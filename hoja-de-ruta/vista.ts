/** Dibujo de la Hoja de ruta a partir de roadmap.json. */
import { formatearFecha, formatearFechaHora } from '../src/compartido/fechas';
import { REPOSITORIO, URL_GDD } from '../src/compartido/proyecto';
import {
  fasesDeEtapa,
  numeroDeFase,
  progreso,
  rangoVersiones,
  type Estado,
  type Etapa,
  type Fase,
  type Roadmap,
  type Tarea,
} from '../src/compartido/roadmap';
import { etiquetaVersion } from '../src/compartido/version';
import { t } from '../src/i18n';
import { barraProgreso, el, type Hijo } from '../src/ui/dom';

/** Dirección del juego vista desde /hoja-de-ruta/. */
const URL_JUEGO = '../';

/** Claves de los desplegables abiertos: «etapa:A», «fase:fase-0». */
export type Abiertos = Set<string>;

/** Desplegables abiertos la primera vez: la etapa y la fase activas. */
export function abiertosIniciales(roadmap: Roadmap): Abiertos {
  const activa = roadmap.fases.find((fase) => fase.id === roadmap.faseActiva);
  return new Set(activa ? [`etapa:${activa.etapa}`, `fase:${activa.id}`] : []);
}

function chipEstado(estado: Estado): HTMLElement {
  return el('span', { class: `chip chip--${estado}` }, t(`comun.estado.${estado}`));
}

function seccion(id: string, titulo: string, ...hijos: Hijo[]): HTMLElement {
  return el(
    'section',
    { class: 'seccion', 'aria-labelledby': `titulo-${id}` },
    el('h2', { id: `titulo-${id}`, class: 'seccion__titulo' }, titulo),
    ...hijos,
  );
}

/** Desplegable que recuerda si está abierto aunque la página se vuelva a dibujar. */
function desplegable(
  clave: string,
  abiertos: Abiertos,
  clase: string,
  cabecera: Hijo[],
  cuerpo: Hijo[],
  modificador = '',
): HTMLDetailsElement {
  const detalles = el(
    'details',
    { class: `${clase} ${modificador}`.trim(), open: abiertos.has(clave) },
    el('summary', { class: `${clase}__cabecera` }, ...cabecera),
    el('div', { class: `${clase}__cuerpo` }, ...cuerpo),
  );
  detalles.addEventListener('toggle', () => {
    if (detalles.open) abiertos.add(clave);
    else abiertos.delete(clave);
  });
  return detalles;
}

function cabeceraPagina(roadmap: Roadmap): HTMLElement {
  const hastaLanzamiento = roadmap.fases.filter((fase) => fase.etapa !== 'I');
  const total = progreso(hastaLanzamiento);
  return el(
    'header',
    { class: 'cabecera' },
    el('p', { class: 'cabecera__juego' }, t('comun.titulo')),
    el('h1', { class: 'cabecera__titulo' }, t('hojaDeRuta.titulo')),
    el('p', { class: 'cabecera__subtitulo' }, t('hojaDeRuta.subtitulo')),
    el(
      'div',
      { class: 'cabecera__version' },
      el(
        'p',
        {},
        el('span', { class: 'cabecera__etiqueta' }, t('hojaDeRuta.versionActual')),
        el('strong', { class: 'cabecera__numero' }, etiquetaVersion(roadmap.versionActual)),
      ),
      el('a', { class: 'boton boton--principal', href: URL_JUEGO }, '▶ ', t('hojaDeRuta.jugar')),
    ),
    el(
      'div',
      { class: 'cabecera__progreso' },
      el(
        'p',
        { class: 'cabecera__progreso-texto' },
        el('span', {}, t('hojaDeRuta.progresoTotal')),
        el('span', {}, t('hojaDeRuta.tareasHechas', { ...total })),
      ),
      barraProgreso(total.porcentaje, t('hojaDeRuta.progresoTotal')),
    ),
  );
}

