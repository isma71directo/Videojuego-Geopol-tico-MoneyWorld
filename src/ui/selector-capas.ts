/**
 * Desplegable de las capas del mapa (tarea f6-t2): un botón en la barra superior que muestra la
 * capa activa y abre la lista con un clic o con la tecla C. Al elegir una capa, el mapa cambia y
 * la lista se cierra (decisión del jugador: sin un atajo por capa).
 *
 * Teclado: flechas, Inicio y Fin para moverse; Intro o espacio para elegir; Escape o C para
 * cerrar sin cambiar.
 */
import { icono, type NombreIcono } from '../av/iconos';
import { t } from '../i18n';
import { CAPAS } from '../map/capas';
import { el } from './dom';

export const POLITICA = 'politica';

const ICONO_CAPA: Record<string, NombreIcono> = {
  politica: 'politica',
  riqueza: 'pib',
  poblacion: 'poblacion',
  densidad: 'densidad',
  crecimiento: 'crecimiento',
  paro: 'paro',
  deuda: 'deuda',
  inflacion: 'inflacion',
  petroleo: 'petroleo',
  gas: 'gas',
  carbon: 'carbon',
};

export interface OpcionCapa {
  id: string;
  icono: NombreIcono;
  /** Una raya antes de la opción, para separar grupos (política, datos, recursos). */
  separadorAntes: boolean;
}

/** Opciones del desplegable, en orden: la capa política y después las de datos. */
export function opcionesCapas(): OpcionCapa[] {
  return [
    { id: POLITICA, icono: 'politica', separadorAntes: false },
    ...CAPAS.map((capa, i) => ({
      id: capa.id,
      icono: ICONO_CAPA[capa.id] ?? 'capas',
      // Raya antes de la primera capa de datos y antes de la primera de recursos.
      separadorAntes: i === 0 || (capa.grupo === 'recursos' && CAPAS[i - 1]?.grupo !== 'recursos'),
    })),
  ];
}

/** Texto de una opción: «Población total», «Reservas de gas natural»… */
export function etiquetaCapa(id: string): string {
  const opcion = t(`juego.mapa.capas.${id}.opcion`);
  return opcion === `juego.mapa.capas.${id}.opcion` ? t(`juego.mapa.capas.${id}.nombre`) : opcion;
}

export interface SelectorCapas {
  elemento: HTMLElement;
  readonly abierto: boolean;
  abrir(): void;
  /** Cierra la lista; con `devolverFoco`, el foco vuelve al botón. */
  cerrar(devolverFoco?: boolean): void;
  alternar(): void;
  /** Marca una capa como activa (sin avisar a `alElegir`). */
  marcar(id: string): void;
}

export function crearSelectorCapas(
  inicial: string,
  alElegir: (id: string) => void,
  alAbrir: () => void = () => undefined,
): SelectorCapas {
  const opciones = opcionesCapas();
  const nombre = el('span', { class: 'capas__nombre' });
  const boton = el(
    'button',
    {
      class: 'boton capas__boton',
      type: 'button',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      'aria-controls': 'menu-capas',
      title: t('juego.mapa.capas.selector.titulo'),
    },
    icono('capas'),
    nombre,
    el('span', { class: 'capas__flecha', 'aria-hidden': 'true' }, '▾'),
  );
  const items = opciones.map((opcion) =>
    el(
      'button',
      {
        class: 'capas__opcion',
        type: 'button',
        role: 'menuitemradio',
        'aria-checked': 'false',
        tabindex: -1,
        'data-capa': opcion.id,
      },
      icono(opcion.icono),
      el('span', {}, etiquetaCapa(opcion.id)),
    ),
  );
  const menu = el(
    'div',
    {
      class: 'capas__menu',
      id: 'menu-capas',
      role: 'menu',
      'aria-label': t('juego.mapa.capas.selector.menu'),
      hidden: true,
    },
    ...opciones.flatMap((opcion, i) => [
      opcion.separadorAntes ? el('div', { class: 'capas__separador', role: 'separator' }) : null,
      items[i]!,
    ]),
  );
  const elemento = el('div', { class: 'capas' }, boton, menu);

  let activa = inicial;
  const marcar = (id: string): void => {
    activa = opciones.some((opcion) => opcion.id === id) ? id : POLITICA;
    for (const item of items) {
      item.setAttribute('aria-checked', String(item.dataset.capa === activa));
    }
    const texto = etiquetaCapa(activa);
    nombre.textContent = texto;
    boton.setAttribute('aria-label', t('juego.mapa.capas.selector.boton', { capa: texto }));
  };

  const fuera = (evento: PointerEvent): void => {
    if (!elemento.contains(evento.target as Node)) cerrar();
  };
  const abrir = (): void => {
    if (!menu.hidden) return;
    menu.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', fuera, true);
    (items.find((item) => item.dataset.capa === activa) ?? items[0])!.focus();
    alAbrir();
  };
  function cerrar(devolverFoco = false): void {
    if (menu.hidden) return;
    menu.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', fuera, true);
    if (devolverFoco) boton.focus();
  }
  const alternar = (): void => (menu.hidden ? abrir() : cerrar(true));

  boton.addEventListener('click', alternar);
  boton.addEventListener('keydown', (evento) => {
    if (evento.key === 'ArrowDown' || evento.key === 'c' || evento.key === 'C') {
      evento.preventDefault();
      abrir();
    }
  });
  for (const item of items) {
    item.addEventListener('click', () => {
      const id = item.dataset.capa!;
      cerrar();
      if (id === activa) return;
      marcar(id);
      alElegir(id);
    });
  }
  menu.addEventListener('keydown', (evento) => {
    const actual = items.indexOf(document.activeElement as HTMLButtonElement);
    const mover = (indice: number): void => {
      evento.preventDefault();
      items[(indice + items.length) % items.length]!.focus();
    };
    switch (evento.key) {
      case 'ArrowDown':
        return mover(actual + 1);
      case 'ArrowUp':
        return mover(actual - 1);
      case 'Home':
        return mover(0);
      case 'End':
        return mover(items.length - 1);
      case 'Escape':
      case 'c':
      case 'C':
        // Que el Escape no quite además la selección del mapa.
        evento.preventDefault();
        evento.stopPropagation();
        return cerrar(true);
      case 'Tab':
        return cerrar();
    }
  });

  marcar(inicial);
  return {
    elemento,
    get abierto() {
      return !menu.hidden;
    },
    abrir,
    cerrar,
    alternar,
    marcar,
  };
}
