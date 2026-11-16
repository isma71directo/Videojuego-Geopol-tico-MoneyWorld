/**
 * Iconos vectoriales de los indicadores y de la interfaz (GDD, sección 7.1). Son SVG propios, dibujados con
 * trazo y `currentColor`, así que toman el color del texto que los rodea.
 */
import capas from './iconos/capas.svg?raw';
import carbon from './iconos/carbon.svg?raw';
import crecimiento from './iconos/crecimiento.svg?raw';
import densidad from './iconos/densidad.svg?raw';
import deuda from './iconos/deuda.svg?raw';
import emisiones from './iconos/emisiones.svg?raw';
import energia from './iconos/energia.svg?raw';
import gas from './iconos/gas.svg?raw';
import inflacion from './iconos/inflacion.svg?raw';
import paro from './iconos/paro.svg?raw';
import petroleo from './iconos/petroleo.svg?raw';
import pib from './iconos/pib.svg?raw';
import poblacion from './iconos/poblacion.svg?raw';
import politica from './iconos/politica.svg?raw';
import silencio from './iconos/silencio.svg?raw';
import gobierno from './iconos/gobierno.svg?raw';
import mundo from './iconos/mundo.svg?raw';
import ejercito from './iconos/ejercito.svg?raw';
import mas from './iconos/mas.svg?raw';
import ministros from './iconos/ministros.svg?raw';
import presupuesto from './iconos/presupuesto.svg?raw';
import impuestos from './iconos/impuestos.svg?raw';
import parlamento from './iconos/parlamento.svg?raw';
import infraestructuras from './iconos/infraestructuras.svg?raw';
import urna from './iconos/urna.svg?raw';
import sociedad from './iconos/sociedad.svg?raw';
import regiones from './iconos/regiones.svg?raw';
import comercio from './iconos/comercio.svg?raw';
import diplomacia from './iconos/diplomacia.svg?raw';
import investigacion from './iconos/investigacion.svg?raw';
import noticias from './iconos/noticias.svg?raw';
import comparador from './iconos/comparador.svg?raw';
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
  // Capas del mapa (tarea f6-t2).
  capas,
  politica,
  densidad,
  petroleo,
  gas,
  carbon,
  // Barra de secciones y sus ventanas (ajuste f7-a2).
  gobierno,
  mundo,
  ejercito,
  mas,
  ministros,
  presupuesto,
  impuestos,
  parlamento,
  infraestructuras,
  urna,
  sociedad,
  regiones,
  comercio,
  diplomacia,
  investigacion,
  noticias,
  comparador,
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
