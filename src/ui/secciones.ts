/**
 * Barra de secciones del mapa (ajustes f7-a2 y f7-a4, decisión del jugador), como en los
 * simuladores geopolíticos de PC:
 *
 * - Abajo, una barra grande con 8 apartados: Gobierno, Ministerios, Política, Economía, Mundo,
 *   Ejército, Investigación e Informes (sin «Más»).
 * - Cada apartado abre encima una sub-barra con sus elementos (Investigación, que solo tiene uno,
 *   abre su ventana directamente) y cada elemento abre su ventana flotante con pestañas.
 * - Gobierno y Ministerios van separados: cada ministerio tiene su ventana con resumen,
 *   presupuesto, leyes del departamento, acciones e infraestructuras.
 * - Por ahora todo está vacío: cada pestaña dice qué tendrá y en qué fase se llena.
 *
 * Teclado: la letra subrayada de cada apartado (G, I, P, E, U, J, V y N) abre su sub-barra; en
 * ella, flechas, Inicio, Fin, Intro y Escape. La M sigue siendo silenciar y la C, elegir la capa.
 */
import { icono, type NombreIcono } from '../av/iconos';
import { t } from '../i18n';
import { el, type Hijo } from './dom';
import { animar, DURACIONES } from './componentes/animacion';
import { indiceConTecla } from './componentes/geometria';
import { ocultarInformacion } from './componentes/info';
import { crearPestanas } from './componentes/pestanas';
import { sonar } from './componentes/sonidos';
import { abrirVentana, ventanasAbiertas, type Ventana } from './componentes/ventana';
import config from './config/secciones.json';
import './estilos/secciones.css';

export interface Apartado {
  id: string;
  /** Letra del atajo (en minúscula); va subrayada en el nombre. */
  tecla: string;
  icono: NombreIcono;
  /** Elementos de su sub-barra: secciones o «ministerio-…». */
  elementos: readonly string[];
}

export interface PestanaSeccion {
  id: string;
  /** Fase de la hoja de ruta en la que se llena (null: todavía sin fase). */
  fase: number | null;
}

export interface Seccion {
  id: string;
  icono: NombreIcono;
  pestanas: readonly PestanaSeccion[];
}

export interface Ministerio {
  id: string;
  icono: NombreIcono;
  /** Fase en la que llegan sus acciones (null: todavía sin fase en la hoja de ruta). */
  faseAcciones: number | null;
  /** Si tiene infraestructuras propias (GDD 6.5). */
  infraestructuras: boolean;
}

/** Prefijo de los elementos de la sub-barra que son ministerios. */
export const PREFIJO_MINISTERIO = 'ministerio-';

/** El elemento de la ventana de un ministerio («presidencia» o «ministerio-sanidad»). */
export const elementoDeMinisterio = (id: string): string =>
  id === 'presidencia' ? 'presidencia' : `${PREFIJO_MINISTERIO}${id}`;

