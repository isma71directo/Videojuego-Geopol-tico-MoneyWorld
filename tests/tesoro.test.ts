/** La deuda por emisiones y el Tesoro (tarea f20-t1). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import configDeuda from '../src/sim/config/deuda.json';
import config from '../src/sim/config/presupuesto.json';
import { completarMercado, sistemaMercado } from '../src/sim/deuda';
import { avanzarMes, completarEconomia, sistemaEconomia } from '../src/sim/economia';
import { desempaquetar, JUEGO } from '../src/sim/guardado';
import { aplicarCambio, fechaDelMes, haciendaDelMes, sistemaHacienda } from '../src/sim/hacienda';
import { crearMotor } from '../src/sim/motor';
import { crearPartida, FORMATO_PARTIDA } from '../src/sim/partida';
import {
  avanzarPresupuesto,
  completarPresupuesto,
  emitirDeuda,
  faltaPresupuesto,
  PLAZOS,
  ponerTiposDelTesoro,
  recomprarDeuda,
  sistemaPresupuesto,
  tipoDelPlazo,
  totalGastos,
  vencimientosIniciales,
  vidaMediaRestante,
  type PresupuestoPais,
} from '../src/sim/presupuesto';
import { paisCompleto } from './ayudas/pais-completo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const ts = config.tesoro;
const suma = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0);
/** Lo que vence en los próximos `meses` meses. */
const venceEn = (p: PresupuestoPais, meses: number): number => suma(p.vencimientos.slice(0, meses));

describe('el calendario de vencimientos (tarea f20-t1)', () => {
  it('la deuda de 2010 vence en 10 años, con unas letras el primer año', () => {
    const { presupuesto } = paisCompleto(paises, 'ESP');
    expect(presupuesto.vencimientos).toHaveLength(ts.meses);
    expect(suma(presupuesto.vencimientos)).toBeCloseTo(presupuesto.deuda, -3);
    expect(venceEn(presupuesto, 12)).toBeGreaterThan(suma(presupuesto.vencimientos.slice(12, 24)));
    // Una vida media de unos 5 años, como la de los países de la OCDE en 2010.
    const vida = vidaMediaRestante(presupuesto);
    expect(vida).toBeGreaterThan(4.5);
    expect(vida).toBeLessThan(6);
    expect(suma(vencimientosIniciales(1000))).toBeCloseTo(1000, 6);
  });

  it('cada mes se paga lo que vence y el Tesoro automático lo renueva: la deuda no cambia sola', () => {
    const espana = paisCompleto(paises, 'ESP');
    const vence = espana.presupuesto.vencimientos[0]!;
    expect(vence).toBeGreaterThan(0);
    espana.avanzar(24);
    // Siempre hay dinero en la tesorería y el calendario cuadra con la deuda.
    expect(espana.estado.tesoreria).toBeGreaterThan(0);
    expect(suma(espana.presupuesto.vencimientos)).toBeCloseTo(espana.presupuesto.deuda, -3);
  });
});

describe('los plazos (tarea f20-t1)', () => {
  it('cada plazo tiene su tipo: las letras, más baratas; los bonos a 10 años, más caros', () => {
    const { presupuesto, mercado } = paisCompleto(paises, 'ESP');
    const { letras, bonos5, bonos10 } = presupuesto.tesoro.tipos;
    expect(letras).toBeLessThan(bonos5);
    expect(bonos5).toBeLessThan(bonos10);
    expect(bonos10).toBeCloseTo(tipoDelPlazo(mercado.tipoMercado, 'bonos10') / 100, 10);
    // Nunca por debajo del mínimo.
    expect(tipoDelPlazo(0, 'letras')).toBe(configDeuda.curva.minimo);
  });

  it('emitir a corto plazo sale más barato, pero obliga a renovar antes (y si la prima sube, más caro)', () => {
    const corto = paisCompleto(paises, 'ESP');
    const largo = paisCompleto(paises, 'ESP');
    const importe = 50e9;
    emitirDeuda(corto.presupuesto, corto.estado, importe, { letras: 1, bonos5: 0, bonos10: 0 });
    emitirDeuda(largo.presupuesto, largo.estado, importe, { letras: 0, bonos5: 0, bonos10: 1 });
    // Más barato...
    expect(corto.presupuesto.tipoInteres).toBeLessThan(largo.presupuesto.tipoInteres);
    // ...pero vence dentro de un año (los bonos, dentro de diez).
    expect(venceEn(corto.presupuesto, 12) - venceEn(largo.presupuesto, 12)).toBeCloseTo(
      importe,
      -3,
    );
    // Si al año el mercado pide un 7 %, las letras se renuevan a ese tipo: acaban saliendo más caras.
    for (const pais of [corto, largo]) {
      for (let mes = 0; mes < 12; mes++) {
        avanzarMes(pais.economia);
        for (const p of PLAZOS) pais.presupuesto.tesoro.tipos[p] = 0.07;
        avanzarPresupuesto(pais.presupuesto, pais.economia, pais.estado);
      }
    }
    expect(corto.presupuesto.tipoInteres).toBeGreaterThan(largo.presupuesto.tipoInteres);
  });
});

