/**
 * Barra de secciones del mapa (ajuste f7-a2, decisión del jugador: adelantada de la Fase 10).
 *
 * Abajo en el centro del mapa: Gobierno · Economía · Política · Mundo · Ejército · Más (GDD 7).
 * Cada botón abre un menú con sus secciones (o la sección, si solo tiene una) y cada sección se
 * abre en una ventana flotante con sus pestañas. Por ahora las ventanas están vacías: cada
 * pestaña dice qué tendrá y en qué fase de la hoja de ruta se llena.
 *
 * Teclado: la letra subrayada de cada botón (G, E, P, U, J y S) abre su menú desde el mapa; en
 * el menú, flechas e Intro. La M sigue siendo silenciar y la C, elegir la capa.
 */
import { icono, type NombreIcono } from '../av/iconos';
import { t } from '../i18n';
import { el, type Hijo } from './dom';
import { conInformacion, ocultarInformacion } from './componentes/info';
import { abrirMenuContextual, menuAbierto } from './componentes/menu';
import { crearPestanas } from './componentes/pestanas';
import { abrirVentana, type Ventana } from './componentes/ventana';
import config from './config/secciones.json';
import './estilos/secciones.css';

export interface GrupoSecciones {
  id: string;
  /** Letra del atajo (en minúscula); va subrayada en el nombre del grupo. */
  tecla: string;
  icono: NombreIcono;
  secciones: readonly string[];
}

export interface PestanaSeccion {
  id: string;
  /** Fase de la hoja de ruta en la que se llena. */
  fase: number;
}

export interface Seccion {
  id: string;
  icono: NombreIcono;
  pestanas: readonly PestanaSeccion[];
}

export const GRUPOS: readonly GrupoSecciones[] = config.grupos.map((grupo) => ({
  ...grupo,
  icono: grupo.icono as NombreIcono,
}));

export const SECCIONES: ReadonlyMap<string, Seccion> = new Map(
  Object.entries(config.secciones).map(([id, seccion]) => [
    id,
    {
      id,
      icono: seccion.icono as NombreIcono,
      pestanas: Object.entries(seccion.pestanas).map(([pestana, fase]) => ({
        id: pestana,
        fase: Number(fase),
      })),
    },
  ]),
);

export const MINISTERIOS: readonly string[] = config.ministerios;

/** Nombre de cada fase usada (como en roadmap.json; un test lo comprueba). */
export const NOMBRES_FASES: Readonly<Record<string, string>> = config.fases;

/** Versión de una fase: la Fase N sale en la v0.(N+1).0 (GDD, sección 9). */
export function versionDeFase(fase: number): string {
  return `0.${fase + 1}.0`;
}

/** El nombre con la letra del atajo subrayada (la primera vez que aparece). */
export function etiquetaConAtajo(texto: string, tecla: string): Hijo[] {
  const i = texto.toLowerCase().indexOf(tecla.toLowerCase());
  if (i < 0) return [texto];
  return [texto.slice(0, i), el('u', {}, texto.charAt(i)), texto.slice(i + 1)];
}

const tituloSeccion = (id: string): string => t(`juego.secciones.${id}.titulo`);

function cuadriculaMinisterios(): HTMLElement {
  return el(
    'div',
    {},
    el('p', { class: 'seccion__nota' }, t('juego.secciones.ministeriosNota')),
    el(
      'ul',
      { class: 'seccion__ministerios' },
      ...MINISTERIOS.map((id) =>
        el(
          'li',
          {},
          el('strong', {}, t(`juego.secciones.ministerios.${id}.nombre`)),
          el('span', {}, t(`juego.secciones.ministerios.${id}.indicadores`)),
        ),
      ),
    ),
  );
}

/** Contenido de una pestaña vacía: en qué fase se llena, qué tendrá y dónde irá. */
export function contenidoPestana(seccion: string, pestana: PestanaSeccion): HTMLElement {
  const base = `juego.secciones.${seccion}.pestanas.${pestana.id}`;
  return el(
    'div',
    { class: 'seccion', 'data-fase': pestana.fase },
    el(
      'p',
      { class: 'seccion__fase' },
      t('juego.secciones.llega', {
        n: pestana.fase,
        fase: NOMBRES_FASES[String(pestana.fase)] ?? '',
        version: versionDeFase(pestana.fase),
      }),
    ),
    el('p', { class: 'seccion__texto' }, t(`${base}.texto`)),
    // Los ministerios ya enseñan dónde irá cada cosa; las demás pestañas, un hueco.
    seccion === 'consejo' && pestana.id === 'ministerios'
      ? cuadriculaMinisterios()
      : el(
          'div',
          { class: 'seccion__hueco', 'aria-hidden': 'true' },
          el('span'),
          el('span'),
          el('span'),
        ),
    el('p', { class: 'seccion__vacia' }, t('juego.secciones.vacia')),
  );
}

