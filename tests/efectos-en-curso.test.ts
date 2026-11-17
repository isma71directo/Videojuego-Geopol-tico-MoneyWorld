// @vitest-environment happy-dom
/** Ver los efectos en curso: en cada dato y en Informes (tarea f13-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { crearEfecto, type DefinicionEfecto, type Efecto } from '../src/sim/efectos';
import { crearPartida, type Partida } from '../src/sim/partida';
import { crearBarraPartida } from '../src/ui/barra-partida';
import { cerrarVentanas } from '../src/ui/componentes/ventana';
import {
  contenidoEfectosEnCurso,
  lineasEfectosDato,
  textoCambio,
  textoFechas,
} from '../src/ui/efectos-en-curso';
import { abrirElemento, ponerContenido, refrescarElemento } from '../src/ui/secciones';
import config from '../src/ui/config/secciones.json';
import { el } from '../src/ui/dom';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const nuevaPartida = (): Partida =>
  crearPartida(
    { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 1 },
    paises.paises,
  );
const efecto = (cambios: Partial<DefinicionEfecto> = {}, hoy = '2010-01-01', id = 'e1'): Efecto =>
  crearEfecto(
    {
      nombre: 'Efecto de prueba',
      origen: 'prueba',
      variable: { pais: 'ESP', campo: 'popularidad' },
      operacion: 'sumar',
      valor: 3,
      duracionDias: 10,
      ...cambios,
    },
    hoy,
    id,
  );

afterEach(() => {
  cerrarVentanas();
  ponerContenido('efectos', null);
  document.body.replaceChildren();
});

describe('cómo se cuenta un efecto (tarea f13-t2)', () => {
  it('lo que cambia y sus fechas', () => {
    expect(textoCambio(efecto())).toBe('+3 puntos');
    expect(textoCambio(efecto({ valor: -2.5 }))).toBe('−2,5 puntos');
    expect(textoCambio(efecto({ variable: { pais: 'ESP', campo: 'tesoreria' }, valor: 1e9 }))).toBe(
      '+1.000 M$',
    );
    expect(textoCambio(efecto({ operacion: 'multiplicar', valor: 1.1 }))).toBe('×1,1');
    expect(textoCambio(efecto({ operacion: 'fijar', valor: 40 }))).toBe('= 40 puntos');
    expect(textoFechas(efecto())).toBe('Del 1 de enero de 2010 al 11 de enero de 2010');
    expect(textoFechas(efecto({ duracionDias: undefined }))).toBe(
      'Desde el 1 de enero de 2010, sin fecha de fin',
    );
  });
});

describe('en la explicación de cada dato (tarea f13-t2)', () => {
  it('solo los efectos que cambian ese dato ahora, con su fecha de fin', () => {
    const partida = nuevaPartida();
    expect(lineasEfectosDato(partida, 'popularidad')).toEqual([]);
    partida.efectos = [efecto(), efecto({ retrasoDias: 5 }, '2010-01-01', 'e2')];
    const contenedor = el('div', {}, ...lineasEfectosDato(partida, 'popularidad'));
    expect(contenedor.textContent).toContain('Efectos en curso');
    expect(contenedor.textContent).toContain(
      '+3 puntos · Efecto de prueba (hasta el 11 de enero de 2010)',
    );
    // El que aún no ha empezado no sale.
    expect(contenedor.querySelectorAll('li')).toHaveLength(1);
    expect(lineasEfectosDato(partida, 'tesoreria')).toEqual([]);
  });

  it('la barra superior lo dice al pasar por la popularidad', () => {
    const partida = nuevaPartida();
    partida.efectos = [efecto()];
    const barra = crearBarraPartida({ partida, alIrAlPais: () => undefined });
    document.body.appendChild(barra.elemento);
    const dato = barra.elemento.querySelector<HTMLElement>('.partida-barra__dato--popularidad')!;
    // El valor que se ve ya lleva el efecto.
    expect(dato.textContent).toContain(`${partida.paises.ESP!.popularidad + 3} %`);
    dato.dispatchEvent(new FocusEvent('focus'));
    dato.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.querySelector('.info:not([hidden])')!.textContent).toContain(
      'Efecto de prueba',
    );
    barra.destruir();
  });
});

describe('ventana «Efectos en curso» de Informes (tarea f13-t2)', () => {
  it('es un elemento de Informes con su icono y su fase', () => {
    const informes = config.apartados.find((a) => a.id === 'informes')!;
    expect(informes.elementos).toContain('efectos');
    expect(config.secciones.efectos).toEqual({ icono: 'efectos', pestanas: { curso: 13 } });
  });

  it('sin partida, con partida y sin efectos, y con efectos en curso y por empezar', () => {
    expect(contenidoEfectosEnCurso(null).textContent).toContain('durante una partida');
    const partida = nuevaPartida();
    expect(contenidoEfectosEnCurso(partida).textContent).toContain('No hay ningún efecto en curso');
    partida.efectos = [
      efecto(),
      efecto({ retrasoDias: 5, origen: 'ley', nombre: 'Subida del IVA' }, '2010-01-01', 'e2'),
      efecto({ variable: { pais: 'FRA', campo: 'popularidad' } }, '2010-01-01', 'e3'),
    ];
    const contenido = contenidoEfectosEnCurso(partida);
    const efectos = contenido.querySelectorAll('.efectos__efecto');
    // Solo los del país del jugador.
    expect(efectos).toHaveLength(2);
    expect(efectos[0]!.textContent).toContain('En curso');
    expect(efectos[0]!.querySelector('.efectos__prueba')!.textContent).toBe('prueba');
    expect(efectos[1]!.classList.contains('efectos__efecto--pendiente')).toBe(true);
    expect(efectos[1]!.textContent).toContain('Empieza el 6 de enero de 2010');
    expect(efectos[1]!.textContent).toContain('Ley');
  });

  it('la ventana enseña el contenido de verdad y se repinta cuando cambia', () => {
    const partida = nuevaPartida();
    ponerContenido('efectos', () => contenidoEfectosEnCurso(partida));
    const ventana = abrirElemento('efectos')!;
    expect(ventana.elemento.textContent).toContain('No hay ningún efecto en curso');
    partida.efectos = [efecto()];
    refrescarElemento('efectos');
    expect(ventana.elemento.textContent).toContain('Efecto de prueba');
    // Sin contenido de verdad, el aviso de su fase.
    ponerContenido('efectos', null);
    cerrarVentanas();
    expect(abrirElemento('efectos')!.elemento.textContent).toContain('Fase 13');
  });
});
