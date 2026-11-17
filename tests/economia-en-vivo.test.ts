// @vitest-environment happy-dom
/** Confianza, ahorro y la economía en vivo en la ficha y en Economía › Economía (tarea f15-t3). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  ahorroNacional,
  avanzarMes,
  economiaInicial,
  objetivoConfianza,
  type EconomiaPais,
} from '../src/sim/economia';
import { cerrarVentanas } from '../src/ui/componentes/ventana';
import {
  bloqueEconomia,
  contenidoVentanaEconomia,
  crecimientoVisible,
  refrescarEconomiaEnVivo,
  textoMes,
} from '../src/ui/economia-en-vivo';
import { contenidoPanel } from '../src/ui/ficha-pais';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const economiaDe = (id: string): EconomiaPais =>
  economiaInicial(paises.paises[id]!.datos, paises.paises[id]!.nivelRenta)!;
const meses = (e: EconomiaPais, n: number) => {
  for (let i = 0; i < n; i++) avanzarMes(e);
};

afterEach(() => {
  cerrarVentanas();
  document.body.replaceChildren();
});

describe('confianza y ahorro (tarea f15-t3)', () => {
  it('la confianza sube si el país crece por encima de su potencial y baja si crece por debajo', () => {
    expect(objetivoConfianza(0, 'consumidores')).toBe(100);
    expect(objetivoConfianza(0.02, 'consumidores')).toBe(104);
    expect(objetivoConfianza(0.02, 'empresas')).toBe(106);
    expect(objetivoConfianza(-1, 'empresas')).toBe(60);
    expect(objetivoConfianza(1, 'consumidores')).toBe(140);
    // China salía de 2010 creciendo mucho (más confianza); Grecia, en crisis (menos).
    const china = economiaDe('CHN');
    const grecia = economiaDe('GRC');
    expect(china.confianzaEmpresas).toBeGreaterThan(110);
    expect(grecia.confianzaConsumidores).toBeLessThan(90);
    expect(grecia.confianzaEmpresas).toBeLessThan(grecia.confianzaConsumidores);
  });

  it('con el tiempo vuelve poco a poco hacia lo normal, al acercarse al potencial', () => {
    const grecia = economiaDe('GRC');
    const antes = grecia.confianzaEmpresas;
    meses(grecia, 48);
    expect(grecia.confianzaEmpresas).toBeGreaterThan(antes);
    expect(Math.abs(grecia.confianzaEmpresas - 100)).toBeLessThan(Math.abs(antes - 100));
  });

  it('más confianza, más consumo e inversión que en 2010; y el PIB no salta el primer mes', () => {
    const china = economiaDe('CHN');
    expect(china.demanda.inversion).toBeGreaterThan(china.demandaBase.inversion);
    expect(china.demanda.consumo).toBeGreaterThan(china.demandaBase.consumo);
    const grecia = economiaDe('GRC');
    expect(grecia.demanda.inversion).toBeLessThan(grecia.demandaBase.inversion);
    // El primer mes crece al ritmo de 2010, sin escalón por la confianza.
    const pib = china.pib;
    avanzarMes(china);
    const anual = Math.pow(china.pib / pib, 12) - 1;
    expect(anual).toBeGreaterThan(0.09);
    expect(anual).toBeLessThan(0.12);
  });

  it('el ahorro nacional es lo que no consumen los hogares ni el Estado', () => {
    const espana = economiaDe('ESP');
    expect(ahorroNacional(espana)).toBeCloseTo(
      1 - espana.demanda.consumo - espana.demanda.consumoPublico,
      10,
    );
    // China ahorra mucho más que Estados Unidos (como en 2010).
    expect(ahorroNacional(economiaDe('CHN'))).toBeGreaterThan(0.4);
    expect(ahorroNacional(economiaDe('USA'))).toBeLessThan(0.25);
  });
});

describe('la economía en vivo (tarea f15-t3)', () => {
  it('el crecimiento que se enseña: desde 2010 al principio y de 12 meses después', () => {
    const e = economiaDe('ESP');
    expect(crecimientoVisible(e)).toBeNull();
    meses(e, 3);
    expect(crecimientoVisible(e)).toMatchObject({ desdeInicio: true });
    meses(e, 10);
    expect(crecimientoVisible(e)).toMatchObject({ desdeInicio: false });
    expect(textoMes(0)).toBe('ene 2010');
    expect(textoMes(13)).toBe('feb 2011');
  });

  it('el bloque enseña los datos y se pone al día cada mes; el que no está a la vista se olvida', () => {
    const e = economiaDe('CHN');
    let fecha = '2010-01-01';
    const bloque = bloqueEconomia(() => ({ economia: e, fecha }));
    document.body.appendChild(bloque.elemento);
    const texto = () => bloque.elemento.textContent!;
    expect(texto()).toContain('En la partida');
    expect(texto()).toContain('1 de enero de 2010');
    expect(texto()).toContain('Confianza de las empresas');
    expect(texto()).toContain('Producción por sectores');
    expect(texto()).toContain('Industria');
    expect(texto()).toContain('PIB real desde enero de 2010');
    const pibAntes = bloque.elemento.querySelector('dd')!.textContent;
    meses(e, 12);
    fecha = '2011-01-01';
    refrescarEconomiaEnVivo();
    expect(texto()).toContain('1 de enero de 2011');
    expect(texto()).toContain('Crecimiento (12 meses)');
    expect(bloque.elemento.querySelector('dd')!.textContent).not.toBe(pibAntes);
    // Fuera de la página ya no se pinta.
    bloque.elemento.remove();
    fecha = '2012-01-01';
    refrescarEconomiaEnVivo();
    expect(texto()).not.toContain('2012');
  });

  it('en la ficha va arriba de la pestaña Economía, con los datos de 2010 debajo; fuera de una partida, no', () => {
    const espana = paises.paises.ESP!;
    const e = economiaDe('ESP');
    const conPartida = contenidoPanel(espana, paises, () => undefined, {
      pestana: 'economia',
      economiaEnVivo: () => ({ economia: e, fecha: '2010-01-01' }),
    });
    document.body.append(...(conPartida as Node[]));
    expect(document.querySelector('.panel-pais .economia, .economia')).not.toBeNull();
    expect(document.body.textContent).toContain('Datos de 2010');
    document.body.replaceChildren();
    const sinPartida = contenidoPanel(espana, paises, () => undefined, { pestana: 'economia' });
    document.body.append(...(sinPartida as Node[]));
    expect(document.querySelector('.economia')).toBeNull();
  });

  it('la ventana Economía › Economía es la del país del jugador, con la nota de las próximas fases', () => {
    const ventana = contenidoVentanaEconomia(
      () => ({ economia: economiaDe('FRA'), fecha: '2010-01-01' }),
      'Francia',
    );
    expect(ventana.textContent).toContain('Francia');
    expect(ventana.textContent).toContain('Fase 17');
    const vacia = contenidoVentanaEconomia(() => ({ economia: null, fecha: '2010-01-01' }), 'X');
    expect(vacia.textContent).toContain('Sin datos para su economía');
  });
});
