/** Hacienda: el presupuesto en dinero, fijo hasta que se decida (tarea f19-t1). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import config from '../src/sim/config/presupuesto.json';
import { completarMercado, sistemaMercado, UMBRAL_CIERRE } from '../src/sim/deuda';
import { completarEconomia, pibNominal, sistemaEconomia } from '../src/sim/economia';
import { desempaquetar, JUEGO } from '../src/sim/guardado';
import {
  aprobarPresupuesto,
  fechaDelMes,
  presupuestoDeLaIa,
  presupuestoEnVigor,
  sistemaHacienda,
  type PresupuestoDecidido,
} from '../src/sim/hacienda';
import { crearMotor } from '../src/sim/motor';
import { crearPartida, FORMATO_PARTIDA } from '../src/sim/partida';
import {
  completarPresupuesto,
  faltaPresupuesto,
  gastoMinisterio,
  MINISTERIOS,
  PARTIDAS,
  saldo,
  sistemaPresupuesto,
  type PresupuestoPais,
} from '../src/sim/presupuesto';
import { paisCompleto } from './ayudas/pais-completo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const h = config.hacienda;

const ministerios = (p: PresupuestoPais) =>
  MINISTERIOS.reduce((t, m) => t + gastoMinisterio(p, m), 0);
/** El presupuesto en vigor con todo el gasto de los ministerios por `factor`. */
const conFactor = (p: PresupuestoPais, factor: number): PresupuestoDecidido => {
  const decidido = presupuestoEnVigor(p);
  for (const m of MINISTERIOS) for (const x of PARTIDAS) decidido.ministerios[m][x] *= factor;
  return decidido;
};
/** Un país del jugador al que se le aplica `decidido` el primer mes. */
const delJugador = (id: string, decidir?: (p: PresupuestoPais) => PresupuestoDecidido) => {
  const pais = paisCompleto(paises, id, 1, { jugador: true });
  if (decidir) aprobarPresupuesto(pais.presupuesto, decidir(pais.presupuesto), 2010);
  return pais;
};
const deficit = (p: ReturnType<typeof paisCompleto>) =>
  -saldo(p.presupuesto) / pibNominal(p.economia);
const deudaPib = (p: ReturnType<typeof paisCompleto>) =>
  p.presupuesto.deuda / pibNominal(p.economia);

describe('el presupuesto en dinero (tarea f19-t1)', () => {
  it('el gasto de los ministerios no cambia hasta que se decide otro (ni crece con la economía)', () => {
    const espana = delJugador('ESP');
    const gasto = ministerios(espana.presupuesto);
    espana.avanzar(30);
    expect(ministerios(espana.presupuesto)).toBeCloseTo(gasto, 0);
    // Sin presupuesto nuevo, el de 2010 se prorroga.
    expect(espana.presupuesto.aprobado).toEqual({ anio: 2010, prorrogado: true });
  });

  it('la prestación por parado es dinero por cada parado (población activa estimada)', () => {
    const { presupuesto, economia } = paisCompleto(paises, 'ESP');
    // España 2010: unos 23 millones de activos (real: 23,1) y 4,6 millones de parados.
    expect(presupuesto.activos).toBeGreaterThan(20e6);
    expect(presupuesto.activos).toBeLessThan(26e6);
    expect(presupuesto.prestacionParado).toBeGreaterThan(4_000);
    expect(presupuesto.prestacionParado).toBeLessThan(20_000);
    expect(presupuesto.transversales.desempleo).toBeCloseTo(
      presupuesto.prestacionParado * economia.paro * presupuesto.activos,
      -3,
    );
  });

  it('las pensiones suben cada enero el IPC (por defecto) o lo que se decida', () => {
    const porDefecto = delJugador('ESP');
    const congeladas = delJugador('ESP', (p) => ({ ...presupuestoEnVigor(p), revalorizacion: 0 }));
    for (const p of [porDefecto, congeladas]) p.avanzar(11);
    const diciembre = porDefecto.presupuesto.transversales.pensiones;
    const diciembreCongeladas = congeladas.presupuesto.transversales.pensiones;
    for (const p of [porDefecto, congeladas]) p.avanzar(1);
    expect(fechaDelMes(porDefecto.economia.meses)).toBe('2011-01-01');
    // (El IPC de enero: la inflación al ritmo de un año.)
    const ipc = porDefecto.economia.inflacion;
    expect(ipc).toBeGreaterThan(0);
    const envejecimiento = Math.pow(1 + config.evolucion.envejecimiento.alto, 1 / 12);
    expect(porDefecto.presupuesto.transversales.pensiones / diciembre).toBeCloseTo(
      envejecimiento * (1 + ipc),
      6,
    );
    expect(congeladas.presupuesto.transversales.pensiones / diciembreCongeladas).toBeCloseTo(
      envejecimiento,
      6,
    );
  });
});

