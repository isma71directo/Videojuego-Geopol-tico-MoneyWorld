/**
 * Prepara las geometrías del mapa para dibujarlas: proyecta cada país una sola vez a
 * coordenadas de mundo y guarda su caja para saltarse los que no se ven.
 */
import { geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { crearProyeccion } from './proyeccion';

export type TopologiaMapa = Topology<{ paises: GeometryCollection; zonas: GeometryCollection }>;

export interface Figura {
  id: string;
  /** Camino SVG en coordenadas de mundo. */
  camino: string;
  /** Caja [x0, y0, x1, y1] en coordenadas de mundo. */
  caja: [number, number, number, number];
  /** Punto de etiqueta en coordenadas de mundo (si lo hay). */
  etiqueta?: [number, number];
  /** Área en unidades de mundo al cuadrado (para ordenar etiquetas por tamaño). */
  area: number;
  /** Geometría original (longitud y latitud), para saber qué país hay bajo el ratón. */
  forma: Feature<Geometry>;
}

export interface CapaFiguras {
  paises: Figura[];
  zonas: Figura[];
}

function figuras(topo: TopologiaMapa, objeto: GeometryCollection): Figura[] {
  const proyeccion = crearProyeccion();
  const camino = geoPath(proyeccion);
  const lista = (feature(topo, objeto) as unknown as FeatureCollection).features as Feature<
    Geometry,
    { etiqueta?: [number, number] }
  >[];
  return lista
    .map((f) => {
      const d = camino(f) ?? '';
      const [[x0, y0], [x1, y1]] = camino.bounds(f);
      const etiqueta = f.properties?.etiqueta ? proyeccion(f.properties.etiqueta) : null;
      return {
        id: String(f.id),
        camino: d,
        caja: [x0, y0, x1, y1] as [number, number, number, number],
        ...(etiqueta ? { etiqueta: etiqueta as [number, number] } : {}),
        area: camino.area(f),
        forma: f,
      };
    })
    .filter((figura) => figura.camino !== '');
}

/** Proyecta todos los países y zonas de una topología. */
export function prepararFiguras(topo: TopologiaMapa): CapaFiguras {
  return { paises: figuras(topo, topo.objects.paises), zonas: figuras(topo, topo.objects.zonas) };
}

/** ¿Se cruzan dos cajas [x0, y0, x1, y1]? */
export function cajasSeCruzan(a: readonly number[], b: readonly number[]): boolean {
  return a[0]! <= b[2]! && a[2]! >= b[0]! && a[1]! <= b[3]! && a[3]! >= b[1]!;
}