describe('emitir y recomprar a mano (tarea f20-t1)', () => {
  it('emitir llena la tesorería y sube la deuda; con los mercados cerrados, no se puede', () => {
    const espana = paisCompleto(paises, 'ESP');
    const { presupuesto, economia, estado } = espana;
    const antes = { deuda: presupuesto.deuda, tesoreria: estado.tesoreria };
    aplicarCambio(presupuesto, economia, estado, {
      tipo: 'emision',
      importe: 20e9,
      reparto: { letras: 0.5, bonos5: 0.5, bonos10: 0 },
    });
    expect(presupuesto.deuda - antes.deuda).toBeCloseTo(20e9, -3);
    expect(estado.tesoreria - antes.tesoreria).toBeCloseTo(20e9, -3);
    presupuesto.tesoro.abierto = false;
    aplicarCambio(presupuesto, economia, estado, { tipo: 'emision', importe: 20e9, reparto: null });
    expect(presupuesto.deuda - antes.deuda).toBeCloseTo(20e9, -3);
  });

  it('recomprar cuando el mercado pide menos de lo que paga la deuda sale caro: se paga por encima de su valor', () => {
    const alemania = paisCompleto(paises, 'DEU');
    const { presupuesto, mercado, estado } = alemania;
    // La deuda vieja paga un 5 % y el mercado pide un 2 %: vale más de lo que se debe.
    presupuesto.tipoInteres = 0.05;
    mercado.tipoMercado = 2;
    ponerTiposDelTesoro(mercado, presupuesto);
    expect(presupuesto.tesoro.precioRecompra).toBeGreaterThan(1.1);
    estado.tesoreria = 30e9;
    const deuda = presupuesto.deuda;
    recomprarDeuda(presupuesto, estado, 10e9);
    const retirada = deuda - presupuesto.deuda;
    expect(retirada).toBeLessThan(10e9 / 1.1);
    expect(estado.tesoreria).toBeCloseTo(20e9, -3);
    // No se puede gastar lo que no hay.
    recomprarDeuda(presupuesto, estado, 1e15);
    expect(estado.tesoreria).toBeGreaterThanOrEqual(0);
  });

  it('con la prima alta la deuda está barata, pero recomprarla con dinero prestado sube los intereses', () => {
    const espana = paisCompleto(paises, 'ESP');
    const { presupuesto, mercado, estado } = espana;
    mercado.prima = 6;
    mercado.tipoMercado = 9;
    ponerTiposDelTesoro(mercado, presupuesto);
    expect(presupuesto.tesoro.precioRecompra).toBeLessThan(1);
    const intereses = presupuesto.deuda * presupuesto.tipoInteres;
    const importe = 20e9;
    emitirDeuda(presupuesto, estado, importe);
    recomprarDeuda(presupuesto, estado, importe);
    expect(presupuesto.deuda * presupuesto.tipoInteres).toBeGreaterThan(intereses + importe * 0.02);
  });
});

describe('el Tesoro automático (tarea f20-t1)', () => {
  it('emite lo que falta para el colchón y, si sobra mucho, paga antes', () => {
    const espana = paisCompleto(paises, 'ESP');
    const { presupuesto, economia, estado } = espana;
    estado.tesoreria = 0;
    const deuda = presupuesto.deuda;
    avanzarMes(economia);
    avanzarPresupuesto(presupuesto, economia, estado);
    const gastoMes = totalGastos(presupuesto) / 12;
    expect(estado.tesoreria).toBeCloseTo(config.evolucion.colchonMeses * gastoMes, -6);
    expect(presupuesto.deuda).toBeGreaterThan(deuda);
    estado.tesoreria = 10 * gastoMes;
    const conDinero = presupuesto.deuda;
    avanzarMes(economia);
    avanzarPresupuesto(presupuesto, economia, estado);
    expect(presupuesto.deuda).toBeLessThan(conDinero - 5 * gastoMes);
  });

  it('el reparto de plazos se elige; lo que no tiene sentido no se aplica', () => {
    const { presupuesto, economia, estado } = paisCompleto(paises, 'ESP');
    aplicarCambio(presupuesto, economia, estado, {
      tipo: 'tesoro',
      automatico: true,
      reparto: { letras: 2, bonos5: 2, bonos10: 0 },
    });
    expect(presupuesto.tesoro.reparto).toEqual({ letras: 0.5, bonos5: 0.5, bonos10: 0 });
    aplicarCambio(presupuesto, economia, estado, {
      tipo: 'tesoro',
      automatico: false,
      reparto: { letras: -1, bonos5: Number.NaN, bonos10: 0 },
    });
    expect(presupuesto.tesoro.automatico).toBe(false);
    expect(presupuesto.tesoro.reparto).toEqual(ts.repartoInicial);
  });
});

