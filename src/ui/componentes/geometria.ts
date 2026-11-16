/**
 * Cuentas de los componentes de interfaz (Fase 7), sin DOM, con tests: dónde puede ir una
 * ventana dentro de la pantalla y qué pestaña o elemento de una lista toca con cada tecla.
 */

/** Rectángulo en píxeles de pantalla. */
export interface Rect {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Margen mínimo entre una ventana y el borde de la pantalla, en píxeles. */
export const MARGEN_PANTALLA = 8;
/** Lo que una ventana deja siempre a la vista de su barra de título al moverla. */
export const BARRA_VISIBLE = 48;

/**
 * Coloca una ventana dentro de la pantalla: nunca se sale por arriba (su título siempre se
 * puede agarrar) y, si es más grande que la pantalla, se pega al margen de arriba a la
 * izquierda.
 */
export function limitarVentana(
  ventana: Rect,
  pantalla: { ancho: number; alto: number },
  margen = MARGEN_PANTALLA,
): { x: number; y: number } {
  const maxX = Math.max(margen, pantalla.ancho - ventana.ancho - margen);
  const maxY = Math.max(margen, pantalla.alto - Math.min(ventana.alto, BARRA_VISIBLE) - margen);
  return {
    x: Math.round(Math.min(maxX, Math.max(margen, ventana.x))),
    y: Math.round(Math.min(maxY, Math.max(margen, ventana.y))),
  };
}

/**
 * Sitio de la ventana número `n` que se abre sin posición guardada: en cascada desde arriba a
 * la izquierda, para que no queden unas encima de otras.
 */
export function posicionEnCascada(
  n: number,
  pantalla: { ancho: number; alto: number },
  ancho: number,
): { x: number; y: number } {
  const paso = 28;
  const filas = Math.max(1, Math.floor((pantalla.alto - 200) / paso));
  const k = n % filas;
  const x = Math.min(
    Math.max(MARGEN_PANTALLA, pantalla.ancho - ancho - MARGEN_PANTALLA),
    96 + k * paso,
  );
  return { x, y: 72 + k * paso };
}

/**
 * Índice al que lleva una tecla en una lista horizontal o vertical (pestañas, menús):
 * flechas para la anterior o la siguiente (dando la vuelta), Inicio y Fin para los extremos.
 * null si la tecla no mueve nada.
 */
export function indiceConTecla(
  actual: number,
  tecla: string,
  total: number,
  orientacion: 'horizontal' | 'vertical' = 'horizontal',
): number | null {
  if (total <= 0) return null;
  const anterior = orientacion === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
  const siguiente = orientacion === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
  switch (tecla) {
    case anterior:
      return (actual - 1 + total) % total;
    case siguiente:
      return (actual + 1) % total;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}

/** Desplazamiento de una ventana con Alt + flechas (con Mayúsculas, más largo). */
export function pasoConTecla(tecla: string, largo: boolean): [number, number] | null {
  const d = largo ? 64 : 16;
  switch (tecla) {
    case 'ArrowLeft':
      return [-d, 0];
    case 'ArrowRight':
      return [d, 0];
    case 'ArrowUp':
      return [0, -d];
    case 'ArrowDown':
      return [0, d];
    default:
      return null;
  }
}
