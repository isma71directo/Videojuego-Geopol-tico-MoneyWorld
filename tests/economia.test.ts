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
import { crearPartida, FORMATO_PARTIDA } from '../src/sim/partida';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const jugables = Object.values(paises.paises).filter((p) => p.jugable);
const economiaDe = (id: string): EconomiaPais =>
  economiaInicial(paises.paises[id]!.datos, paises.paises[id]!.nivelRenta)!;
/** Avanza unos años (en «realista», si no se dice) y devuelve el crecimiento de cada uno. */
function anios(economia: EconomiaPais, cuantos: number, dureza = 1): number[] {
  const crecimientos: number[] = [];
  for (let a = 0; a < cuantos; a++) {
    const antes = economia.pib;
    for (let m = 0; m < 12; m++) avanzarMes(economia, dureza);
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

  it('Grecia, sin hacer nada, se hunde cuatro años seguidos y en diez no recupera su PIB de 2010', () => {
    // Real: −5,5 %, −10,1 %, −7,1 % y −2,7 % en 2010–2013 (−23 % en total).
    const grecia = economiaDe('GRC');
    const crecimientos = anios(grecia, 4);
    for (const g of crecimientos) expect(g).toBeLessThan(0);
    expect(grecia.pib / paises.paises.GRC!.datos.pib!).toBeLessThan(0.85);
    anios(grecia, 6);
    expect(grecia.pib).toBeLessThan(paises.paises.GRC!.datos.pib!);
  });

  it('los desequilibrios de 2010 fuerzan un ajuste: recorte del gasto, menos crédito y menos confianza', () => {
    const grecia = economiaDe('GRC');
    const gasto = grecia.demandaBase.consumoPublico;
    const pendiente = grecia.desequilibrio.ajustePendiente;
    expect(grecia.desequilibrio.intensidad).toBeGreaterThan(1.5);
    // Déficit de 2010 del 11,4 %: hay que cerrar lo que pasa del 3 %.
    expect(pendiente).toBeCloseTo(0.084, 3);
    anios(grecia, 2);
    expect(grecia.demandaBase.consumoPublico).toBeLessThan(gasto - 0.02);
    expect(grecia.desequilibrio.ajustePendiente).toBeLessThan(pendiente);
    expect(grecia.desequilibrio.creditoPerdido).toBeGreaterThan(0.03);
    expect(grecia.confianzaEmpresas).toBeLessThan(85);
    // Cerrado el déficit, el crédito vuelve poco a poco (a la mitad cada 3 años).
    anios(grecia, 8);
    expect(grecia.desequilibrio.ajustePendiente).toBe(0);
    const credito = grecia.desequilibrio.creditoPerdido;
    anios(grecia, 3);
    expect(grecia.desequilibrio.creditoPerdido).toBeCloseTo(credito / 2, 3);
  });

  it('un país sin desequilibrios no sufre ese ajuste', () => {
    const china = economiaDe('CHN');
    expect(china.desequilibrio.intensidad).toBeLessThan(0.05);
    anios(china, 3);
    expect(china.desequilibrio.creditoPerdido).toBeLessThan(0.001);
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
      const e = economiaInicial(pais.datos, pais.nivelRenta)!;
      anios(e, 5);
      return e.pib < pais.datos.pib!;
    });
    expect(encogen.map((p) => p.id)).toEqual(expect.arrayContaining(['GRC', 'PRT', 'ISL']));
    expect(encogen.length).toBeGreaterThanOrEqual(5);
  });

  it('según la dificultad: en realista es más duro que en fácil, y el ajuste dura lo mismo', () => {
    expect(durezaDe('realista')).toBe(1);
    expect(durezaDe('facil')).toBeLessThan(durezaDe('normal'));
    expect(durezaDe('normal')).toBeLessThan(1);
    const realista = economiaDe('GRC');
    const facil = economiaDe('GRC');
    const fin = (e: EconomiaPais, dureza: number) => {
      let mes = 0;
      while (e.desequilibrio.ajustePendiente > 0 && mes < 240) {
        avanzarMes(e, dureza);
        mes++;
      }
      return mes;
    };
    expect(fin(realista, 1)).toBe(fin(facil, durezaDe('facil')));
    expect(realista.pib).toBeLessThan(facil.pib * 0.95);
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
    expect(cargada).toEqual(partida);
  });

  it('el motor aplica la dureza de la dificultad de la partida (ajuste f15-a1)', () => {
    const pibGrecia = (dificultad: 'facil' | 'realista') => {
      const motor = crearMotor({ sistemas: [sistemaEconomia] });
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
      delete estado.economia.desequilibrio;
      delete estado.economia.demandaReferencia;
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
    expect(cargada).toEqual(partida);
  });
});
