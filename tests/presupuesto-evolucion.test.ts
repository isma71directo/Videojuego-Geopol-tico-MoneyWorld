/** El presupuesto mes a mes: responde a la economía y el déficit se cubre con deuda (tarea f17-t3). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { sistemaAlertas } from '../src/sim/alertas';
import {
  avanzarMes,
  durezaDe,
  economiaInicial,
  nivelDe,
  pibNominal,
  sistemaEconomia,
  type EconomiaPais,
} from '../src/sim/economia';
import { crearMotor } from '../src/sim/motor';
import { empezarSalida } from '../src/sim/deuda';
import { paisCompleto } from './ayudas/pais-completo';
import { crearPartida } from '../src/sim/partida';
import {
  avanzarPresupuesto,
  gastoMinisterio,
  MINISTERIOS,
  PARTIDAS,
  presupuestoInicial,
  sistemaPresupuesto,
  totalGastos,
  totalIngresos,
  type PresupuestoPais,
} from '../src/sim/presupuesto';
import { tesoreriaInicial } from '../src/sim/valores-iniciales';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const jugables = Object.values(paises.paises).filter((p) => p.jugable);

interface Pais {
  economia: EconomiaPais;
  presupuesto: PresupuestoPais;
  estado: { tesoreria: number };
}
const paisDe = (id: string): Pais => {
  const datos = paises.paises[id]!;
  const economia = economiaInicial(datos.datos, datos.nivelRenta)!;
  return {
    economia,
    presupuesto: presupuestoInicial(datos.datos, nivelDe(datos.nivelRenta), economia)!,
    estado: { tesoreria: tesoreriaInicial(datos.datos as never) },
  };
};
/** Avanza unos meses la economía y el presupuesto (sin el mercado de la deuda). */
const meses = (p: Pais, n: number, cadaMes?: () => void) => {
  for (let i = 0; i < n; i++) {
    avanzarMes(p.economia);
    avanzarPresupuesto(p.presupuesto, p.economia, p.estado);
    cadaMes?.();
  }
};
const ministerios = (p: PresupuestoPais) =>
  MINISTERIOS.reduce((t, m) => t + gastoMinisterio(p, m), 0);

describe('responde a la economía (tarea f17-t3)', () => {
  it('estabilizadores: en la recesión, la recaudación cae y las prestaciones por desempleo suben', () => {
    const espana = paisDe('ESP');
    const ingresos = espana.presupuesto.serie.ingresos[0]!;
    const desempleo = espana.presupuesto.transversales.desempleo;
    meses(espana, 24);
    // Recauda menos en % del PIB y paga más paro (en dinero y en % del PIB).
    expect(espana.presupuesto.serie.ingresos.at(-1)!).toBeLessThan(ingresos);
    expect(espana.presupuesto.transversales.desempleo).toBeGreaterThan(desempleo * 1.1);
  });

  it('las pensiones suben con los precios y con el envejecimiento', () => {
    const japon = paisDe('JPN');
    const pensiones = japon.presupuesto.transversales.pensiones;
    meses(japon, 60);
    const precios = japon.economia.nivelPrecios;
    expect(japon.presupuesto.transversales.pensiones).toBeGreaterThan(pensiones * precios * 1.08);
  });

  it('los recortes del rescate del FMI salen de los ministerios (más en «realista» que en «fácil»; Fase 18)', () => {
    const realista = paisCompleto(paises, 'GRC', 1);
    const facil = paisCompleto(paises, 'GRC', durezaDe('facil'));
    for (const p of [realista, facil]) {
      empezarSalida('fmi', p.mercado, p.economia, p.presupuesto);
      p.avanzar(24);
    }
    expect(realista.mercado.programa?.tipo).toBe('fmi');
    expect(ministerios(realista.presupuesto)).toBeLessThan(ministerios(facil.presupuesto));
    // Las partidas de cada ministerio siguen sumando lo suyo.
    for (const m of MINISTERIOS) {
      const suma = PARTIDAS.reduce((t, x) => t + realista.presupuesto.ministerios[m][x], 0);
      expect(suma).toBeCloseTo(gastoMinisterio(realista.presupuesto, m), 0);
    }
  });
});

