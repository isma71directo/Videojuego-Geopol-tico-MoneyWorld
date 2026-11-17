/**
 * Test de credibilidad de la Fase 16 (tarea f16-t3; GDD, sección 9): en 5 años sin intervención,
 * el crecimiento anual entre −10 % y +15 % y la inflación entre −5 % y +30 %, salvo casos
 * justificados.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises, PaisDatos } from '../src/datos/paises';
import { avanzarMes, economiaInicial } from '../src/sim/economia';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const jugables = Object.values(paises.paises).filter((p) => p.jugable);
const CRECIMIENTO: [number, number] = [-0.1, 0.15];
const INFLACION: [number, number] = [-0.05, 0.3];
const dentro = (valor: number, [minimo, maximo]: [number, number]) =>
  valor >= minimo && valor <= maximo;

/** Cinco años sin intervención: el crecimiento de cada año y la inflación de cada mes. */
function cincoAnios(pais: PaisDatos): { crecimientos: number[]; inflaciones: number[] } {
  const e = economiaInicial(pais.datos, pais.nivelRenta)!;
  const crecimientos: number[] = [];
  const inflaciones: number[] = [e.inflacion];
  for (let a = 0; a < 5; a++) {
    const antes = e.pib;
    for (let m = 0; m < 12; m++) {
      avanzarMes(e);
      inflaciones.push(e.inflacion);
    }
    crecimientos.push(e.pib / antes - 1);
  }
  return { crecimientos, inflaciones };
}

describe('test de credibilidad: 5 años sin intervención (tarea f16-t3)', () => {
  it('los 20 mayores países crecen entre −10 % y +15 % al año, con inflación entre −5 % y +30 %', () => {
    const mayores = [...jugables]
      .sort((a, b) => (b.datos.pib ?? 0) - (a.datos.pib ?? 0))
      .slice(0, 20);
    for (const pais of mayores) {
      const { crecimientos, inflaciones } = cincoAnios(pais);
      for (const g of crecimientos) expect(dentro(g, CRECIMIENTO), `${pais.id} ${g}`).toBe(true);
      for (const p of inflaciones) expect(dentro(p, INFLACION), `${pais.id} ${p}`).toBe(true);
    }
  });

  it('todos los países también, salvo los que ya estaban fuera en 2010 (casos justificados)', () => {
    const justificados: string[] = [];
    for (const pais of jugables) {
      const { crecimientos, inflaciones } = cincoAnios(pais);
      // Justificado: arranca con su crecimiento o su inflación reales de 2010, que ya se salían.
      const crecio2010 = (pais.datos.crecimientoPib ?? 3) / 100;
      const inflacion2010 = (pais.datos.inflacion ?? 3) / 100;
      const crecimientoJustificado = !dentro(crecio2010, CRECIMIENTO);
      const inflacionJustificada = !dentro(inflacion2010, INFLACION);
      const creceBien = crecimientos.every((g) => dentro(g, CRECIMIENTO));
      const preciosBien = inflaciones.every((p) => dentro(p, INFLACION));
      if (!creceBien) {
        expect(crecimientoJustificado, `${pais.id}: ${crecimientos.join(', ')}`).toBe(true);
        // Solo el primer año: después vuelve a lo creíble.
        expect(
          crecimientos.slice(1).every((g) => dentro(g, CRECIMIENTO)),
          pais.id,
        ).toBe(true);
        justificados.push(pais.id);
      }
      if (!preciosBien) {
        expect(inflacionJustificada, pais.id).toBe(true);
        justificados.push(pais.id);
      }
    }
    // Macao (25 % en 2010) y Zimbabue (19,7 %): su crecimiento real de 2010.
    expect(justificados.length).toBeLessThanOrEqual(5);
  });
});
