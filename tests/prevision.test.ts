/** Previsión del presupuesto a 12 meses (tarea f19-t3). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { presupuestoEnVigor } from '../src/sim/hacienda';
import { diasUnoSiguientes, MESES_PREVISION, prever } from '../src/sim/prevision';
import { MINISTERIOS, PARTIDAS, saldo, totalGastos, totalIngresos } from '../src/sim/presupuesto';
import { paisCompleto } from './ayudas/pais-completo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;

/** España del jugador tras `meses` meses, a mitad del mes siguiente. */
const espanaA = (meses: number) => {
  const espana = paisCompleto(paises, 'ESP', 1, { jugador: true });
  espana.avanzar(meses);
  const datos = {
    economia: espana.economia,
    presupuesto: espana.presupuesto,
    mercado: espana.mercado,
    tesoreria: espana.estado.tesoreria,
  };
  // (Tras `meses` pasos, el último fue el día 1 de 2010 + meses; estamos a mitad de ese mes.)
  const mes = String((meses % 12) + 1).padStart(2, '0');
  const fecha = `${2010 + Math.floor(meses / 12)}-${mes}-15`;
  return { espana, datos, fecha };
};

describe('la previsión a 12 meses (tarea f19-t3)', () => {
  it('coincide con lo que pasa si no cambia nada más (prueba del GDD)', () => {
    const { espana, datos, fecha } = espanaA(5);
    const prevision = prever('ESP', datos, { fecha });
    espana.avanzar(MESES_PREVISION);
    expect(prevision.ingresos).toBeCloseTo(totalIngresos(espana.presupuesto), -3);
    expect(prevision.gastos).toBeCloseTo(totalGastos(espana.presupuesto), -3);
    expect(prevision.saldo).toBeCloseTo(saldo(espana.presupuesto), -3);
    expect(prevision.deuda).toBeCloseTo(espana.presupuesto.deuda, -3);
    expect(prevision.prima).toBeCloseTo(espana.mercado.prima, 6);
    expect(prevision.rating).toBe(espana.mercado.rating);
  });

  it('no toca el país: trabaja sobre una copia', () => {
    const { espana, datos, fecha } = espanaA(2);
    const antes = structuredClone({
      economia: espana.economia,
      presupuesto: espana.presupuesto,
      mercado: espana.mercado,
    });
    prever('ESP', datos, { fecha });
    expect({
      economia: espana.economia,
      presupuesto: espana.presupuesto,
      mercado: espana.mercado,
    }).toEqual(antes);
  });

  it('con otro presupuesto, otra previsión: gastar más sube el déficit y la deuda', () => {
    const { datos, fecha } = espanaA(0);
    const igual = prever('ESP', datos, { fecha });
    const decidido = presupuestoEnVigor(datos.presupuesto);
    for (const m of MINISTERIOS) for (const p of PARTIDAS) decidido.ministerios[m][p] *= 1.2;
    const masGasto = prever('ESP', datos, { fecha, decidido });
    expect(masGasto.saldo).toBeLessThan(igual.saldo);
    expect(masGasto.deuda).toBeGreaterThan(igual.deuda);
    // (La prima tarda más: a 12 meses, el crecimiento extra la compensa; a 3 años sube:
    // tests/hacienda.test.ts.)
    // Y recortar, lo contrario (y menos PIB).
    for (const m of MINISTERIOS) for (const p of PARTIDAS) decidido.ministerios[m][p] *= 0.7;
    const recorte = prever('ESP', datos, { fecha, decidido });
    expect(recorte.saldo).toBeGreaterThan(igual.saldo);
    expect(recorte.pibNominal).toBeLessThan(igual.pibNominal);
  });

  it('los días 1 de los meses siguientes', () => {
    expect(diasUnoSiguientes('2010-11-20', 3)).toEqual(['2010-12-01', '2011-01-01', '2011-02-01']);
  });
});
