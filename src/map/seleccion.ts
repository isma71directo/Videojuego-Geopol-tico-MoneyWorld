/**
 * Qué país hay en un punto del mapa (tarea f4-t1). Lógica pura, con tests.
 * Primero se miran los países diminutos por su punto de etiqueta (a ciertos zooms no se ven
 * como polígono) y después, el polígono que contiene el punto.
 */
import { geoContains } from 'd3-geo';
import type { Figura } from './geometria';
import { ANCHO_MUNDO } from './proyeccion';

/** Un país que en pantalla mide menos que esto se señala por su punto de etiqueta. */
export const UMBRAL_PEQUENO_PX = 10;
/** Distancia máxima (px) entre el ratón y la etiqueta de un país diminuto. */
export const RADIO_PEQUENO_PX = 9;

/** Distancia horizontal más corta teniendo en cuenta que el mundo da la vuelta. */
function distanciaX(a: number, b: number): number {
  const d = Math.abs(a - b) % ANCHO_MUNDO;
  return Math.min(d, ANCHO_MUNDO - d);
}

/**
 * Identificador del país en el punto (x, y) de mundo, o null si es mar.
 * `k` es el zoom (px por unidad de mundo) e `invertir` pasa de mundo a longitud y latitud.
 */
export function paisEnPunto(
  figuras: readonly Figura[],
  x: number,
  y: number,
  k: number,
  invertir: (punto: [number, number]) => [number, number] | null,
): string | null {
  const xm = ((x % ANCHO_MUNDO) + ANCHO_MUNDO) % ANCHO_MUNDO;

  let pequeno: Figura | null = null;
  let distanciaPequeno = Infinity;
  for (const figura of figuras) {
    if (!figura.etiqueta) continue;
    const tamano = Math.max(figura.caja[2] - figura.caja[0], figura.caja[3] - figura.caja[1]) * k;
    if (tamano >= UMBRAL_PEQUENO_PX) continue;
    const distancia = Math.hypot(distanciaX(figura.etiqueta[0], xm), figura.etiqueta[1] - y) * k;
    if (distancia < RADIO_PEQUENO_PX && distancia < distanciaPequeno) {
      pequeno = figura;
      distanciaPequeno = distancia;
    }
  }
  if (pequeno) return pequeno.id;

  const lugar = invertir([xm, y]);
  if (!lugar) return null;
  let elegido: Figura | null = null;
  for (const figura of figuras) {
    const [x0, y0, x1, y1] = figura.caja;
    if (xm < x0 || xm > x1 || y < y0 || y > y1) continue;
    if (!geoContains(figura.forma, lugar)) continue;
    // Si dos coinciden (enclaves), gana el más pequeño: el Vaticano dentro de Italia.
    if (!elegido || figura.area < elegido.area) elegido = figura;
  }
  return elegido?.id ?? null;
}
