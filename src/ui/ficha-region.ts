/**
 * Ficha de una región en el mapa (tarea f5-t3): el recuadro que aparece al pasar el ratón y el
 * panel que se abre al hacer clic. Muestra su país, su población y su PIB de 2010, con la fuente
 * de cada dato; las estimaciones llevan asterisco.
 */
import { urlBandera } from '../av/banderas';
import { dolares, dolaresPorPersona, enteros, personas, porcentaje } from '../compartido/formato';
import type { ConjuntoPaises, PaisDatos } from '../datos/paises';
import {
  actividadPrincipal,
  RECURSOS_POR_TIPO,
  SECTORES,
  sectoresDePais,
  tipoDeRecurso,
  type EconomiaRegion,
  type Recurso,
  type RecursoRegion,
  type TipoRecurso,
} from '../datos/regiones-economia';
import { t } from '../i18n';
import { valorPais, valorRegion, type CapaDatos } from '../map/capas';
import type { RegionSenalada } from '../map/mapa';
import { el, type Hijo } from './dom';
import { barraDePartes } from './componentes/graficos';
import { conInformacion } from './componentes/info';
import { crearPestanas } from './componentes/pestanas';
import { icono } from '../av/iconos';
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

export interface OpcionesFichaRegion {
  /** Economía, recursos y ciudades (undefined mientras se cargan; null si no hay). */
  economia?: EconomiaRegion | null;
  /** Pestaña que se abre (la última que miró el jugador). */
  pestana?: string;
  alCambiarPestana?: (id: string) => void;
  /** Ir a una ciudad de la región en el mapa. */
  alIrACiudad?: (nombre: string) => void;
}

const km2 = (valor: number): string =>
  t('juego.mapa.region.km2', {
    n:
      valor < 100
        ? new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(valor)
        : enteros(valor),
  });
const pesoTexto = (peso: number): string => porcentaje(peso * 100);

/** Fila «nombre: valor», con una explicación al pasar el ratón o con el foco si se da. */
function fila(titulo: string, valor: string, estimado = false, explicacion?: string): HTMLElement {
  const nombre = el('dt', explicacion ? { tabindex: 0 } : {}, titulo);
  if (explicacion) conInformacion(nombre, () => [el('strong', {}, titulo), el('br'), explicacion]);
  return el(
    'div',
    { class: 'panel-pais__fila' },
    nombre,
    el('dd', { class: estimado ? 'es-estimado' : undefined }, valor),
  );
}

/** Reparto por sectores de la región o, si no lo hay, el de su país (y de dónde sale). */
function sectoresDeRegion(
  economia: EconomiaRegion | null | undefined,
  pais: PaisDatos | undefined,
): { valores: [number, number, number]; delPais: boolean } | null {
  if (economia?.sectores) return { valores: economia.sectores, delPais: false };
  const delPais = sectoresDePais(
    pais?.datos.agriculturaPib,
    pais?.datos.industriaPib,
    pais?.datos.serviciosPib,
  );
  return delPais ? { valores: delPais, delPais: true } : null;
}

