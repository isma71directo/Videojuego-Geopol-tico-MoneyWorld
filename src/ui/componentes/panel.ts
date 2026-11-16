/**
 * Paneles laterales (tarea f7-t1): una columna pegada a la izquierda o a la derecha de la
 * pantalla, con título, botón de cerrar y contenido que se desplaza. En cada lado hay como
 * mucho un panel: abrir otro en el mismo lado sustituye al anterior. Escape lo cierra.
 */
import { icono as crearIcono, type NombreIcono } from '../../av/iconos';
import { t } from '../../i18n';
import { el, type Hijo } from '../dom';
import '../estilos/componentes.css';

export type Lado = 'izquierda' | 'derecha';

export interface OpcionesPanel {
  titulo: string;
  lado: Lado;
  contenido: Hijo[];
  /** Ancho en píxeles (por defecto, 340). */
  ancho?: number;
  icono?: NombreIcono;
  alCerrar?: () => void;
}

export interface Panel {
  readonly elemento: HTMLElement;
  readonly cuerpo: HTMLElement;
  readonly lado: Lado;
  readonly abierto: boolean;
  cerrar(): void;
}

const porLado = new Map<Lado, Panel>();
let contador = 0;

/** Panel abierto en un lado (o null). */
export function panelEn(lado: Lado): Panel | null {
  return porLado.get(lado) ?? null;
}

export function abrirPanel(
  opciones: OpcionesPanel,
  contenedor: HTMLElement = document.body,
): Panel {
  porLado.get(opciones.lado)?.cerrar();
  contador += 1;
  const idTitulo = `panel-titulo-${contador}`;
  const cerrarBoton = el(
    'button',
    {
      class: 'panel__cerrar',
      type: 'button',
      'aria-label': t('juego.componentes.cerrarPanel', { titulo: opciones.titulo }),
    },
    '✕',
  );
  const cuerpo = el('div', { class: 'panel__cuerpo' }, ...opciones.contenido);
  const elemento = el(
    'aside',
    {
      class: `panel panel--${opciones.lado}`,
      'aria-labelledby': idTitulo,
      tabindex: -1,
    },
    el(
      'header',
      { class: 'panel__cabecera' },
      opciones.icono ? crearIcono(opciones.icono) : null,
      el('h2', { class: 'panel__titulo', id: idTitulo }, opciones.titulo),
      cerrarBoton,
    ),
    cuerpo,
  );
  elemento.style.width = `${opciones.ancho ?? 340}px`;

  let abierto = true;
  const panel: Panel = {
    elemento,
    cuerpo,
    lado: opciones.lado,
    get abierto() {
      return abierto;
    },
    cerrar() {
      if (!abierto) return;
      abierto = false;
      if (porLado.get(opciones.lado) === panel) porLado.delete(opciones.lado);
      elemento.remove();
      opciones.alCerrar?.();
    },
  };
  cerrarBoton.addEventListener('click', () => panel.cerrar());
  elemento.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || evento.defaultPrevented) return;
    evento.preventDefault();
    evento.stopPropagation();
    panel.cerrar();
  });
  porLado.set(opciones.lado, panel);
  contenedor.appendChild(elemento);
  elemento.focus({ preventScroll: true });
  return panel;
}
