/** Deuda, prima de riesgo y rating: la fórmula de 2010 (tarea f18-t1). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  fundamentosDe2010,
  primaDeRiesgo,
  primaDeTipo,
  RATINGS,
  ratingDe,
  tieneMonedaPropia,
  tipoDeMercado,
  type Fundamentos,
} from '../src/sim/deuda';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const jugables = Object.values(paises.paises).filter((p) => p.jugable);
const fundamentos = (id: string) => fundamentosDe2010(id, paises.paises[id]!.datos as never);
/** Tipo que da la fórmula a un país en 2010. */
const tipoFormula = (id: string) => {
  const f = fundamentos(id);
  return tipoDeMercado(primaDeRiesgo(f), f.inflacion);
};
/** El rating de 2010: con su tipo real si lo tiene (OCDE) y, si no, con la fórmula. */
const rating2010 = (id: string) => {
  const f = fundamentos(id);
  const real = paises.paises[id]!.datos.tipoBono10;
  return ratingDe(typeof real === 'number' ? primaDeTipo(real, f.inflacion) : primaDeRiesgo(f));
};
const posicion = (rating: string) => RATINGS.indexOf(rating);

describe('la fórmula de la prima de 2010 (tarea f18-t1)', () => {
  it('se parece a los tipos reales a 10 años de la OCDE (40 países)', () => {
    const conDato = jugables.filter((p) => typeof p.datos.tipoBono10 === 'number');
    expect(conDato.length).toBeGreaterThanOrEqual(38);
    const errores = conDato.map((p) => Math.abs(tipoFormula(p.id) - p.datos.tipoBono10!));
    const medio = errores.reduce((a, b) => a + b, 0) / errores.length;
    expect(medio).toBeLessThan(1);
    // El orden de 2010: Grecia paga más que Portugal, Portugal más que España, España más que
    // Alemania; y Japón, con su enorme deuda pero moneda propia, menos que Alemania.
    expect(tipoFormula('GRC')).toBeGreaterThan(tipoFormula('PRT'));
    expect(tipoFormula('PRT')).toBeGreaterThan(tipoFormula('ESP'));
    expect(tipoFormula('ESP')).toBeGreaterThan(tipoFormula('DEU'));
    expect(tipoFormula('JPN')).toBeLessThan(tipoFormula('DEU'));
  });

  it('da a cada país un rating creíble en 2010', () => {
    expect(['AAA', 'AA+']).toContain(rating2010('DEU'));
    expect(['AAA', 'AA+']).toContain(rating2010('USA'));
    expect(posicion(rating2010('GRC'))).toBeGreaterThanOrEqual(posicion('BBB-'));
    expect(posicion(rating2010('ESP'))).toBeLessThan(posicion(rating2010('GRC')));
    // Los países pobres o inestables, peor que los ricos, pero sin hundirse todos en C.
    expect(posicion(rating2010('PAK'))).toBeGreaterThan(posicion(rating2010('CHN')));
    for (const pais of jugables) {
      const rating = rating2010(pais.id);
      expect(RATINGS, pais.id).toContain(rating);
    }
    const enC = jugables.filter((p) => rating2010(p.id) === 'C');
    expect(enC.length, enC.map((p) => p.id).join(', ')).toBeLessThanOrEqual(3);
  });

  it('los ratings van de AAA a D y se asignan por tramos de prima', () => {
    expect(RATINGS[0]).toBe('AAA');
    expect(RATINGS.at(-2)).toBe('C');
    expect(RATINGS.at(-1)).toBe('D');
    expect(ratingDe(0.5)).toBe('AAA');
    expect(ratingDe(5.5)).toBe('BB+');
    expect(ratingDe(30)).toBe('C');
  });

  it('los países del euro de 2010 no tienen moneda propia (provisional hasta la Fase 21)', () => {
    expect(tieneMonedaPropia('GRC')).toBe(false);
    expect(tieneMonedaPropia('DEU')).toBe(false);
    expect(tieneMonedaPropia('JPN')).toBe(true);
    expect(tieneMonedaPropia('GBR')).toBe(true);
  });
});

describe('si se hace mal, empeora (tarea f18-t1)', () => {
  const base: Fundamentos = {
    id: 'ESP',
    pibPerCapita: 30000,
    estabilidad: 5,
    inflacion: 0.02,
    crecimiento: 0.01,
    deuda: 0.6,
    deficit: 0.03,
    deficitExterior: 0.02,
    carga: 0.08,
  };

  it('más deuda, más déficit o más déficit exterior: más prima', () => {
    const prima = primaDeRiesgo(base);
    expect(primaDeRiesgo({ ...base, deuda: 1.2 })).toBeGreaterThan(prima);
    expect(primaDeRiesgo({ ...base, deficit: 0.1 })).toBeGreaterThan(prima);
    expect(primaDeRiesgo({ ...base, deficitExterior: 0.1 })).toBeGreaterThan(prima);
    expect(primaDeRiesgo({ ...base, inflacion: 0.2 })).toBeGreaterThan(prima);
    expect(primaDeRiesgo({ ...base, estabilidad: -40 })).toBeGreaterThan(prima);
    expect(primaDeRiesgo({ ...base, crecimiento: -0.05 })).toBeGreaterThan(prima);
  });

  it('sin moneda propia, la deuda se castiga más (2010: Grecia frente a Japón)', () => {
    const conMoneda = { ...base, id: 'GBR', deuda: 1.5 };
    const sinMoneda = { ...base, id: 'ESP', deuda: 1.5 };
    expect(primaDeRiesgo(sinMoneda) / primaDeRiesgo({ ...sinMoneda, deuda: 0.6 })).toBeGreaterThan(
      primaDeRiesgo(conMoneda) / primaDeRiesgo({ ...conMoneda, deuda: 0.6 }),
    );
  });

  it('cuando los intereses se comen los ingresos, la prima se dispara', () => {
    expect(primaDeRiesgo({ ...base, carga: 0.4 })).toBeGreaterThan(primaDeRiesgo(base) * 1.5);
  });
});
