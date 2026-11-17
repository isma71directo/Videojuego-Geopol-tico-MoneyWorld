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
    meses(grecia, 96);
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
    expect(ventana.textContent).toContain('Fase 19');
    const vacia = contenidoVentanaEconomia(() => ({ economia: null, fecha: '2010-01-01' }), 'X');
    expect(vacia.textContent).toContain('Sin datos para su economía');
  });
});

describe('iconos y gráfico animado (tarea f15-t4)', () => {
  it('cada sector y cada indicador tiene su icono, con nombre en la galería', async () => {
    const { NOMBRES_ICONOS } = await import('../src/av/iconos');
    const { ICONO_SECTOR } = await import('../src/ui/economia-en-vivo');
    const { SECTORES } = await import('../src/sim/economia');
    const { t } = await import('../src/i18n');
    for (const sector of SECTORES) expect(NOMBRES_ICONOS).toContain(ICONO_SECTOR[sector]);
    for (const nuevo of [
      'consumo',
      'inversion',
      'ahorro',
      'confianza',
      'empresas',
      'construccion',
      'servicios',
      'potencial',
    ]) {
      expect(NOMBRES_ICONOS).toContain(nuevo);
      expect(t(`galeria.iconos.${nuevo}`)).not.toContain('galeria.');
    }
    const bloque = bloqueEconomia(() => ({ economia: economiaDe('CHN'), fecha: '2010-01-01' }));
    expect(bloque.elemento.querySelectorAll('.economia__termino .icono')).toHaveLength(11);
    expect(bloque.elemento.querySelectorAll('.grafico__leyenda--partes .icono')).toHaveLength(7);
  });

  it('ya no hay ajuste forzoso: los recortes llegan con la crisis de deuda (Fase 18)', () => {
    const bloque = bloqueEconomia(() => ({ economia: economiaDe('GRC'), fecha: '2010-01-01' }));
    expect(bloque.elemento.textContent).not.toContain('Ajuste forzoso');
  });

  it('enseña el paro, la inflación y el PIB nominal, con su gráfico (tarea f16-t3)', () => {
    const e = economiaDe('GRC');
    const bloque = bloqueEconomia(() => ({ economia: e, fecha: '2010-01-01' }));
    document.body.appendChild(bloque.elemento);
    const texto = () => bloque.elemento.textContent!;
    expect(texto()).toContain('PIB nominal');
    expect(texto()).toContain('Paro');
    expect(texto()).toContain('12,7 %');
    expect(texto()).toContain('Inflación');
    expect(texto()).toContain('4,7 %');
    expect(texto()).toContain('Paro e inflación desde enero de 2010');
    // Dos gráficos de líneas: el PIB y el paro con la inflación (dos líneas).
    expect(bloque.elemento.querySelectorAll('.grafico__linea')).toHaveLength(3);
    // Al cabo de un año, el paro de Grecia ha subido: sale en rojo, con lo que ha cambiado.
    meses(e, 12);
    refrescarEconomiaEnVivo();
    const fila = [...bloque.elemento.querySelectorAll('.panel-pais__fila')].find((f) =>
      f.querySelector('dt')!.textContent!.includes('Paro'),
    )!;
    expect(fila.querySelector('dd')!.textContent).toMatch(/\(\+\d/);
    expect(fila.querySelector('dd')!.classList.contains('economia__baja')).toBe(true);
  });

  it('el gráfico se dibuja la primera vez y después solo late el último punto', () => {
    const e = economiaDe('IND');
    const bloque = bloqueEconomia(() => ({ economia: e, fecha: '2010-01-01' }));
    document.body.appendChild(bloque.elemento);
    expect(bloque.elemento.querySelector('.grafico__linea--dibujar')).not.toBeNull();
    expect(bloque.elemento.querySelector('.grafico__linea')!.getAttribute('pathLength')).toBe('1');
    meses(e, 1);
    refrescarEconomiaEnVivo();
    expect(bloque.elemento.querySelector('.grafico__linea--dibujar')).toBeNull();
    expect(bloque.elemento.querySelector('.grafico__punto--latido')).not.toBeNull();
  });

  it('las marcas del eje no se pisan: cada tres meses al principio y cada enero después', async () => {
    const { marcasMeses } = await import('../src/ui/economia-en-vivo');
    expect(marcasMeses(7)).toEqual([0, 3, 6]);
    expect(marcasMeses(24)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24]);
    expect(marcasMeses(61)).toEqual([0, 12, 24, 36, 48, 60]);
    // Con muchos años, cada dos o más eneros: nunca más de siete marcas.
    expect(marcasMeses(12 * 30).length).toBeLessThanOrEqual(7);
  });
});
