/** Alertas económicas del país del jugador (tarea f16-t4). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  ALERTAS_GRAVES,
  alertasNuevas,
  sistemaAlertas,
  situacionesDeAlerta,
} from '../src/sim/alertas';
import { economiaInicial, sistemaEconomia, type EconomiaPais } from '../src/sim/economia';
import { crearMotor, type MensajeMotor, type SucesoMotor } from '../src/sim/motor';
import { crearPartida } from '../src/sim/partida';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const economiaDe = (id: string): EconomiaPais =>
  economiaInicial(paises.paises[id]!.datos, paises.paises[id]!.nivelRenta)!;

/** Juega con un país hasta una fecha y devuelve las alertas que llegan (y si paran). */
function jugar(
  paisId: string,
  hasta: string,
  pausaAutomatica = true,
  dificultad: 'facil' | 'normal' | 'realista' = 'realista',
): SucesoMotor[] {
  const motor = crearMotor({ sistemas: [sistemaEconomia, sistemaAlertas] });
  const partida = crearPartida(
    { paisId, dificultad, eventosHistoricos: true, semilla: 7 },
    paises.paises,
  );
  motor.atender({ tipo: 'empezar', partida, pausaAutomatica });
  motor.atender({ tipo: 'velocidad', velocidad: 64 });
  const sucesos: SucesoMotor[] = [];
  let vueltas = 0;
  while (motor.partida!.fecha < hasta && vueltas++ < 100_000) {
    const mensajes: MensajeMotor[] = motor.avanzar(250);
    for (const mensaje of mensajes) {
      if (mensaje.tipo !== 'suceso') continue;
      sucesos.push(mensaje);
      // Como «Seguir» en el aviso.
      if (mensaje.pausado) motor.atender({ tipo: 'velocidad', velocidad: 64 });
    }
  }
  return sucesos;
}

describe('cuándo salta una alerta (tarea f16-t4)', () => {
  it('inflación alta (más del 10 %) y desbocada (más del 20 %), con margen para salir', () => {
    const e = { serie: [1], paro: 0.08, serieParo: [0.08], inflacion: 0.11 };
    expect(situacionesDeAlerta(e).map((a) => a.tipo)).toEqual(['inflacion']);
    // Ya en alerta, sigue en ella hasta bajar del 9 %.
    expect(situacionesDeAlerta({ ...e, inflacion: 0.095 }, ['inflacion'])).toHaveLength(1);
    expect(situacionesDeAlerta({ ...e, inflacion: 0.085 }, ['inflacion'])).toHaveLength(0);
    expect(situacionesDeAlerta({ ...e, inflacion: 0.25 }).map((a) => a.tipo)).toEqual([
      'inflacionGrave',
      'inflacion',
    ]);
    expect(situacionesDeAlerta({ ...e, inflacion: -0.01 }).map((a) => a.tipo)).toEqual([
      'deflacion',
    ]);
    expect(ALERTAS_GRAVES.has('inflacionGrave')).toBe(true);
    expect(ALERTAS_GRAVES.has('inflacion')).toBe(false);
  });

  it('recesión: dos trimestres seguidos cayendo', () => {
    const base = { paro: 0.08, serieParo: [0.08], inflacion: 0.02 };
    const cae = [100, 100, 100, 99, 99, 99, 98, 98, 98];
    expect(situacionesDeAlerta({ ...base, serie: cae }).map((a) => a.tipo)).toEqual(['recesion']);
    // Uno solo no basta.
    const unTrimestre = [100, 100, 100, 100, 100, 100, 99, 99, 99];
    expect(situacionesDeAlerta({ ...base, serie: unTrimestre })).toHaveLength(0);
  });

  it('paro que se dispara: sube 2 puntos o más en un año', () => {
    const serieParo = Array.from({ length: 13 }, (_, i) => 0.1 + i * 0.002);
    const alerta = situacionesDeAlerta({ serie: [1], paro: 0.124, serieParo, inflacion: 0.02 });
    expect(alerta).toEqual([{ tipo: 'paro', valor: 0.124 }]);
  });

  it('la primera vez solo anota lo que pasa (lo de 2010 no salta) y después no se repite cada mes', () => {
    // Venezuela empieza con un 28 % de inflación: sin alerta al empezar.
    const venezuela = economiaDe('VEN');
    expect(alertasNuevas(venezuela)).toEqual([]);
    expect(venezuela.alertas).toContain('inflacionGrave');
    expect(alertasNuevas(venezuela)).toEqual([]);
    // Si la inflación de Alemania pasa del 20 % de golpe, una sola alerta: la grave.
    const alemania = economiaDe('DEU');
    expect(alertasNuevas(alemania)).toEqual([]);
    alemania.inflacion = 0.22;
    expect(alertasNuevas(alemania).map((a) => a.tipo)).toEqual(['inflacionGrave']);
    expect(alertasNuevas(alemania)).toEqual([]);
  });
});

describe('en la partida (tarea f16-t4)', () => {
  it('Grecia sin intervención entra en recesión en 2010 y la partida se para (es grave)', () => {
    const sucesos = jugar('GRC', '2011-07-01');
    const recesion = sucesos.find((s) => s.suceso.alerta?.tipo === 'recesion');
    expect(recesion).toBeDefined();
    expect(recesion!.pausado).toBe(true);
    expect(recesion!.suceso.importante).toBe(true);
    expect(recesion!.suceso.origen).toBe('economia');
    expect(recesion!.suceso.fecha < '2011-01-01').toBe(true);
    // A la una de la madrugada del día 1, justo después del cambio de mes.
    expect(recesion!.suceso.hora).toBe(1);
    expect(recesion!.suceso.fecha.endsWith('-01')).toBe(true);
    // Y el paro que se dispara, que no para.
    const paro = sucesos.find((s) => s.suceso.alerta?.tipo === 'paro');
    expect(paro).toBeDefined();
    expect(paro!.pausado).toBe(false);
    // Una sola alerta de cada tipo mientras dura.
    expect(sucesos.filter((s) => s.suceso.alerta?.tipo === 'recesion')).toHaveLength(1);
  });

  it('sin la pausa automática, la recesión avisa sin parar', () => {
    const sucesos = jugar('GRC', '2011-01-01', false);
    const recesion = sucesos.find((s) => s.suceso.alerta?.tipo === 'recesion');
    expect(recesion!.pausado).toBe(false);
  });

  it('un país que va bien (Alemania) no recibe alertas en dos años', () => {
    expect(jugar('DEU', '2012-01-01')).toEqual([]);
  });
});
