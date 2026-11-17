/** Economía de cada país: producción por sector y demanda, mes a mes (tarea f15-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  avanzarMes,
  CAMPO_SECTOR,
  completarEconomia,
  crecimientoInteranual,
  crecimientoPotencial,
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
/** Avanza unos meses y devuelve el crecimiento de cada año. */
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
    expect(e.demanda.consumo * 100).toBeCloseTo(espana.consumoHogaresPib!, 5);
    expect(e.demanda.inversion * 100).toBeCloseTo(espana.inversionPib!, 5);
    // Al empezar, la producción potencial de cada sector es lo que produce de verdad.
    expect(e.pibPotencial).toBe(e.pib);
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
    expect(productividadDelPais(100)).toBeLessThanOrEqual(0.028);
  });
});

describe('cómo evoluciona (tarea f15-t2)', () => {
  it('sin intervención, el PIB de los 20 mayores países evoluciona en rangos creíbles durante 5 años (prueba del GDD)', () => {
    const mayores = [...jugables]
      .sort((a, b) => (b.datos.pib ?? 0) - (a.datos.pib ?? 0))
      .slice(0, 20);
    for (const pais of mayores) {
      const e = economiaDe(pais.id);
      const crecimientos = anios(e, 5);
      for (const g of crecimientos) {
        expect(g, pais.id).toBeGreaterThan(-0.03);
        expect(g, pais.id).toBeLessThan(0.12);
      }
      const veces = e.pib / pais.datos.pib!;
      expect(veces, pais.id).toBeGreaterThan(1.02);
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
});
