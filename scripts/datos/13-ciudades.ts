/**
 * Capitales y ciudades principales del mapa (tarea f4-t3).
 *
 * Fuente: Natural Earth 1:10m, lugares poblados (populated places), versión fijada v5.1.2
 *         (dominio público). De cada lugar se usan el nombre en español (NAME_ES), la posición,
 *         su clase de población (RANK_MAX, de 0 a 14) y el zoom a partir del que se muestra
 *         (MIN_ZOOM, en la escala habitual de los mapas web).
 * País de 2010: se decide por la posición, con las fronteras de 2010 de mapa-2010-detalle.json
 *         (así Simferópol queda en Ucrania, Yuba en Sudán y Sujumi en Abjasia), no por el país
 *         que indica Natural Earth.
 * Capital de 2010: la ciudad cuyo nombre coincide con la capital de 2010 de cada país
 *         (fuentes/datos/paises.json, de 01-paises.ts: Wikidata y tabla manual). Las capitales de Natural Earth posteriores a 2010 (Yuba,
 *         Guitega…) no cuentan. Las pocas que no coinciden por nombre se resuelven en
 *         scripts/datos/manual/ciudades-2010.json; si queda alguna sin resolver, el script falla.
 *         Las capitales que no están en Natural Earth (Road Town, Yaren…) toman su posición y su
 *         nombre de Wikidata (CC0); como no tienen clase ni zoom de Natural Earth, se les da
 *         rango 0 y zoom ZOOM_SIN_DATOS, que solo sirven para decidir cuándo se dibujan.
 * No se guarda la población: las cifras de Natural Earth no son de 2010.
 *
 * Salida: public/data/ciudades-2010.json
 * Uso:    node scripts/datos/13-ciudades.ts
 */
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';
import { geoBounds, geoContains, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { descargarJson, escribirJsonCompacto, leerJson } from './lib/comun.ts';
import { leerPaises } from './lib/paises.ts';

const VERSION_NE = 'v5.1.2';
const URL_LUGARES = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${VERSION_NE}/geojson/ne_10m_populated_places.geojson`;

/** Clase de población mínima de una ciudad que no es capital (10 = de 100 000 a 200 000 hab.). */
const RANGO_MINIMO = 10;
/** Zoom máximo de una ciudad que no es capital (más allá no se mostraría nunca). */
const ZOOM_MAXIMO = 7;
/** Ciudades como máximo por país, además de la capital. */
const MAXIMO_POR_PAIS = 25;
/** Distancia máxima (km) a un país para un lugar costero que cae justo fuera del contorno. */
const DISTANCIA_COSTA_KM = 25;
/** Zoom desde el que se dibujan las capitales que no están en Natural Earth (islas pequeñas). */
const ZOOM_SIN_DATOS = 5;

interface Manual {
  /** Código del país → nombre exacto (NAME) del lugar de Natural Earth que es su capital. */
  capitalesNE: Record<string, string>;
  /** Código del país → identificadores de Wikidata de su capital (o capitales). */
  capitalesWikidata: Record<string, string[] | string>;
}
type Lugar = Feature<Point, Record<string, string | number | null>>;

export interface Ciudad {
  nombre: string;
  pais: string;
  lon: number;
  lat: number;
  /** Clase de población de Natural Earth (de 0 a 14; más es mayor). */
  rango: number;
  /** Zoom (escala de los mapas web) desde el que se muestra. */
  zoom: number;
  capital: boolean;
}

const manual = leerJson<Manual>('scripts/datos/manual/ciudades-2010.json');
const sinNotas = <T>(tabla: Record<string, T | string>): Map<string, T> =>
  new Map(Object.entries(tabla).filter(([clave]) => !clave.startsWith('_')) as [string, T][]);
const capitalesNE = sinNotas<string>(manual.capitalesNE);
const capitalesWikidata = sinNotas<string[]>(manual.capitalesWikidata);
const paises = Object.fromEntries(leerPaises().map((pais) => [pais.id, pais]));
const topo = leerJson<Topology>('public/data/mapa-2010-detalle.json');
const formas = (
  feature(topo, topo.objects.paises!) as unknown as FeatureCollection<Polygon | MultiPolygon>
).features.map((forma) => {
  const [[x0, y0], [x1, y1]] = geoBounds(forma);
  // Si la caja cruza el antimeridiano (x0 > x1), se mira siempre el polígono.
  return { id: String(forma.id), forma, caja: [x0, y0, x1, y1] as const };
});

/** «Ciudad de México» → «ciudad de mexico»: sin tildes, mayúsculas ni signos. */
const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function paisDe(lon: number, lat: number): string | null {
  for (const { id, forma, caja } of formas) {
    const [x0, y0, x1, y1] = caja;
    const dentroCaja = lat >= y0 && lat <= y1 && (x0 > x1 || (lon >= x0 && lon <= x1));
    if (dentroCaja && geoContains(forma, [lon, lat])) return id;
  }
  return null;
}

/** País más cercano a un lugar costero que, por la simplificación, cae en el mar. */
function paisCercano(lon: number, lat: number): string | null {
  let mejor: string | null = null;
  let distanciaMejor = DISTANCIA_COSTA_KM / 6371;
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
}

console.log('Descargando lugares poblados de Natural Earth…');
const lugares = (await descargarJson<FeatureCollection<Point>>(URL_LUGARES)).features as Lugar[];

const texto = (lugar: Lugar, campo: string): string => String(lugar.properties[campo] ?? '');
const conPais = lugares
  .map((lugar) => {
    const [lon, lat] = lugar.geometry.coordinates as [number, number];
    return { lugar, lon, lat, pais: paisDe(lon, lat) ?? paisCercano(lon, lat) };
  })
  .filter((x): x is typeof x & { pais: string } => x.pais !== null && x.pais in paises);

// Capital de 2010 de cada país.
const capitales = new Map<string, Lugar>();
const sinCapital: string[] = [];
for (const pais of Object.values(paises)) {
  if (capitalesWikidata.has(pais.id)) continue;
  const nombreNE = capitalesNE.get(pais.id);
  let coinciden: typeof conPais;
  if (nombreNE) {
    // Por su nombre en Natural Earth, aunque caiga justo al otro lado de una frontera
    // (Nicosia está partida entre Chipre y Chipre del Norte).
    coinciden = lugares
      .filter((lugar) => texto(lugar, 'NAME') === nombreNE)
      .map((lugar) => {
        const [lon, lat] = lugar.geometry.coordinates as [number, number];
        return { lugar, lon, lat, pais: pais.id };
      });
  } else {
    const buscado = normalizar(pais.capital);
    coinciden = conPais.filter(
      ({ lugar, pais: id }) =>
        id === pais.id &&
        ['NAME_ES', 'NAME', 'NAMEASCII', 'NAMEPAR', 'NAME_EN']
          .flatMap((campo) => texto(lugar, campo).split('|'))
          .some((nombre) => nombre && normalizar(nombre) === buscado),
    );
  }
  coinciden.sort(
    (a, b) => Number(b.lugar.properties.RANK_MAX) - Number(a.lugar.properties.RANK_MAX),
  );
  const elegida = coinciden[0];
  if (elegida) {
    capitales.set(pais.id, elegida.lugar);
    // Una capital asignada a mano cuenta para su país aunque caiga en el de al lado.
    const registro = conPais.find((x) => x.lugar === elegida.lugar);
    if (registro) registro.pais = pais.id;
  } else {
    sinCapital.push(`${pais.id} (${pais.nombre}): «${pais.capital}»`);
  }
}
if (sinCapital.length > 0) {
  console.error(
    `Capitales de 2010 sin lugar en Natural Earth (añadirlas a manual/ciudades-2010.json):\n  ${sinCapital.join('\n  ')}`,
  );
  process.exit(1);
}

// Capitales que no están en Natural Earth: posición y nombre de Wikidata.
interface FilaWikidata {
  lugar: { value: string };
  nombre?: { value: string };
  posicion: { value: string };
}
const identificadores = [...capitalesWikidata.values()].flat();
const consulta = `SELECT ?lugar ?nombre ?posicion WHERE {
  VALUES ?lugar { ${identificadores.map((q) => `wd:${q}`).join(' ')} }
  ?lugar wdt:P625 ?posicion .
  OPTIONAL { ?lugar rdfs:label ?nombre FILTER(LANG(?nombre) = "es") }
}`;
console.log('Consultando en Wikidata las capitales que no están en Natural Earth…');
const filas = (
  await descargarJson<{ results: { bindings: FilaWikidata[] } }>(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(consulta)}`,
    { cabeceras: { Accept: 'application/sparql-results+json' } },
  )
).results.bindings;
const deWikidata: Ciudad[] = [];
for (const [paisId, lista] of capitalesWikidata) {
  for (const qid of lista) {
    const fila = filas.find((f) => f.lugar.value.endsWith(`/${qid}`));
    const punto = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(fila?.posicion.value ?? '');
    if (!fila || !punto) {
      console.error(`Sin posición en Wikidata para ${qid} (${paisId}).`);
      process.exit(1);
    }
    deWikidata.push({
      // Con una sola capital se usa el mismo nombre que en la ficha del país.
      nombre: lista.length === 1 ? paises[paisId]!.capital : (fila.nombre?.value ?? qid),
      pais: paisId,
      lon: Math.round(Number(punto[1]) * 1000) / 1000,
      lat: Math.round(Number(punto[2]) * 1000) / 1000,
      rango: 0,
      zoom: ZOOM_SIN_DATOS,
      capital: true,
    });
  }
}