/** Abre la ventana de una sección (o la trae delante si ya está abierta). */
export function abrirSeccion(id: string): Ventana | null {
  const seccion = SECCIONES.get(id);
  if (!seccion) return null;
  const titulo = tituloSeccion(id);
  const [unica] = seccion.pestanas;
  const contenido =
    seccion.pestanas.length === 1 && unica
      ? contenidoPestana(id, unica)
      : crearPestanas(
          seccion.pestanas.map((pestana) => ({
            id: pestana.id,
            titulo: t(`juego.secciones.${id}.pestanas.${pestana.id}.titulo`),
            contenido: () => [contenidoPestana(id, pestana)],
          })),
          { etiqueta: titulo },
        ).elemento;
  return abrirVentana({
    id: `seccion-${id}`,
    titulo,
    icono: seccion.icono,
    ancho: 560,
    contenido: [contenido],
  });
}

export interface BarraSecciones {
  readonly elemento: HTMLElement;
  /** Atiende una tecla de la pantalla; devuelve si era un atajo de la barra. */
  alTeclear(evento: KeyboardEvent): boolean;
  /** Abre el grupo (su menú, o su sección si solo tiene una). */
  abrirGrupo(id: string): void;
}

/** ¿Se está escribiendo en un campo? Entonces las letras no son atajos. */
function escribiendo(destino: EventTarget | null): boolean {
  return (
    destino instanceof HTMLElement &&
    (destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName))
  );
}

export function crearBarraSecciones(): BarraSecciones {
  const botones = new Map<string, HTMLButtonElement>();
  let abierto: string | null = null;
  let ultimoCierre = { grupo: '', momento: -Infinity };

  const abrirGrupo = (id: string): void => {
    const grupo = GRUPOS.find((g) => g.id === id);
    const boton = botones.get(id);
    if (!grupo || !boton) return;
    ocultarInformacion();
    const [sola] = grupo.secciones;
    if (grupo.secciones.length === 1 && sola) {
      menuAbierto()?.cerrar(false);
      abrirSeccion(sola);
      return;
    }
    const nombre = t(`juego.secciones.grupos.${id}`);
    const caja = boton.getBoundingClientRect();
    boton.setAttribute('aria-expanded', 'true');
    abierto = id;
    abrirMenuContextual({
      etiqueta: nombre,
      titulo: nombre,
      opciones: grupo.secciones.map((seccion) => ({
        etiqueta: tituloSeccion(seccion),
        icono: SECCIONES.get(seccion)?.icono,
        accion: () => abrirSeccion(seccion),
      })),
      // Encima del botón: el menú se abre hacia arriba si no cabe debajo.
      x: caja.left,
      y: caja.top - 6,
      alCerrar: () => {
        boton.setAttribute('aria-expanded', 'false');
        if (abierto === id) abierto = null;
        ultimoCierre = { grupo: id, momento: performance.now() };
      },
    });
  };

  const lista = el(
    'ul',
    { class: 'secciones__lista' },
    ...GRUPOS.map((grupo) => {
      const nombre = t(`juego.secciones.grupos.${grupo.id}`);
      const tecla = grupo.tecla.toUpperCase();
      const varias = grupo.secciones.length > 1;
      const boton = el(
        'button',
        {
          class: 'secciones__grupo',
          type: 'button',
          'data-grupo': grupo.id,
          'aria-keyshortcuts': tecla,
          'aria-haspopup': varias ? 'menu' : undefined,
          'aria-expanded': varias ? 'false' : undefined,
        },
        icono(grupo.icono),
        el('span', {}, ...etiquetaConAtajo(nombre, grupo.tecla)),
      );
      boton.addEventListener('click', () => {
        // El clic que acaba de cerrar el menú de este botón no lo vuelve a abrir.
        const recien = performance.now() - ultimoCierre.momento < 300;
        if (ultimoCierre.grupo === grupo.id && recien) return;
        abrirGrupo(grupo.id);
      });
      conInformacion(boton, () => [
        el('strong', {}, t('juego.secciones.tecla', { tecla })),
        el('br'),
        grupo.secciones.map(tituloSeccion).join(' · '),
      ]);
      botones.set(grupo.id, boton);
      return el('li', {}, boton);
    }),
  );
  const elemento = el(
    'nav',
    { class: 'secciones', 'aria-label': t('juego.secciones.etiqueta') },
    lista,
  );

  return {
    elemento,
    abrirGrupo,
    alTeclear(evento) {
      if (evento.ctrlKey || evento.altKey || evento.metaKey || evento.defaultPrevented) {
        return false;
      }
      if (escribiendo(evento.target) || evento.key.length !== 1) return false;
      const grupo = GRUPOS.find((g) => g.tecla === evento.key.toLowerCase());
      if (!grupo) return false;
      evento.preventDefault();
      if (abierto === grupo.id && menuAbierto()) menuAbierto()?.cerrar(true);
      else abrirGrupo(grupo.id);
      return true;
    },
  };
}
