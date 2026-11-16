/**
 * Ventanas flotantes (tarea f7-t1, GDD 7: «los paneles se abren a los lados o como ventanas
 * sobre el mapa; puede haber varios abiertos a la vez»). Decisión del jugador: se mueven
 * arrastrando el título y recuerdan dónde se dejaron.
 *
 * - La que se toca o recibe el foco pasa delante de las demás.
 * - Teclado: Alt + flechas la mueven (con Mayúsculas, más deprisa) y Escape la cierra.
 * - Nunca se salen de la pantalla, tampoco al cambiar su tamaño.
 */
import { icono as crearIcono, type NombreIcono } from '../../av/iconos';
import { t } from '../../i18n';
import { el, type Hijo } from '../dom';
import { limitarVentana, pasoConTecla, posicionEnCascada } from './geometria';
import '../estilos/componentes.css';

const PREFIJO_POSICION = 'geopolitica-2010.ventanas.';

export interface OpcionesVentana {
  /** Identificador estable: la ventana recuerda su sitio y no se abre dos veces. */
  id: string;
  titulo: string;
  contenido: Hijo[];
  /** Ancho en píxeles (por defecto, 420). El alto se ajusta al contenido. */
  ancho?: number;
  icono?: NombreIcono;
  alCerrar?: () => void;
}

export interface Ventana {
  readonly id: string;
  readonly elemento: HTMLElement;
  /** Zona del contenido (para cambiarlo sin cerrar la ventana). */
  readonly cuerpo: HTMLElement;
  readonly abierta: boolean;
  cerrar(): void;
  alFrente(): void;
  mover(x: number, y: number): void;
  /** Posición actual (esquina superior izquierda), en píxeles. */
  posicion(): { x: number; y: number };
}

const abiertas = new Map<string, Ventana>();
/** Orden de apilado de cada ventana abierta (la más alta, delante). */
const ordenDe = new Map<string, number>();
let ordenZ = 0;
let creadas = 0;

function leerPosicion(id: string): { x: number; y: number } | null {
  try {
    const texto = localStorage.getItem(PREFIJO_POSICION + id);
    if (!texto) return null;
    const valor = JSON.parse(texto) as { x?: unknown; y?: unknown };
    return typeof valor.x === 'number' && typeof valor.y === 'number'
      ? { x: valor.x, y: valor.y }
      : null;
  } catch {
    return null;
  }
}

function guardarPosicion(id: string, posicion: { x: number; y: number }): void {
  try {
    localStorage.setItem(PREFIJO_POSICION + id, JSON.stringify(posicion));
  } catch {
    // Sin almacenamiento, la ventana solo recuerda su sitio durante esta visita.
  }
}

const pantalla = (): { ancho: number; alto: number } => ({
  ancho: window.innerWidth,
  alto: window.innerHeight,
});

/** Ventanas abiertas ahora, de la de más atrás a la de más delante. */
export function ventanasAbiertas(): Ventana[] {
  return [...abiertas.values()].sort((a, b) => ordenDe.get(a.id)! - ordenDe.get(b.id)!);
}