function ultimaSesion(roadmap: Roadmap): HTMLElement {
  const sesion = roadmap.ultimaSesion;
  const pendiente =
    sesion.pendienteDelJugador.length > 0
      ? el(
          'ul',
          { class: 'sesion__pendientes' },
          ...sesion.pendienteDelJugador.map((texto) => el('li', {}, texto)),
        )
      : el('p', {}, t('hojaDeRuta.ultimaSesion.nadaPendiente'));
  return seccion(
    'sesion',
    t('hojaDeRuta.ultimaSesion.titulo'),
    el(
      'div',
      { class: 'tarjeta sesion' },
      el('p', { class: 'sesion__fecha' }, formatearFecha(sesion.fecha)),
      el(
        'dl',
        { class: 'ficha' },
        el('dt', {}, t('hojaDeRuta.ultimaSesion.resumen')),
        el('dd', {}, sesion.resumen),
        el('dt', {}, t('hojaDeRuta.ultimaSesion.siguientePaso')),
        el('dd', {}, sesion.siguientePaso),
      ),
      el(
        'div',
        {
          class:
            sesion.pendienteDelJugador.length > 0
              ? 'sesion__jugador sesion__jugador--avisar'
              : 'sesion__jugador',
        },
        el('h3', {}, t('hojaDeRuta.ultimaSesion.pendienteDelJugador')),
        pendiente,
      ),
    ),
  );
}

function tarea(datos: Tarea): HTMLElement {
  const enlace = datos.enlace.startsWith('https://')
    ? el(
        'a',
        { class: 'tarea__enlace', href: datos.enlace, target: '_blank', rel: 'noopener' },
        t('hojaDeRuta.fases.verCambio'),
      )
    : null;
  return el(
    'li',
    { class: `tarea tarea--${datos.estado}` },
    el('span', { class: 'tarea__marca', 'aria-hidden': 'true' }),
    el(
      'div',
      { class: 'tarea__texto' },
      el('p', { class: 'tarea__titulo' }, datos.titulo),
      el(
        'p',
        { class: 'tarea__detalle' },
        el('span', { class: 'tarea__estado' }, t(`comun.estado.${datos.estado}`)),
        datos.fecha ? el('span', {}, formatearFecha(datos.fecha)) : null,
        enlace,
      ),
    ),
  );
}

function nombreFase(fase: Fase): string {
  const numero = numeroDeFase(fase.id);
  const version = etiquetaVersion(fase.version);
  return numero === null ? version : `${t('hojaDeRuta.fases.fase', { numero })} · ${version}`;
}

function dato(titulo: string, valor: string): Hijo[] {
  return valor === '' ? [] : [el('dt', {}, titulo), el('dd', {}, valor)];
}

function fase(datos: Fase, roadmap: Roadmap, abiertos: Abiertos): HTMLElement {
  const avance = progreso([datos]);
  const esActiva = datos.id === roadmap.faseActiva;
  const dependencias = datos.dependeDe
    .map((id) => roadmap.fases.find((otra) => otra.id === id))
    .filter((otra): otra is Fase => otra !== undefined)
    .map((otra) => `${nombreFase(otra)} · ${otra.nombre}`)
    .join(', ');

  const cabecera: Hijo[] = [
    el(
      'span',
      { class: 'fase__titulo' },
      el('span', { class: 'fase__numero' }, nombreFase(datos)),
      el('span', { class: 'fase__nombre' }, datos.nombre),
    ),
    el(
      'span',
      { class: 'fase__estado' },
      esActiva ? el('span', { class: 'chip chip--activa' }, t('hojaDeRuta.fases.activa')) : null,
      chipEstado(datos.estado),
      el('span', { class: 'fase__porcentaje' }, `${avance.porcentaje} %`),
    ),
    barraProgreso(avance.porcentaje, t('hojaDeRuta.fases.progresoDe', { nombre: datos.nombre })),
  ];

  const cuerpo: Hijo[] = [
    el(
      'dl',
      { class: 'ficha' },
      ...dato(t('hojaDeRuta.fases.objetivo'), datos.objetivo),
      ...dato(t('hojaDeRuta.fases.dependeDe'), dependencias),
      ...dato(t('hojaDeRuta.fases.hechoCuando'), datos.hechoCuando),
      ...dato(t('hojaDeRuta.fases.pruebaJugador'), datos.pruebaJugador),
    ),
    datos.tareas.length > 0
      ? el(
          'div',
          {},
          el(
            'h4',
            { class: 'fase__subtitulo' },
            `${t('hojaDeRuta.fases.tareas')} · ${avance.hechas}/${avance.total}`,
          ),
          el('ul', { class: 'tareas' }, ...datos.tareas.map(tarea)),
        )
      : el('p', { class: 'vacio' }, t('hojaDeRuta.fases.sinTareas')),
  ];

  return desplegable(
    `fase:${datos.id}`,
    abiertos,
    'fase',
    cabecera,
    cuerpo,
    esActiva ? 'fase--activa' : '',
  );
}

