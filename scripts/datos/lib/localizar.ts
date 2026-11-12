/**
 * En qué país de 2010 cae un punto, con las fronteras de public/data/mapa-2010-detalle.json.
 * Lo usan las ciudades (13-ciudades.ts) y las regiones (14-regiones.ts).
 */
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
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
