/**
 * Ficha de una región en el mapa (tarea f5-t3): el recuadro que aparece al pasar el ratón y el
 * panel que se abre al hacer clic. Muestra su país, su población y su PIB de 2010, con la fuente
 * de cada dato; las estimaciones llevan asterisco.
 */
import { urlBandera } from '../av/banderas';
import { dolares, dolaresPorPersona, enteros, personas } from '../compartido/formato';
import type { ConjuntoPaises } from '../datos/paises';
import { t } from '../i18n';
import { valorPais, valorRegion, type CapaDatos } from '../map/capas';
import type { RegionSenalada } from '../map/mapa';
import { el, type Hijo } from './dom';
import { nombreCapa, textoValorCapa } from './leyenda';

/** Datos de una región en /public/data/regiones-2010-datos.json. */
export interface DatosRegion {
  poblacion: number | null;
  origenPoblacion: string | null;
  pib: number | null;
  origenPib: string | null;
}

export interface ConjuntoRegiones {
  fuente: string;
  regiones: Record<string, DatosRegion>;
}

const esEstimado = (origen: string | null): boolean => origen?.startsWith('EST:') ?? false;

/** «DOSE:2010» → «DOSE (2010)»; «EST:poblacion» → «Estimación». */
export function textoFuente(origen: string | null): string {
  if (!origen) return t('juego.mapa.region.sinDato');
  const [sigla, anio] = origen.split(':');
  const clave = `juego.mapa.region.fuentes.${sigla}`;
  const texto = t(clave, { anio: anio ?? '' });
  return texto === clave ? origen : texto;
}

function nombrePais(region: RegionSenalada, paises: ConjuntoPaises | null): string {
  return paises?.paises[region.pais]?.nombre ?? region.pais;
}

/** Valor con asterisco si es una estimación. */
const conMarca = (texto: string, estimado: boolean): string => (estimado ? `${texto}*` : texto);

/** PIB por habitante (con asterisco si alguno de los dos datos es estimado) o null. */
export function pibPorHabitante(datos: DatosRegion): { texto: string; estimado: boolean } | null {
  if (!datos.pib || !datos.poblacion) return null;
  return {
    texto: dolaresPorPersona(datos.pib / datos.poblacion),
    estimado: esEstimado(datos.origenPib) || esEstimado(datos.origenPoblacion),
  };
}

function bandera(region: RegionSenalada, clase: string): HTMLImageElement {
  return el('img', { class: clase, src: urlBandera(region.pais), alt: '', width: 36, height: 27 });
}

/**
 * Dato de la capa activa para la ficha de una región (Fase 6): el de la propia región en las
 * capas por región (riqueza y población) y, en las demás, el de su país, que se nombra.
 */
export function lineaCapaRegion(
  region: RegionSenalada,
  paises: ConjuntoPaises | null,
  datos: DatosRegion | null,
  capa: CapaDatos,
): string {
  if (capa.porRegion) {
    const dato = valorRegion(capa, datos, region.superficie);
    const texto = dato
      ? conMarca(textoValorCapa(capa, dato.valor), dato.estimado)
      : t('juego.mapa.region.sinDato');
    return `${nombreCapa(capa)}: ${texto}`;
  }
  const pais = paises?.paises[region.pais];
  const dato = pais ? valorPais(capa, pais) : null;
  const texto = dato
    ? conMarca(textoValorCapa(capa, dato.valor), dato.estimado)
    : t('juego.mapa.region.sinDato');
  return `${nombreCapa(capa)} (${nombrePais(region, paises)}): ${texto}`;
}

