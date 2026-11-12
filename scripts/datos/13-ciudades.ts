/**
 * Capitales y ciudades principales del mapa (tarea f4-t3 y ajuste f4-a3).
 *
 * Fuente: Natural Earth 1:10m, lugares poblados (populated places), versión fijada v5.1.2
 *         (dominio público). De cada lugar se usan el nombre en español (NAME_ES), la posición,
 *         su clase de población (RANK_MAX, de 0 a 14) y su identificador de Wikidata.
 * País de 2010: se decide por la posición, con las fronteras de 2010 de mapa-2010-detalle.json
 *         (así Simferópol queda en Ucrania, Yuba en Sudán y Sujumi en Abjasia), no por el país
 *         que indica Natural Earth.
 * Capital de 2010: la ciudad cuyo nombre coincide con la capital de 2010 de cada país
 *         (fuentes/datos/paises.json, de 01-paises.ts: Wikidata y tabla manual). Las capitales
 *         de Natural Earth posteriores a 2010 (Yuba, Guitega…) no cuentan. Las pocas que no
 *         coinciden por nombre se resuelven en scripts/datos/manual/ciudades-2010.json; si queda
 *         alguna sin resolver, el script falla. Las capitales que no están en Natural Earth
 *         (Road Town, Yaren…) toman su posición y su nombre de Wikidata (CC0).
 * Nombres: el español de Natural Earth (NAME_ES), con las correcciones de la tabla manual
 *         (traducciones erróneas, nombres de 2010 de las ciudades renombradas después,
 *         transliteraciones raras). Los lugares erróneos de Natural Earth se excluyen ahí también.
 * Población: de Wikidata (CC0, propiedad P1082, población del municipio), la de 2010 o, si no
 *         hay, la de la fecha más cercana; con su año en «origenPoblacion» («WD:2010»). Si
 *         Wikidata no tiene ninguna con fecha, la de 2010 de la ONU (aglomeración urbana) que
 *         recoge Natural Earth («ONU:2010»); si tampoco, la de Wikidata sin fecha
 *         («WD:sin-fecha»); si no hay ninguna, null. La clase de población de Natural Earth
 *         («rango») solo sirve para ordenar las ciudades sin población.
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

/** Clase de población mínima de una ciudad que no es capital (9 = de 100 000 a 200 000 hab.). */
const RANGO_MINIMO = 9;
/** Ciudades como máximo por país, además de la capital. */
const MAXIMO_POR_PAIS = 50;
/** Año del escenario: se busca la población de este año o la más cercana. */
const ANIO = 2010;
/** Distancia máxima (km) a un país para un lugar costero que cae justo fuera del contorno. */
const DISTANCIA_COSTA_KM = 25;

interface Manual {
  /** Código del país → nombre exacto (NAME) del lugar de Natural Earth que es su capital. */
  capitalesNE: Record<string, string>;
  /** Código del país → identificadores de Wikidata de su capital (o capitales). */
  capitalesWikidata: Record<string, string[] | string>;
  /** «país|nombre en Natural Earth» → nombre corregido (ajuste f4-a5). */
  nombres: Record<string, string>;
  /** «país|nombre en Natural Earth» → motivo por el que el lugar no se usa (ajuste f4-a5). */
  excluir: Record<string, string>;
}
type Lugar = Feature<Point, Record<string, string | number | null>>;

export interface Ciudad {
  nombre: string;
  pais: string;
  lon: number;
  lat: number;
  capital: boolean;
  /** Habitantes (null si no hay dato). */
  poblacion: number | null;
  /** Fuente y año de la población: «WD:2010», «ONU:2010», «WD:sin-fecha» o null. */
  origenPoblacion: string | null;
  /** Clase de población de Natural Earth (0 a 14); solo para ordenar si falta la población. */
  rango: number;
}

const manual = leerJson<Manual>('scripts/datos/manual/ciudades-2010.json');
const sinNotas = <T>(tabla: Record<string, T | string>): Map<string, T> =>
  new Map(Object.entries(tabla).filter(([clave]) => !clave.startsWith('_')) as [string, T][]);
