/** Economía de cada país: producción por sector y demanda, mes a mes (tarea f15-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  avanzarMes,
  baseParaCrecer,
  CAMPO_SECTOR,
  completarEconomia,
  crecimientoInteranual,
  crecimientoPotencial,
  durezaDe,
  economiaInicial,
  faltaEconomia,
  impulsoEnMes,
  productividadDelPais,
  SECTORES,
  sistemaEconomia,
  type EconomiaPais,
} from '../src/sim/economia';
import { desempaquetar, empaquetar, JUEGO } from '../src/sim/guardado';
import { crearMotor } from '../src/sim/motor';
import {
  completarPresupuesto,
  gastoMinisterio,
  MINISTERIOS,
  sistemaPresupuesto,
} from '../src/sim/presupuesto';
import { completarMercado, sistemaMercado } from '../src/sim/deuda';
import { paisCompleto } from './ayudas/pais-completo';
import { crearPartida, FORMATO_PARTIDA } from '../src/sim/partida';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const jugables = Object.values(paises.paises).filter((p) => p.jugable);
const economiaDe = (id: string): EconomiaPais =>
  economiaInicial(paises.paises[id]!.datos, paises.paises[id]!.nivelRenta)!;
/** Avanza unos años la economía sola y devuelve el crecimiento de cada uno. */
function anios(economia: EconomiaPais, cuantos: number): number[] {
  const crecimientos: number[] = [];
  for (let a = 0; a < cuantos; a++) {
    const antes = economia.pib;
    for (let m = 0; m < 12; m++) avanzarMes(economia);
    crecimientos.push(economia.pib / antes - 1);
  }
  return crecimientos;
}

describe('la economía de 2010 (tarea f15-t2)', () => {
  it('sale de los datos reales: PIB, sectores de la ONU y reparto de la demanda', () => {
    const espana = paises.paises.ESP!.datos;
    const e = economiaDe('ESP');
    expect(e.pib).toBe(espana.pib);
    expect(e.serie).toEqual([Math.round(espana.pib!)]);
    const suma = SECTORES.reduce((total, s) => total + e.sectores[s].valor, 0);
    expect(suma).toBeCloseTo(e.pib, -3);
    // Cada sector pesa lo que dice la ONU (los siete suman 100).
    for (const s of SECTORES) {
      expect((e.sectores[s].valor / e.pib) * 100).toBeCloseTo(espana[CAMPO_SECTOR[s]]!, 1);
    }
    expect(e.demandaBase.consumo * 100).toBeCloseTo(espana.consumoHogaresPib!, 5);
    expect(e.demandaBase.inversion * 100).toBeCloseTo(espana.inversionPib!, 5);
    // Al empezar, lo que podría producir es el PIB sin la brecha de la confianza de 2010 (f16-t1).
    expect(e.pibPotencial * (1 + e.brechaDemanda)).toBeCloseTo(e.pib, -3);
  });

  it('todos los países jugables tienen su economía, con valores válidos', () => {
    for (const pais of jugables) {
      const e = economiaInicial(pais.datos, pais.nivelRenta);
      expect(e, pais.id).not.toBeNull();
      for (const s of SECTORES) {
        const sector = e!.sectores[s];
        for (const valor of [sector.valor, sector.capital, sector.trabajo, sector.productividad]) {
          expect(Number.isFinite(valor) && valor >= 0, `${pais.id} ${s}`).toBe(true);
        }
      }
    }
  });

  it('la productividad crece más en los países que tienen menos renta (convergencia)', () => {
    expect(productividadDelPais(1_000)).toBeGreaterThan(productividadDelPais(10_000));
    expect(productividadDelPais(10_000)).toBeGreaterThan(productividadDelPais(45_000));
    expect(productividadDelPais(80_000)).toBeCloseTo(0.008, 5);
    expect(productividadDelPais(100)).toBeLessThanOrEqual(0.03);
  });
});