function pestanaResumen(
  region: RegionSenalada,
  paises: ConjuntoPaises | null,
  datos: DatosRegion | null,
  economia: EconomiaRegion | null | undefined,
): Hijo[] {
  const sinDato = t('juego.mapa.region.sinDato');
  const pais = paises?.paises[region.pais];
  if (!datos) return [el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.cargando'))];
  const porHabitante = pibPorHabitante(datos);
  const superficie = economia?.superficie ?? null;
  const superficieEstimada = economia?.origenSuperficie?.startsWith('EST:') ?? false;
  const densidad = datos.poblacion !== null && superficie ? datos.poblacion / superficie : null;
  const principal = economia?.capital ?? (economia?.ciudades[0] ? economia.ciudades[0][0] : null);
  const sectores = sectoresDeRegion(economia, pais);
  const paisSectores = sectoresDePais(
    pais?.datos.agriculturaPib,
    pais?.datos.industriaPib,
    pais?.datos.serviciosPib,
  );
  const actividad =
    sectores && !sectores.delPais ? actividadPrincipal(sectores.valores, paisSectores) : null;
  return [
    el(
      'dl',
      { class: 'panel-pais__datos' },
      fila(t('juego.mapa.region.pais'), nombrePais(region, paises)),
      economia === undefined
        ? null
        : fila(
            economia?.capital
              ? t('juego.mapa.region.capital')
              : t('juego.mapa.region.ciudadPrincipal'),
            principal ?? sinDato,
            false,
            t('juego.mapa.region.explicacion.capital'),
          ),
      fila(
        t('juego.mapa.region.poblacion'),
        datos.poblacion === null
          ? sinDato
          : conMarca(enteros(datos.poblacion), esEstimado(datos.origenPoblacion)),
        esEstimado(datos.origenPoblacion),
        `${t('juego.mapa.region.explicacion.poblacion')} ${textoFuente(datos.origenPoblacion)}`,
      ),
      fila(
        t('juego.mapa.region.pib'),
        datos.pib === null ? sinDato : conMarca(dolares(datos.pib), esEstimado(datos.origenPib)),
        esEstimado(datos.origenPib),
        `${t('juego.mapa.region.explicacion.pib')} ${textoFuente(datos.origenPib)}`,
      ),
      fila(
        t('juego.mapa.region.pibPorHabitante'),
        porHabitante ? conMarca(porHabitante.texto, porHabitante.estimado) : sinDato,
        porHabitante?.estimado ?? false,
      ),
      economia === undefined
        ? null
        : fila(
            t('juego.mapa.region.superficie'),
            superficie ? conMarca(km2(superficie), superficieEstimada) : sinDato,
            superficieEstimada,
            t('juego.mapa.region.explicacion.superficie'),
          ),
      densidad === null
        ? null
        : fila(
            t('juego.mapa.region.densidad'),
            conMarca(
              t('juego.mapa.region.habKm2', { n: enteros(Math.round(densidad)) }),
              superficieEstimada || esEstimado(datos.origenPoblacion),
            ),
            superficieEstimada || esEstimado(datos.origenPoblacion),
            t('juego.mapa.region.explicacion.densidad'),
          ),
      actividad
        ? fila(
            t('juego.mapa.region.actividad'),
            t('juego.mapa.region.actividadTexto', {
              sector: t(`juego.mapa.region.sectores.${actividad.principal}`),
              peso: pesoTexto(actividad.peso),
            }),
            false,
            t('juego.mapa.region.explicacion.actividad'),
          )
        : null,
    ),
    actividad?.destaca
      ? el(
          'p',
          { class: 'ficha-region__destaca' },
          t('juego.mapa.region.destaca', {
            sector: t(`juego.mapa.region.sectoresArticulo.${actividad.destaca.sector}`),
            peso: pesoTexto(actividad.destaca.peso),
            pais: nombrePais(region, paises),
            media: pesoTexto(actividad.destaca.mediaPais),
          }),
        )
      : null,
    economia === undefined
      ? el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.cargandoEconomia'))
      : null,
  ];
}

/** Lista de recursos agrupados por tipo (energía, metales…), de más a menos yacimientos. */
function listaRecursos(economia: EconomiaRegion): Hijo[] {
  if (economia.recursos.length === 0) {
    return [el('p', { class: 'ficha-recursos__nada' }, t('juego.mapa.region.recursos.nada'))];
  }
  const porTipo = new Map<TipoRecurso, RecursoRegion[]>();
  for (const recurso of economia.recursos) {
    const tipo = tipoDeRecurso(recurso[0]);
    porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), recurso]);
  }
  // Primero el tipo con más yacimientos (en Antofagasta, los metales por el cobre).
  const total = (tipo: TipoRecurso): number =>
    porTipo.get(tipo)!.reduce((suma, [, n]) => suma + n, 0);
  return (Object.keys(RECURSOS_POR_TIPO) as TipoRecurso[])
    .filter((tipo) => porTipo.has(tipo))
    .sort((a, b) => total(b) - total(a))
    .map((tipo) =>
      el(
        'section',
        { class: `ficha-recursos__grupo ficha-recursos__grupo--${tipo}` },
        el('h4', { class: 'ficha-recursos__tipo' }, t(`juego.mapa.region.recursos.tipos.${tipo}`)),
        el(
          'ul',
          { class: 'ficha-recursos__lista' },
          ...porTipo
            .get(tipo)!
            .map(([recurso, n, ejemplos]) =>
              el(
                'li',
                { class: 'ficha-recursos__recurso', 'data-recurso': recurso },
                iconoRecurso(recurso),
                el(
                  'span',
                  { class: 'ficha-recursos__texto' },
                  el('strong', {}, t(`juego.mapa.region.recursos.nombres.${recurso}`)),
                  el(
                    'span',
                    { class: 'ficha-recursos__cuenta' },
                    n === 1
                      ? t('juego.mapa.region.recursos.yacimiento')
                      : t('juego.mapa.region.recursos.yacimientos', { n: enteros(n) }),
                  ),
                  ejemplos.length > 0
                    ? el(
                        'span',
                        { class: 'ficha-recursos__ejemplos' },
                        t('juego.mapa.region.recursos.ejemplos', { lista: ejemplos.join(', ') }),
                      )
                    : null,
                ),
              ),
            ),
        ),
      ),
    );
}