const capitalesNE = sinNotas<string>(manual.capitalesNE);
const capitalesWikidata = sinNotas<string[]>(manual.capitalesWikidata);
const nombresCorregidos = sinNotas<string>(manual.nombres);
const excluidos = sinNotas<string>(manual.excluir);
/** Entradas de la tabla manual que se han usado: si sobra alguna, la tabla está desfasada. */
const usadas = new Set<string>();
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
/** Ciudad con lo necesario para buscar su población. */
interface Pendiente {
  ciudad: Ciudad;
  qid: string;
  /** Población de 2010 de la ONU según Natural Earth (en miles; 0 si no la hay). */
  onu2010: number;
}
const deWikidata: Pendiente[] = [];
for (const [paisId, lista] of capitalesWikidata) {
  for (const qid of lista) {
    const fila = filas.find((f) => f.lugar.value.endsWith(`/${qid}`));
    const punto = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(fila?.posicion.value ?? '');
    if (!fila || !punto) {
      console.error(`Sin posición en Wikidata para ${qid} (${paisId}).`);
      process.exit(1);
    }
    deWikidata.push({
      ciudad: {
        // Con una sola capital se usa el mismo nombre que en la ficha del país.
        nombre: lista.length === 1 ? paises[paisId]!.capital : (fila.nombre?.value ?? qid),
        pais: paisId,
        lon: Math.round(Number(punto[1]) * 1000) / 1000,
        lat: Math.round(Number(punto[2]) * 1000) / 1000,
        capital: true,
        poblacion: null,
        origenPoblacion: null,
        rango: 0,
      },
      qid,
      onu2010: 0,
    });
  }
}

/** Nombre corregido (si está en la tabla manual) o el de Natural Earth. */
function corregirNombre(clave: string, nombreNE: string): string {
  const corregido = nombresCorregidos.get(clave);
  if (corregido === undefined) return nombreNE;
  usadas.add(clave);
  return corregido;
}

const esCapital = new Set(capitales.values());
const pendientes: Pendiente[] = [...deWikidata];
const capitalDe = new Map([...capitales].map(([paisId, lugar]) => [lugar, paisId]));
const porPais = new Map<string, number>();
const ordenados = [...conPais].sort(
  (a, b) => Number(b.lugar.properties.RANK_MAX) - Number(a.lugar.properties.RANK_MAX),
);
for (const { lugar, lon, lat, pais } of ordenados) {
  const capital = esCapital.has(lugar);
  const rango = Number(lugar.properties.RANK_MAX);
  // Nombre en español de Natural Earth, corregido si está en la tabla manual.
  const nombreNE = texto(lugar, 'NAME_ES') || texto(lugar, 'NAME');
  const clave = `${pais}|${nombreNE}`;
  if (excluidos.has(clave)) {
    usadas.add(clave);
    continue;
  }
  if (!capital) {
    if (rango < RANGO_MINIMO) continue;
    const cuenta = porPais.get(pais) ?? 0;
    if (cuenta >= MAXIMO_POR_PAIS) continue;
    porPais.set(pais, cuenta + 1);
  }
  const paisCapital = capitalDe.get(lugar);
  pendientes.push({
    ciudad: {
      // Las capitales llevan el mismo nombre que en la ficha del país.
      nombre: paisCapital ? paises[paisCapital]!.capital : corregirNombre(clave, nombreNE),
      pais: paisCapital ?? pais,
      lon: Math.round(lon * 1000) / 1000,
      lat: Math.round(lat * 1000) / 1000,
      capital,
      poblacion: null,
      origenPoblacion: null,
      rango,
    },
    qid: texto(lugar, 'WIKIDATAID'),
    onu2010: Number(lugar.properties.POP2010 ?? 0),
  });
}

const sobran = [...nombresCorregidos.keys(), ...excluidos.keys()].filter((c) => !usadas.has(c));
if (sobran.length > 0) {
  console.error(
    `Entradas de manual/ciudades-2010.json que no coinciden con ninguna ciudad:\n  ${sobran.join('\n  ')}`,
  );
  process.exit(1);
}

// Población de Wikidata: todas las declaraciones de P1082 con su fecha, por lotes.
interface FilaPoblacion {
  lugar: { value: string };
  valor: { value: string };
  fecha?: { value: string };
  rango: { value: string };
}
const declaraciones = new Map<
  string,
  { valor: number; anio: number | null; preferida: boolean }[]
