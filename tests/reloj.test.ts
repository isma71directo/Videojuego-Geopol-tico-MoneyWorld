/** Reloj del juego por horas (tarea f11-t1). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import config from '../src/sim/config/tiempo.json';
import { avanzarPartida, crearPartida, FECHA_INICIO, HORA_INICIO } from '../src/sim/partida';
import {
  avanzarHoras,
  diaDeLaSemana,
  EMPIEZA_EN_PAUSA,
  horaAbsoluta,
  horasQueTocan,
  momentoDe,
  msPorHora,
  pasosDelDia,
  velocidadVecina,
  VELOCIDADES,
  type Paso,
  type Ritmo,
} from '../src/sim/reloj';

const inicio = { fecha: '2010-01-01', hora: 0 };
const cuenta = (pasos: Paso[]): Record<Ritmo, number> => {
  const total = { diario: 0, semanal: 0, mensual: 0, anual: 0 };
  for (const paso of pasos) total[paso.ritmo]++;
  return total;
};

describe('calendario del reloj (tarea f11-t1)', () => {
  it('un año de juego: 365 pasos diarios, 52 semanales, 12 mensuales y 1 anual (prueba del GDD)', () => {
    const { momento, pasos } = avanzarHoras(inicio, 365 * 24);
    expect(momento).toEqual({ fecha: '2011-01-01', hora: 0 });
    expect(cuenta(pasos)).toEqual({ diario: 365, semanal: 52, mensual: 12, anual: 1 });
  });

  it('el mismo año, hora a hora o de golpe, da los mismos pasos en el mismo orden', () => {
    let momento = inicio;
    const pasos: Paso[] = [];
    for (let i = 0; i < 365 * 24; i++) {
      const paso = avanzarHoras(momento, 1);
      momento = paso.momento;
      pasos.push(...paso.pasos);
    }
    expect(momento).toEqual({ fecha: '2011-01-01', hora: 0 });
    expect(pasos).toEqual(avanzarHoras(inicio, 365 * 24).pasos);
  });

  it('un día tiene 24 horas: el paso diario llega justo a medianoche', () => {
    expect(avanzarHoras(inicio, 23)).toEqual({
      momento: { fecha: '2010-01-01', hora: 23 },
      pasos: [],
    });
    expect(avanzarHoras(inicio, 24).pasos).toEqual([{ ritmo: 'diario', fecha: '2010-01-02' }]);
    expect(avanzarHoras({ fecha: '2010-01-01', hora: 23 }, 1).momento).toEqual({
      fecha: '2010-01-02',
      hora: 0,
    });
    expect(avanzarHoras(inicio, 0)).toEqual({ momento: inicio, pasos: [] });
  });

  it('lunes, día 1 y 1 de enero; 2012 es bisiesto', () => {
    // El 1 de enero de 2010 fue viernes y el 4, lunes.
    expect(diaDeLaSemana('2010-01-01')).toBe(4);
    expect(diaDeLaSemana('2010-01-04')).toBe(0);
    expect(pasosDelDia('2010-01-04').map((p) => p.ritmo)).toEqual(['diario', 'semanal']);
    expect(pasosDelDia('2010-03-01').map((p) => p.ritmo)).toEqual(['diario', 'semanal', 'mensual']);
    expect(pasosDelDia('2011-01-01').map((p) => p.ritmo)).toEqual(['diario', 'mensual', 'anual']);
    expect(avanzarHoras({ fecha: '2012-02-28', hora: 12 }, 24).momento.fecha).toBe('2012-02-29');
    expect(cuenta(avanzarHoras({ fecha: '2012-01-01', hora: 0 }, 366 * 24).pasos).diario).toBe(366);
  });

  it('momentos válidos y no válidos', () => {
    expect(momentoDe(horaAbsoluta({ fecha: '2010-07-15', hora: 13 }))).toEqual({
      fecha: '2010-07-15',
      hora: 13,
    });
    expect(() => horaAbsoluta({ fecha: '2010-1-1', hora: 0 })).toThrow(/no válido/);
    expect(() => horaAbsoluta({ fecha: '2010-01-01', hora: 24 })).toThrow(/no válido/);
    expect(() => avanzarHoras(inicio, -1)).toThrow(/no válidas/);
    expect(() => avanzarHoras(inicio, 1.5)).toThrow(/no válidas/);
  });
});

describe('velocidades (ajuste f11-a2, decisión del jugador: ×1 = una hora cada 2 s)', () => {
  it('pausa, ×1, ×2, ×4 y ×8; a ×1 un día dura 48 s y a ×8 un año, unos 36 min', () => {
    expect(VELOCIDADES).toEqual([0, 1, 2, 4, 8]);
    expect(msPorHora(1)).toBe(2000);
    expect(msPorHora(1) * 24).toBe(48_000);
    expect(msPorHora(4) * 24 * 7).toBe(84_000);
    expect((msPorHora(8) * 24 * 365) / 60_000).toBeCloseTo(36.5, 1);
    expect(msPorHora(0)).toBe(Infinity);
    expect(EMPIEZA_EN_PAUSA).toBe(true);
  });

  it('cuenta las horas fotograma a fotograma, guardando lo que sobra', () => {
    // Cuatro segundos a ×1 en fotogramas de 20 ms: 2 horas.
    let resto = 0;
    let horas = 0;
    for (let i = 0; i < 200; i++) {
      const r = horasQueTocan(1, 20, resto);
      horas += r.horas;
      resto = r.restoMs;
    }
    expect(horas).toBe(2);
    expect(resto).toBeCloseTo(0, 6);
    // A ×8, 250 ms son una hora (y un fotograma no cuenta más de eso).
    expect(horasQueTocan(8, 250)).toEqual({ horas: 1, restoMs: 0 });
    expect(horasQueTocan(8, 100, 200)).toEqual({ horas: 1, restoMs: 50 });
  });

  it('en pausa no avanza, y un fotograma muy largo no hace saltar el tiempo', () => {
    expect(horasQueTocan(0, 5000, 300)).toEqual({ horas: 0, restoMs: 0 });
    expect(horasQueTocan(8, 60_000).horas).toBe(config.maxMsPorFotograma / msPorHora(8));
    expect(horasQueTocan(1, -5, 100)).toEqual({ horas: 0, restoMs: 100 });
  });

  it('las teclas suben y bajan de velocidad sin salirse', () => {
    expect(velocidadVecina(0, 1)).toBe(1);
    expect(velocidadVecina(4, 1)).toBe(8);
    expect(velocidadVecina(8, 1)).toBe(8);
    expect(velocidadVecina(1, -1)).toBe(0);
    expect(velocidadVecina(0, -1)).toBe(0);
  });
});

describe('la partida avanza (tarea f11-t1)', () => {
  it('empieza el 1 de enero de 2010 a medianoche y guarda la hora', () => {
    const paises = JSON.parse(
      readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
    ) as ConjuntoPaises;
    const partida = crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 3 },
      paises.paises,
    );
    expect([partida.fecha, partida.hora]).toEqual([FECHA_INICIO, HORA_INICIO]);
    const { partida: despues, pasos } = avanzarPartida(partida, 24 * 31 + 9);
    expect([despues.fecha, despues.hora]).toEqual(['2010-02-01', 9]);
    expect(pasos.at(-1)).toEqual({ ritmo: 'mensual', fecha: '2010-02-01' });
    // La partida de antes no cambia y el resto del estado se conserva.
    expect(partida.fecha).toBe(FECHA_INICIO);
    expect(despues.paises).toBe(partida.paises);
    expect(despues.jugador).toEqual(partida.jugador);
  });
});
