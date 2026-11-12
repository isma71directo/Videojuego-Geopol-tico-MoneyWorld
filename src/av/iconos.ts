/**
 * Iconos vectoriales de los indicadores y de la interfaz (GDD, sección 7.1). Son SVG propios, dibujados con
 * trazo y `currentColor`, así que toman el color del texto que los rodea.
 */
import crecimiento from './iconos/crecimiento.svg?raw';
import deuda from './iconos/deuda.svg?raw';
import emisiones from './iconos/emisiones.svg?raw';
import energia from './iconos/energia.svg?raw';
import inflacion from './iconos/inflacion.svg?raw';
import paro from './iconos/paro.svg?raw';
import pib from './iconos/pib.svg?raw';
import poblacion from './iconos/poblacion.svg?raw';
import silencio from './iconos/silencio.svg?raw';
import sonido from './iconos/sonido.svg?raw';

const ICONOS = {
  poblacion,
  pib,
  crecimiento,
  paro,
  inflacion,
  deuda,
  energia,
  emisiones,
  sonido,
  silencio,
};

export type NombreIcono = keyof typeof ICONOS;

export const NOMBRES_ICONOS = Object.keys(ICONOS) as NombreIcono[];

/**
 * Crea el icono como elemento SVG. Si se da una etiqueta, se anuncia como imagen con ese
 * texto; si no, es decorativo y los lectores de pantalla lo ignoran.
 */
export function icono(nombre: NombreIcono, etiqueta?: string): SVGElement {
  const plantilla = document.createElement('template');
  // El contenido es un archivo SVG propio del proyecto, no texto de fuera.
  plantilla.innerHTML = ICONOS[nombre];
  const svg = plantilla.content.firstElementChild as SVGElement;
  svg.classList.add('icono');
  if (etiqueta) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', etiqueta);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  return svg;
}
