/** Azar de la partida (tarea f12-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { azarDesde, crearAzar, semillaNueva, type Azar } from '../src/sim/azar';
import { crearMotor } from '../src/sim/motor';
import { crearPartida } from '../src/sim/partida';

const serie = (azar: Azar, n = 20): number[] => Array.from({ length: n }, () => azar.siguiente());

describe('generador del azar (tarea f12-t2)', () => {
  it('con la misma semilla, siempre la misma serie (para los tests y para reproducir fallos)', () => {
    expect(serie(crearAzar(12345))).toEqual(serie(crearAzar(12345)));
    // Semillas vecinas dan series que no se parecen en nada.
    const a = serie(crearAzar(1));
    const b = serie(crearAzar(2));
    expect(a.filter((x, i) => Math.abs(x - b[i]!) < 0.01).length).toBeLessThan(3);
  });

  it('dos partidas nuevas tienen azares distintos', () => {
    const series = new Set<string>();
    for (let i = 0; i < 20; i++) series.add(serie(crearAzar(semillaNueva()), 5).join());
    expect(series.size).toBe(20);
  });

  it('los números se reparten por igual entre 0 y 1', () => {
    const azar = crearAzar(2010);
    const cajas = new Array<number>(10).fill(0);
    const n = 100_000;
    let suma = 0;
    for (let i = 0; i < n; i++) {
      const x = azar.siguiente();
      expect(x >= 0 && x < 1).toBe(true);
      cajas[Math.floor(x * 10)]!++;
      suma += x;
    }
    // Cada décima, un 10 % (± 0,5 puntos); la media, 0,5.
    for (const caja of cajas) expect(Math.abs(caja / n - 0.1)).toBeLessThan(0.005);
    expect(suma / n).toBeCloseTo(0.5, 2);
  });

  it('enteros, probabilidades, elegir, barajar y la campana', () => {
    const azar = crearAzar(7);
    const vistos = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const n = azar.entero(1, 6);
      expect(n >= 1 && n <= 6 && Number.isInteger(n)).toBe(true);
      vistos.add(n);
    }
    expect([...vistos].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(() => azar.entero(5, 4)).toThrow(/vacío/);
    let si = 0;
    for (let i = 0; i < 20_000; i++) if (azar.probabilidad(0.3)) si++;
    expect(si / 20_000).toBeCloseTo(0.3, 1);
    expect(['a', 'b', 'c']).toContain(azar.elegir(['a', 'b', 'c']));
    expect(() => azar.elegir([])).toThrow(/vacía/);
    const lista = Array.from({ length: 50 }, (_, i) => i);
    const barajada = azar.barajar(lista);
    expect([...barajada].sort((x, y) => x - y)).toEqual(lista);
    expect(barajada).not.toEqual(lista);
    const normales = Array.from({ length: 20_000 }, () => azar.normal(10, 2));
    const media = normales.reduce((s, x) => s + x, 0) / normales.length;
    const desviacion = Math.sqrt(
      normales.reduce((s, x) => s + (x - media) ** 2, 0) / normales.length,
    );
    expect(media).toBeCloseTo(10, 1);
    expect(desviacion).toBeCloseTo(2, 1);
  });

  it('el estado permite seguir la misma serie en otro sitio', () => {
    const azar = crearAzar(99);
    serie(azar, 7);
    const copia = azarDesde(azar.estado());
    expect(serie(copia)).toEqual(serie(azar));
    // Un estado todo a cero no deja el generador atascado.
    const cero = azarDesde([0, 0, 0, 0]);
    expect(new Set(serie(cero)).size).toBe(20);
  });
});

describe('el motor usa el azar de cada partida (tarea f12-t2)', () => {
  const paises = JSON.parse(
    readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
  ) as ConjuntoPaises;
  /** Lo que «sortea» un sistema de prueba durante un mes de juego. */
  const sorteos = (semilla: number): number[] => {
    const tiradas: number[] = [];
    const motor = crearMotor({
      sistemas: [(pasos, _partida, azar) => pasos.forEach(() => tiradas.push(azar.entero(0, 99)))],
    });
    motor.atender({
      tipo: 'empezar',
      partida: crearPartida(
        { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla },
        paises.paises,
      ),
    });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    for (let i = 0; i < 2400; i++) motor.avanzar(10);
    return tiradas;
  };

  it('con la semilla fija de un test, el motor da siempre lo mismo', () => {
    const una = sorteos(4242);
    expect(una.length).toBeGreaterThan(30);
    expect(sorteos(4242)).toEqual(una);
  });

  it('dos partidas nuevas no se desarrollan igual', () => {
    expect(sorteos(semillaNueva())).not.toEqual(sorteos(semillaNueva()));
  });
});
