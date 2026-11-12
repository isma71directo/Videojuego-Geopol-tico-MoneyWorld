/**
 * Ficha de una ciudad en el mapa (ajuste f4-a4): el recuadro que aparece al pasar el ratón por
 * su punto o su nombre y el panel que se abre al hacer clic. Muestra su país, si es capital y
 * su población de 2010 (o la más cercana), con el año y la fuente del dato.
 */
import { urlBandera } from '../av/banderas';
import { enteros, personas } from '../compartido/formato';
import type { ConjuntoPaises } from '../datos/paises';
import { t } from '../i18n';
import type { Ciudad } from '../map/ciudades';
import { el, type Hijo } from './dom';

/** Año y fuente de la población a partir de su origen («WD:2008», «ONU:2010»…). */
export function origenDePoblacion(
  origen: string | null,
): { fuente: string; anio: number | null } | null {
  if (!origen) return null;
  const [sigla, anio] = origen.split(':');
  const clave = `juego.mapa.ciudad.fuentes.${sigla}`;
  const fuente = t(clave);
  return {
    fuente: fuente === clave ? (sigla ?? origen) : fuente,
    anio: anio && /^\d{4}$/.test(anio) ? Number(anio) : null,
  };
}

function nombrePais(ciudad: Ciudad, conjunto: ConjuntoPaises | null): string {
  return conjunto?.paises[ciudad.pais]?.nombre ?? ciudad.pais;
}

/** «Capital de España», «Capital de Cáceres (España)» o «Ciudad de España». */
export function subtituloCiudad(ciudad: Ciudad, conjunto: ConjuntoPaises | null): string {
  const pais = nombrePais(ciudad, conjunto);
  if (ciudad.capital) return t('juego.mapa.ciudad.capitalDe', { pais });
  if (ciudad.capitalRegional && ciudad.capitalDe) {
    return t('juego.mapa.ciudad.capitalRegionalDe', { region: ciudad.capitalDe, pais });
  }
  return t('juego.mapa.ciudad.ciudadDe', { pais });
}

/** «675.121 (2010)», «3,3 millones (2010)» o «Sin dato». */
export function textoPoblacion(ciudad: Ciudad, corto: boolean): string {
  if (ciudad.poblacion === null) return t('juego.mapa.ciudad.sinDato');
  const valor = corto ? personas(ciudad.poblacion) : enteros(ciudad.poblacion);
  const anio = origenDePoblacion(ciudad.origenPoblacion)?.anio;
  return anio ? t('juego.mapa.ciudad.conAnio', { valor, anio }) : valor;
}

function bandera(ciudad: Ciudad, clase: string): HTMLImageElement {
  return el('img', { class: clase, src: urlBandera(ciudad.pais), alt: '', width: 36, height: 27 });
}

/** Contenido del recuadro que aparece al pasar el ratón por una ciudad. */
export function contenidoRecuadroCiudad(ciudad: Ciudad, conjunto: ConjuntoPaises | null): Hijo[] {
  return [
    el(
      'div',
      { class: 'ficha__cabecera' },
      bandera(ciudad, 'ficha__bandera'),
      el('strong', {}, ciudad.nombre),
    ),
    el('span', { class: 'ficha__dato' }, subtituloCiudad(ciudad, conjunto)),
    el(
      'span',
      { class: 'ficha__dato' },
      `${t('juego.mapa.ciudad.poblacion')}: ${textoPoblacion(ciudad, true)}`,
    ),
  ];
}

/** Contenido del panel de la ciudad seleccionada. */
export function contenidoPanelCiudad(
  ciudad: Ciudad,
  conjunto: ConjuntoPaises | null,
  alCerrar: () => void,
  alVerPais: () => void,
): Hijo[] {
  const cerrar = el(
    'button',
    { class: 'panel-pais__cerrar', type: 'button', 'aria-label': t('juego.mapa.ciudad.cerrar') },
    '×',
  );
  cerrar.addEventListener('click', alCerrar);
  const verPais = el(
    'button',
    { class: 'boton panel-pais__accion', type: 'button' },
    t('juego.mapa.ciudad.verPais', { pais: nombrePais(ciudad, conjunto) }),
  );
  verPais.addEventListener('click', alVerPais);
  const origen = origenDePoblacion(ciudad.origenPoblacion);
  const fila = (titulo: string, valor: string): HTMLElement =>
    el('div', { class: 'panel-pais__fila' }, el('dt', {}, titulo), el('dd', {}, valor));
  return [
    el(
      'header',
      { class: 'panel-pais__cabecera' },
      bandera(ciudad, 'panel-pais__bandera'),
      el('h2', { class: 'panel-pais__nombre', id: 'panel-pais-titulo' }, ciudad.nombre),
      cerrar,
    ),
    el('p', { class: 'panel-pais__subtitulo' }, subtituloCiudad(ciudad, conjunto)),
    el(
      'dl',
      { class: 'panel-pais__datos' },
      fila(
        t('juego.mapa.ciudad.poblacion'),
        ciudad.poblacion === null ? t('juego.mapa.ciudad.sinDato') : enteros(ciudad.poblacion),
      ),
      origen
        ? fila(
            t('juego.mapa.ciudad.anioDato'),
            origen.anio ? String(origen.anio) : t('juego.mapa.ciudad.sinAnio'),
          )
        : null,
      origen ? fila(t('juego.mapa.ciudad.fuente'), origen.fuente) : null,
    ),
    origen && origen.anio !== 2010
      ? el('p', { class: 'panel-pais__pie' }, t('juego.mapa.ciudad.notaAnio'))
      : null,
    verPais,
  ];
}
