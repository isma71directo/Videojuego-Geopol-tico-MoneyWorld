/** Inflación persistente y PIB nominal (tarea f16-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { paisCompleto } from './ayudas/pais-completo';
import {
  avanzarMes,
  demandaConConfianza,
  economiaInicial,
  pibNominal,
  type EconomiaPais,
} from '../src/sim/economia';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const jugables = Object.values(paises.paises).filter((p) => p.jugable);
const economiaDe = (id: string): EconomiaPais =>
  economiaInicial(paises.paises[id]!.datos, paises.paises[id]!.nivelRenta)!;
const meses = (e: EconomiaPais, n: number) => {
  for (let i = 0; i < n; i++) avanzarMes(e);
};
/** Fija la inflación (y lo que se espera) de una economía. */
const conInflacion = (e: EconomiaPais, inflacion: number) => {
  e.inflacion = inflacion;
  e.inflacionEsperada = inflacion;
  return e;
};

describe('la inflación de 2010 (tarea f16-t2)', () => {
  it('cada país empieza con su inflación real de 2010, que es también la que se espera', () => {
    const espana = economiaDe('ESP');
    expect(espana.inflacion * 100).toBeCloseTo(paises.paises.ESP!.datos.inflacion!, 3);
    expect(espana.inflacionEsperada).toBe(espana.inflacion);
    expect(espana.nivelPrecios).toBe(1);
    expect(pibNominal(espana)).toBe(espana.pib);
    expect(espana.serieInflacion).toHaveLength(1);
    expect(espana.serieInflacion[0]).toBeCloseTo(espana.inflacion, 4);
  });

  it('la demanda de 2010 ya trae el daño de la inflación de ese año: sin ella habría más inversión', () => {
    // Venezuela: 28 % de inflación en 2010.
    const venezuela = economiaDe('VEN');
    const datos = paises.paises.VEN!.datos;
    expect(venezuela.demandaBase.inversion).toBeGreaterThan(datos.inversionPib! / 100);
    expect(venezuela.demandaReferencia.inversion).toBeCloseTo(datos.inversionPib! / 100, 6);
  });
});

describe('cómo evoluciona (tarea f16-t2)', () => {
  it('es persistente: sin banco central, cada país arrastra la suya (decisión del jugador)', () => {
    const venezuela = economiaDe('VEN');
    const japon = economiaDe('JPN');
    const alemania = economiaDe('DEU');
    meses(venezuela, 60);
    meses(japon, 60);
    meses(alemania, 60);
    expect(venezuela.inflacion).toBeGreaterThan(0.2);
    expect(japon.inflacion).toBeLessThan(0);
    expect(Math.abs(alemania.inflacion - 0.011)).toBeLessThan(0.005);
  });

  it('curva de Phillips: con mucho paro, la inflación baja (Grecia, 2010–2014)', () => {
    // Real: del 4,7 % en 2010 al −1,4 % en 2014. (Con su presupuesto y el mercado de su deuda: el
    // crédito caro y el impago hunden la economía; Fase 18.)
    const grecia = paisCompleto(paises, 'GRC');
    grecia.avanzar(48);
    expect(grecia.economia.inflacion).toBeLessThan(0.02);
    expect(grecia.economia.inflacionEsperada).toBeLessThan(0.047);
  });

  it('gastar de más recalienta: baja el paro, pero sube la inflación (nada es gratis)', () => {
    const normal = economiaDe('DEU');
    const gasto = economiaDe('DEU');
    gasto.demandaBase.consumoPublico += 0.04;
    meses(normal, 24);
    meses(gasto, 24);
    expect(gasto.paro).toBeLessThan(normal.paro);
    expect(gasto.inflacion).toBeGreaterThan(normal.inflacion + 0.002);
  });

  it('una inflación alta resta inversión, confianza de las empresas y PIB (si se hace mal, empeora)', () => {
    const normal = economiaDe('BRA');
    const alta = conInflacion(economiaDe('BRA'), 0.25);
    expect(demandaConConfianza(alta).inversion).toBeLessThan(
      demandaConConfianza(normal).inversion * 0.9,
    );
    meses(normal, 12);
    meses(alta, 12);
    expect(alta.confianzaEmpresas).toBeLessThan(normal.confianzaEmpresas - 5);
    expect(alta.pib).toBeLessThan(normal.pib);
  });

  it('la deflación frena el consumo', () => {
    const normal = economiaDe('FRA');
    const deflacion = conInflacion(economiaDe('FRA'), -0.03);
    expect(demandaConConfianza(deflacion).consumo).toBeLessThan(
      demandaConConfianza(normal).consumo * 0.98,
    );
    meses(normal, 12);
    meses(deflacion, 12);
    expect(deflacion.pib).toBeLessThan(normal.pib);
  });

  it('el PIB nominal crece con los precios', () => {
    const india = economiaDe('IND');
    meses(india, 60);
    expect(india.nivelPrecios).toBeGreaterThan(1.6);
    expect(pibNominal(india) / india.pib).toBeCloseTo(india.nivelPrecios, 10);
  });

  it('en 10 años, la inflación de todos los países se queda en límites creíbles', () => {
    for (const pais of jugables) {
      const e = economiaInicial(pais.datos, pais.nivelRenta)!;
      meses(e, 120);
      expect(Number.isFinite(e.inflacion) && Number.isFinite(e.nivelPrecios), pais.id).toBe(true);
      expect(e.inflacion, pais.id).toBeGreaterThanOrEqual(-0.1);
      expect(e.inflacion, pais.id).toBeLessThanOrEqual(1);
      expect(e.serieInflacion, pais.id).toHaveLength(121);
    }
  });
});