describe('si se hace mal, empeora (tarea f19-t1)', () => {
  it('con la inflación, un gasto congelado compra menos: el consumo público pesa menos', () => {
    // Brasil (inflación del 5 %): el jugador lo deja como está; la IA lo sube con la economía.
    const congelado = delJugador('BRA');
    const ia = paisCompleto(paises, 'BRA');
    const peso = congelado.economia.demandaBase.consumoPublico;
    congelado.avanzar(36);
    ia.avanzar(36);
    expect(congelado.economia.demandaBase.consumoPublico).toBeLessThan(peso * 0.85);
    expect(congelado.economia.demandaBase.consumoPublico).toBeLessThan(
      ia.economia.demandaBase.consumoPublico,
    );
    // Gasta menos: menos demanda y menos PIB.
    expect(congelado.economia.pib).toBeLessThan(ia.economia.pib);
  });

  it('recortar baja la demanda y sube el paro', () => {
    const igual = delJugador('DEU');
    const recorte = delJugador('DEU', (p) => conFactor(p, 0.85));
    igual.avanzar(12);
    recorte.avanzar(12);
    expect(recorte.economia.pib).toBeLessThan(igual.economia.pib * 0.99);
    expect(recorte.economia.paro).toBeGreaterThan(igual.economia.paro + 0.003);
    // (Y el déficit, más bajo.)
    expect(deficit(recorte)).toBeLessThan(deficit(igual) - 0.02);
  });

  it('gastar más sin ingresos sube la deuda y la prima', () => {
    const igual = delJugador('ESP');
    const gasto = delJugador('ESP', (p) => conFactor(p, 1.25));
    igual.avanzar(36);
    gasto.avanzar(36);
    // (Unos 9 puntos más en tres años: el gasto también sube el PIB y la recaudación.)
    expect(deudaPib(gasto)).toBeGreaterThan(deudaPib(igual) + 0.06);
    expect(gasto.mercado.prima).toBeGreaterThan(igual.mercado.prima);
  });

  it('subir las pensiones por encima del IPC sube el consumo y el déficit', () => {
    const ipc = delJugador('FRA');
    const mas = delJugador('FRA', (p) => ({ ...presupuestoEnVigor(p), revalorizacion: 0.1 }));
    ipc.avanzar(14);
    mas.avanzar(14);
    expect(mas.economia.demandaBase.consumo).toBeGreaterThan(ipc.economia.demandaBase.consumo);
    expect(deficit(mas)).toBeGreaterThan(deficit(ipc) + 0.005);
  });
});

describe('los presupuestos de la IA (tarea f19-t1)', () => {
  const factorDe = (id: string, cambiar?: (p: ReturnType<typeof paisCompleto>) => void) => {
    const pais = paisCompleto(paises, id);
    cambiar?.(pais);
    const decidido = presupuestoDeLaIa(pais.presupuesto, pais.economia, pais.mercado);
    return {
      factor: decidido.ministerios.sanidad.personal / pais.presupuesto.ministerios.sanidad.personal,
      decidido,
      pais,
    };
  };

  it('con la prima cerca del cierre de los mercados, recorta y congela las pensiones', () => {
    const { factor, decidido } = factorDe('ITA', (p) => {
      p.mercado.prima = UMBRAL_CIERRE * h.ia.cercaDelCierre + 0.1;
    });
    expect(factor).toBeCloseTo(1 - h.ia.recorte, 6);
    expect(decidido.revalorizacion).toBe(0);
  });

  it('con un déficit alto, congela; moderado, sube con la inflación; con margen, con la economía; con superávit, algo más', () => {
    // Grecia (déficit del 11 %): congela.
    expect(factorDe('GRC').factor).toBeCloseTo(1, 6);
    // Alemania (4,2 %): con la inflación.
    const alemania = factorDe('DEU');
    expect(deficit(alemania.pais)).toBeGreaterThan(h.ia.deficitMargen);
    expect(alemania.factor).toBeCloseTo(1 + Math.max(0, alemania.pais.economia.inflacion), 6);
    // China (con margen): con la economía, más que la inflación.
    const china = factorDe('CHN');
    expect(china.factor).toBeGreaterThan(1 + china.pais.economia.inflacion + 0.02);
    // Noruega (superávit): con la economía y algo más.
    const noruega = factorDe('NOR');
    expect(deficit(noruega.pais)).toBeLessThan(0);
    expect(noruega.factor).toBeGreaterThan(
      1 + noruega.pais.economia.inflacion + h.ia.extraSuperavit,
    );
    // Nunca bajan la prestación por parado (si no recortan).
    expect(china.decidido.prestacionParado).toBeGreaterThanOrEqual(
      china.pais.presupuesto.prestacionParado,
    );
  });

  it('la IA aprueba su presupuesto cada enero (y no se prorroga)', () => {
    const china = paisCompleto(paises, 'CHN');
    const gasto = ministerios(china.presupuesto);
    china.avanzar(11);
    expect(ministerios(china.presupuesto)).toBeCloseTo(gasto, 0);
    china.avanzar(1);
    expect(ministerios(china.presupuesto)).toBeGreaterThan(gasto * 1.05);
    expect(china.presupuesto.aprobado).toEqual({ anio: 2011, prorrogado: false });
  });
});