/** Abre una ventana (o trae delante la que ya tenga ese identificador). */
export function abrirVentana(
  opciones: OpcionesVentana,
  contenedor: HTMLElement = document.body,
): Ventana {
  const existente = abiertas.get(opciones.id);
  if (existente) {
    existente.alFrente();
    existente.elemento.focus({ preventScroll: true });
    return existente;
  }
  const ancho = opciones.ancho ?? 420;
  const idTitulo = `ventana-titulo-${opciones.id}`;
  const cerrarBoton = el(
    'button',
    {
      class: 'ventana__cerrar',
      type: 'button',
      'aria-label': t('juego.componentes.cerrarVentana', { titulo: opciones.titulo }),
    },
    '✕',
  );
  const cabecera = el(
    'header',
    { class: 'ventana__cabecera', title: t('juego.componentes.moverVentana') },
    opciones.icono ? crearIcono(opciones.icono) : null,
    el('h2', { class: 'ventana__titulo', id: idTitulo }, opciones.titulo),
    cerrarBoton,
  );
  const cuerpo = el('div', { class: 'ventana__cuerpo' }, ...opciones.contenido);
  const elemento = el(
    'section',
    {
      class: 'ventana',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-labelledby': idTitulo,
      tabindex: -1,
      'data-ventana': opciones.id,
    },
    cabecera,
    cuerpo,
  );
  elemento.style.width = `${ancho}px`;

  let x = 0;
  let y = 0;
  let abierta = true;
  const colocar = (nx: number, ny: number, guardar: boolean): void => {
    const limitada = limitarVentana(
      { x: nx, y: ny, ancho: elemento.offsetWidth || ancho, alto: elemento.offsetHeight || 200 },
      pantalla(),
    );
    x = limitada.x;
    y = limitada.y;
    elemento.style.transform = `translate(${x}px, ${y}px)`;
    if (guardar) guardarPosicion(opciones.id, { x, y });
  };

  const ventana: Ventana = {
    id: opciones.id,
    elemento,
    cuerpo,
    get abierta() {
      return abierta;
    },
    cerrar() {
      if (!abierta) return;
      abierta = false;
      abiertas.delete(opciones.id);
      ordenDe.delete(opciones.id);
      window.removeEventListener('resize', alCambiarPantalla);
      elemento.remove();
      opciones.alCerrar?.();
    },
    alFrente() {
      if (ordenDe.get(opciones.id) === ordenZ) return;
      ordenZ += 1;
      ordenDe.set(opciones.id, ordenZ);
      // Por encima de la capa de ventanas del tema (var(--capa-ventana) = 30).
      elemento.style.setProperty('z-index', String(30 + ordenZ));
    },
    mover(nx, ny) {
      colocar(nx, ny, true);
    },
    posicion() {
      return { x, y };
    },
  };

  // Arrastrar por el título (no por sus botones).
  let arrastre: { dx: number; dy: number; puntero: number } | null = null;
  cabecera.addEventListener('pointerdown', (evento) => {
    if (evento.button !== 0 || (evento.target as Element).closest('button')) return;
    ventana.alFrente();
    arrastre = { dx: evento.clientX - x, dy: evento.clientY - y, puntero: evento.pointerId };
    cabecera.setPointerCapture?.(evento.pointerId);
    elemento.classList.add('ventana--moviendo');
    evento.preventDefault();
  });
  cabecera.addEventListener('pointermove', (evento) => {
    if (!arrastre || evento.pointerId !== arrastre.puntero) return;
    colocar(evento.clientX - arrastre.dx, evento.clientY - arrastre.dy, false);
  });
  const soltar = (evento: PointerEvent): void => {
    if (!arrastre || evento.pointerId !== arrastre.puntero) return;
    arrastre = null;
    elemento.classList.remove('ventana--moviendo');
    guardarPosicion(opciones.id, { x, y });
  };
  cabecera.addEventListener('pointerup', soltar);
  cabecera.addEventListener('pointercancel', soltar);

  elemento.addEventListener('pointerdown', () => ventana.alFrente());
  elemento.addEventListener('focusin', () => ventana.alFrente());
  elemento.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !evento.defaultPrevented) {
      // Que el Escape no llegue también al mapa (quitaría la selección).
      evento.preventDefault();
      evento.stopPropagation();
      ventana.cerrar();
      return;
    }
    if (evento.altKey) {
      const paso = pasoConTecla(evento.key, evento.shiftKey);
      if (paso) {
        evento.preventDefault();
        colocar(x + paso[0], y + paso[1], true);
      }
    }
  });
  cerrarBoton.addEventListener('click', () => ventana.cerrar());
  const alCambiarPantalla = (): void => colocar(x, y, false);
  window.addEventListener('resize', alCambiarPantalla);

  abiertas.set(opciones.id, ventana);
  contenedor.appendChild(elemento);
  ventana.alFrente();
  const inicial = leerPosicion(opciones.id) ?? posicionEnCascada(creadas++, pantalla(), ancho);
  colocar(inicial.x, inicial.y, false);
  elemento.focus({ preventScroll: true });
  return ventana;
}

/** Cierra todas las ventanas abiertas (al salir de una pantalla). */
export function cerrarVentanas(): void {
  for (const ventana of [...abiertas.values()]) ventana.cerrar();
}
