/**
 * Ríos y lagos del mapa (tarea f3-t4).
 *
 * Fuente: Natural Earth 1:50m, versión fijada (dominio público): ríos (sin las líneas que
 *         atraviesan lagos) y lagos. Cada elemento guarda el zoom a partir del cual se muestra
 *         («z», en la escala habitual de los mapas web) y su nombre.
 *
 * Salida: public/data/mapa-agua.json (TopoJSON con los objetos «rios» y «lagos»)
 * Uso:    node scripts/datos/12-agua.ts
 */
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, quantile, simplify, sphericalTriangleArea } from 'topojson-simplify';
import { descargarJson, escribirTexto } from './lib/comun.ts';
import { orientarParaD3, type MultiPoligono } from './lib/geometria.ts';

const URL_NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson';

type Propiedades = Record<string, string | number | null>;

function limpiar(
  coleccion: FeatureCollection<Geometry, Propiedades>,
  tipo: 'rios' | 'lagos',
): Feature[] {
  return coleccion.features
    .filter((f) => tipo === 'lagos' || f.properties.featurecla === 'River')
    .map((f) => {
      const geometria = f.geometry;
      if (geometria.type === 'Polygon' || geometria.type === 'MultiPolygon') {
        const multi = (
          geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates
        ) as MultiPoligono;
        f.geometry = { type: 'MultiPolygon', coordinates: orientarParaD3(multi) };
      }
      return {
        type: 'Feature',
        properties: {
          z: Number(f.properties.min_zoom ?? 5),
          nombre: String(f.properties.name_es ?? f.properties.name ?? ''),
        },
        geometry: f.geometry,
      } as Feature;
    });
}

const [rios, lagos] = await Promise.all([
  descargarJson<FeatureCollection<Geometry, Propiedades>>(
    `${URL_NE}/ne_50m_rivers_lake_centerlines.geojson`,
  ),
  descargarJson<FeatureCollection<Geometry, Propiedades>>(`${URL_NE}/ne_50m_lakes.geojson`),
]);

const colecciones: Record<string, FeatureCollection> = {
  rios: { type: 'FeatureCollection', features: limpiar(rios, 'rios') },
  lagos: { type: 'FeatureCollection', features: limpiar(lagos, 'lagos') },
};
const topo = presimplify(
  topology(colecciones, 1e6) as unknown as Parameters<typeof presimplify>[0],
  sphericalTriangleArea,
);
const texto = JSON.stringify(quantize(simplify(topo, quantile(topo, 0.35)), 1e5));
escribirTexto('public/data/mapa-agua.json', `${texto}\n`);
console.log(
  `Agua: ${colecciones.rios!.features.length} ríos y ${colecciones.lagos!.features.length} lagos · ${(texto.length / 1024).toFixed(0)} KB`,
);
