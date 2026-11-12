/**
 * Ríos y lagos del mapa (tarea f3-t4). Cada elemento se muestra a partir de un zoom: los
 * grandes ríos se ven desde lejos y los pequeños al acercarse.
 */
import { geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { crearProyeccion, ANCHO_MUNDO } from './proyeccion';

export type TopologiaAgua = Topology<{ rios: GeometryCollection; lagos: GeometryCollection }>;

export interface ElementoAgua {
  /** Zoom (escala de los mapas web) a partir del cual se muestra. */
  z: number;
  nombre: string;
  camino: string;
  caja: [number, number, number, number];
}

export interface CapaAgua {
  rios: ElementoAgua[];
  lagos: ElementoAgua[];
}

/**
 * Zoom equivalente al de los mapas web (0 = el mundo en 256 px) para un zoom de la cámara:
 * Natural Earth indica con esa escala cuándo mostrar cada río o lago.
 */
export function zoomWeb(k: number): number {
  return Math.log2((ANCHO_MUNDO * k) / 256);
}

function elementos(topo: TopologiaAgua, objeto: GeometryCollection): ElementoAgua[] {
  const camino = geoPath(crearProyeccion());
  const lista = (feature(topo, objeto) as unknown as FeatureCollection).features as Feature<
    Geometry,
    { z: number; nombre: string }
  >[];
  return lista
    .map((f) => {
      const [[x0, y0], [x1, y1]] = camino.bounds(f);
      return {
        z: f.properties.z,
        nombre: f.properties.nombre,
        camino: camino(f) ?? '',
        caja: [x0, y0, x1, y1] as [number, number, number, number],
      };
    })
    .filter((elemento) => elemento.camino !== '')
    .sort((a, b) => a.z - b.z);
}

export function prepararAgua(topo: TopologiaAgua): CapaAgua {
  return { rios: elementos(topo, topo.objects.rios), lagos: elementos(topo, topo.objects.lagos) };
}