describe('si se hace mal, empeora (tarea f20-t1)', () => {
  it('si la tesorería se acaba con el Tesoro apagado, el país deja de pagar', () => {
    const grecia = paisCompleto(paises, 'GRC', 1, { jugador: true });
    const { presupuesto, economia, mercado, estado } = grecia;
    haciendaDelMes(presupuesto, economia, mercado, {
      esJugador: true,
      fecha: fechaDelMes(economia.meses),
      cambios: [{ tipo: 'tesoro', automatico: false, reparto: null }],
      estado,
    });
    expect(presupuesto.tesoro.automatico).toBe(false);
    const deuda = presupuesto.deuda;
    for (let mes = 0; mes < 24 && !mercado.programa; mes++) grecia.avanzar(1);
    expect(mercado.programa?.tipo).toBe('impago');
    expect(mercado.rating).toBe('D');
    // Con la quita, la deuda (y su calendario) baja a la mitad.
    expect(presupuesto.deuda).toBeLessThan(deuda * 0.6);
    expect(suma(presupuesto.vencimientos)).toBeCloseTo(presupuesto.deuda, -3);
  });

  it('la IA, con el Tesoro automático, no se queda sin tesorería', () => {
    const grecia = paisCompleto(paises, 'GRC');
    for (let mes = 0; mes < 18; mes++) {
      grecia.avanzar(1);
      expect(grecia.estado.tesoreria).toBeGreaterThanOrEqual(0);
    }
    expect(grecia.presupuesto.tesoro.automatico).toBe(true);
  });

  it('al jugador se le avisa: primero de que queda poca tesorería y luego de que se ha acabado', () => {
    const motor = crearMotor({
      sistemas: [sistemaEconomia, sistemaPresupuesto, sistemaMercado, sistemaHacienda],
    });
    const partida = crearPartida(
      { paisId: 'GRC', dificultad: 'realista', eventosHistoricos: true, semilla: 4 },
      paises.paises,
    );
    motor.atender({ tipo: 'empezar', partida, pausaAutomatica: false });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    motor.atender({
      tipo: 'cambiosPresupuesto',
      cambios: [{ tipo: 'tesoro', automatico: false, reparto: null }],
    });
    const avisos = new Set<string>();
    while (motor.partida!.fecha < '2011-06-01' && !avisos.has('sinTesoreria')) {
      motor.avanzar(500);
      for (const suceso of motor.partida!.agenda) {
        if (suceso.alerta) avisos.add(suceso.alerta.tipo);
      }
    }
    expect(avisos.has('tesoreriaBaja')).toBe(true);
    expect(avisos.has('sinTesoreria')).toBe(true);
    expect(motor.partida!.paises.GRC!.mercado!.programa?.tipo).toBe('impago');
  });
});

describe('partidas guardadas (tarea f20-t1)', () => {
  it('una partida de la v0.20 (formato 8) se migra: la deuda vence como la de 2010 y el Tesoro empieza automático', () => {
    const partida = crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 9 },
      paises.paises,
    );
    const antigua = structuredClone(partida) as unknown as {
      paises: Record<string, { presupuesto: Record<string, unknown> | null }>;
    };
    for (const estado of Object.values(antigua.paises)) {
      if (!estado.presupuesto) continue;
      delete estado.presupuesto.vencimientos;
      delete estado.presupuesto.tesoro;
    }
    const cargada = desempaquetar({
      juego: JUEGO,
      formato: 8,
      version: '0.20.1',
      partida: { ...antigua, formato: 8 },
    }).partida;
    expect(cargada.formato).toBe(FORMATO_PARTIDA);
    expect(faltaPresupuesto(cargada)).toBe(true);
    completarEconomia(cargada, paises.paises);
    completarPresupuesto(cargada, paises.paises);
    completarMercado(cargada, paises.paises);
    expect(faltaPresupuesto(cargada)).toBe(false);
    expect(cargada).toEqual(partida);
  });
});