describe('cómo evoluciona (tarea f15-t2)', () => {
  it('sin intervención, el PIB de los 20 mayores países evoluciona en rangos creíbles durante 5 años (prueba del GDD)', () => {
    // Ajuste f15-a1: nada mejora solo; España, con su paro y su déficit de 2010, puede encoger.
    const mayores = [...jugables]
      .sort((a, b) => (b.datos.pib ?? 0) - (a.datos.pib ?? 0))
      .slice(0, 20);
    for (const pais of mayores) {
      const e = economiaDe(pais.id);
      const crecimientos = anios(e, 5);
      for (const g of crecimientos) {
        expect(g, pais.id).toBeGreaterThan(-0.05);
        expect(g, pais.id).toBeLessThan(0.12);
      }
      const veces = e.pib / pais.datos.pib!;
      expect(veces, pais.id).toBeGreaterThan(0.95);
      expect(veces, pais.id).toBeLessThan(1.6);
      expect(e.serie, pais.id).toHaveLength(61);
    }
  });

  it('arranca con el crecimiento real de 2010 y se acerca poco a poco al potencial', () => {
    // China creció un 10,6 % en 2010; España, un 0,1 %.
    const china = economiaDe('CHN');
    const [chino1, , , , chino5] = anios(china, 5);
    expect(chino1).toBeGreaterThan(0.09);
    expect(chino5).toBeLessThan(chino1!);
    expect(Math.abs(chino5! - crecimientoPotencial(china))).toBeLessThan(0.02);
    const espana = economiaDe('ESP');
    const [espanol1, , , , espanol5] = anios(espana, 5);
    expect(espanol1).toBeLessThan(0.01);
    expect(espanol5).toBeGreaterThan(espanol1!);
    // El impulso de 2010 se apaga a la mitad cada 18 meses.
    expect(impulsoEnMes({ impulsoInicial: 0.04 }, 18)).toBeCloseTo(0.02, 10);
  });

  it('ningún país se dispara ni se hunde en 10 años; los datos siguen siendo válidos', () => {
    for (const pais of jugables) {
      const e = economiaInicial(pais.datos, pais.nivelRenta)!;
      const crecimientos = anios(e, 10);
      for (const g of crecimientos) {
        expect(g, pais.id).toBeGreaterThan(-0.2);
        expect(g, pais.id).toBeLessThan(0.3);
      }
      expect(crecimientoPotencial(e), pais.id).toBeGreaterThanOrEqual(-0.01);
      expect(crecimientoPotencial(e), pais.id).toBeLessThan(0.1);
      expect(Number.isFinite(e.pib) && e.pib > 0, pais.id).toBe(true);
      expect(crecimientoInteranual(e), pais.id).toBeCloseTo(crecimientos.at(-1)!, 6);
    }
  });

  it('sin azar: la misma partida da siempre la misma economía (decisión del jugador)', () => {
    const una = economiaDe('BRA');
    const otra = economiaDe('BRA');
    anios(una, 3);
    anios(otra, 3);
    expect(una).toEqual(otra);
  });

  it('los sectores cambian de peso: la agricultura pierde peso en un país pobre', () => {
    const e = economiaDe('ETH');
    const peso = () => e.sectores.agricultura.valor / e.pib;
    const antes = peso();
    anios(e, 10);
    expect(peso()).toBeLessThan(antes);
  });
});