describe('el déficit se cubre con deuda: si se hace mal, empeora (tarea f17-t3)', () => {
  it('sin intervención, Grecia acumula deuda y sus intereses crecen (bola de nieve)', () => {
    const grecia = paisDe('GRC');
    const intereses = grecia.presupuesto.transversales.intereses;
    meses(grecia, 36);
    // Real: del 148 % del PIB en 2010 al 172 % en 2011, antes de la quita de 2012.
    expect(grecia.presupuesto.serie.deuda.at(-1)!).toBeGreaterThan(190);
    expect(grecia.presupuesto.transversales.intereses).toBeGreaterThan(intereses * 1.3);
  });

  it('gastar más sube la deuda y los intereses', () => {
    const normal = paisDe('DEU');
    const derrochador = paisDe('DEU');
    for (const m of MINISTERIOS) {
      for (const p of PARTIDAS) derrochador.presupuesto.ministerios[m][p] *= 1.1;
    }
    meses(normal, 60);
    meses(derrochador, 60);
    expect(derrochador.presupuesto.deuda).toBeGreaterThan(normal.presupuesto.deuda * 1.05);
    expect(derrochador.presupuesto.transversales.intereses).toBeGreaterThan(
      normal.presupuesto.transversales.intereses,
    );
  });

  it('la tesorería no baja de un mes de gastos: el Estado emite deuda', () => {
    const grecia = paisDe('GRC');
    meses(grecia, 24, () => {
      expect(grecia.estado.tesoreria).toBeGreaterThanOrEqual(
        (totalGastos(grecia.presupuesto) / 12) * 0.999,
      );
    });
  });

  it('con superávit, el Estado paga su deuda y ahorra (Noruega)', () => {
    const noruega = paisDe('NOR');
    const tesoreria = noruega.estado.tesoreria;
    meses(noruega, 60);
    expect(noruega.presupuesto.deuda).toBeLessThan(paises.paises.NOR!.datos.pib! * 0.05);
    expect(noruega.estado.tesoreria).toBeGreaterThan(tesoreria * 3);
  });

  it('en 10 años, el presupuesto de todos los países sigue siendo válido', () => {
    for (const pais of jugables) {
      const datos = paises.paises[pais.id]!;
      const economia = economiaInicial(datos.datos, datos.nivelRenta)!;
      const presupuesto = presupuestoInicial(datos.datos, nivelDe(datos.nivelRenta), economia)!;
      const estado = { tesoreria: tesoreriaInicial(datos.datos as never) };
      for (let m = 0; m < 120; m++) {
        avanzarMes(economia);
        avanzarPresupuesto(presupuesto, economia, estado);
      }
      const valores = [totalIngresos(presupuesto), totalGastos(presupuesto), presupuesto.deuda];
      for (const v of valores) expect(Number.isFinite(v) && v >= 0, pais.id).toBe(true);
      expect(estado.tesoreria, pais.id).toBeGreaterThan(0);
      expect(presupuesto.serie.deuda, pais.id).toHaveLength(121);
      // (Algún microestado con datos atípicos, como Tuvalu, pasa del 1000 %.)
      expect((presupuesto.deuda / pibNominal(economia)) * 100, pais.id).toBeLessThan(2000);
    }
  });
});

describe('en la partida (tarea f17-t3)', () => {
  it('el motor avanza el presupuesto cada mes, después de la economía', () => {
    const motor = crearMotor({ sistemas: [sistemaEconomia, sistemaPresupuesto, sistemaAlertas] });
    const partida = crearPartida(
      { paisId: 'ESP', dificultad: 'realista', eventosHistoricos: true, semilla: 4 },
      paises.paises,
    );
    const tesoreria = partida.paises.ESP!.tesoreria;
    const deuda = partida.paises.ESP!.presupuesto!.deuda;
    motor.atender({ tipo: 'empezar', partida, pausaAutomatica: false });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    while (motor.partida!.fecha < '2011-01-01') motor.avanzar(250);
    const espana = motor.partida!.paises.ESP!;
    expect(espana.presupuesto!.serie.deuda).toHaveLength(13);
    expect(espana.presupuesto!.deuda).toBeGreaterThan(deuda);
    expect(espana.tesoreria).not.toBe(tesoreria);
  });
});
