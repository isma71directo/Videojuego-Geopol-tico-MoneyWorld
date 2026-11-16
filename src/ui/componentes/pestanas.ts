/**
 * Pestañas (tarea f7-t1), según el patrón de pestañas de WAI-ARIA: con el foco en ellas, las
 * flechas izquierda y derecha cambian de pestaña (dando la vuelta) e Inicio y Fin van a la
 * primera y a la última. Solo la pestaña activa está en el orden de tabulación, y el contenido
 * de cada una se crea la primera vez que se abre.
 */
import { icono as crearIcono, type NombreIcono } from '../../av/iconos';
import { anadir, el, type Hijo } from '../dom';
import { indiceConTecla } from './geometria';
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

  let activa = -1;
  const seleccionarIndice = (i: number, conFoco: boolean): void => {
    if (i < 0 || i >= pestanas.length) return;
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
    if (cambia) opciones.alCambiar?.(pestanas[i]!.id);
  };

  botones.forEach((boton, i) => {
    boton.addEventListener('click', () => seleccionarIndice(i, false));
    boton.addEventListener('keydown', (evento) => {
      const destino = indiceConTecla(i, evento.key, pestanas.length);
      if (destino === null) return;
      evento.preventDefault();
      seleccionarIndice(destino, true);
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