function pestanaEconomia(
  region: RegionSenalada,
  paises: ConjuntoPaises | null,
  economia: EconomiaRegion | null | undefined,
): Hijo[] {
  if (economia === undefined) {
    return [el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.cargandoEconomia'))];
  }
  const sectores = sectoresDeRegion(economia, paises?.paises[region.pais]);
  return [
    sectores
      ? barraDePartes({
          titulo: t('juego.mapa.region.sectores.titulo'),
          partes: SECTORES.map((sector, i) => ({
            etiqueta: t(`juego.mapa.region.sectores.${sector}`),
            valor: sectores.valores[i]! * 100,
            color: i,
          })),
          formato: (v) => porcentaje(v),
        })
      : el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.sectores.sinDato')),
    sectores?.delPais
      ? el(
          'p',
          { class: 'panel-pais__pie' },
          t('juego.mapa.region.sectores.delPais', { pais: nombrePais(region, paises) }),
        )
      : null,
    el('h3', { class: 'ficha-recursos__titulo' }, t('juego.mapa.region.recursos.titulo')),
    economia ? el('div', { class: 'ficha-recursos' }, ...listaRecursos(economia)) : null,
    el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.recursos.nota')),
  ];
}

function pestanaCiudades(
  economia: EconomiaRegion | null | undefined,
  alIrACiudad: ((nombre: string) => void) | undefined,
): Hijo[] {
  if (economia === undefined) {
    return [el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.cargandoEconomia'))];
  }
  if (!economia || economia.ciudades.length === 0) {
    return [el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.ciudades.vacia'))];
  }
  return [
    el(
      'ol',
      { class: 'ficha-ciudades' },
      ...economia.ciudades.map(([nombre, poblacion, marca]) => {
        const boton = el(
          'button',
          {
            type: 'button',
            class: 'ficha-ciudades__boton',
            'aria-label': t('juego.mapa.region.ciudades.ir', { ciudad: nombre }),
          },
          iconoMarca(marca),
          el('span', { class: 'ficha-ciudades__nombre' }, nombre),
          marca
            ? el(
                'span',
                { class: 'ficha-ciudades__marca' },
                t(
                  marca === 'pais'
                    ? 'juego.mapa.region.ciudades.capitalPais'
                    : 'juego.mapa.region.ciudades.capitalRegion',
                ),
              )
            : null,
          el(
            'span',
            { class: 'ficha-ciudades__poblacion' },
            poblacion === null ? t('juego.mapa.region.ciudades.sinPoblacion') : personas(poblacion),
          ),
        );
        boton.addEventListener('click', () => alIrACiudad?.(nombre));
        return el('li', {}, boton);
      }),
    ),
  ];
}

function pestanaFuentes(
  datos: DatosRegion | null,
  economia: EconomiaRegion | null | undefined,
): Hijo[] {
  const elemento = (titulo: string, texto: string): HTMLElement =>
    el('li', {}, el('strong', {}, titulo), el('span', {}, texto));
  const origenSectores = economia?.origenSectores;
  const textoSuperficie: Record<string, string> = {
    WD: t('juego.mapa.region.fuentesRegion.superficieWd'),
    'EST:mapa': t('juego.mapa.region.fuentesRegion.superficieMapa'),
  };
  const textoCapital: Record<string, string> = {
    NE: t('juego.mapa.region.fuentesRegion.capitalNe'),
    WD: t('juego.mapa.region.fuentesRegion.capitalWd'),
    pais: t('juego.mapa.region.fuentesRegion.capitalPais'),
  };
  return [
    el(
      'ul',
      { class: 'ficha-fuentes' },
      datos
        ? elemento(
            t('juego.mapa.region.fuentesRegion.poblacion'),
            textoFuente(datos.origenPoblacion),
          )
        : null,
      datos
        ? elemento(t('juego.mapa.region.fuentesRegion.pib'), textoFuente(datos.origenPib))
        : null,
      economia === undefined
        ? null
        : elemento(
            t('juego.mapa.region.fuentesRegion.sectores'),
            origenSectores?.endsWith(':conjunto')
              ? t('juego.mapa.region.fuentesRegion.sectoresConjunto')
              : origenSectores
                ? t('juego.mapa.region.fuentesRegion.sectoresDose')
                : t('juego.mapa.region.fuentesRegion.sectoresPais'),
          ),
      economia
        ? elemento(
            t('juego.mapa.region.fuentesRegion.recursos'),
            t('juego.mapa.region.fuentesRegion.recursosFuente'),
          )
        : null,
      economia?.origenSuperficie
        ? elemento(
            t('juego.mapa.region.fuentesRegion.superficie'),
            textoSuperficie[economia.origenSuperficie] ??
              t('juego.mapa.region.fuentesRegion.superficiePais'),
          )
        : null,
      economia?.origenCapital
        ? elemento(
            t('juego.mapa.region.fuentesRegion.capital'),
            textoCapital[economia.origenCapital] ?? economia.origenCapital,
          )
        : null,
      economia && economia.ciudades.length > 0
        ? elemento(
            t('juego.mapa.region.fuentesRegion.ciudades'),
            t('juego.mapa.region.fuentesRegion.ciudadesFuente'),
          )
        : null,
    ),
    el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.sectores.industriaNota')),
  ];
}

/** Contenido del panel de la región seleccionada (tarea f9-t3): cabecera y pestañas. */
export function contenidoPanelRegion(
  region: RegionSenalada,
  paises: ConjuntoPaises | null,
  datos: DatosRegion | null,
  alCerrar: () => void,
  alVerPais: () => void,
  opciones: OpcionesFichaRegion = {},
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
  const { economia } = opciones;
  const hayEstimados =
    datos !== null &&
    (esEstimado(datos.origenPoblacion) ||
      esEstimado(datos.origenPib) ||
      (economia?.origenSuperficie?.startsWith('EST:') ?? false));
  const pestanas = crearPestanas(
    [
      {
        id: 'resumen',
        titulo: t('juego.mapa.region.pestanas.resumen'),
        contenido: () => pestanaResumen(region, paises, datos, economia),
      },
      {
        id: 'economia',
        titulo: t('juego.mapa.region.pestanas.economia'),
        contenido: () => pestanaEconomia(region, paises, economia),
      },
      {
        id: 'ciudades',
        titulo: t('juego.mapa.region.pestanas.ciudades'),
        contenido: () => pestanaCiudades(economia, opciones.alIrACiudad),
      },
      {
        id: 'fuentes',
        titulo: t('juego.mapa.region.pestanas.fuentes'),
        contenido: () => pestanaFuentes(datos, economia),
      },
    ],
    {
      etiqueta: t('juego.mapa.region.pestanas.etiqueta', { region: region.nombre }),
      ...(opciones.pestana ? { inicial: opciones.pestana } : {}),
      ...(opciones.alCambiarPestana ? { alCambiar: opciones.alCambiarPestana } : {}),
    },
  );
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
    pestanas.elemento,
    datos ? el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.ajustado')) : null,
    hayEstimados ? el('p', { class: 'panel-pais__pie' }, t('juego.mapa.region.estimado')) : null,
    verPais,
  ];
}

/** Marca de color del recurso (su icono llega en la tarea f9-t4). */
function iconoRecurso(recurso: Recurso): HTMLElement {
  return el('span', {
    class: `ficha-recursos__marca ficha-recursos__marca--${tipoDeRecurso(recurso)}`,
    'aria-hidden': 'true',
  });
}

/** Icono de una ciudad de la lista: estrella si es capital, edificio si no. */
function iconoMarca(marca: '' | 'pais' | 'region'): HTMLElement {
  return el(
    'span',
    {
      class: `ficha-ciudades__icono${marca ? ` ficha-ciudades__icono--${marca}` : ''}`,
      'aria-hidden': 'true',
    },
    icono(marca === 'pais' ? 'estrella' : 'ciudad'),
  );
}
