/**
 * Ficha de un país en el mapa (tarea f4-t1): el recuadro que sigue al ratón y el panel
 * lateral que se abre al seleccionarlo. Solo muestra datos de /public/data/paises-2010.json;
 * los valores estimados se marcan con un asterisco.
 */
import { urlBandera } from '../av/banderas';
import { dolares, dolaresPorPersona, personas, porcentaje } from '../compartido/formato';
import { esEstimado, type ConjuntoPaises, type PaisDatos } from '../datos/paises';
import { t } from '../i18n';
import type { CapaDatos } from '../map/capas';
import { el, type Hijo } from './dom';
import { nombreCapa, textoValorCapa } from './leyenda';

type Formato = (valor: number) => string;

/** Datos clave del panel, en este orden. */
const CAMPOS_PANEL: readonly [string, Formato][] = [
  ['poblacion', personas],
  ['pib', dolares],
  ['pibPerCapita', dolaresPorPersona],
  ['crecimientoPib', porcentaje],
  ['paro', porcentaje],
  ['inflacion', porcentaje],
  ['deudaPib', porcentaje],
  ['esperanzaVida', (v) => t('juego.mapa.pais.anos', { valor: Math.round(v) })],
];

/** Datos breves del recuadro que sigue al ratón. */
const CAMPOS_RECUADRO: readonly [string, Formato][] = [
  ['poblacion', personas],
  ['pibPerCapita', dolaresPorPersona],
];

function bandera(pais: PaisDatos, clase: string): HTMLImageElement {
  return el('img', { class: clase, src: urlBandera(pais.id), alt: '', width: 36, height: 27 });
}

/** «Territorio dependiente de Reino Unido», «Estatus especial: …» o nada. */
export function estatusPais(pais: PaisDatos, conjunto: ConjuntoPaises): string | null {
  if (pais.tipo === 'dependiente' && pais.soberano) {
    const soberano = conjunto.paises[pais.soberano]?.nombre ?? pais.soberano;
    return t('juego.mapa.pais.dependiente', { soberano });
  }
  if (pais.tipo === 'especial' && pais.estatus) {
    return t('juego.mapa.pais.especial', { estatus: pais.estatus });
  }
  return null;
}

/** Valor ya formateado y si es estimado (o null si no hay dato). */
export function valorCampo(
  pais: PaisDatos,
  campo: string,
  formato: Formato,
): { texto: string; estimado: boolean } | null {
  const valor = pais.datos[campo];
  if (valor === null || valor === undefined) return null;
  return { texto: formato(valor), estimado: esEstimado(pais.origen[campo]) };
}

function nombreCampo(campo: string, conjunto: ConjuntoPaises): string {
  const clave = `juego.mapa.pais.${campo}`;
  const texto = t(clave);
  return texto === clave ? (conjunto.campos[campo]?.nombre ?? campo) : texto;
}

/**
 * Contenido del recuadro que aparece al pasar el ratón. Con una capa de datos activa (Fase 6),
 * su dato va primero y destacado.
 */
export function contenidoRecuadro(
  pais: PaisDatos,
  conjunto: ConjuntoPaises,
  capa: CapaDatos | null = null,
): Hijo[] {
  const datoCapa = capa ? valorCampo(pais, capa.campo, (v) => textoValorCapa(capa, v)) : null;
  const lineaCapa = capa
    ? el(
        'span',
        { class: 'ficha__dato ficha__dato--capa' },
        `${nombreCapa(capa)}: ${
          datoCapa
            ? `${datoCapa.texto}${datoCapa.estimado ? '*' : ''}`
            : t('juego.mapa.pais.sinDato')
        }`,
      )
    : null;
  const campos = CAMPOS_RECUADRO.filter(([campo]) => campo !== capa?.campo);
  const lineas = campos.map(([campo, formato]) => {
    const valor = valorCampo(pais, campo, formato);
    return valor
      ? el(
          'span',
          { class: 'ficha__dato' },
          `${nombreCampo(campo, conjunto)}: ${valor.texto}${valor.estimado ? '*' : ''}`,
        )
      : null;
  });
  const estatus = estatusPais(pais, conjunto);
  return [
    el(
      'div',
      { class: 'ficha__cabecera' },
      bandera(pais, 'ficha__bandera'),
      el('strong', {}, pais.nombre),
    ),
    estatus ? el('span', { class: 'ficha__estatus' }, estatus) : null,
    lineaCapa,
    el('span', { class: 'ficha__dato' }, `${t('juego.mapa.pais.capital')}: ${pais.capital}`),
    ...lineas,
  ];
}

/** Contenido del panel lateral del país seleccionado. */
export function contenidoPanel(
  pais: PaisDatos,
  conjunto: ConjuntoPaises,
  alCerrar: () => void,
): Hijo[] {
  const cerrar = el(
    'button',
    { class: 'panel-pais__cerrar', type: 'button', 'aria-label': t('juego.mapa.pais.cerrar') },
    '×',
  );
  cerrar.addEventListener('click', alCerrar);
  let hayEstimados = false;
  const filas = CAMPOS_PANEL.map(([campo, formato]) => {
    const valor = valorCampo(pais, campo, formato);
    if (valor?.estimado) hayEstimados = true;
    return el(
      'div',
      { class: 'panel-pais__fila' },
      el('dt', {}, nombreCampo(campo, conjunto)),
      el(
        'dd',
        { class: valor?.estimado ? 'es-estimado' : undefined },
        valor ? `${valor.texto}${valor.estimado ? '*' : ''}` : t('juego.mapa.pais.sinDato'),
      ),
    );
  });
  const estatus = estatusPais(pais, conjunto);
  return [
    el(
      'header',
      { class: 'panel-pais__cabecera' },
      bandera(pais, 'panel-pais__bandera'),
      el('h2', { class: 'panel-pais__nombre', id: 'panel-pais-titulo' }, pais.nombre),
      cerrar,
    ),
    estatus ? el('p', { class: 'panel-pais__estatus' }, estatus) : null,
    pais.jugable ? null : el('p', { class: 'panel-pais__estatus' }, t('juego.mapa.pais.noJugable')),
    el(
      'dl',
      { class: 'panel-pais__datos' },
      el(
        'div',
        { class: 'panel-pais__fila' },
        el('dt', {}, t('juego.mapa.pais.capital')),
        el('dd', {}, pais.capital),
      ),
      el(
        'div',
        { class: 'panel-pais__fila' },
        el('dt', {}, t('juego.mapa.pais.region')),
        el('dd', {}, pais.regionNombre),
      ),
      el(
        'div',
        { class: 'panel-pais__fila' },
        el('dt', {}, t('juego.mapa.pais.nivelRenta')),
        el('dd', {}, t('juego.mapa.pais.renta.' + pais.nivelRenta)),
      ),
      ...filas,
    ),
    el('p', { class: 'panel-pais__pie' }, t('juego.mapa.pais.datos2010')),
    hayEstimados ? el('p', { class: 'panel-pais__pie' }, t('juego.mapa.pais.estimado')) : null,
  ];
}