const esCapital = new Set(capitales.values());
const ciudades: Ciudad[] = [...deWikidata];
const capitalDe = new Map([...capitales].map(([paisId, lugar]) => [lugar, paisId]));
const porPais = new Map<string, number>();
const ordenados = [...conPais].sort(
  (a, b) =>
    Number(b.lugar.properties.RANK_MAX) - Number(a.lugar.properties.RANK_MAX) ||
    Number(a.lugar.properties.MIN_ZOOM) - Number(b.lugar.properties.MIN_ZOOM),
);
for (const { lugar, lon, lat, pais } of ordenados) {
  const capital = esCapital.has(lugar);
  const rango = Number(lugar.properties.RANK_MAX);
  const zoom = Number(lugar.properties.MIN_ZOOM);
  if (!capital) {
    if (rango < RANGO_MINIMO || zoom > ZOOM_MAXIMO) continue;
    const cuenta = porPais.get(pais) ?? 0;
    if (cuenta >= MAXIMO_POR_PAIS) continue;
    porPais.set(pais, cuenta + 1);
  }
  const paisCapital = capitalDe.get(lugar);
  ciudades.push({
    // Las capitales llevan el mismo nombre que en la ficha del país.
    nombre: paisCapital
      ? paises[paisCapital]!.capital
      : texto(lugar, 'NAME_ES') || texto(lugar, 'NAME'),
    pais: paisCapital ?? pais,
    lon: Math.round(lon * 1000) / 1000,
    lat: Math.round(lat * 1000) / 1000,
    rango,
    zoom: Math.round(zoom * 10) / 10,
    capital,
  });
}

escribirJsonCompacto(
  'public/data/ciudades-2010.json',
  {
    fuente: `Natural Earth 1:10m, lugares poblados ${VERSION_NE} (dominio público). Wikidata (CC0) para las capitales que no están en Natural Earth. País según las fronteras de 2010.`,
    ciudades,
  },
  2,
);
const numCapitales = ciudades.filter((c) => c.capital).length;
const paisesConCapital = new Set(ciudades.filter((c) => c.capital).map((c) => c.pais)).size;
console.log(
  `ciudades-2010.json: ${ciudades.length} ciudades; ${numCapitales} capitales de ${paisesConCapital} de ${Object.keys(paises).length} países.`,
);