describe('nada mejora solo: si se hace mal, empeora (ajuste f15-a1)', () => {
  it('sin base para crecer (alfabetización, electricidad, internet, educación), la productividad apenas crece', () => {
    expect(productividadDelPais(1_000, 0.3)).toBeLessThan(productividadDelPais(1_000, 1) / 2);
    expect(productividadDelPais(1_000, 0)).toBeGreaterThanOrEqual(0);
    const base = (id: string) => baseParaCrecer(paises.paises[id]!.datos);
    expect(base('TCD')).toBeLessThan(0.4);
    expect(base('DEU')).toBeGreaterThan(0.95);
    // Chad, más pobre que la India, crece menos en productividad: le falta base.
    expect(economiaDe('TCD').crecimientoProductividad).toBeLessThan(
      economiaDe('IND').crecimientoProductividad,
    );
  });

  it('Grecia, sin hacer nada, se hunde tres años seguidos y en diez no recupera su PIB de 2010', () => {
    // Real: −5,5 %, −10,1 %, −7,1 % y −2,7 % en 2010–2013 (−23 % en total). Con su presupuesto y
    // el mercado de su deuda: el crédito se encarece, los mercados se cierran y deja de pagar
    // (Fase 18).
    const grecia = paisCompleto(paises, 'GRC');
    const crecimientos = grecia.anios(3);
    for (const g of crecimientos) expect(g).toBeLessThan(0);
    expect(grecia.economia.pib / paises.paises.GRC!.datos.pib!).toBeLessThan(0.8);
    grecia.anios(7);
    expect(grecia.economia.pib).toBeLessThan(paises.paises.GRC!.datos.pib!);
  });

  it('sin hacer nada, la prima de Grecia se dispara: crédito caro, confianza hundida y, al cerrarse los mercados, el impago con sus recortes (Fase 18)', () => {
    const grecia = paisCompleto(paises, 'GRC');
    const gasto = grecia.economia.demandaBase.consumoPublico;
    const inversion = grecia.economia.demanda.inversion;
    const prima = grecia.mercado.prima;
    // El diagnóstico de 2010: muy desequilibrada (déficit del 11,4 %: sobra lo que pasa del 3 %).
    expect(grecia.economia.desequilibrio.intensidad).toBeGreaterThan(1.5);
    expect(grecia.economia.desequilibrio.ajustePendiente).toBeCloseTo(0.084, 3);
    // Nada se recorta solo: el primer año el gasto en dinero no cambia (con la inflación pesa algo
    // menos)…
    const ministerios = () =>
      MINISTERIOS.reduce((t, m) => t + gastoMinisterio(grecia.presupuesto, m), 0);
    const enDinero = ministerios();
    grecia.avanzar(11);
    expect(ministerios()).toBeCloseTo(enDinero, 0);
    expect(grecia.economia.demandaBase.consumoPublico).toBeLessThan(gasto);
    // (Con la inflación de Grecia, del 4,7 %, pesa algo más de un punto menos.)
    expect(grecia.economia.demandaBase.consumoPublico).toBeGreaterThan(gasto - 0.02);
    grecia.avanzar(1);
    // … pero la prima sube y el crédito se encarece: se invierte menos y cae la confianza.
    expect(grecia.mercado.prima).toBeGreaterThan(prima + 2);
    expect(grecia.economia.demanda.inversion).toBeLessThan(inversion * 0.9);
    expect(grecia.economia.confianzaEmpresas).toBeLessThan(85);
    // Al cerrarse los mercados, con una deuda impagable, deja de pagar y tiene que recortar.
    grecia.avanzar(24);
    expect(grecia.mercado.programa?.tipo).toBe('impago');
    expect(grecia.mercado.rating).toBe('D');
    expect(grecia.economia.demandaBase.consumoPublico).toBeLessThan(gasto - 0.02);
  });

  it('un país sano no entra en crisis ni recorta: su gobierno sube el gasto con la economía (China)', () => {
    const china = paisCompleto(paises, 'CHN');
    const gasto = china.economia.demandaBase.consumoPublico;
    const ministerios = () =>
      MINISTERIOS.reduce((t, m) => t + gastoMinisterio(china.presupuesto, m), 0);
    const enDinero = ministerios();
    expect(china.economia.desequilibrio.intensidad).toBeLessThan(0.05);
    china.anios(3);
    expect(china.mercado.programa).toBeNull();
    expect(china.mercado.cerrado).toBe(false);
    expect(ministerios()).toBeGreaterThan(enDinero * 1.3);
    // Mantiene su peso (en diente de sierra: sube cada enero y, con la economía creciendo un 10 %
    // al año, pesa algo menos hasta el siguiente).
    expect(Math.abs(china.economia.demandaBase.consumoPublico - gasto)).toBeLessThan(0.025);
  });

  it('si se invierte menos, hay menos capital y menos PIB', () => {
    const normal = economiaDe('FRA');
    const menos = economiaDe('FRA');
    menos.demandaBase.inversion -= 0.05;
    anios(normal, 5);
    anios(menos, 5);
    const capital = (e: EconomiaPais) => SECTORES.reduce((t, s) => t + e.sectores[s].capital, 0);
    expect(capital(menos)).toBeLessThan(capital(normal));
    expect(menos.pib).toBeLessThan(normal.pib);
  });

  it('si el Estado recorta su gasto, el PIB cae a corto plazo', () => {
    const normal = economiaDe('DEU');
    const recorte = economiaDe('DEU');
    recorte.demandaBase.consumoPublico -= 0.03;
    anios(normal, 1);
    anios(recorte, 1);
    expect(recorte.pib).toBeLessThan(normal.pib * 0.99);
  });

  it('sin intervención, varios países encogen en 5 años', () => {
    const encogen = jugables.filter((pais) => {
      const completo = paisCompleto(paises, pais.id);
      completo.anios(5);
      return completo.economia.pib < pais.datos.pib!;
    });
    // (Portugal también, en la partida, con el contagio de Grecia: tests/mercado-deuda.test.ts.)
    expect(encogen.map((p) => p.id)).toContain('GRC');
    expect(encogen.length).toBeGreaterThanOrEqual(5);
  });

  it('según la dificultad: en realista, la prima pesa más en el crédito que en fácil', () => {
    expect(durezaDe('realista')).toBe(1);
    expect(durezaDe('facil')).toBeLessThan(durezaDe('normal'));
    expect(durezaDe('normal')).toBeLessThan(1);
    const griegaRealista = paisCompleto(paises, 'GRC', 1);
    const griegaFacil = paisCompleto(paises, 'GRC', durezaDe('facil'));
    griegaRealista.avanzar(36);
    griegaFacil.avanzar(36);
    expect(griegaRealista.economia.pib).toBeLessThan(griegaFacil.economia.pib * 0.99);
  });
});