function etapa(datos: Etapa, roadmap: Roadmap, abiertos: Abiertos): HTMLElement {
  const fases = fasesDeEtapa(roadmap, datos.id);
  const avance = progreso(fases);
  const cabecera: Hijo[] = [
    el(
      'span',
      { class: 'etapa__titulo' },
      el('span', { class: 'etapa__letra' }, t('hojaDeRuta.fases.etapa', { id: datos.id })),
      el('span', { class: 'etapa__nombre' }, datos.nombre),
    ),
    el(
      'span',
      { class: 'etapa__resumen' },
      el('span', {}, `v${rangoVersiones(fases)}`),
      el('span', {}, t('hojaDeRuta.fases.numFases', { n: fases.length })),
      el('span', { class: 'etapa__porcentaje' }, `${avance.porcentaje} %`),
    ),
    barraProgreso(avance.porcentaje, t('hojaDeRuta.fases.progresoDe', { nombre: datos.nombre })),
  ];
  const cuerpo: Hijo[] = [
    datos.hito ? el('p', { class: 'etapa__hito' }, '🎮 ', datos.hito) : null,
    ...fases.map((unaFase) => fase(unaFase, roadmap, abiertos)),
  ];
  return desplegable(`etapa:${datos.id}`, abiertos, 'etapa', cabecera, cuerpo);
}

function ideas(roadmap: Roadmap): HTMLElement {
  const contenido =
    roadmap.ideasPendientes.length === 0
      ? el('p', { class: 'vacio' }, t('hojaDeRuta.ideas.vacio'))
      : el(
          'ul',
          { class: 'lista-tarjetas' },
          ...roadmap.ideasPendientes.map((idea) => {
            const asignada = roadmap.fases.find((f) => f.id === idea.faseAsignada);
            return el(
              'li',
              { class: 'tarjeta' },
              el('p', { class: 'idea__titulo' }, idea.titulo),
              el(
                'p',
                { class: 'tarea__detalle' },
                idea.origen
                  ? el('span', {}, t('hojaDeRuta.ideas.origen', { origen: idea.origen }))
                  : null,
                el(
                  'span',
                  {},
                  asignada
                    ? `${nombreFase(asignada)} · ${asignada.nombre}`
                    : t('hojaDeRuta.ideas.sinFase'),
                ),
              ),
            );
          }),
        );
  return seccion('ideas', t('hojaDeRuta.ideas.titulo'), contenido);
}

function historial(roadmap: Roadmap): HTMLElement {
  const contenido =
    roadmap.historial.length === 0
      ? el('p', { class: 'vacio' }, t('hojaDeRuta.historial.vacio'))
      : el(
          'ol',
          { class: 'lista-tarjetas' },
          // La versión más reciente, arriba.
          ...[...roadmap.historial]
            .reverse()
            .map((entrada) =>
              el(
                'li',
                { class: 'tarjeta' },
                el(
                  'p',
                  { class: 'historial__version' },
                  el('strong', {}, etiquetaVersion(entrada.version)),
                  el('span', {}, formatearFecha(entrada.fecha)),
                ),
                el(
                  'ul',
                  { class: 'historial__cambios' },
                  ...entrada.cambios.map((cambio) => el('li', {}, cambio)),
                ),
              ),
            ),
        );
  return seccion('historial', t('hojaDeRuta.historial.titulo'), contenido);
}

function pie(): HTMLElement {
  const externo = { target: '_blank', rel: 'noopener' };
  return el(
    'footer',
    { class: 'pie' },
    el('a', { href: URL_JUEGO }, t('hojaDeRuta.pie.juego')),
    el('a', { href: '../galeria/' }, t('hojaDeRuta.pie.galeria')),
    el('a', { href: REPOSITORIO, ...externo }, t('hojaDeRuta.pie.repositorio')),
    el('a', { href: URL_GDD, ...externo }, t('hojaDeRuta.pie.diseno')),
    el('a', { href: `${REPOSITORIO}/issues/new/choose`, ...externo }, t('hojaDeRuta.pie.reportar')),
  );
}

/** Texto «Datos del 11/11/2026, 16:30» de la barra de estado. */
export function textoDatos(roadmap: Roadmap): string {
  return t('hojaDeRuta.datosDe', { fecha: formatearFechaHora(roadmap.actualizado) });
}

/** Devuelve todo el contenido de la página para un roadmap ya cargado. */
export function vistaHojaDeRuta(roadmap: Roadmap, abiertos: Abiertos, estado: HTMLElement): Hijo[] {
  return [
    cabeceraPagina(roadmap),
    estado,
    ultimaSesion(roadmap),
    seccion(
      'fases',
      t('hojaDeRuta.fases.titulo'),
      el('div', { class: 'etapas' }, ...roadmap.etapas.map((e) => etapa(e, roadmap, abiertos))),
    ),
    ideas(roadmap),
    historial(roadmap),
    pie(),
  ];
}