/** Contenido del recuadro que aparece al pasar el ratón por una región. */
export function contenidoRecuadroRegion(
  region: RegionSenalada,
  paises: ConjuntoPaises | null,
  datos: DatosRegion | null,
  capa: CapaDatos | null = null,
): Hijo[] {
  // Con una capa por región, su dato va arriba y no se repite debajo.
  const enCapa = capa?.porRegion ? capa.campo : null;
  const porHabitante = datos && enCapa !== 'pibPerCapita' ? pibPorHabitante(datos) : null;
  return [
    el(
      'div',
      { class: 'ficha__cabecera' },
      bandera(region, 'ficha__bandera'),
      el('strong', {}, region.nombre),
    ),
    el(
      'span',
      { class: 'ficha__dato' },
      t('juego.mapa.region.regionDe', { pais: nombrePais(region, paises) }),
    ),
    capa && datos
      ? el(
          'span',
          { class: 'ficha__dato ficha__dato--capa' },
          lineaCapaRegion(region, paises, datos, capa),
        )
      : null,
    datos?.poblacion && enCapa !== 'poblacion'
      ? el(
          'span',
          { class: 'ficha__dato' },
          `${t('juego.mapa.region.poblacion')}: ${conMarca(personas(datos.poblacion), esEstimado(datos.origenPoblacion))}`,
        )
      : null,
    porHabitante
      ? el(
          'span',
          { class: 'ficha__dato' },
          `${t('juego.mapa.region.pibPorHabitante')}: ${conMarca(porHabitante.texto, porHabitante.estimado)}`,
        )
      : null,
    datos ? null : el('span', { class: 'ficha__dato' }, t('juego.mapa.region.cargando')),
  ];
}

/** Contenido del panel de la región seleccionada. */
export function contenidoPanelRegion(
  region: RegionSenalada,
  paises: ConjuntoPaises | null,
  datos: DatosRegion | null,
  alCerrar: () => void,
  alVerPais: () => void,
): Hijo[] {
  const cerrar = el(
    'button',
    { class: 'panel-pais__cerrar', type: 'button', 'aria-label': t('juego.mapa.region.cerrar') },
    '×',
  );
  cerrar.addEventListener('click', alCerrar);
  const verPais = el(
    'button',
    { class: 'boton panel-pais__accion', type: 'button' },
    t('juego.mapa.region.verPais', { pais: nombrePais(region, paises) }),
  );
  verPais.addEventListener('click', alVerPais);
  const fila = (titulo: string, valor: string, estimado = false): HTMLElement =>
    el(
      'div',
      { class: 'panel-pais__fila' },
      el('dt', {}, titulo),
      el('dd', { class: estimado ? 'es-estimado' : undefined }, valor),
    );
  const sinDato = t('juego.mapa.region.sinDato');
  const porHabitante = datos ? pibPorHabitante(datos) : null;
  const hayEstimados =
    datos !== null && (esEstimado(datos.origenPoblacion) || esEstimado(datos.origenPib));
  return [
    el(
      'header',
      { class: 'panel-pais__cabecera' },
      bandera(region, 'panel-pais__bandera'),
      el('h2', { class: 'panel-pais__nombre', id: 'panel-pais-titulo' }, region.nombre),
      cerrar,
    ),
    el(
      'p',
      { class: 'panel-pais__subtitulo' },
      t('juego.mapa.region.regionDe', { pais: nombrePais(region, paises) }),
    ),
    datos
      ? el(
          'dl',
          { class: 'panel-pais__datos' },
          fila(
            t('juego.mapa.region.poblacion'),
            datos.poblacion === null
              ? sinDato
              : conMarca(enteros(datos.poblacion), esEstimado(datos.origenPoblacion)),
            esEstimado(datos.origenPoblacion),
          ),
          fila(
            t('juego.mapa.region.pib'),
            datos.pib === null
              ? sinDato
              : conMarca(dolares(datos.pib), esEstimado(datos.origenPib)),
            esEstimado(datos.origenPib),
          ),
          fila(
            t('juego.mapa.region.pibPorHabitante'),
            porHabitante ? conMarca(porHabitante.texto, porHabitante.estimado) : sinDato,
            porHabitante?.estimado ?? false,
          ),
          fila(t('juego.mapa.region.fuentePoblacion'), textoFuente(datos.origenPoblacion)),
          fila(t('juego.mapa.region.fuentePib'), textoFuente(datos.origenPib)),
        )
      : el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.cargando')),
    datos ? el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.ajustado')) : null,
    hayEstimados ? el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.estimado')) : null,
    verPais,
  ];
}