export const APARTADOS: readonly Apartado[] = config.apartados.map((apartado) => ({
  ...apartado,
  icono: apartado.icono as NombreIcono,
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

/** Los 20 ministerios de la sección 6.4 (Presidencia, el primero, va en Gobierno). */
export const MINISTERIOS: ReadonlyMap<string, Ministerio> = new Map(
  Object.entries(config.ministerios).map(([id, ministerio]) => [
    id,
    {
      id,
      icono: ministerio.icono as NombreIcono,
      faseAcciones: ministerio.faseAcciones,
      infraestructuras: ministerio.infraestructuras,
    },
  ]),
);

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

const minuscula = (texto: string): string => texto.charAt(0).toLowerCase() + texto.slice(1);

/** Ministerio de un elemento de la sub-barra («ministerio-sanidad»), si lo es. */
export function ministerioDe(elemento: string): Ministerio | null {
  if (!elemento.startsWith(PREFIJO_MINISTERIO)) return null;
  return MINISTERIOS.get(elemento.slice(PREFIJO_MINISTERIO.length)) ?? null;
}

/** Nombre corto de un elemento (en la sub-barra): «Sanidad», «Presupuesto»… */
export function nombreElemento(elemento: string): string {
  const ministerio = ministerioDe(elemento);
  return ministerio
    ? t(`juego.secciones.ministerios.${ministerio.id}.nombre`)
    : t(`juego.secciones.${elemento}.titulo`);
}

/** Título de la ventana de un elemento: «Ministerio de Sanidad», «Presupuesto»… */
export function tituloElemento(elemento: string): string {
  const ministerio = ministerioDe(elemento);
  return ministerio
    ? t('juego.secciones.ministerio.titulo', { nombre: nombreElemento(elemento) })
    : t(`juego.secciones.${elemento}.titulo`);
}

export function iconoElemento(elemento: string): NombreIcono | null {
  return ministerioDe(elemento)?.icono ?? SECCIONES.get(elemento)?.icono ?? null;
}

/** Pestañas de la ventana de un elemento (las de un ministerio se arman con su ficha). */
export function pestanasDe(elemento: string): readonly PestanaSeccion[] {
  const ministerio = ministerioDe(elemento);
  if (!ministerio) return SECCIONES.get(elemento)?.pestanas ?? [];
  return Object.entries(config.pestanasMinisterio)
    .filter(([id]) => id !== 'infraestructuras' || ministerio.infraestructuras)
    .map(([id, fase]) => ({ id, fase: id === 'acciones' ? ministerio.faseAcciones : fase }));
}

function avisoFase(fase: number | null): HTMLElement {
  return fase === null
    ? el('p', { class: 'seccion__fase seccion__fase--sin' }, t('juego.secciones.sinFase'))
    : el(
        'p',
        { class: 'seccion__fase' },
        t('juego.secciones.llega', {
          n: fase,
          fase: NOMBRES_FASES[String(fase)] ?? '',
          version: versionDeFase(fase),
        }),
      );
}

const hueco = (): HTMLElement =>
  el('div', { class: 'seccion__hueco', 'aria-hidden': 'true' }, el('span'), el('span'), el('span'));

/** Cuadrícula de los 20 ministerios: cada tarjeta abre la ventana del ministerio. */
function cuadriculaMinisterios(): HTMLElement {
  return el(
    'div',
    {},
    el('p', { class: 'seccion__nota' }, t('juego.secciones.ministeriosNota')),
    el(
      'ul',
      { class: 'seccion__ministerios' },
      ...[...MINISTERIOS.values()].map((ministerio) => {
        const elemento =
          ministerio.id === 'presidencia' ? 'presidencia' : `${PREFIJO_MINISTERIO}${ministerio.id}`;
        const boton = el(
          'button',
          { type: 'button', 'data-elemento': elemento },
          icono(ministerio.icono),
          el('strong', {}, t(`juego.secciones.ministerios.${ministerio.id}.nombre`)),
          el('span', {}, t(`juego.secciones.ministerios.${ministerio.id}.indicadores`)),
        );
        boton.addEventListener('click', () => abrirElemento(elemento));
        return el('li', {}, boton);
      }),
    ),
  );
}

/** Contenido de una pestaña vacía: en qué fase se llena, qué tendrá y dónde irá. */
export function contenidoPestana(elemento: string, pestana: PestanaSeccion): HTMLElement {
  const ministerio = ministerioDe(elemento);
  let texto: string;
  if (ministerio) {
    const base = `juego.secciones.ministerios.${ministerio.id}`;
    texto = t(`juego.secciones.ministerio.pestanas.${pestana.id}.texto`, {
      indicadores: minuscula(t(`${base}.indicadores`)),
      acciones: t(`${base}.acciones`),
      infraestructuras: t(`${base}.infraestructuras`),
    });
  } else {
    texto = t(`juego.secciones.${elemento}.pestanas.${pestana.id}.texto`);
  }
  return el(
    'div',
    { class: 'seccion', 'data-fase': pestana.fase ?? 'sin' },
    avisoFase(pestana.fase),
    el('p', { class: 'seccion__texto' }, texto),
    // Los ministerios ya enseñan dónde irá cada cosa; las demás pestañas, un hueco.
    elemento === 'consejo' && pestana.id === 'ministerios' ? cuadriculaMinisterios() : hueco(),
    el('p', { class: 'seccion__vacia' }, t('juego.secciones.vacia')),
  );
}

function tituloPestana(elemento: string, pestana: string): string {
  return ministerioDe(elemento)
    ? t(`juego.secciones.ministerio.pestanas.${pestana}.titulo`)
    : t(`juego.secciones.${elemento}.pestanas.${pestana}.titulo`);
}

/**
 * Elementos que ya tienen contenido de verdad (tarea f13-t2: «Efectos en curso»): en lugar del
 * hueco «llega en la fase N», su ventana enseña lo que da esta función.
 */
const contenidosReales = new Map<string, () => HTMLElement>();

/** Da (o quita, con null) el contenido de verdad de un elemento. */
export function ponerContenido(elemento: string, contenido: (() => HTMLElement) | null): void {
  if (contenido) contenidosReales.set(elemento, contenido);
  else contenidosReales.delete(elemento);
}

/**
 * Pestañas con contenido de verdad dentro de una ventana con varias (ajuste f19-a3: la pestaña
 * «Presupuesto» de cada ministerio): en lugar del hueco «llega en la fase N», lo que dé la función.
 */
const pestanasReales = new Map<string, () => HTMLElement>();

/** Pone (o quita, con `null`) el contenido de verdad de una pestaña de un elemento. */
export function ponerContenidoPestana(
  elemento: string,
  pestana: string,
  contenido: (() => HTMLElement) | null,
): void {
  const clave = `${elemento}/${pestana}`;
  if (contenido) pestanasReales.set(clave, contenido);
  else pestanasReales.delete(clave);
}

/** El contenido de una pestaña: el de verdad, si lo tiene, o el hueco de su fase. */
function contenidoDe(elemento: string, pestana: PestanaSeccion): HTMLElement {
  return pestanasReales.get(`${elemento}/${pestana.id}`)?.() ?? contenidoPestana(elemento, pestana);
}

/** Vuelve a pintar, si está abierta, la ventana de un elemento con contenido de verdad. */
export function refrescarElemento(elemento: string): void {
  const contenido = contenidosReales.get(elemento);
  const ventana = ventanasAbiertas().find((v) => v.id === `seccion-${elemento}`);
  if (contenido && ventana) ventana.cuerpo.replaceChildren(contenido());
}

/** Abre la ventana de un elemento (o la trae delante si ya está abierta). */
export function abrirElemento(elemento: string): Ventana | null {
  const pestanas = pestanasDe(elemento);
  const iconoVentana = iconoElemento(elemento);
  if (pestanas.length === 0 || !iconoVentana) return null;
  const titulo = tituloElemento(elemento);
  const [unica] = pestanas;
  const real = contenidosReales.get(elemento);
  const contenido = real
    ? real()
    : pestanas.length === 1 && unica
      ? contenidoDe(elemento, unica)
      : crearPestanas(
          pestanas.map((pestana) => ({
            id: pestana.id,
            titulo: tituloPestana(elemento, pestana.id),
            contenido: () => [contenidoDe(elemento, pestana)],
          })),
          { etiqueta: titulo },
        ).elemento;
  return abrirVentana({
    id: `seccion-${elemento}`,
    titulo,
    icono: iconoVentana,
    ancho: 560,
    contenido: [contenido],
  });
}

export interface BarraSecciones {
  readonly elemento: HTMLElement;
  /** Apartado cuya sub-barra está abierta (o null). */
  readonly abierto: string | null;
  /** Atiende una tecla de la pantalla; devuelve si era de la barra. */
  alTeclear(evento: KeyboardEvent): boolean;
  /** Abre (o cierra, si ya lo estaba) la sub-barra de un apartado. */
  alternarApartado(id: string, conFoco?: boolean): void;
  cerrarSubbarra(devolverFoco?: boolean): void;
  /** Quita los oyentes del documento (al salir del mapa). */
  destruir(): void;
}

/** ¿Se está escribiendo en un campo? Entonces las letras no son atajos. */
function escribiendo(destino: EventTarget | null): boolean {
  return (
    destino instanceof HTMLElement &&
    (destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName))
  );
}

/** Elementos por fila de la sub-barra (los 19 ministerios ocupan dos filas). */
const COLUMNAS_MAXIMAS = 10;

export function crearBarraSecciones(): BarraSecciones {
  const botones = new Map<string, HTMLButtonElement>();
  let abierto: string | null = null;

  const tituloSub = el('p', { class: 'secciones__sub-titulo' });
  const lista = el('ul', { class: 'secciones__elementos' });
  const sub = el(
    'div',
    { class: 'secciones__sub', id: 'secciones-sub', role: 'toolbar', hidden: true },
    tituloSub,
    lista,
  );

  const elementosSub = (): HTMLButtonElement[] => [
    ...lista.querySelectorAll<HTMLButtonElement>('.secciones__elemento'),
  ];

  const cerrarSubbarra = (devolverFoco = false): void => {
    if (!abierto) return;
    const boton = botones.get(abierto);
    boton?.setAttribute('aria-expanded', 'false');
    abierto = null;
    sub.hidden = true;
    lista.replaceChildren();
    if (devolverFoco) boton?.focus();
  };

  const alternarApartado = (id: string, conFoco = true): void => {
    const apartado = APARTADOS.find((a) => a.id === id);
    if (!apartado) return;
    ocultarInformacion();
    if (abierto === id) {
      cerrarSubbarra(true);
      return;
    }
    const [unico] = apartado.elementos;
    if (apartado.elementos.length === 1 && unico) {
      cerrarSubbarra();
      abrirElemento(unico);
      return;
    }
    if (abierto) botones.get(abierto)?.setAttribute('aria-expanded', 'false');
    abierto = id;
    botones.get(id)?.setAttribute('aria-expanded', 'true');
    const nombre = t(`juego.secciones.apartados.${id}`);
    tituloSub.textContent = nombre;
    sub.setAttribute('aria-label', nombre);
    lista.style.setProperty(
      '--columnas',
      String(Math.min(COLUMNAS_MAXIMAS, apartado.elementos.length)),
    );
    lista.replaceChildren(
      ...apartado.elementos.map((elemento, i) => {
        const iconoElem = iconoElemento(elemento);
        const boton = el(
          'button',
          {
            class: 'secciones__elemento',
            type: 'button',
            'data-elemento': elemento,
            tabindex: i === 0 ? 0 : -1,
          },
          iconoElem ? icono(iconoElem) : null,
          el('span', {}, nombreElemento(elemento)),
        );
        boton.addEventListener('click', () => abrirElemento(elemento));
        return el('li', {}, boton);
      }),
    );
    sub.hidden = false;
    void animar(
      sub,
      [
        { opacity: 0, translate: '-50% 8px' },
        { opacity: 1, translate: '-50% 0' },
      ],
      DURACIONES.abrirMenu + 40,
    );
    sonar('menu');
    if (conFoco) elementosSub()[0]?.focus();
  };

  // Flechas, Inicio y Fin recorren la sub-barra; Escape la cierra.
  sub.addEventListener('keydown', (evento) => {
    const elementos = elementosSub();
    const actual = elementos.indexOf(document.activeElement as HTMLButtonElement);
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      cerrarSubbarra(true);
      return;
    }
    if (actual < 0) return;
    const tecla =
      evento.key === 'ArrowUp'
        ? 'ArrowLeft'
        : evento.key === 'ArrowDown'
          ? 'ArrowRight'
          : evento.key;
    const destino = indiceConTecla(actual, tecla, elementos.length);
    if (destino === null) return;
    evento.preventDefault();
    elementos.forEach((boton, i) => (boton.tabIndex = i === destino ? 0 : -1));
    elementos[destino]!.focus();
  });

  const listaApartados = el(
    'ul',
    { class: 'secciones__lista' },
    ...APARTADOS.map((apartado) => {
      const nombre = t(`juego.secciones.apartados.${apartado.id}`);
      const tecla = apartado.tecla.toUpperCase();
      const conSubbarra = apartado.elementos.length > 1;
      const boton = el(
        'button',
        {
          class: 'secciones__apartado',
          type: 'button',
          'data-apartado': apartado.id,
          'aria-keyshortcuts': tecla,
          'aria-controls': conSubbarra ? 'secciones-sub' : undefined,
          'aria-expanded': conSubbarra ? 'false' : undefined,
        },
        icono(apartado.icono),
        el('span', {}, ...etiquetaConAtajo(nombre, apartado.tecla)),
      );
      boton.addEventListener('click', (evento) =>
        alternarApartado(apartado.id, evento.detail === 0),
      );
      botones.set(apartado.id, boton);
      return el('li', {}, boton);
    }),
  );
  const barra = el(
    'nav',
    { class: 'secciones__barra', 'aria-label': t('juego.secciones.etiqueta') },
    listaApartados,
  );
  const elemento = el('div', { class: 'secciones' }, barra, sub);

  // Un clic en el mapa (fuera de la barra y de las ventanas) cierra la sub-barra.
  const alPulsarFuera = (evento: PointerEvent): void => {
    const destino = evento.target as Element | null;
    if (!abierto || !destino?.closest) return;
    if (destino.closest('.secciones, .ventana, .menu')) return;
    cerrarSubbarra();
  };
  document.addEventListener('pointerdown', alPulsarFuera, true);

  return {
    elemento,
    get abierto() {
      return abierto;
    },
    alternarApartado,
    cerrarSubbarra,
    destruir() {
      document.removeEventListener('pointerdown', alPulsarFuera, true);
    },
    alTeclear(evento) {
      if (evento.ctrlKey || evento.altKey || evento.metaKey || evento.defaultPrevented) {
        return false;
      }
      // Escape cierra la sub-barra (antes que quitar la selección del mapa).
      if (evento.key === 'Escape' && abierto) {
        const destino = evento.target as Element | null;
        if (destino?.closest?.('.ventana, .menu')) return false;
        evento.preventDefault();
        cerrarSubbarra();
        return true;
      }
      if (escribiendo(evento.target) || evento.key.length !== 1) return false;
      const apartado = APARTADOS.find((a) => a.tecla === evento.key.toLowerCase());
      if (!apartado) return false;
      evento.preventDefault();
      alternarApartado(apartado.id, true);
      return true;
    },
  };
}