describe('en la partida (tarea f15-t2)', () => {
  const nueva = () =>
    crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 3 },
      paises.paises,
    );

  it('cada país empieza con su economía y el motor la avanza cada mes', () => {
    const motor = crearMotor({ sistemas: [sistemaEconomia] });
    motor.atender({ tipo: 'empezar', partida: nueva(), pausaAutomatica: false });
    const inicio = motor.partida!.paises.ESP!.economia!.pib;
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    while (motor.partida!.fecha < '2011-01-01') motor.avanzar(250);
    const espana = motor.partida!.paises.ESP!.economia!;
    expect(espana.meses).toBe(12);
    expect(espana.serie).toHaveLength(13);
    expect(espana.pib).not.toBe(inicio);
    expect(crecimientoInteranual(espana)).not.toBeNull();
    // Todos los países a la vez.
    expect(motor.partida!.paises.CHN!.economia!.meses).toBe(12);
  });

  it('se guarda y se carga con la partida', () => {
    const partida = nueva();
    for (let m = 0; m < 6; m++) avanzarMes(partida.paises.FRA!.economia!);
    const { archivo } = empaquetar(partida, { tipo: 'anual' }, '0.16.0', new Date());
    expect(desempaquetar(JSON.parse(JSON.stringify(archivo))).partida).toEqual(partida);
  });

  it('una partida guardada antes de la Fase 15 (formato 2) se migra y recibe su economía de 2010', () => {
    const partida = nueva();
    const antigua: Record<string, unknown> = {
      ...structuredClone(partida),
      formato: 2,
      paises: Object.fromEntries(
        Object.entries(partida.paises).map(([id, { tesoreria, popularidad }]) => [
          id,
          { tesoreria, popularidad },
        ]),
      ),
    };
    const cargada = desempaquetar({
      juego: JUEGO,
      formato: 2,
      version: '0.15.1',
      partida: antigua,
    }).partida;
    expect(cargada.formato).toBe(FORMATO_PARTIDA);
    expect(faltaEconomia(cargada)).toBe(true);
    completarEconomia(cargada, paises.paises);
    expect(faltaEconomia(cargada)).toBe(false);
    // (Y su presupuesto y el mercado de su deuda, como al cargarla en la pantalla: Fases 17 y 18.)
    completarPresupuesto(cargada, paises.paises);
    completarMercado(cargada, paises.paises);
    expect(cargada).toEqual(partida);
  });

  it('el motor aplica la dureza de la dificultad de la partida (con el mercado de la deuda, Fase 18)', () => {
    const pibGrecia = (dificultad: 'facil' | 'realista') => {
      const motor = crearMotor({
        sistemas: [sistemaEconomia, sistemaPresupuesto, sistemaMercado],
      });
      const partida = crearPartida(
        { paisId: 'ESP', dificultad, eventosHistoricos: true, semilla: 3 },
        paises.paises,
      );
      motor.atender({ tipo: 'empezar', partida, pausaAutomatica: false });
      motor.atender({ tipo: 'velocidad', velocidad: 64 });
      while (motor.partida!.fecha < '2012-01-01') motor.avanzar(250);
      return motor.partida!.paises.GRC!.economia!.pib;
    };
    expect(pibGrecia('realista')).toBeLessThan(pibGrecia('facil'));
  });

  it('una partida de la v0.16.0 (formato 3) se migra y recibe los desequilibrios de 2010 (ajuste f15-a1)', () => {
    const partida = nueva();
    const antigua = structuredClone(partida) as unknown as {
      formato: number;
      paises: Record<string, { economia: Record<string, unknown> | null }>;
    };
    antigua.formato = 3;
    for (const estado of Object.values(antigua.paises)) {
      if (!estado.economia) continue;
      // Como se guardaba en la v0.16.0: la demanda de base era la de los datos, y aún no había
      // desequilibrios, paro ni inflación.
      estado.economia.demandaBase = { ...(estado.economia.demandaReferencia as object) };
      for (const campo of [
        'desequilibrio',
        'demandaReferencia',
        'paro',
        'paroEstructural',
        'sensibilidadParo',
        'brechaAsumida',
        'serieParo',
        'inflacion',
        'inflacionEsperada',
        'nivelPrecios',
        'serieInflacion',
      ]) {
        delete estado.economia[campo];
      }
      estado.economia.crecimientoProductividad = 0.01;
    }
    const cargada = desempaquetar({
      juego: JUEGO,
      formato: 3,
      version: '0.16.0',
      partida: antigua,
    }).partida;
    expect(cargada.formato).toBe(FORMATO_PARTIDA);
    expect(faltaEconomia(cargada)).toBe(true);
    completarEconomia(cargada, paises.paises);
    expect(faltaEconomia(cargada)).toBe(false);
    // (Sin salto: la brecha de ahora se toma como asumida.)
    for (const estado of Object.values(cargada.paises)) {
      if (estado.economia) estado.economia.brechaAsumida = 0;
    }
    expect(cargada).toEqual(partida);
  });
});
