/**
 * Índice ligero de las regiones para el buscador (tarea f9-t2): nombre, país, población, punto de
 * la etiqueta y caja de cada región, en grados. Así el buscador las encuentra y el mapa puede ir
 * hasta ellas antes de descargar sus fronteras (regiones-2010.json, mucho más pesado).
 *
 * Fuentes: public/data/regiones-2010.json (Natural Earth, agrupadas en la tarea f5-t1) y
 * public/data/regiones-2010-datos.json (población de 2010).
 *
 * Salida: public/data/buscador-2010.json
 * Uso:    node scripts/datos/22-buscador.ts (después de 14-regiones.ts y 15-regiones-datos.ts)
 */
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { geoBounds } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { escribirJsonCompacto, leerJson } from './lib/comun.ts';

const topo = leerJson<Topology>('public/data/regiones-2010.json');
const datos = leerJson<{ regiones: Record<string, { poblacion: number | null }> }>(
  'public/data/regiones-2010-datos.json',
).regiones;

const formas = (
  feature(topo, topo.objects.regiones!) as unknown as FeatureCollection<
    Polygon | MultiPolygon,
    { id: string; pais: string; nombre: string; etiqueta: [number, number] }
  >
).features;

const dos = (x: number): number => Math.round(x * 100) / 100;
const regiones = formas
  .map((forma) => {
    const { id, pais, nombre, etiqueta } = forma.properties;
    const [[x0, y0], [x1, y1]] = geoBounds(forma);
    return [
      id,
      nombre,
      pais,
      datos[id]?.poblacion ?? null,
      etiqueta.map(dos),
      [x0, y0, x1, y1].map(dos),
    ];
  })
  .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

escribirJsonCompacto(
  'public/data/buscador-2010.json',
  {
    fuente:
      'Natural Earth (dominio público), regiones de 2010 agrupadas; población de regiones-2010-datos.json.',
    formato:
      'regiones: [id, nombre, país, población, [lon, lat] de la etiqueta, [lon0, lat0, lon1, lat1] de la caja]. Si lon0 > lon1, la caja cruza el antimeridiano.',
    regiones,
  },
  2,
);
console.log(`buscador-2010.json: ${regiones.length} regiones.`);
