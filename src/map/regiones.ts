/**
 * Regiones del mapa (tarea f5-t3). Lógica pura, con tests.
 * Las regiones de un país se ven cuando ese país es grande en pantalla: así Rusia muestra sus
 * regiones antes que Bélgica. Desde lejos, el mapa solo enseña países.
 */
import type { Feature, MultiLineString, MultiPolygon } from 'geojson';
import { geoContains, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { ANCHO_MUNDO, crearProyeccion } from './proyeccion';
import { cajasSeSolapan, type Caja } from './rotulos';

export interface PropiedadesRegion {
  id: string;
  pais: string;
  nombre: string;
  /** Punto de la etiqueta (longitud y latitud). */
  etiqueta: [number, number];
}

export type TopologiaRegiones = Topology<{ regiones: GeometryCollection<PropiedadesRegion> }>;

export interface RegionMapa {
  id: string;
  pais: string;
  nombre: string;
  /** Punto de la etiqueta en coordenadas de mundo. */
  etiqueta: [number, number];
  /** Caja en coordenadas de mundo: [x0, y0, x1, y1]. */
  caja: [number, number, number, number];
  /** Área en unidades de mundo al cuadrado. */
  area: number;
  /** Contorno en coordenadas de mundo (trazado SVG). */
  camino: string;
  /** Geometría original (longitud y latitud), para saber si un punto está dentro. */
  forma: Feature<MultiPolygon, PropiedadesRegion>;
}

/** Las regiones de un país se dibujan cuando el país mide al menos esto en pantalla (px). */
export const TAMANO_REGIONES_PX = 240;

export function regionesVisibles(tamanoPaisPx: number): boolean {
  return tamanoPaisPx >= TAMANO_REGIONES_PX;
}

export interface CapaRegionesPreparada {
  porPais: Map<string, RegionMapa[]>;
  porId: Map<string, RegionMapa>;
  /** Fronteras interiores de un país (trazado SVG en coordenadas de mundo), con memoria. */
  fronteras(pais: string): string;
}

export function prepararRegiones(topo: TopologiaRegiones): CapaRegionesPreparada {
  const camino = geoPath(crearProyeccion());
  const proyeccion = crearProyeccion();
  const formas = (
    feature(topo, topo.objects.regiones) as unknown as {
      features: Feature<MultiPolygon, PropiedadesRegion>[];
    }
  ).features;
  const porPais = new Map<string, RegionMapa[]>();
  const porId = new Map<string, RegionMapa>();
  for (const forma of formas) {
    const { id, pais, nombre } = forma.properties;
    const [[x0, y0], [x1, y1]] = camino.bounds(forma);
    const etiqueta = proyeccion(forma.properties.etiqueta) ?? [(x0 + x1) / 2, (y0 + y1) / 2];
    const region: RegionMapa = {
      id,
      pais,
      nombre,
      etiqueta: [etiqueta[0], etiqueta[1]],
      caja: [x0, y0, x1, y1],
      area: camino.area(forma),
      camino: camino(forma) ?? '',
      forma,
    };
    porId.set(id, region);
    const lista = porPais.get(pais) ?? [];
    lista.push(region);
    porPais.set(pais, lista);
  }
  const memoria = new Map<string, string>();
  return {
    porPais,
    porId,
    fronteras(pais) {
      let trazado = memoria.get(pais);
      if (trazado === undefined) {
        // Solo los tramos entre dos regiones del mismo país: la costa ya la dibuja el país.
        const lineas = mesh(
          topo,
          topo.objects.regiones as unknown as Parameters<typeof mesh>[1],
          (a, b) => {
            const pa = (a as unknown as { properties: PropiedadesRegion }).properties;
            const pb = (b as unknown as { properties: PropiedadesRegion }).properties;
            return a !== b && pa.pais === pais && pb.pais === pais;
          },
        ) as MultiLineString;
        trazado = camino(lineas) ?? '';
        memoria.set(pais, trazado);
      }
      return trazado;
    },
  };
}

/**
 * Región en el punto (x, y) de mundo, entre las de un país. Si dos coinciden (una dentro de
 * otra, como Madrid en el Estado de México), gana la más pequeña.
 */
export function regionEnPunto(
  regiones: readonly RegionMapa[],
  x: number,
  y: number,
  invertir: (punto: [number, number]) => [number, number] | null,
): RegionMapa | null {
  const xm = ((x % ANCHO_MUNDO) + ANCHO_MUNDO) % ANCHO_MUNDO;
  const lugar = invertir([xm, y]);
  if (!lugar) return null;
  let elegida: RegionMapa | null = null;
  for (const region of regiones) {
    const [x0, y0, x1, y1] = region.caja;
    if (xm < x0 || xm > x1 || y < y0 || y > y1) continue;
    if (!geoContains(region.forma, lugar)) continue;
    if (!elegida || region.area < elegida.area) elegida = region;
  }
  return elegida;
}

export interface CandidatoNombreRegion {
  id: string;
  texto: string;
  /** Punto de la etiqueta en pantalla. */
  x: number;
  y: number;
  /** Tamaño de la región en pantalla (raíz de su área, en px). */
  tamano: number;
}

export interface NombreRegion {
  id: string;
  texto: string;
  x: number;
  y: number;
  caja: Caja;
}

/**
 * Nombres de las regiones: las grandes primero, solo si el nombre cabe más o menos en la región
 * y sin pisar lo ya ocupado (nombres de países y de capitales). Si el sitio está tapado, se
 * prueba un poco más arriba y un poco más abajo.
 */
export function colocarNombresRegiones(
  candidatos: readonly CandidatoNombreRegion[],
  medir: (texto: string) => number,
  alturaTexto: number,
  ancho: number,
  alto: number,
  ocupadas: readonly Caja[] = [],
): NombreRegion[] {
  const tapadas: Caja[] = [...ocupadas];
  const colocados: NombreRegion[] = [];
  const orden = [...candidatos].sort((a, b) => b.tamano - a.tamano || a.id.localeCompare(b.id));
  for (const candidato of orden) {
    const anchoTexto = medir(candidato.texto);
    if (anchoTexto > candidato.tamano * 1.2) continue;
    for (const dy of [0, -alturaTexto * 1.2, alturaTexto * 1.2]) {
      const y = candidato.y + dy;
      const caja: Caja = [
        candidato.x - anchoTexto / 2 - 2,
        y - alturaTexto / 2 - 1,
        candidato.x + anchoTexto / 2 + 2,
        y + alturaTexto / 2 + 1,
      ];
      if (caja[2] < 0 || caja[0] > ancho || caja[3] < 0 || caja[1] > alto) break;
      if (tapadas.some((otra) => cajasSeSolapan(caja, otra))) continue;
      colocados.push({ id: candidato.id, texto: candidato.texto, x: candidato.x, y, caja });
      tapadas.push(caja);
      break;
    }
  }
  return colocados;
}
