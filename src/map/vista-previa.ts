/**
 * Vista previa estática del mapa de 2010 en SVG (galería audiovisual, tarea f2-t4).
 * El mapa interactivo del juego, en Canvas, llega en la Fase 3; esto solo sirve para revisar
 * las fronteras y los territorios.
 */
import { geoEqualEarth, geoGraticule10, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { ConjuntoPaises } from '../datos/paises';

export type TopologiaMapa = Topology<{ paises: GeometryCollection; zonas: GeometryCollection }>;

const SVG = 'http://www.w3.org/2000/svg';
const ANCHO = 960;

function trazo(d: string | null, clase: string, titulo?: string): SVGPathElement {
  const camino = document.createElementNS(SVG, 'path');
  camino.setAttribute('d', d ?? '');
  camino.setAttribute('class', clase);
  if (titulo) {
    const texto = document.createElementNS(SVG, 'title');
    texto.textContent = titulo;
    camino.appendChild(texto);
  }
  return camino;
}

function coleccion(topo: TopologiaMapa, objeto: GeometryCollection): Feature<Geometry>[] {
  return (feature(topo, objeto) as unknown as FeatureCollection).features;
}

/**
 * Dibuja el mapa: océano, retícula, zonas sin país y cada país o territorio coloreado según
 * su tipo (Estado, territorio especial o dependiente). `etiqueta` describe el mapa para los
 * lectores de pantalla.
 */
export function vistaPreviaMapa(
  topo: TopologiaMapa,
  conjunto: ConjuntoPaises,
  etiqueta: string,
): SVGSVGElement {
  const esfera = { type: 'Sphere' } as const;
  const proyeccion = geoEqualEarth().fitWidth(ANCHO, esfera);
  const camino = geoPath(proyeccion);
  const [[, arriba], [, abajo]] = camino.bounds(esfera);
  const alto = Math.ceil(abajo - arriba);

  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 ${Math.floor(arriba)} ${ANCHO} ${alto}`);
  svg.setAttribute('class', 'mapa-previo');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', etiqueta);

  svg.append(
    trazo(camino(esfera), 'mapa-previo__oceano'),
    trazo(camino(geoGraticule10()), 'mapa-previo__reticula'),
  );
  for (const zona of coleccion(topo, topo.objects.zonas)) {
    svg.append(trazo(camino(zona), 'mapa-previo__zona'));
  }
  for (const pais of coleccion(topo, topo.objects.paises)) {
    const datos = conjunto.paises[String(pais.id)];
    const tipo = datos?.tipo ?? 'pais';
    svg.append(trazo(camino(pais), `mapa-previo__pais mapa-previo__pais--${tipo}`, datos?.nombre));
  }
  svg.append(trazo(camino(esfera), 'mapa-previo__borde'));
  return svg;
}