>();
const qids = [...new Set(pendientes.map((p) => p.qid).filter((q) => /^Q\d+$/.test(q)))];
console.log(`Consultando en Wikidata la población de ${qids.length} ciudades…`);
for (let i = 0; i < qids.length; i += 200) {
  const lote = qids.slice(i, i + 200);
  const consultaPoblacion = `SELECT ?lugar ?valor ?fecha ?rango WHERE {
    VALUES ?lugar { ${lote.map((q) => `wd:${q}`).join(' ')} }
    ?lugar p:P1082 ?declaracion .
    ?declaracion ps:P1082 ?valor ; wikibase:rank ?rango .
    OPTIONAL { ?declaracion pq:P585 ?fecha }
  }`;
  const filasPoblacion = (
    await descargarJson<{ results: { bindings: FilaPoblacion[] } }>(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(consultaPoblacion)}`,
      { cabeceras: { Accept: 'application/sparql-results+json' } },
    )
  ).results.bindings;
  for (const fila of filasPoblacion) {
    if (fila.rango.value.endsWith('DeprecatedRank')) continue;
    const qid = fila.lugar.value.split('/').pop()!;
    const anio =
      fila.fecha && /^\d{4}-/.test(fila.fecha.value) ? Number(fila.fecha.value.slice(0, 4)) : null;
    const lista = declaraciones.get(qid) ?? [];
    lista.push({
      valor: Math.round(Number(fila.valor.value)),
      anio,
      preferida: fila.rango.value.endsWith('PreferredRank'),
    });
    declaraciones.set(qid, lista);
  }
  // Una pausa corta entre lotes, por cortesía con el servicio.
  await new Promise((resolver) => setTimeout(resolver, 300));
}

/** La población de 2010 o la de la fecha más cercana (en empate, la anterior a 2010). */
function elegirPoblacion(pendiente: Pendiente): Pick<Ciudad, 'poblacion' | 'origenPoblacion'> {
  const lista = (declaraciones.get(pendiente.qid) ?? []).filter((d) => d.valor > 0);
  const conFecha = lista.filter((d) => d.anio !== null);
  if (conFecha.length > 0) {
    const [mejor] = [...conFecha].sort(
      (a, b) =>
        Math.abs(a.anio! - ANIO) - Math.abs(b.anio! - ANIO) ||
        Number(a.anio! > ANIO) - Number(b.anio! > ANIO) ||
        Number(b.preferida) - Number(a.preferida),
    );
    return { poblacion: mejor!.valor, origenPoblacion: `WD:${mejor!.anio}` };
  }
  if (pendiente.onu2010 > 0) {
    return { poblacion: Math.round(pendiente.onu2010 * 1000), origenPoblacion: `ONU:${ANIO}` };
  }
  const sinFecha = lista.find((d) => d.preferida) ?? lista[0];
  if (sinFecha) return { poblacion: sinFecha.valor, origenPoblacion: 'WD:sin-fecha' };
  return { poblacion: null, origenPoblacion: null };
}

const ciudades: Ciudad[] = pendientes.map((pendiente) => ({
  ...pendiente.ciudad,
  ...elegirPoblacion(pendiente),
}));
const recuento = (prueba: (ciudad: Ciudad) => boolean): number => ciudades.filter(prueba).length;
console.log(
  `Población: ${recuento((c) => c.origenPoblacion === `WD:${ANIO}`)} de ${ANIO}, ` +
    `${recuento((c) => /^WD:\d{4}$/.test(c.origenPoblacion ?? '') && c.origenPoblacion !== `WD:${ANIO}`)} de otro año, ` +
    `${recuento((c) => c.origenPoblacion === `ONU:${ANIO}`)} de la ONU, ` +
    `${recuento((c) => c.origenPoblacion === 'WD:sin-fecha')} sin fecha y ` +
    `${recuento((c) => c.poblacion === null)} sin dato.`,
);

escribirJsonCompacto(
  'public/data/ciudades-2010.json',
  {
    fuente: `Natural Earth 1:10m, lugares poblados ${VERSION_NE} (dominio público), y Wikidata (CC0) para la población y las capitales que no están en Natural Earth. País según las fronteras de 2010.`,
    origenesPoblacion: {
      'WD:<año>': 'Wikidata, población del municipio en ese año (la de 2010 o la más cercana)',
      'ONU:2010':
        'Naciones Unidas (World Urbanization Prospects), aglomeración urbana, según Natural Earth',
      'WD:sin-fecha': 'Wikidata, población sin fecha indicada',
    },
    ciudades,
  },
  2,
);
const numCapitales = ciudades.filter((c) => c.capital).length;
const paisesConCapital = new Set(ciudades.filter((c) => c.capital).map((c) => c.pais)).size;
console.log(
  `ciudades-2010.json: ${ciudades.length} ciudades; ${numCapitales} capitales de ${paisesConCapital} de ${Object.keys(paises).length} países.`,
);
