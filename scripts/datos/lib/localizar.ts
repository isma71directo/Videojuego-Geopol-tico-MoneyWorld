/**
 * En qué país de 2010 cae un punto, con las fronteras de public/data/mapa-2010-detalle.json.
 * Lo usan las ciudades (13-ciudades.ts) y las regiones (14-regiones.ts); y, para saber en qué
 * región cae un punto, los datos económicos de las regiones (21-regiones-economia.ts).
 */
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { geoBounds, geoContains, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

export interface Localizador {
  /** País cuyo polígono contiene el punto, o null. */
  paisDe(lon: number, lat: number): string | null;
  /** País con algún punto del contorno a menos de `km` (para lugares que caen en el mar). */
  paisCercano(lon: number, lat: number, km: number): string | null;
  /** Polígono de un país (para regiones de países sin divisiones). */
  forma(id: string): Polygon | MultiPolygon | undefined;
}

export function crearLocalizador(topo: Topology): Localizador {
  const formas = (
    feature(topo, topo.objects.paises!) as unknown as FeatureCollection<Polygon | MultiPolygon>
  ).features.map((forma) => {
    const [[x0, y0], [x1, y1]] = geoBounds(forma);
    // Si la caja cruza el antimeridiano (x0 > x1), se mira siempre el polígono.
    return { id: String(forma.id), forma, caja: [x0, y0, x1, y1] as const };
  });
  return {
    paisDe(lon, lat) {
      for (const { id, forma, caja } of formas) {
        const [x0, y0, x1, y1] = caja;
        const dentroCaja = lat >= y0 && lat <= y1 && (x0 > x1 || (lon >= x0 && lon <= x1));
        if (dentroCaja && geoContains(forma, [lon, lat])) return id;
      }
      return null;
    },
    paisCercano(lon, lat, km) {
      let mejor: string | null = null;
      let distanciaMejor = km / 6371;
      for (const { id, forma } of formas) {
        const anillos =
          forma.geometry.type === 'Polygon'
            ? forma.geometry.coordinates
            : forma.geometry.coordinates.flat();
        for (const anillo of anillos) {
          for (const punto of anillo) {
            const distancia = geoDistance([lon, lat], punto as [number, number]);
            if (distancia < distanciaMejor) {
              distanciaMejor = distancia;
              mejor = id;
            }
          }
        }
      }
      return mejor;
    },
    forma(id) {
      return formas.find((f) => f.id === id)?.forma.geometry;
    },
  };
}

export interface LocalizadorRegiones {
  /**
   * Región de un país que contiene el punto o, si cae fuera de todas (en la costa), la más
   * cercana a menos de `km`. null si no hay ninguna.
   */
  regionDe(
    pais: string,
    lon: number,
    lat: number,
    km?: number,
    exigirCerca?: boolean,
  ): string | null;
}

/** En qué región de 2010 cae un punto, con public/data/regiones-2010.json (tarea f9-t1). */
export function crearLocalizadorRegiones(topo: Topology): LocalizadorRegiones {
  const porPais = new Map<
    string,
    { id: string; forma: Feature<Polygon | MultiPolygon>; caja: readonly number[] }[]
  >();
  const formas = (
    feature(topo, topo.objects.regiones!) as unknown as FeatureCollection<
      Polygon | MultiPolygon,
      { id: string; pais: string }
    >
  ).features;
  for (const forma of formas) {
    const [[x0, y0], [x1, y1]] = geoBounds(forma);
    const lista = porPais.get(forma.properties.pais) ?? [];
    lista.push({ id: forma.properties.id, forma, caja: [x0, y0, x1, y1] });
    porPais.set(forma.properties.pais, lista);
  }
  return {
    regionDe(pais, lon, lat, km = 60, exigirCerca = false) {
      const lista = porPais.get(pais) ?? [];
      // En un país de una sola región, esa (salvo que se pida que el punto esté cerca).
      if (lista.length === 1 && !exigirCerca) return lista[0]!.id;
      for (const { id, forma, caja } of lista) {
        const [x0, y0, x1, y1] = caja as [number, number, number, number];
        const dentroCaja = lat >= y0 && lat <= y1 && (x0 > x1 || (lon >= x0 && lon <= x1));
        if (dentroCaja && geoContains(forma, [lon, lat])) return id;
      }
      let mejor: string | null = null;
      let distanciaMejor = km / 6371;
      for (const { id, forma } of lista) {
        const anillos =
          forma.geometry.type === 'Polygon'
            ? forma.geometry.coordinates
            : forma.geometry.coordinates.flat();
        for (const anillo of anillos) {
          for (const punto of anillo) {
            const distancia = geoDistance([lon, lat], punto as [number, number]);
            if (distancia < distanciaMejor) {
              distanciaMejor = distancia;
              mejor = id;
            }
          }
        }
      }
      return mejor;
    },
  };
}
