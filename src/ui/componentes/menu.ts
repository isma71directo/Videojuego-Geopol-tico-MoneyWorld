/**
 * Menú contextual (tarea f7-t2, GDD 7: «el clic derecho, un menú de acciones»). Se abre donde
 * está el ratón (o junto a un elemento, si se abre con el teclado), sin salirse de la
 * pantalla. Solo hay uno abierto a la vez.
 *
 * Teclado: flechas arriba y abajo, Inicio y Fin para moverse; Intro o espacio para elegir;
 * Escape o Tab para cerrar (el foco vuelve a donde estaba). Un clic fuera también lo cierra.
 */
import { icono as crearIcono, type NombreIcono } from '../../av/iconos';
import { el } from '../dom';
import { indiceConTecla, limitarVentana } from './geometria';
import '../estilos/componentes.css';

export interface OpcionMenu {
  etiqueta: string;
  icono?: NombreIcono;
  /** Atajo que se muestra a la derecha (solo informativo). */
  atajo?: string;
  desactivada?: boolean;
  accion: () => void;
}

/** Una raya para separar grupos de opciones. */
export const SEPARADOR = 'separador' as const;

export interface OpcionesMenu {
  etiqueta: string;
  /** Título opcional arriba del menú (p. ej. el país sobre el que se abrió). */
  titulo?: string;
  opciones: readonly (OpcionMenu | typeof SEPARADOR)[];
  x: number;
  y: number;
  alCerrar?: () => void;
}

export interface MenuContextual {
  readonly elemento: HTMLElement;
  readonly abierto: boolean;
  cerrar(devolverFoco?: boolean): void;
}

let actual: MenuContextual | null = null;

export function menuAbierto(): MenuContextual | null {
  return actual?.abierto ? actual : null;
}

export function abrirMenuContextual(opciones: OpcionesMenu): MenuContextual {
  actual?.cerrar(false);
  const anterior = document.activeElement as HTMLElement | null;
  const elementos: HTMLButtonElement[] = [];
  const hijos = opciones.opciones.map((opcion) => {
    if (opcion === SEPARADOR) return el('div', { class: 'menu__separador', role: 'separator' });
    const boton = el(
      'button',
      {
        class: 'menu__opcion',
        type: 'button',
        role: 'menuitem',
        tabindex: -1,
        'aria-disabled': opcion.desactivada ? 'true' : undefined,
      },
      opcion.icono ? crearIcono(opcion.icono) : el('span', { class: 'menu__hueco' }),
      el('span', { class: 'menu__texto' }, opcion.etiqueta),
      opcion.atajo ? el('kbd', { class: 'menu__atajo' }, opcion.atajo) : null,
    );
    boton.addEventListener('click', () => {
      if (opcion.desactivada) return;
      menu.cerrar(false);
      opcion.accion();
    });
    elementos.push(boton);
    return boton;
  });
  const elemento = el(
    'div',
    { class: 'menu', role: 'menu', 'aria-label': opciones.etiqueta, tabindex: -1 },
    opciones.titulo ? el('p', { class: 'menu__titulo' }, opciones.titulo) : null,
    ...hijos,
  );

  let abierto = true;
  const fuera = (evento: PointerEvent): void => {
    if (!elemento.contains(evento.target as Node)) menu.cerrar(false);
  };
  const menu: MenuContextual = {
    elemento,
    get abierto() {
      return abierto;
    },
    cerrar(devolverFoco = true) {
      if (!abierto) return;
      abierto = false;
      document.removeEventListener('pointerdown', fuera, true);
      window.removeEventListener('blur', alPerderVentana);
      elemento.remove();
      if (actual === menu) actual = null;
      if (devolverFoco) anterior?.focus?.({ preventScroll: true });
      opciones.alCerrar?.();
    },
  };
  const alPerderVentana = (): void => menu.cerrar(false);

  elemento.addEventListener('keydown', (evento) => {
    const indice = elementos.indexOf(document.activeElement as HTMLButtonElement);
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      menu.cerrar(true);
      return;
    }
    if (evento.key === 'Tab') {
      evento.preventDefault();
      menu.cerrar(true);
      return;
    }
    const destino = indiceConTecla(Math.max(0, indice), evento.key, elementos.length, 'vertical');
    if (destino !== null) {
      evento.preventDefault();
      elementos[destino]!.focus();
    }
  });
  // El menú propio no deja que salga el del navegador encima.
  elemento.addEventListener('contextmenu', (evento) => evento.preventDefault());

  document.body.appendChild(elemento);
  const { x, y } = limitarVentana(
    {
      x: opciones.x,
      y: opciones.y,
      ancho: elemento.offsetWidth || 220,
      alto: elemento.offsetHeight || 40 * elementos.length,
    },
    { ancho: window.innerWidth, alto: window.innerHeight },
  );
  // Si no cabe debajo del ratón, se abre hacia arriba.
  const alto = elemento.offsetHeight || 40 * elementos.length;
  const arriba = opciones.y + alto > window.innerHeight - 8 ? Math.max(8, opciones.y - alto) : y;
  elemento.style.transform = `translate(${x}px, ${arriba}px)`;
  document.addEventListener('pointerdown', fuera, true);
  window.addEventListener('blur', alPerderVentana);
  (elementos.find((b) => b.getAttribute('aria-disabled') !== 'true') ?? elemento).focus();
  actual = menu;
  return menu;
}
