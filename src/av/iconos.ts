/**
 * Iconos vectoriales de los indicadores y de la interfaz (GDD, sección 7.1). Son SVG propios, dibujados con
 * trazo y `currentColor`, así que toman el color del texto que los rodea.
 */
import bateria from './iconos/bateria.svg?raw';
import buscar from './iconos/buscar.svg?raw';
import cristales from './iconos/cristales.svg?raw';
import gema from './iconos/gema.svg?raw';
import lingote from './iconos/lingote.svg?raw';
import pico from './iconos/pico.svg?raw';
import uranio from './iconos/uranio.svg?raw';
import capas from './iconos/capas.svg?raw';
import ciudad from './iconos/ciudad.svg?raw';
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
import regimenParlamentario from './iconos/regimen-parlamentario.svg?raw';
import regimenPresidencial from './iconos/regimen-presidencial.svg?raw';
import regimenSemipresidencial from './iconos/regimen-semipresidencial.svg?raw';
import regimenMonarquiaParlamentaria from './iconos/regimen-monarquia-parlamentaria.svg?raw';
import regimenMonarquiaAbsoluta from './iconos/regimen-monarquia-absoluta.svg?raw';
import regimenPartidoUnico from './iconos/regimen-partido-unico.svg?raw';
import regimenJunta from './iconos/regimen-junta.svg?raw';
import regimenTeocracia from './iconos/regimen-teocracia.svg?raw';
import hacienda from './iconos/hacienda.svg?raw';
import interior from './iconos/interior.svg?raw';
import justicia from './iconos/justicia.svg?raw';
import sanidad from './iconos/sanidad.svg?raw';
import educacion from './iconos/educacion.svg?raw';
import ciencia from './iconos/ciencia.svg?raw';
import trabajo from './iconos/trabajo.svg?raw';
import industria from './iconos/industria.svg?raw';
import transportes from './iconos/transportes.svg?raw';
import telecomunicaciones from './iconos/telecomunicaciones.svg?raw';
import agricultura from './iconos/agricultura.svg?raw';
import medioambiente from './iconos/medioambiente.svg?raw';
import vivienda from './iconos/vivienda.svg?raw';
import cultura from './iconos/cultura.svg?raw';
import igualdad from './iconos/igualdad.svg?raw';
import estrella from './iconos/estrella.svg?raw';
import ley from './iconos/ley.svg?raw';
import organizaciones from './iconos/organizaciones.svg?raw';
import equipamiento from './iconos/equipamiento.svg?raw';
import base from './iconos/base.svg?raw';
import guerra from './iconos/guerra.svg?raw';
import informe from './iconos/informe.svg?raw';
import historial from './iconos/historial.svg?raw';
import gobierno from './iconos/gobierno.svg?raw';
import mundo from './iconos/mundo.svg?raw';
import calendario from './iconos/calendario.svg?raw';
import popularidad from './iconos/popularidad.svg?raw';
import salir from './iconos/salir.svg?raw';
import pausa from './iconos/pausa.svg?raw';
import seguir from './iconos/seguir.svg?raw';
import efectos from './iconos/efectos.svg?raw';
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
  buscar,
  ciudad,
  uranio,
  lingote,
  gema,
  pico,
  bateria,
  cristales,
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
  // Ministerios y ventanas de la barra (ajuste f7-a4).
  hacienda,
  interior,
  justicia,
  sanidad,
  educacion,
  ciencia,
  trabajo,
  industria,
  transportes,
  telecomunicaciones,
  agricultura,
  medioambiente,
  vivienda,
  cultura,
  igualdad,
  estrella,
  ley,
  organizaciones,
  equipamiento,
  base,
  guerra,
  informe,
  historial,
  // Barra superior de la partida (tarea f10-t3).
  calendario,
  popularidad,
  salir,
  // Controles del tiempo (tarea f11-t3).
  pausa,
  seguir,
  // Efectos en curso (tarea f13-t2).
  efectos,
  // Regímenes políticos (tarea f8-t3).
  'regimen-parlamentario': regimenParlamentario,
  'regimen-presidencial': regimenPresidencial,
  'regimen-semipresidencial': regimenSemipresidencial,
  'regimen-monarquia-parlamentaria': regimenMonarquiaParlamentaria,
  'regimen-monarquia-absoluta': regimenMonarquiaAbsoluta,
  'regimen-partido-unico': regimenPartidoUnico,
  'regimen-junta': regimenJunta,
  'regimen-teocracia': regimenTeocracia,
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