describe('el jugador decide (tarea f19-t1)', () => {
  it('lo que manda al motor vale desde el mes siguiente', () => {
    const motor = crearMotor({
      sistemas: [sistemaEconomia, sistemaPresupuesto, sistemaMercado, sistemaHacienda],
    });
    const partida = crearPartida(
      { paisId: 'ESP', dificultad: 'realista', eventosHistoricos: true, semilla: 4 },
      paises.paises,
    );
    motor.atender({ tipo: 'empezar', partida, pausaAutomatica: false });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    while (motor.partida!.fecha < '2010-03-15') motor.avanzar(250);
    const espana = () => motor.partida!.paises.ESP!.presupuesto!;
    const educacion = gastoMinisterio(espana(), 'educacion');
    const decidido = presupuestoEnVigor(espana());
    for (const x of PARTIDAS) decidido.ministerios.educacion[x] *= 1.2;
    decidido.revalorizacion = 0.01;
    motor.atender({ tipo: 'presupuesto', presupuesto: decidido });
    // Aún no: hasta el día 1.
    expect(gastoMinisterio(espana(), 'educacion')).toBeCloseTo(educacion, 0);
    while (motor.partida!.fecha < '2010-04-02') motor.avanzar(250);
    expect(gastoMinisterio(espana(), 'educacion')).toBeCloseTo(educacion * 1.2, -3);
    expect(espana().revalorizacion).toBe(0.01);
    expect(espana().aprobado).toEqual({ anio: 2010, prorrogado: false });
    expect(motor.partida!.presupuestoDecidido).toBeUndefined();
    // (Y no cambia el presupuesto de los demás países.)
  });

  it('lo que no tiene sentido no se aplica: cantidades negativas o subidas de las pensiones desorbitadas', () => {
    const { presupuesto } = paisCompleto(paises, 'ESP');
    const antes = presupuesto.ministerios.defensa.personal;
    const decidido = presupuestoEnVigor(presupuesto);
    decidido.ministerios.defensa.personal = -5;
    decidido.revalorizacion = 3;
    decidido.prestacionParado = Number.NaN;
    const prestacion = presupuesto.prestacionParado;
    aprobarPresupuesto(presupuesto, decidido, 2010);
    expect(presupuesto.ministerios.defensa.personal).toBe(antes);
    expect(presupuesto.revalorizacion).toBe(0.2);
    expect(presupuesto.prestacionParado).toBe(prestacion);
  });
});

describe('partidas guardadas (tarea f19-t1)', () => {
  it('una partida de la v0.19.0 (formato 7) se migra y recibe el presupuesto en dinero, sin saltos', () => {
    const partida = crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 9 },
      paises.paises,
    );
    const antigua = structuredClone(partida) as unknown as {
      paises: Record<string, { presupuesto: Record<string, unknown> | null }>;
    };
    for (const estado of Object.values(antigua.paises)) {
      const p = estado.presupuesto;
      if (!p) continue;
      for (const campo of [
        'activos',
        'prestacionParado',
        'revalorizacion',
        'aprobado',
        'referencia',
      ]) {
        delete p[campo];
      }
      p.porParado = 0.1;
      p.potencialVisto = 1;
    }
    const cargada = desempaquetar({
      juego: JUEGO,
      formato: 7,
      version: '0.19.0',
      partida: { ...antigua, formato: 7 },
    }).partida;
    expect(cargada.formato).toBe(FORMATO_PARTIDA);
    expect(faltaPresupuesto(cargada)).toBe(true);
    completarEconomia(cargada, paises.paises);
    completarPresupuesto(cargada, paises.paises);
    completarMercado(cargada, paises.paises);
    expect(faltaPresupuesto(cargada)).toBe(false);
    // Lo mismo que una partida nueva (al empezar, la referencia es la de 2010).
    expect(cargada).toEqual(partida);
  });
});
