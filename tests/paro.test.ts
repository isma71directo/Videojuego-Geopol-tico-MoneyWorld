/** Paro: ley de Okun, paro estructural e histéresis (tarea f16-t1). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  avanzarMes,
  brechaProduccion,
  completarEconomia,
  demandaConConfianza,
  economiaInicial,
  faltaEconomia,
  paroCiclico,
  SECTORES,
  subidaDelParo,
  type EconomiaPais,
} from '../src/sim/economia';
import { desempaquetar, JUEGO } from '../src/sim/guardado';
import { crearPartida, FORMATO_PARTIDA } from '../src/sim/partida';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const jugables = Object.values(paises.paises).filter((p) => p.jugable);
const economiaDe = (id: string): EconomiaPais =>
  economiaInicial(paises.paises[id]!.datos, paises.paises[id]!.nivelRenta)!;
const meses = (e: EconomiaPais, n: number) => {
  for (let i = 0; i < n; i++) avanzarMes(e);
};
const trabajo = (e: EconomiaPais) => SECTORES.reduce((t, s) => t + e.sectores[s].trabajo, 0);

describe('el paro de 2010 (tarea f16-t1)', () => {
  it('cada país empieza con su paro real de 2010, que es también su paro estructural', () => {
    const espana = economiaDe('ESP');
    expect(espana.paro * 100).toBeCloseTo(paises.paises.ESP!.datos.paro!, 3);
    expect(espana.paroEstructural).toBe(espana.paro);
    expect(paroCiclico(espana)).toBe(0);
    expect(espana.serieParo).toEqual([espana.paro]);
    expect(subidaDelParo(espana)).toBeNull();
  });

  it('el paro es más sensible en los países ricos y en los que ya tenían mucho paro (estimado)', () => {
    const sensibilidad = (id: string) => economiaDe(id).sensibilidadParo;
    // España (19,9 % de paro en 2010, mucho empleo temporal) más que Estados Unidos…
    expect(sensibilidad('ESP')).toBeGreaterThan(sensibilidad('USA'));
    // … y los países ricos más que los pobres, con más economía informal.
    expect(sensibilidad('USA')).toBeGreaterThan(sensibilidad('IND'));
    expect(sensibilidad('IND')).toBeGreaterThan(sensibilidad('ETH'));
    for (const pais of jugables) {
      const e = economiaInicial(pais.datos, pais.nivelRenta)!;
      expect(e.sensibilidadParo, pais.id).toBeGreaterThan(0);
      expect(e.sensibilidadParo, pais.id).toBeLessThanOrEqual(1);
    }
  });
});

describe('cómo evoluciona (tarea f16-t1)', () => {
  it('ley de Okun: con el PIB por debajo de su potencial, sube el paro (Grecia y España, 2010–2013)', () => {
    // Real: Grecia, del 12,7 % al 27,5 % en 2013; España, del 19,9 % al 26,1 %.
    const grecia = economiaDe('GRC');
    const espana = economiaDe('ESP');
    meses(grecia, 36);
    meses(espana, 36);
    expect(brechaProduccion(grecia)).toBeLessThan(-0.05);
    expect(grecia.paro).toBeGreaterThan(0.2);
    expect(espana.paro).toBeGreaterThan(0.23);
    expect(subidaDelParo(grecia)).toBeGreaterThan(0);
  });

  it('un país que crece en su potencial apenas cambia su paro', () => {
    for (const id of ['DEU', 'RUS', 'MEX']) {
      const e = economiaDe(id);
      const antes = e.paro;
      meses(e, 120);
      expect(Math.abs(e.paro - antes), id).toBeLessThan(0.01);
    }
  });

  it('si el Estado recorta su gasto, sube el paro (si se hace mal, empeora)', () => {
    const normal = economiaDe('DEU');
    const recorte = economiaDe('DEU');
    recorte.demandaBase.consumoPublico -= 0.03;
    meses(normal, 12);
    meses(recorte, 12);
    expect(recorte.paro).toBeGreaterThan(normal.paro + 0.005);
  });

  it('histéresis: si el paro se queda alto, parte se vuelve estructural y ya no baja sola', () => {
    const grecia = economiaDe('GRC');
    const inicial = grecia.paro;
    let estructural = grecia.paroEstructural;
    for (let m = 0; m < 120; m++) {
      avanzarMes(grecia);
      expect(grecia.paroEstructural).toBeGreaterThanOrEqual(estructural);
      estructural = grecia.paroEstructural;
    }
    expect(grecia.paroEstructural).toBeGreaterThan(inicial + 0.03);
    expect(grecia.paro).toBeGreaterThan(inicial + 0.03);
  });

  it('los parados no producen: con más paro estructural queda menos trabajo para producir', () => {
    const grecia = economiaDe('GRC');
    const antes = trabajo(grecia);
    meses(grecia, 60);
    // La población activa crece un poco cada año, pero los ocupados que producen bajan.
    expect(trabajo(grecia)).toBeLessThan(antes);
    const alemania = economiaDe('DEU');
    const antesAlemania = trabajo(alemania);
    meses(alemania, 60);
    expect(trabajo(alemania)).toBeGreaterThan(antesAlemania);
  });

  it('el mercado de trabajo asume la brecha poco a poco: el paro de Grecia baja aunque el PIB no se recupere', () => {
    const grecia = economiaDe('GRC');
    let maximo = 0;
    for (let m = 0; m < 120; m++) {
      avanzarMes(grecia);
      maximo = Math.max(maximo, grecia.paro);
    }
    expect(grecia.paro).toBeLessThan(maximo - 0.03);
    expect(grecia.pib).toBeLessThan(paises.paises.GRC!.datos.pib!);
  });

  it('el paro hunde el consumo y la confianza de los consumidores', () => {
    const normal = economiaDe('FRA');
    const conParo = economiaDe('FRA');
    conParo.paro += 0.05;
    expect(demandaConConfianza(conParo).consumo).toBeLessThan(
      demandaConConfianza(normal).consumo * 0.98,
    );
    meses(normal, 6);
    meses(conParo, 6);
    expect(conParo.confianzaConsumidores).toBeLessThan(normal.confianzaConsumidores - 1);
    expect(conParo.pib).toBeLessThan(normal.pib);
  });

  it('en 10 años, el paro de todos los países se queda en límites creíbles', () => {
    for (const pais of jugables) {
      const e = economiaInicial(pais.datos, pais.nivelRenta)!;
      meses(e, 120);
      expect(Number.isFinite(e.paro), pais.id).toBe(true);
      expect(e.paro, pais.id).toBeGreaterThanOrEqual(0.005);
      expect(e.paro, pais.id).toBeLessThanOrEqual(0.5);
      expect(e.serieParo, pais.id).toHaveLength(121);
    }
  });
});

describe('en la partida (tarea f16-t1)', () => {
  it('una partida de la v0.16.1 (formato 4) se migra y recibe el paro de 2010', () => {
    const partida = crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 5 },
      paises.paises,
    );
    const antigua = structuredClone(partida) as unknown as {
      formato: number;
      paises: Record<string, { economia: Record<string, unknown> | null }>;
    };
    antigua.formato = 4;
    for (const estado of Object.values(antigua.paises)) {
      if (!estado.economia) continue;
      for (const campo of [
        'paro',
        'paroEstructural',
        'sensibilidadParo',
        'brechaAsumida',
        'serieParo',
      ]) {
        delete estado.economia[campo];
      }
    }
    const cargada = desempaquetar({
      juego: JUEGO,
      formato: 4,
      version: '0.16.1',
      partida: antigua,
    }).partida;
    expect(cargada.formato).toBe(FORMATO_PARTIDA);
    expect(faltaEconomia(cargada)).toBe(true);
    completarEconomia(cargada, paises.paises);
    expect(faltaEconomia(cargada)).toBe(false);
    // Sin salto: la brecha de ahora se toma como asumida (al empezar, la de la confianza).
    for (const estado of Object.values(cargada.paises)) {
      if (estado.economia) estado.economia.brechaAsumida = 0;
    }
    expect(cargada).toEqual(partida);
  });
});
