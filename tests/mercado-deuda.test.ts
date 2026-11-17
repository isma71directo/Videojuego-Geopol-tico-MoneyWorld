/** El mercado de la deuda: prima, rating, renovación, crédito y contagio (tarea f18-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { sistemaAlertas } from '../src/sim/alertas';
import {
  completarMercado,
  faltaMercado,
  presionDeContagio,
  revisarRating,
  sistemaMercado,
} from '../src/sim/deuda';
import { completarEconomia, demandaConConfianza, sistemaEconomia } from '../src/sim/economia';
import { desempaquetar, JUEGO } from '../src/sim/guardado';
import { crearMotor, type Motor } from '../src/sim/motor';
import { crearPartida, FORMATO_PARTIDA } from '../src/sim/partida';
import { MINISTERIOS, PARTIDAS, sistemaPresupuesto } from '../src/sim/presupuesto';
import { paisCompleto } from './ayudas/pais-completo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;

const nueva = (dificultad: 'facil' | 'normal' | 'realista' = 'realista') =>
  crearPartida({ paisId: 'ESP', dificultad, eventosHistoricos: true, semilla: 11 }, paises.paises);
/** Una partida entera (todos los países, con contagio) hasta una fecha. */
function jugarHasta(motor: Motor, fecha: string): void {
  while (motor.partida!.fecha < fecha) motor.avanzar(250);
}
const motorCon = () => {
  const motor = crearMotor({
    sistemas: [sistemaEconomia, sistemaPresupuesto, sistemaMercado, sistemaAlertas],
  });
  motor.atender({ tipo: 'empezar', partida: nueva(), pausaAutomatica: false });
  motor.atender({ tipo: 'velocidad', velocidad: 64 });
  return motor;
};

describe('la prima y el rating de 2010 (tarea f18-t2)', () => {
  it('cada país empieza con su prima y su rating; los de la OCDE, con su tipo real', () => {
    const partida = nueva();
    const grecia = partida.paises.GRC!.mercado!;
    const alemania = partida.paises.DEU!.mercado!;
    expect(grecia.tipoMercado).toBeCloseTo(paises.paises.GRC!.datos.tipoBono10!, 1);
    expect(alemania.tipoMercado).toBeCloseTo(paises.paises.DEU!.datos.tipoBono10!, 1);
    expect(grecia.rating).toBe('BB+');
    expect(alemania.rating).toBe('AAA');
    // El crédito de la economía toma la prima de 2010 como referencia.
    const economia = partida.paises.GRC!.economia!;
    expect(economia.primaRiesgo).toBe(grecia.prima);
    expect(economia.primaReferencia).toBe(grecia.prima);
    for (const estado of Object.values(partida.paises)) {
      if (estado.mercado) expect(estado.mercado.serie).toHaveLength(1);
    }
  });
});

