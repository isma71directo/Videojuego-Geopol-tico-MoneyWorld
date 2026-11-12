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
import type { Feature, FeatureCollection, Point } from 'geojson';
import { geoDistance } from 'd3-geo';
import type { Topology } from 'topojson-specification';
import { descargarJson, escribirJsonCompacto, leerJson } from './lib/comun.ts';
import { crearLocalizador } from './lib/localizar.ts';
import {
  consultarPoblaciones,
  elegirPoblacion,
  poblacionSinFecha,
} from './lib/poblacion-wikidata.ts';
import { leerPaises } from './lib/paises.ts';

const VERSION_NE = 'v5.1.2';
const URL_LUGARES = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${VERSION_NE}/geojson/ne_10m_populated_places.geojson`;

/** Clase de población mínima de una ciudad que no es capital (9 = de 100 000 a 200 000 hab.). */
const RANGO_MINIMO = 9;
/** Ciudades como máximo por país, además de la capital. */
const MAXIMO_POR_PAIS = 50;
/** Año del escenario: se busca la población de este año o la más cercana. */
const ANIO = 2010;
/** Una capital de provincia a menos de esta distancia de una ciudad incluida es esa ciudad. */
const DISTANCIA_MISMA_CIUDAD_KM = 15;
/**
 * Una capital de provincia fronteriza que, por la simplificación del mapa, cae al otro lado se
 * acepta si está a menos de esto de su país (Leticia, Gorizia, Saint-Louis…).
 */
const DISTANCIA_FRONTERA_KM = 8;
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
  /** Países sin capitales de provincia porque sus unidades son municipios (ajuste f5-a1). */
  sinCapitalesDeUnidad: Record<string, string>;
  /** «país por posición|nombre» → país de 2010, para lugares que caen al otro lado. */
  asignarPais: Record<string, string>;
  /** Capitales de provincia de Wikidata que no se usan (datos erróneos o de otro país). */
  capitalesExcluidas: Record<string, string>;
}
type Lugar = Feature<Point, Record<string, string | number | null>>;

export interface Ciudad {
  nombre: string;
  pais: string;
  lon: number;
  lat: number;
  capital: boolean;
  /** Capital de una provincia o región de primer nivel (ajuste f5-a1). */
  capitalRegional: boolean;
  /** Nombre de la provincia o región de la que es capital, o null. */
  capitalDe: string | null;
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
const asignarPais = sinNotas<string>(manual.asignarPais);
const capitalesExcluidas = sinNotas<string>(manual.capitalesExcluidas);
/** Entradas de la tabla manual que se han usado: si sobra alguna, la tabla está desfasada. */
const usadas = new Set<string>();
const paises = Object.fromEntries(leerPaises().map((pais) => [pais.id, pais]));
const localizador = crearLocalizador(leerJson<Topology>('public/data/mapa-2010-detalle.json'));

/** «Ciudad de México» → «ciudad de mexico»: sin tildes, mayúsculas ni signos. */
const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const paisDe = (lon: number, lat: number): string | null => localizador.paisDe(lon, lat);
/** País más cercano a un lugar costero que, por la simplificación, cae en el mar. */
const paisCercano = (lon: number, lat: number): string | null =>
  localizador.paisCercano(lon, lat, DISTANCIA_COSTA_KM);

console.log('Descargando lugares poblados de Natural Earth…');
const lugares = (await descargarJson<FeatureCollection<Point>>(URL_LUGARES)).features as Lugar[];

const texto = (lugar: Lugar, campo: string): string => String(lugar.properties[campo] ?? '');
const conPais = lugares
  .map((lugar) => {
    const [lon, lat] = lugar.geometry.coordinates as [number, number];
    const porPosicion = paisDe(lon, lat) ?? paisCercano(lon, lat);
    const asignado = asignarPais.get(`${porPosicion}|${texto(lugar, 'NAME')}`);
    if (asignado) usadas.add(`pais:${porPosicion}|${texto(lugar, 'NAME')}`);
    return { lugar, lon, lat, pais: asignado ?? porPosicion };
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
        capitalRegional: false,
        capitalDe: null,
        poblacion: null,
        origenPoblacion: null,
        rango: 0,
      },
      qid,
      onu2010: 0,
    });
  }
}

interface CapitalUnidad {
  qid: string;
  es: string | null;
  en: string | null;
  posicion: [number, number];
  /** Nombre en español de la provincia, de Wikidata. */
  unidadEs: string | null;
}

/**
 * Capital de cada división de primer nivel en Wikidata (propiedad P36), la válida el
 * 1 de enero de 2010: sin las que empiezan después ni las que acabaron antes. Si hay varias,
 * la preferida y, después, la de identificador menor (para que el resultado sea estable).
 */
async function consultarCapitalesProvincia(
  qids: readonly string[],
): Promise<Map<string, CapitalUnidad>> {
  interface Fila {
    u: { value: string };
    ues?: { value: string };
    cap: { value: string };
    es?: { value: string };
    en?: { value: string };
    coord?: { value: string };
    ini?: { value: string };
    fin?: { value: string };
    rango: { value: string };
  }
  const validos = [...new Set(qids.filter((q) => /^Q\d+$/.test(q)))];
  const candidatas = new Map<string, (CapitalUnidad & { preferida: boolean })[]>();
  for (let i = 0; i < validos.length; i += 150) {
    const lote = validos.slice(i, i + 150);
    const consultaCapitales = `SELECT ?u ?ues ?cap ?es ?en ?coord ?ini ?fin ?rango WHERE {
      VALUES ?u { ${lote.map((q) => `wd:${q}`).join(' ')} }
      ?u p:P36 ?st . ?st ps:P36 ?cap ; wikibase:rank ?rango .
      OPTIONAL { ?st pq:P580 ?ini } OPTIONAL { ?st pq:P582 ?fin }
      OPTIONAL { ?cap wdt:P625 ?coord }
      OPTIONAL { ?cap rdfs:label ?es FILTER(LANG(?es) = "es") }
      OPTIONAL { ?cap rdfs:label ?en FILTER(LANG(?en) = "en") }
      OPTIONAL { ?u rdfs:label ?ues FILTER(LANG(?ues) = "es") }
    }`;
    const filasCapitales = (
      await descargarJson<{ results: { bindings: Fila[] } }>(
        `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(consultaCapitales)}`,
        { cabeceras: { Accept: 'application/sparql-results+json' } },
      )
    ).results.bindings;
    for (const fila of filasCapitales) {
      if (fila.rango.value.endsWith('DeprecatedRank')) continue;
      const inicio = fila.ini?.value.slice(0, 10);
      const fin = fila.fin?.value.slice(0, 10);
      if (inicio && /^\d{4}-/.test(inicio) && inicio > '2010-01-01') continue;
      if (fin && /^\d{4}-/.test(fin) && fin <= '2010-01-01') continue;
      const punto = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(fila.coord?.value ?? '');
      if (!punto) continue;
      const u = fila.u.value.split('/').pop()!;
      const lista = candidatas.get(u) ?? [];
      lista.push({
        qid: fila.cap.value.split('/').pop()!,
        es: fila.es?.value ?? null,
        en: fila.en?.value ?? null,
        posicion: [Number(punto[1]), Number(punto[2])],
        unidadEs: fila.ues?.value ?? null,
        preferida: fila.rango.value.endsWith('PreferredRank'),
      });
      candidatas.set(u, lista);
    }
    await new Promise((resolver) => setTimeout(resolver, 300));
  }
  const elegidas = new Map<string, CapitalUnidad>();
  for (const [u, lista] of candidatas) {
    const [mejor] = [...lista].sort(
      (a, b) =>
        Number(b.preferida) - Number(a.preferida) ||
        Number(a.qid.slice(1)) - Number(b.qid.slice(1)) ||
        a.posicion[0] - b.posicion[0],
    );
    elegidas.set(u, mejor!);
  }
  return elegidas;
}

/** «provincia de Cáceres» → «Cáceres»; «Departamento de Antioquia» → «Antioquia». */
function limpiarNombreUnidad(nombre: string): string {
  const limpio = nombre.replace(
    /^(provincia|departamento|estado|región|regi[oó]n|distrito|condado|prefectura|gobernación|gobernorado|óblast|voivodato|cantón|municipio|parroquia|wilaya|condado de|periferia) (de la |de los |de las |del |de )/iu,
    '',
  );
  return limpio.charAt(0).toLocaleUpperCase('es') + limpio.slice(1);
}

/**
 * Nombre de una capital de provincia: el español de Wikidata, salvo si usa signos de
 * transliteración poco usados en español (entonces el inglés); sin «Ciudad de» si el resto es
 * el nombre de su provincia («Ciudad de Teruel» → «Teruel»).
 */
function nombreDeCapital(capital: CapitalUnidad, nombreUnidad: string): string {
  const raro = /[āēīōūḥṭṣḍẓġ]/u;
  let nombre = capital.es ?? capital.en ?? capital.qid;
  if (raro.test(nombre) && capital.en && !raro.test(capital.en)) nombre = capital.en;
  nombre = nombre.replace(/ \([^)]*\)$/u, '');
  const sinCiudad = nombre.replace(/^Ciudad de /u, '');
  if (sinCiudad !== nombre && normalizar(sinCiudad) === normalizar(nombreUnidad))
    nombre = sinCiudad;
  return nombre;
}

/**
 * Quita los signos de transliteración poco usados en español («Lūang Namthā» → «Luang Namtha»,
 * «ʿAmrān» → «Amran»). Los nombres japoneses conservan sus vocales largas (Kōbe).
 */
function sinTransliteracion(nombre: string, pais: string): string {
  if (pais === 'JPN' || !/[āēīōūḥṭṣḍẓġʿʾ]/u.test(nombre)) return nombre;
  return nombre
    .replace(/[ʿʾ]/gu, '')
    .normalize('NFD')
    .replace(/[\u0304\u0323\u0307]/gu, '')
    .normalize('NFC');
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
      capitalRegional: false,
      capitalDe: null,
      poblacion: null,
      origenPoblacion: null,
      rango,
    },
    qid: texto(lugar, 'WIKIDATAID'),
    onu2010: Number(lugar.properties.POP2010 ?? 0),
  });
}

// Capitales de provincia (ajuste f5-a1): la capital de 2010 de cada división de primer nivel
// (las unidades de Natural Earth de fuentes/datos/regiones.json, de 14-regiones.ts) según
// Wikidata; para las divisiones sin capital en Wikidata, las «Admin-1 capital» de Natural Earth.
// Si ya hay una ciudad a menos de DISTANCIA_MISMA_CIUDAD_KM, no se añade: se marca esa.
const sinCapitalesDeUnidad = sinNotas<string>(manual.sinCapitalesDeUnidad);
const regionesFuente = leerJson<{
  regiones: { pais: string; unidades: { nombre: string; wikidata: string | null }[] }[];
}>('fuentes/datos/regiones.json').regiones;
const unidadesProvincia = regionesFuente
  .filter((r) => !sinCapitalesDeUnidad.has(r.pais))
  .flatMap((r) =>
    r.unidades.map((u) => ({ pais: r.pais, nombre: u.nombre, wikidata: u.wikidata })),
  );
console.log(`Consultando en Wikidata la capital de ${unidadesProvincia.length} provincias…`);
const capitalesUnidad = await consultarCapitalesProvincia(
  unidadesProvincia.map((u) => u.wikidata ?? ''),
);
const kmEntre = (a: [number, number], b: [number, number]): number => geoDistance(a, b) * 6371;
/** Distancia (km) de un punto al contorno de un país (a su vértice más cercano). */
function distanciaAPais(pais: string, punto: [number, number]): number {
  const forma = localizador.forma(pais);
  if (!forma) return Infinity;
  const anillos = forma.type === 'Polygon' ? forma.coordinates : forma.coordinates.flat();
  let minima = Infinity;
  for (const anillo of anillos) {
    for (const vertice of anillo) {
      minima = Math.min(minima, kmEntre(vertice as [number, number], punto));
    }
  }
  return minima;
}

/** Ciudad ya incluida del mismo país a menos de esa distancia (o null). */
function ciudadCercana(pais: string, punto: [number, number]): Pendiente | null {
  let mejor: Pendiente | null = null;
  let distancia = DISTANCIA_MISMA_CIUDAD_KM;
  for (const p of pendientes) {
    if (p.ciudad.pais !== pais) continue;
    const d = kmEntre([p.ciudad.lon, p.ciudad.lat], punto);
    if (d < distancia) {
      distancia = d;
      mejor = p;
    }
  }
  return mejor;
}
let marcadas = 0;
let anadidas = 0;
let fueraDePais = 0;
const descartadas: string[] = [];
const qidsAnadidos = new Set<string>();
const marcar = (pendiente: Pendiente, capitalDe: string): void => {
  if (!pendiente.ciudad.capitalRegional) marcadas++;
  pendiente.ciudad.capitalRegional = true;
  pendiente.ciudad.capitalDe ??= capitalDe;
};
for (const unidad of unidadesProvincia) {
  const capital = unidad.wikidata ? capitalesUnidad.get(unidad.wikidata) : undefined;
  if (!capital) continue;
  const nombreUnidad = limpiarNombreUnidad(capital.unidadEs ?? unidad.nombre);
  const cercana = ciudadCercana(unidad.pais, capital.posicion);
  if (cercana) {
    marcar(cercana, nombreUnidad);
    continue;
  }
  if (qidsAnadidos.has(capital.qid)) continue;
  const claveCapital = `${unidad.pais}|${nombreDeCapital(capital, nombreUnidad)}`;
  if (capitalesExcluidas.has(claveCapital)) {
    usadas.add(`capital:${claveCapital}`);
    continue;
  }
  // Solo si la capital cae en el mismo país de 2010 que su provincia (o justo en la frontera).
  const [lon, lat] = capital.posicion;
  if (
    (paisDe(lon, lat) ?? paisCercano(lon, lat)) !== unidad.pais &&
    distanciaAPais(unidad.pais, capital.posicion) > DISTANCIA_FRONTERA_KM
  ) {
    fueraDePais++;
    descartadas.push(claveCapital);
    continue;
  }
  qidsAnadidos.add(capital.qid);
  anadidas++;
  const nombreCapital = nombreDeCapital(capital, nombreUnidad);
  pendientes.push({
    ciudad: {
      nombre: nombreCapital,
      pais: unidad.pais,
      lon: Math.round(lon * 1000) / 1000,
      lat: Math.round(lat * 1000) / 1000,
      capital: false,
      capitalRegional: true,
      capitalDe: nombreUnidad,
      poblacion: null,
      origenPoblacion: null,
      rango: 0,
    },
    qid: capital.qid,
    onu2010: 0,
  });
}
// Las «Admin-1 capital» de Natural Earth que aún falten (divisiones sin capital en Wikidata).
for (const { lugar, lon, lat, pais } of conPais) {
  if (!texto(lugar, 'FEATURECLA').startsWith('Admin-1 capital')) continue;
  if (sinCapitalesDeUnidad.has(pais)) continue;
  const nombreNE = texto(lugar, 'NAME_ES') || texto(lugar, 'NAME');
  const clave = `${pais}|${nombreNE}`;
  if (excluidos.has(clave)) continue;
  const cercana = ciudadCercana(pais, [lon, lat]);
  const nombreUnidad = texto(lugar, 'ADM1NAME') || nombreNE;
  if (cercana) {
    marcar(cercana, nombreUnidad);
    continue;
  }
  anadidas++;
  pendientes.push({
    ciudad: {
      nombre: corregirNombre(clave, nombreNE),
      pais,
      lon: Math.round(lon * 1000) / 1000,
      lat: Math.round(lat * 1000) / 1000,
      capital: false,
      capitalRegional: true,
      capitalDe: nombreUnidad,
      poblacion: null,
      origenPoblacion: null,
      rango: Number(lugar.properties.RANK_MAX),
    },
    qid: texto(lugar, 'WIKIDATAID'),
    onu2010: Number(lugar.properties.POP2010 ?? 0),
  });
}
console.log(
  `Capitales de provincia: ${marcadas} ya estaban, ${anadidas} añadidas, ${fueraDePais} descartadas por caer en otro país` +
    (descartadas.length ? ` (${descartadas.join(', ')}).` : '.'),
);

const sobran = [
  ...nombresCorregidos.keys(),
  ...excluidos.keys(),
  ...[...asignarPais.keys()].map((c) => `pais:${c}`),
  ...[...capitalesExcluidas.keys()].map((c) => `capital:${c}`),
].filter((c) => !usadas.has(c));
if (sobran.length > 0) {
  console.error(
    `Entradas de manual/ciudades-2010.json que no coinciden con ninguna ciudad:\n  ${sobran.join('\n  ')}`,
  );
  process.exit(1);
}

// Población de Wikidata: todas las declaraciones de P1082 con su fecha.
console.log(`Consultando en Wikidata la población de ${pendientes.length} ciudades…`);
const declaraciones = await consultarPoblaciones(pendientes.map((p) => p.qid));

/** La población de 2010 o la de la fecha más cercana; si no, la de la ONU o la sin fecha. */
function elegir(pendiente: Pendiente): Pick<Ciudad, 'poblacion' | 'origenPoblacion'> {
  const lista = declaraciones.get(pendiente.qid) ?? [];
  const conFecha = elegirPoblacion(lista, ANIO);
  if (conFecha) return { poblacion: conFecha.valor, origenPoblacion: `WD:${conFecha.anio}` };
  if (pendiente.onu2010 > 0) {
    return { poblacion: Math.round(pendiente.onu2010 * 1000), origenPoblacion: `ONU:${ANIO}` };
  }
  const sinFecha = poblacionSinFecha(lista);
  if (sinFecha !== null) return { poblacion: sinFecha, origenPoblacion: 'WD:sin-fecha' };
  return { poblacion: null, origenPoblacion: null };
}

const ciudades: Ciudad[] = pendientes.map((pendiente) => ({
  ...pendiente.ciudad,
  nombre: sinTransliteracion(pendiente.ciudad.nombre, pendiente.ciudad.pais),
  ...elegir(pendiente),
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
    fuente: `Natural Earth 1:10m, lugares poblados ${VERSION_NE} (dominio público), y Wikidata (CC0) para la población, las capitales que no están en Natural Earth y las capitales de provincia de 2010. País según las fronteras de 2010.`,
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
