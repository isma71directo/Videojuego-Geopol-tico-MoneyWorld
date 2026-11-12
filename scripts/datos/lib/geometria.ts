/** Utilidades de geometría para los scripts del mapa. Lógica pura, con tests. */
import { geoArea } from 'd3-geo';
import type { Feature } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

/** Radio medio de la Tierra, en km. */
export const RADIO_TIERRA_KM = 6371.0088;

/**
 * Superficie de cada país del mapa (km², con un decimal). Sirve de respaldo para los
 * territorios sin dato oficial de superficie (tarea f6-t2).
 */
export function superficiesDelMapa(
  topo: Topology<{ paises: GeometryCollection }>,
): Record<string, number> {
  const formas = (feature(topo, topo.objects.paises) as unknown as { features: Feature[] })
    .features;
  return Object.fromEntries(
    formas.map((forma) => [
      String(forma.id),
      Math.round(geoArea(forma) * RADIO_TIERRA_KM ** 2 * 10) / 10,
    ]),
  );
}

export type Anillo = [number, number][];
export type Poligono = Anillo[];
export type MultiPoligono = Poligono[];

/** Área plana (en grados², con signo) de un anillo: positiva si va en sentido antihorario. */
export function areaConSigno(anillo: readonly (readonly number[])[]): number {
  let suma = 0;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i, i += 1) {
    suma += (anillo[j]![0]! - anillo[i]![0]!) * (anillo[j]![1]! + anillo[i]![1]!);
  }
  return suma / 2;
}

/**
 * Orienta los anillos como espera d3-geo: el exterior en sentido horario y los huecos en
 * sentido antihorario (al revés que GeoJSON RFC 7946). Si la orientación es la contraria,
 * d3 dibuja el resto de la esfera en lugar del país.
 */
export function orientarParaD3(multi: MultiPoligono): MultiPoligono {
  return multi.map((poligono) =>
    poligono.map((anillo, i) => {
      const horario = areaConSigno(anillo) < 0;
      const debeSerHorario = i === 0;
      return horario === debeSerHorario ? anillo : [...anillo].reverse();
    }),
  );
}

/** Pasa un Polygon o MultiPolygon de GeoJSON a lista de polígonos. */
export function comoMultiPoligono(geometria: {
  type: string;
  coordinates: unknown;
}): MultiPoligono {
  if (geometria.type === 'Polygon') return [geometria.coordinates as Poligono];
  if (geometria.type === 'MultiPolygon') return geometria.coordinates as MultiPoligono;
  throw new Error(`Geometría no admitida: ${geometria.type}`);
}

/** Longitud máxima de un polígono (para separar partes lejanas, como las islas del Caribe). */
export function longitudMaxima(poligono: Poligono): number {
  return Math.max(...poligono[0]!.map((punto) => punto[0]));
}

/** Área plana absoluta de un polígono (exterior menos huecos), en grados². */
export function areaPlana(poligono: Poligono): number {
  const [exterior, ...huecos] = poligono;
  return (
    Math.abs(areaConSigno(exterior!)) -
    huecos.reduce((suma, hueco) => suma + Math.abs(areaConSigno(hueco)), 0)
  );
}

/** El polígono más grande de un multipolígono (para colocar la etiqueta). */
export function poligonoMayor(multi: MultiPoligono): Poligono {
  return multi.reduce((mayor, actual) => (areaPlana(actual) > areaPlana(mayor) ? actual : mayor));
}

/** Redondea coordenadas a un número de decimales. */
export function redondearPunto([x, y]: readonly number[], decimales = 2): [number, number] {
  const f = 10 ** decimales;
  return [Math.round(x! * f) / f, Math.round(y! * f) / f];
}
