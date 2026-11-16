/**
 * Pestañas (tarea f7-t1), según el patrón de pestañas de WAI-ARIA: con el foco en ellas, las
 * flechas izquierda y derecha cambian de pestaña (dando la vuelta) e Inicio y Fin van a la
 * primera y a la última. Solo la pestaña activa está en el orden de tabulación, y el contenido
 * de cada una se crea la primera vez que se abre.
 *
 * Al cambiar de pestaña (tarea f7-t4), la raya de la activa se desliza a la nueva, el
 * contenido entra desde el lado hacia el que se va y suena un clic suave. Los cambios hechos
 * desde el código no suenan.
 */
import { icono as crearIcono, type NombreIcono } from '../../av/iconos';
import { anadir, el, type Hijo } from '../dom';
import { animar, DURACIONES, FOTOGRAMAS } from './animacion';
import { indiceConTecla } from './geometria';
import { sonar } from './sonidos';
import '../estilos/componentes.css';

export interface Pestana {
  id: string;
  titulo: string;
  icono?: NombreIcono;
  /** Crea el contenido la primera vez que se muestra la pestaña. */
  contenido: () => Hijo[];
}

export interface GrupoPestanas {
  readonly elemento: HTMLElement;
  readonly activa: string;
  seleccionar(id: string, conFoco?: boolean): void;
}

let contador = 0;

export function crearPestanas(
  pestanas: readonly Pestana[],
  opciones: { etiqueta: string; inicial?: string; alCambiar?: (id: string) => void },
): GrupoPestanas {
  contador += 1;
  const base = `pestanas-${contador}`;
  const botones = pestanas.map((pestana) =>
    el(
      'button',
      {
        class: 'pestanas__pestana',
        type: 'button',
        role: 'tab',
        id: `${base}-${pestana.id}`,
        'aria-controls': `${base}-${pestana.id}-contenido`,
        'aria-selected': 'false',
        tabindex: -1,
      },
      pestana.icono ? crearIcono(pestana.icono) : null,
      el('span', {}, pestana.titulo),
    ),
  );
  const paneles = pestanas.map((pestana) =>
    el('div', {
      class: 'pestanas__contenido',
      role: 'tabpanel',
      id: `${base}-${pestana.id}-contenido`,
      'aria-labelledby': `${base}-${pestana.id}`,
      tabindex: 0,
      hidden: true,
    }),
  );
  const creadas = new Set<number>();
  const lista = el(
    'div',
    { class: 'pestanas__lista', role: 'tablist', 'aria-label': opciones.etiqueta },
    ...botones,
  );
  const elemento = el('div', { class: 'pestanas' }, lista, ...paneles);

  // Raya bajo la pestaña activa: se desliza de una a otra. Hasta que se puede medir (la lista
  // aún no está en la página), la activa se marca con su propio borde.
  const raya = el('span', { class: 'pestanas__raya', 'aria-hidden': 'true' });
  lista.appendChild(raya);
  const colocarRaya = (deslizar: boolean): void => {
    const boton = botones[activa];
    if (!boton?.offsetWidth) return;
    const primera = !lista.classList.contains('pestanas__lista--raya');
    if (primera || !deslizar) raya.style.transition = 'none';
    raya.style.width = `${boton.offsetWidth}px`;
    raya.style.transform = `translateX(${boton.offsetLeft}px)`;
    lista.classList.add('pestanas__lista--raya');
    if (primera || !deslizar) {
      void raya.offsetWidth; // aplica la posición antes de devolver la transición
      raya.style.removeProperty('transition');
    }
  };
  // Las pestañas cambian de ancho al entrar en la página, al cargar la letra o al compactarse.
  if (typeof ResizeObserver === 'function') {
    const observador = new ResizeObserver(() => colocarRaya(false));
    for (const boton of botones) observador.observe(boton);
  }

  let activa = -1;
  const seleccionarIndice = (i: number, conFoco: boolean, porJugador = false): void => {
    if (i < 0 || i >= pestanas.length) return;
    const anterior = activa;
    if (!creadas.has(i)) {
      anadir(paneles[i]!, ...pestanas[i]!.contenido());
      creadas.add(i);
    }
    const cambia = i !== activa;
    botones.forEach((boton, j) => {
      boton.setAttribute('aria-selected', String(j === i));
      boton.tabIndex = j === i ? 0 : -1;
      paneles[j]!.hidden = j !== i;
    });
    activa = i;
    if (conFoco) botones[i]!.focus();
    colocarRaya(true);
    if (cambia) {
      void animar(paneles[i]!, FOTOGRAMAS.pestana(i > anterior ? 1 : -1), DURACIONES.pestana);
      if (porJugador) sonar('pestana');
      opciones.alCambiar?.(pestanas[i]!.id);
    }
  };

  botones.forEach((boton, i) => {
    boton.addEventListener('click', () => seleccionarIndice(i, false, true));
    boton.addEventListener('keydown', (evento) => {
      const destino = indiceConTecla(i, evento.key, pestanas.length);
      if (destino === null) return;
      evento.preventDefault();
      seleccionarIndice(destino, true, true);
    });
  });

  const inicial = Math.max(
    0,
    pestanas.findIndex((pestana) => pestana.id === opciones.inicial),
  );
  // La pestaña inicial no avisa a «alCambiar»: no la ha cambiado nadie.
  activa = inicial;
  creadas.add(inicial);
  anadir(paneles[inicial]!, ...pestanas[inicial]!.contenido());
  botones.forEach((boton, j) => {
    boton.setAttribute('aria-selected', String(j === inicial));
    boton.tabIndex = j === inicial ? 0 : -1;
    paneles[j]!.hidden = j !== inicial;
  });

  return {
    elemento,
    get activa() {
      return pestanas[activa]!.id;
    },
    seleccionar(id, conFoco = false) {
      seleccionarIndice(
        pestanas.findIndex((pestana) => pestana.id === id),
        conFoco,
      );
    },
  };
}