describe('si se hace mal, empeora (tarea f18-t2)', () => {
  it('gastar más sin ingresos sube la deuda y, a partir de cierto umbral, la prima (prueba del GDD)', () => {
    const normal = paisCompleto(paises, 'DEU');
    const derrochador = paisCompleto(paises, 'DEU');
    for (const m of MINISTERIOS) {
      for (const p of PARTIDAS) derrochador.presupuesto.ministerios[m][p] *= 1.3;
    }
    normal.avanzar(36);
    derrochador.avanzar(36);
    expect(derrochador.presupuesto.deuda).toBeGreaterThan(normal.presupuesto.deuda * 1.1);
    expect(derrochador.mercado.prima).toBeGreaterThan(normal.mercado.prima * 1.2);
  });

  it('la prima encarece la deuda poco a poco: se renueva la que vence y la nueva (vida media)', () => {
    const grecia = paisCompleto(paises, 'GRC');
    const tipo = grecia.presupuesto.tipoInteres;
    grecia.avanzar(12);
    // El tipo medio sube hacia el de mercado, pero no lo alcanza en un año.
    expect(grecia.presupuesto.tipoInteres).toBeGreaterThan(tipo);
    expect(grecia.presupuesto.tipoInteres).toBeLessThan(grecia.mercado.tipoMercado / 100);
  });

  it('con la prima más alta, el crédito se encarece: menos inversión y menos confianza', () => {
    const grecia = paisCompleto(paises, 'GRC');
    const caro = paisCompleto(paises, 'GRC');
    caro.economia.primaRiesgo = caro.economia.primaReferencia + 6;
    expect(demandaConConfianza(caro.economia).inversion).toBeLessThan(
      demandaConConfianza(grecia.economia).inversion * 0.8,
    );
  });

  it('el rating se revisa cada trimestre y se mueve como mucho dos escalones', () => {
    expect(revisarRating('AAA', 'BB')).toBe('AA');
    expect(revisarRating('BB', 'AAA')).toBe('BBB-');
    expect(revisarRating('A', 'A')).toBe('A');
    expect(revisarRating('D', 'AAA')).toBe('D');
    const grecia = paisCompleto(paises, 'GRC');
    const ratings: string[] = [];
    for (let m = 0; m < 12; m++) {
      grecia.avanzar(1);
      ratings.push(grecia.mercado.rating);
    }
    // Solo cambia en los meses de revisión (cada tres).
    for (let m = 1; m < 12; m++) {
      if ((m + 1) % 3 !== 0) expect(ratings[m]).toBe(ratings[m - 1]);
    }
  });
});

describe('contagio (tarea f18-t2)', () => {
  it('un país en apuros presiona a los que se le parecen (el euro, la región)', () => {
    const grecia = { id: 'GRC', region: 'ECS', prima: 20 };
    expect(presionDeContagio(grecia, { id: 'PRT', region: 'ECS' })).toBeGreaterThan(0.8);
    expect(presionDeContagio(grecia, { id: 'JPN', region: 'EAS' })).toBe(0);
    expect(presionDeContagio({ ...grecia, prima: 5 }, { id: 'PRT', region: 'ECS' })).toBe(0);
  });

  it('sin intervención, Grecia entra en crisis de deuda en 2010–2012 y contagia a Portugal (prueba del GDD)', () => {
    const motor = motorCon();
    jugarHasta(motor, '2013-01-01');
    const paisesPartida = motor.partida!.paises;
    expect(paisesPartida.GRC!.mercado!.cerrado).toBe(true);
    // Portugal, con el contagio, peor que solo.
    const portugalSolo = paisCompleto(paises, 'PRT');
    portugalSolo.avanzar(36);
    expect(paisesPartida.PRT!.mercado!.prima).toBeGreaterThan(portugalSolo.mercado.prima);
    // Los fuertes no entran en crisis.
    for (const id of ['DEU', 'USA', 'CHN', 'JPN']) {
      expect(paisesPartida[id]!.mercado!.cerrado, id).toBe(false);
    }
  }, 60_000);
});

describe('en la partida (tarea f18-t2)', () => {
  it('una partida de la v0.18.0 (formato 6) se migra y recibe el mercado de su deuda', () => {
    const partida = nueva();
    const antigua = structuredClone(partida) as unknown as {
      formato: number;
      paises: Record<
        string,
        Record<string, unknown> & { economia: Record<string, unknown> | null }
      >;
    };
    antigua.formato = 6;
    for (const estado of Object.values(antigua.paises)) {
      delete estado.mercado;
      if (estado.economia) {
        delete estado.economia.primaRiesgo;
        delete estado.economia.primaReferencia;
      }
    }
    const cargada = desempaquetar({
      juego: JUEGO,
      formato: 6,
      version: '0.18.0',
      partida: antigua,
    }).partida;
    expect(cargada.formato).toBe(FORMATO_PARTIDA);
    expect(faltaMercado(cargada)).toBe(true);
    completarEconomia(cargada, paises.paises);
    completarMercado(cargada, paises.paises);
    expect(faltaMercado(cargada)).toBe(false);
    expect(cargada).toEqual(partida);
  });
});
