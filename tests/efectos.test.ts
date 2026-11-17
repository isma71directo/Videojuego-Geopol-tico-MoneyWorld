/** Efectos y modificadores (tarea f13-t1). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  activo,
  crearEfecto,
  datoEfectivo,
  efectosDe,
  revisarEfectos,
  sumarDias,
  sumarMeses,
  valorEfectivo,
  type DefinicionEfecto,
  type Efecto,
} from '../src/sim/efectos';
import { crearMotor, type EstadoMotor } from '../src/sim/motor';
import { crearPartida } from '../src/sim/partida';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;

const definicion = (cambios: Partial<DefinicionEfecto> = {}): DefinicionEfecto => ({
  nombre: 'Prueba',
  origen: 'prueba',
  variable: { pais: 'ESP', campo: 'popularidad' },
  operacion: 'sumar',
  valor: 3,
  ...cambios,
});

describe('fechas de los efectos (tarea f13-t1)', () => {
  it('sumar días y meses, con el último día del mes cuando no existe', () => {
    expect(sumarDias('2010-01-30', 3)).toBe('2010-02-02');
    expect(sumarMeses('2010-01-15', 1)).toBe('2010-02-15');
    expect(sumarMeses('2010-01-31', 1)).toBe('2010-02-28');
    expect(sumarMeses('2011-11-30', 3)).toBe('2012-02-29');
    expect(sumarMeses('2010-12-10', 2)).toBe('2011-02-10');
    expect(() => sumarDias('2010-1-1', 1)).toThrow(/no válida/);
  });

  it('un modificador con retraso y duración empieza y termina en las fechas correctas (GDD)', () => {
    const efecto = crearEfecto(
      definicion({ retrasoMeses: 1, duracionMeses: 2 }),
      '2010-01-15',
      'e1',
    );
    expect(efecto).toMatchObject({ desde: '2010-02-15', hasta: '2010-04-15' });
    expect(activo(efecto, '2010-02-14')).toBe(false);
    expect(activo(efecto, '2010-02-15')).toBe(true);
    expect(activo(efecto, '2010-04-14')).toBe(true);
    expect(activo(efecto, '2010-04-15')).toBe(false);
    // En días, y permanente si no tiene duración.
    expect(
      crearEfecto(definicion({ retrasoDias: 5, duracionDias: 10 }), '2010-01-01', 'e2'),
    ).toMatchObject({ desde: '2010-01-06', hasta: '2010-01-16' });
    const permanente = crearEfecto(definicion(), '2010-03-01', 'e3');
    expect(permanente.hasta).toBeNull();
    expect(activo(permanente, '2015-01-01')).toBe(true);
    expect(() =>
      crearEfecto(definicion({ operacion: 'dividir' as never }), '2010-01-01', 'x'),
    ).toThrow(/Operación/);
  });
});

describe('valor con los efectos aplicados (tarea f13-t1)', () => {
  const efecto = (
    operacion: Efecto['operacion'],
    valor: number,
    cambios: Partial<Efecto> = {},
  ): Efecto => ({
    ...crearEfecto(definicion({ operacion, valor }), '2010-01-01', `${operacion}${valor}`),
    ...cambios,
  });

  it('primero fijar, luego multiplicar y por último sumar; dentro de los límites', () => {
    expect(
      valorEfectivo(50, [efecto('sumar', 3), efecto('multiplicar', 1.1)], 'popularidad'),
    ).toBeCloseTo(58);
    expect(valorEfectivo(50, [efecto('fijar', 40), efecto('sumar', 5)], 'popularidad')).toBe(45);
    expect(valorEfectivo(90, [efecto('sumar', 30)], 'popularidad')).toBe(100);
    expect(valorEfectivo(5, [efecto('sumar', -30)], 'popularidad')).toBe(0);
    expect(valorEfectivo(1e9, [efecto('multiplicar', 2)], 'tesoreria')).toBe(2e9);
  });

  it('solo cuentan los efectos de ese país y ese dato que actúan en la fecha', () => {
    const efectos = [
      efecto('sumar', 3),
      efecto('sumar', 10, { variable: { pais: 'FRA', campo: 'popularidad' } }),
      efecto('sumar', 7, { variable: { pais: 'ESP', campo: 'tesoreria' } }),
      efecto('sumar', 20, { desde: '2010-06-01' }),
    ];
    expect(efectosDe(efectos, 'ESP', 'popularidad', '2010-01-02')).toHaveLength(1);
    expect(
      datoEfectivo(
        { popularidad: 32, tesoreria: 0, economia: null },
        efectos,
        'ESP',
        'popularidad',
        '2010-01-02',
      ),
    ).toBe(35);
    expect(
      datoEfectivo(
        { popularidad: 32, tesoreria: 0, economia: null },
        efectos,
        'ESP',
        'popularidad',
        '2010-07-01',
      ),
    ).toBe(55);
  });

  it('al empezar el día: los que empiezan, los que terminan y los que quedan', () => {
    const corto = crearEfecto(definicion({ duracionDias: 2 }), '2010-01-01', 'corto');
    const luego = crearEfecto(definicion({ retrasoDias: 2 }), '2010-01-01', 'luego');
    const revision = revisarEfectos([corto, luego], '2010-01-03');
    expect(revision.terminan.map((e) => e.id)).toEqual(['corto']);
    expect(revision.empiezan.map((e) => e.id)).toEqual(['luego']);
    expect(revision.quedan.map((e) => e.id)).toEqual(['luego']);
  });
});

describe('el motor aplica y quita los efectos solos (tarea f13-t1)', () => {
  it('un efecto con retraso y duración actúa entre sus fechas y luego desaparece', () => {
    const motor = crearMotor();
    motor.atender({
      tipo: 'empezar',
      partida: crearPartida(
        { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 1 },
        paises.paises,
      ),
    });
    const respuesta = motor.atender({
      tipo: 'efecto',
      definicion: definicion({ retrasoDias: 2, duracionDias: 3 }),
    });
    const estado = respuesta[0] as EstadoMotor;
    expect(estado.efectos).toHaveLength(1);
    expect(estado.efectos[0]).toMatchObject({ desde: '2010-01-03', hasta: '2010-01-06' });
    const base = motor.partida!.paises.ESP!.popularidad;
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    /** Avanza hasta el día dado y devuelve la popularidad con efectos. */
    const popularidadEl = (dia: string): number => {
      let ultimo: EstadoMotor | null = null;
      while (motor.partida!.fecha < dia) {
        for (const m of motor.avanzar(10)) if (m.tipo === 'estado') ultimo = m;
      }
      const p = motor.partida!;
      return datoEfectivo(
        p.paises.ESP!,
        ultimo?.efectos ?? p.efectos,
        'ESP',
        'popularidad',
        p.fecha,
      );
    };
    expect(popularidadEl('2010-01-02')).toBe(base);
    expect(popularidadEl('2010-01-03')).toBe(base + 3);
    expect(popularidadEl('2010-01-05')).toBe(base + 3);
    expect(popularidadEl('2010-01-06')).toBe(base);
    expect(motor.partida!.efectos).toHaveLength(0);
  });

  it('sin partida no se puede añadir un efecto', () => {
    expect(crearMotor().atender({ tipo: 'efecto', definicion: definicion() })).toEqual([]);
  });
});
