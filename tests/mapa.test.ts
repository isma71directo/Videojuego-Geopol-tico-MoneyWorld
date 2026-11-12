import { readFileSync } from 'node:fs';
import { geoArea, geoContains } from 'd3-geo';
import type { Feature, MultiPolygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';
import {
  areaConSigno,
  orientarParaD3,
  type MultiPoligono,
} from '../scripts/datos/lib/geometria.ts';
import type { ConjuntoPaises } from '../src/datos/paises';

const leer = (ruta: string): string => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

type Topo = Topology<{ paises: GeometryCollection; zonas: GeometryCollection }>;
const conjunto = JSON.parse(leer('public/data/paises-2010.json')) as ConjuntoPaises;

function cargar(nivel: string) {
  const topo = JSON.parse(leer(`public/data/mapa-2010-${nivel}.json`)) as Topo;
  const coleccion = (objeto: GeometryCollection) =>
    (
      feature(topo, objeto) as unknown as {
        features: Feature<MultiPolygon, { etiqueta?: number[] }>[];
      }
    ).features;
  return { topo, paises: coleccion(topo.objects.paises), zonas: coleccion(topo.objects.zonas) };
}

/** Puntos del interior (no de la costa, que la simplificación puede dejar en el mar). */
const PUNTOS_2010: [string, number, number, string][] = [
  ['Simferópol (Crimea)', 34.1, 44.95, 'UKR'],
  ['Moscú', 37.62, 55.75, 'RUS'],
  ['Juba (hoy Sudán del Sur)', 31.58, 4.85, 'SDN'],
  ['Jartum', 32.53, 15.5, 'SDN'],
  ['Sujumi', 41.02, 43.0, 'ABK'],
  ['Tsjinval', 43.96, 42.23, 'SOS'],
  ['Tiflis', 44.79, 41.72, 'GEO'],
  ['Tiráspol', 29.63, 46.84, 'PMR'],
  ['Chisináu', 28.86, 47.01, 'MDA'],
  ['El Aaiún', -13.2, 27.15, 'ESH'],
  ['Rabat', -6.84, 34.02, 'MAR'],
  ['Kralendijk (Bonaire)', -68.27, 12.15, 'ANT'],
  ['Willemstad (Curazao)', -68.93, 12.11, 'ANT'],
  ['Ámsterdam', 4.9, 52.37, 'NLD'],
  ['Jersey', -2.13, 49.215, 'CHI'],
  ['Hong Kong', 114.17, 22.32, 'HKG'],
  ['Puerto Rico', -66.5, 18.2, 'PRI'],
  ['Groenlandia', -40, 72, 'GRL'],
  ['Islas Malvinas', -58.6, -51.65, 'GBR'],
  ['Åland', 19.93, 60.1, 'FIN'],
  ['Pristina', 21.17, 42.66, 'XKX'],
  ['Hargeisa', 44.06, 9.56, 'SOL'],
  ['Nicosia Norte', 33.36, 35.2, 'CYN'],
  ['Taipéi', 121.56, 25.03, 'TWN'],
  ['Madrid', -3.7, 40.42, 'ESP'],
];

describe('mapa de 2010: nivel de detalle', () => {
  const { paises, zonas } = cargar('detalle');
  const ids = Object.keys(conjunto.paises);

  it('cada país o territorio de los datos tiene geometría, y no sobra ninguna', () => {
    expect(paises.map((f) => f.id).sort()).toEqual([...ids].sort());
  });

  it('las zonas sin país son las documentadas', () => {
    expect(zonas.map((f) => f.id).sort()).toEqual(
      ['ATA', 'BJN', 'BRI', 'BRT', 'CNM', 'KAS', 'PGA', 'SCR', 'SER', 'SPI'].sort(),
    );
  });

  it.each(PUNTOS_2010)('%s cae en el territorio que le correspondía en 2010', (_, lon, lat, id) => {
    const dueños = paises.filter((f) => geoContains(f, [lon, lat])).map((f) => f.id);
    expect(dueños).toEqual([id]);
  });

  it('ninguna geometría está invertida (cubriría el resto del mundo)', () => {
    for (const f of [...paises, ...zonas])
      expect(geoArea(f), String(f.id)).toBeLessThan(2 * Math.PI);
  });

  it('cada país tiene un punto de etiqueta válido', () => {
    for (const f of paises) {
      const [lon, lat] = f.properties.etiqueta ?? [];
      expect(lon, String(f.id)).toBeGreaterThanOrEqual(-180);
      expect(lon, String(f.id)).toBeLessThanOrEqual(180);
      expect(lat, String(f.id)).toBeGreaterThanOrEqual(-90);
      expect(lat, String(f.id)).toBeLessThanOrEqual(90);
    }
  });
});

describe('geometría', () => {
  const cuadrado: MultiPoligono = [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  ];

  it('mide el área con signo según el sentido de giro', () => {
    expect(areaConSigno(cuadrado[0]![0]!)).toBe(1);
    expect(areaConSigno([...cuadrado[0]![0]!].reverse())).toBe(-1);
  });

  it('orienta el exterior en sentido horario y los huecos al revés, como pide d3', () => {
    const hueco: [number, number][] = [
      [0.2, 0.2],
      [0.2, 0.8],
      [0.8, 0.8],
      [0.8, 0.2],
      [0.2, 0.2],
    ];
    const [exterior, interior] = orientarParaD3([[cuadrado[0]![0]!, hueco]])[0]!;
    expect(areaConSigno(exterior!)).toBeLessThan(0);
    expect(areaConSigno(interior!)).toBeGreaterThan(0);
  });
});
