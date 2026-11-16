/**
 * Economía, recursos, superficie y ciudades de cada región en 2010 (tarea f9-t1).
 *
 * Fuentes:
 *  - DOSE, «Global dataset of reported subnational economic output» (Wenz et al.), V2.14 en Zenodo,
 *    CC BY 4.0: valor añadido de la agricultura, la industria y los servicios de cada región en
 *    2010. Se casan sus regiones con las nuestras igual que en 15-regiones-datos.ts.
 *  - USGS, «Major Mineral Deposits of the World» (Open-File Report 2005-1294, dominio público):
 *    unos 3.200 grandes yacimientos minerales con su ubicación y su mineral.
 *  - Wikidata (CC0): campos de petróleo (Q211748) y de gas (Q1349255) y minas de carbón con
 *    coordenadas, sin los cerrados antes de 2010 ni los descubiertos o abiertos después; y la
 *    superficie (P2046) de las unidades de Natural Earth de cada región.
 *  - public/data/ciudades-2010.json (Natural Earth y Wikidata): ciudades y capitales regionales.
 *
 * Cada yacimiento y cada ciudad se asigna a la región en la que cae (o a la más cercana si cae
 * en la costa). No es un inventario completo de recursos: solo los yacimientos registrados.
 *
 * Salida: public/data/regiones-2010-economia.json
 * Uso:    node scripts/datos/21-regiones-economia.ts (después de 14-regiones.ts y 15-regiones-datos.ts)
 * Requiere: la orden «unzip» del sistema.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { geoArea } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import {
  descargar,
  descargarJson,
  descargarTexto,
  escribirJsonCompacto,
  leerCsv,
  leerJson,
  numero,
} from './lib/comun.ts';
import { URL_DOSE, normalizar, resolverPorNombre } from './lib/dose.ts';
import { RADIO_TIERRA_KM } from './lib/geometria.ts';
import { crearLocalizador, crearLocalizadorRegiones } from './lib/localizar.ts';

const ANIO = 2010;
const URL_USGS = 'https://mrdata.usgs.gov/major-deposits/ofr20051294-csv.zip';
const SPARQL = 'https://query.wikidata.org/sparql?query=';
/** Ciudades que se guardan de cada región (las más pobladas). */
const CIUDADES_POR_REGION = 8;
/** Ejemplos de yacimientos que se guardan de cada recurso. */
const EJEMPLOS = 3;

interface Unidad {
  nombre: string;
  codigo: string | null;
  wikidata: string | null;
}
interface RegionFuente {
  id: string;
  pais: string;
  nombre: string;
  unidades: Unidad[];
}
interface Ciudad {
  nombre: string;
  pais: string;
  lon: number;
  lat: number;
  capital: boolean;
  capitalRegional: boolean;
  capitalDe: string | null;
  poblacion: number | null;
}
interface Fila {
  [clave: string]: { value: string } | undefined;
}

const pausa = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

async function consultar(consulta: string): Promise<Fila[]> {
  const respuesta = await descargarJson<{ results: { bindings: Fila[] } }>(
    SPARQL + encodeURIComponent(consulta),
    { cabeceras: { Accept: 'application/sparql-results+json' } },
  );
  await pausa(800);
  return respuesta.results.bindings;
}

const regiones = leerJson<{ regiones: RegionFuente[] }>('fuentes/datos/regiones.json').regiones;
const topoRegiones = leerJson<Topology>('public/data/regiones-2010.json');
const topoMapa = leerJson<Topology>('public/data/mapa-2010-detalle.json');
const paises = leerJson<{
  paises: Record<string, { datos: Record<string, number | null>; origen: Record<string, string> }>;
}>('public/data/paises-2010.json').paises;
const ciudades = leerJson<{ ciudades: Ciudad[] }>('public/data/ciudades-2010.json').ciudades;
const manualDose = leerJson<{
  alias: Record<string, Record<string, string[]>>;
  omitir: Record<string, string>;
}>('scripts/datos/manual/regiones-dose.json');

const localizador = crearLocalizador(topoMapa);
const localizadorRegiones = crearLocalizadorRegiones(topoRegiones);
const porPais = new Map<string, RegionFuente[]>();
for (const region of regiones) {
  const lista = porPais.get(region.pais) ?? [];
  lista.push(region);
  porPais.set(region.pais, lista);
}

/** Región en la que cae un punto (con su país), o null. */
function regionDelPunto(lon: number, lat: number): string | null {
  const pais = localizador.paisDe(lon, lat) ?? localizador.paisCercano(lon, lat, 50);
  return pais ? localizadorRegiones.regionDe(pais, lon, lat) : null;
}

// ── 1. Superficie ────────────────────────────────────────────────────────────────────────────
console.log('Consultando en Wikidata la superficie de las unidades de cada región…');
const areaUnidad = new Map<string, number>();
const qids = [
  ...new Set(regiones.flatMap((r) => r.unidades.map((u) => u.wikidata ?? '')).filter(Boolean)),
];
for (let i = 0; i < qids.length; i += 200) {
  const lote = qids.slice(i, i + 200);
  const filas = await consultar(`SELECT ?u ?area ?rango WHERE {
    VALUES ?u { ${lote.map((q) => `wd:${q}`).join(' ')} }
    ?u p:P2046 ?d . ?d psn:P2046/wikibase:quantityAmount ?area . ?d wikibase:rank ?rango .
    FILTER(?rango != wikibase:DeprecatedRank) }`);
  // La preferida, si la hay; si no, la mayor (algunas unidades tienen la de tierra y la total).
  const porUnidad = new Map<string, { area: number; preferida: boolean }[]>();
  for (const fila of filas) {
    const id = fila.u!.value.split('/').pop()!;
    const lista = porUnidad.get(id) ?? [];
    lista.push({
      area: Number(fila.area!.value) / 1e6,
      preferida: fila.rango!.value.endsWith('PreferredRank'),
    });
    porUnidad.set(id, lista);
  }
  for (const [id, lista] of porUnidad) {
    const preferidas = lista.filter((x) => x.preferida);
    const candidatas = preferidas.length > 0 ? preferidas : lista;
    const area = Math.max(...candidatas.map((x) => x.area));
    if (area > 0) areaUnidad.set(id, area);
  }
}
const formasRegion = new Map(
  (
    feature(topoRegiones, topoRegiones.objects.regiones!) as unknown as FeatureCollection<
      Polygon | MultiPolygon,
      { id: string }
    >
  ).features.map((f) => [f.properties.id, f]),
);

interface Superficie {
  valor: number | null;
  origen: string | null;
}
/** km² sin decimales, salvo en las regiones muy pequeñas (islas), con uno. */
const km2 = (valor: number): number =>
  valor < 100 ? Math.round(valor * 10) / 10 : Math.round(valor);
function superficie(region: RegionFuente): Superficie {
  const lista = porPais.get(region.pais)!;
  if (lista.length === 1) {
    const pais = paises[region.pais];
    return { valor: pais?.datos.superficie ?? null, origen: pais?.origen.superficie ?? null };
  }
  const areas = region.unidades.map((u) => (u.wikidata ? areaUnidad.get(u.wikidata) : undefined));
  if (areas.length > 0 && areas.every((a) => a !== undefined)) {
    return { valor: km2(areas.reduce((s, a) => s + a!, 0)), origen: 'WD' };
  }
  // Medida en el mapa (estimada); las islas diminutas casi no tienen superficie en él: sin dato.
  const forma = formasRegion.get(region.id);
  const medida = forma ? km2(geoArea(forma) * RADIO_TIERRA_KM ** 2) : 0;
  return medida > 0 ? { valor: medida, origen: 'EST:mapa' } : { valor: null, origen: null };
}

// ── 2. Sectores (DOSE) ───────────────────────────────────────────────────────────────────────
console.log('Descargando DOSE (sectores de cada región) de Zenodo…');
const dose = leerCsv(await descargarTexto(URL_DOSE)).filter((f) => f.year === String(ANIO));
const sectores = new Map<string, { valores: [number, number, number]; conjunto: boolean }>();
const omitir = new Set(Object.keys(manualDose.omitir).filter((k) => !k.startsWith('_')));
let filasSinCasar = 0;
for (const [pais, lista] of porPais) {
  if (lista.length === 1 || omitir.has(pais)) continue;
  const resolver = resolverPorNombre(lista);
  for (const fila of dose.filter((f) => f.GID_0 === pais)) {
    const pob = numero(fila.pop);
    const ag = numero(fila.ag_grp_pc_lcu);
    const ind = numero(fila.man_grp_pc_lcu);
    const serv = numero(fila.serv_grp_pc_lcu);
    if (!pob || ag === null || ind === null || serv === null) continue;
    const alias = manualDose.alias[pais]?.[fila.region!];
    const ids = alias
      ? alias.map((nombre) => lista.find((r) => r.nombre === nombre)?.id ?? resolver(nombre))
      : [resolver(fila.region!)];
    const validos = [...new Set(ids.filter((id): id is string => id !== null))];
    if (validos.length === 0) {
      filasSinCasar++;
      continue;
    }
    for (const id of validos) {
      const previo = sectores.get(id);
      const suma: [number, number, number] = [ag * pob, ind * pob, serv * pob];
      sectores.set(id, {
        valores: previo
          ? [previo.valores[0] + suma[0], previo.valores[1] + suma[1], previo.valores[2] + suma[2]]
          : suma,
        conjunto: (previo?.conjunto ?? false) || validos.length > 1,
      });
    }
  }
}

// ── 3. Ciudades y capitales ──────────────────────────────────────────────────────────────────
const ciudadesPorRegion = new Map<string, Ciudad[]>();
/** Región de cada nombre (de la región o de sus unidades), por país. */
const regionPorNombre = new Map<string, string>();
for (const region of regiones) {
  regionPorNombre.set(`${region.pais}|${normalizar(region.nombre)}`, region.id);
  for (const u of region.unidades)
    regionPorNombre.set(`${region.pais}|${normalizar(u.nombre)}`, region.id);
}
for (const ciudad of ciudades) {
  // Una capital va a la región de la que es capital aunque, con las fronteras simplificadas
  // del mapa, caiga en la de al lado.
  const id =
    (ciudad.capitalDe
      ? regionPorNombre.get(`${ciudad.pais}|${normalizar(ciudad.capitalDe)}`)
      : null) ?? localizadorRegiones.regionDe(ciudad.pais, ciudad.lon, ciudad.lat);
  if (!id) continue;
  const lista = ciudadesPorRegion.get(id) ?? [];
  lista.push(ciudad);
  ciudadesPorRegion.set(id, lista);
}

/**
 * Capital de las regiones hechas de varias unidades (Cataluña = cuatro provincias), según
 * Wikidata: la capital (P36) de la entidad a la que pertenecen sus unidades (P131), solo si esa
 * ciudad está dentro de la región. Se busca después de leer las ciudades.
 */
async function capitalesDeWikidata(): Promise<Map<string, string>> {
  const varias = regiones.filter((r) => r.unidades.length > 1);
  const regionDeUnidad = new Map<string, RegionFuente>();
  for (const region of varias) {
    for (const u of region.unidades) if (u.wikidata) regionDeUnidad.set(u.wikidata, region);
  }
  const votos = new Map<string, Map<string, { nombre: string; votos: number }>>();
  const unidades = [...regionDeUnidad.keys()];
  for (let i = 0; i < unidades.length; i += 150) {
    const lote = unidades.slice(i, i + 150);
    const filas = await consultar(`SELECT ?u ?cap ?coord ?es ?en WHERE {
      VALUES ?u { ${lote.map((q) => `wd:${q}`).join(' ')} }
      ?u wdt:P131 ?padre . ?padre wdt:P36 ?cap . ?cap wdt:P625 ?coord .
      OPTIONAL { ?cap rdfs:label ?es FILTER(LANG(?es) = "es") }
      OPTIONAL { ?cap rdfs:label ?en FILTER(LANG(?en) = "en") } }`);
    for (const fila of filas) {
      const region = regionDeUnidad.get(fila.u!.value.split('/').pop()!)!;
      const punto = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(fila.coord!.value);
      if (!punto) continue;
      // Solo si la capital cae dentro de la región (no la del país, si la región no la tiene).
      const dentro = localizadorRegiones.regionDe(
        region.pais,
        Number(punto[1]),
        Number(punto[2]),
        0,
      );
      if (dentro !== region.id) continue;
      const nombre = fila.es?.value ?? fila.en?.value;
      if (!nombre) continue;
      const deRegion = votos.get(region.id) ?? new Map<string, { nombre: string; votos: number }>();
      const previo = deRegion.get(fila.cap!.value);
      deRegion.set(fila.cap!.value, { nombre, votos: (previo?.votos ?? 0) + 1 });
      votos.set(region.id, deRegion);
    }
  }
  const resultado = new Map<string, string>();
  for (const [id, candidatas] of votos) {
    const mejor = [...candidatas.values()].sort(
      (a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre),
    )[0];
    if (mejor) resultado.set(id, mejor.nombre);
  }
  return resultado;
}
console.log('Consultando en Wikidata la capital de las regiones hechas de varias unidades…');
const capitalesWd = await capitalesDeWikidata();

/**
 * Capital de la región solo cuando es segura: la ciudad que Natural Earth da como capital de la
 * región (o de su única unidad) o la que se llama como ella; la de Wikidata en las regiones de varias unidades; o, en un país
 * de una sola región, la capital del país. Si no, ninguna.
 */
function capital(region: RegionFuente, lista: Ciudad[]): { nombre: string; origen: string } | null {
  const nombres = new Set([normalizar(region.nombre)]);
  if (region.unidades.length === 1) nombres.add(normalizar(region.unidades[0]!.nombre));
  const regional = lista.find(
    (c) => c.capitalRegional && c.capitalDe && nombres.has(normalizar(c.capitalDe)),
  );
  if (regional) return { nombre: regional.nombre, origen: 'NE' };
  // La región que se llama como una de sus ciudades (Viena, Ereván, Ciudad de Buenos Aires).
  const homonima = lista.find((c) => nombres.has(normalizar(c.nombre)));
  if (homonima) return { nombre: homonima.nombre, origen: 'NE' };
  const deWikidata = capitalesWd.get(region.id);
  if (deWikidata) {
    // Con el nombre de nuestra lista de ciudades si está en ella («Barcelona»).
    const ciudad = lista.find((c) => normalizar(c.nombre) === normalizar(deWikidata));
    return { nombre: ciudad?.nombre ?? deWikidata, origen: 'WD' };
  }
  if (porPais.get(region.pais)!.length === 1) {
    const delPais = lista.find((c) => c.capital);
    return delPais ? { nombre: delPais.nombre, origen: 'pais' } : null;
  }
  return null;
}

// ── 4. Recursos ──────────────────────────────────────────────────────────────────────────────
/** Mineral del USGS (en inglés) → clave del recurso. */
const MINERALES: [RegExp, string][] = [
  [
    /^(gem|emerald|sapphire|ruby|jade|amethyst|opal|topaz|tourmaline|kunzite|lapis|aquamarine|spinel|amber)/,
    'piedras-preciosas',
  ],
  [/^gold/, 'oro'],
  [/^silver/, 'plata'],
  [/^(copper|cooper)/, 'cobre'],
  [/^(iron|magnetite|hematite)/, 'hierro'],
  [/^(alumin|bauxite)/, 'bauxita'],
  [/^coal/, 'carbon'],
  [/^zinc/, 'zinc'],
  [/^lead/, 'plomo'],
  [/^nickel/, 'niquel'],
  [/^chrom/, 'cromo'],
  [/^mangan/, 'manganeso'],
  [/^tin$/, 'estano'],
  [/^tungsten/, 'wolframio'],
  [/^molybd/, 'molibdeno'],
  [/^titan/, 'titanio'],
  [/^zirc/, 'circonio'],
  [/^uran/, 'uranio'],
  [/^diamond/, 'diamantes'],
  [/^(pge|platinum|palladium|rhodium)/, 'platino'],
  [/^cobalt/, 'cobalto'],
  [/^lithium/, 'litio'],
  [/^(ree|rare)/, 'tierras-raras'],
  [/^(columbium|niobium|tantal)/, 'niobio-tantalio'],
  [/^vanad/, 'vanadio'],
  [/^mercury/, 'mercurio'],
  [/^antimony/, 'antimonio'],
  [/^graphite/, 'grafito'],
  [/^phosph/, 'fosfatos'],
  [/^(potash|potassium|sylvite)/, 'potasa'],
  [/^(halite|salt|sodium chloride)/, 'sal'],
  [/^sulfur/, 'azufre'],
  [/^fluor/, 'fluorita'],
  [/^(barite|barium)/, 'barita'],
  [/^gypsum/, 'yeso'],
  [/^magnes/, 'magnesio'],
  [/^bor/, 'boro'],
  [/^(soda ash|sodium carbonate|trona)/, 'carbonato-sodio'],
  [/^(kaolin|clay|bentonite)/, 'arcillas'],
  [/^talc/, 'talco'],
  [/^asbestos/, 'amianto'],
  [/^strontium/, 'estroncio'],
  [/^(limestone|dolomite|calcite|calcium carbonate)/, 'caliza'],
  [/^garnet/, 'granate'],
  [/^sodium sulfate/, 'sulfato-sodio'],
  [/^beryl/, 'berilio'],
  [/^bismuth/, 'bismuto'],
  [/^iodine/, 'yodo'],
];
/** Minerales poco frecuentes que van a «otros minerales» (se cuentan para el resumen). */
const otros = new Map<string, number>();
function claves(texto: string): string[] {
  const resultado = new Set<string>();
  // Sin lo que va entre paréntesis («gem (ruby, sapphire)» → «gem»).
  for (const parte of texto.replace(/\([^)]*\)/g, '').split(/[,;/]| and |-/)) {
    const limpio = parte.trim().toLowerCase();
    if (!limpio || ['earth', 'earths', 'elements', 'rich'].includes(limpio)) continue;
    const encontrado = MINERALES.find(([patron]) => patron.test(limpio));
    if (encontrado) resultado.add(encontrado[1]);
    else {
      resultado.add('otros-minerales');
      otros.set(limpio, (otros.get(limpio) ?? 0) + 1);
    }
  }
  return [...resultado];
}

/**
 * País (o países) que el USGS da a cada yacimiento: por su nombre en inglés, comparado con el
 * de cada país del juego, y unos pocos alias. Sirve para descartar coordenadas erróneas.
 */
const ALIAS_USGS: Record<string, string[]> = {
  burma: ['MMR'],
  'czech republic': ['CZE'],
  'cote d ivoire': ['CIV'],
  'kalaallit nunaat greenland': ['GRL'],
  'korean peninsula': ['PRK', 'KOR'],
  luxenbourg: ['LUX'],
  macedonia: ['MKD'],
  'serbia and montenegro': ['SRB', 'MNE', 'XKX'],
  surinam: ['SUR'],
  swaziland: ['SWZ'],
  'the gambia': ['GMB'],
  turkey: ['TUR'],
};
const sinTildes = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
const nombresIngles = new Intl.DisplayNames(['en'], { type: 'region' });
const isoPorNombre = new Map<string, string>();
for (const pais of leerJson<{ paises: { id: string; iso2: string | null }[] }>(
  'fuentes/datos/paises.json',
).paises) {
  if (!pais.iso2) continue;
  const nombre = nombresIngles.of(pais.iso2);
  if (nombre) isoPorNombre.set(sinTildes(nombre), pais.id);
}
function paisesUsgs(nombre: string): string[] | null {
  const clave = sinTildes(nombre);
  const iso = isoPorNombre.get(clave);
  return iso ? [iso] : (ALIAS_USGS[clave] ?? null);
}
const soberanos = leerJson<{ paises: Record<string, { soberano?: string }> }>(
  'public/data/paises-2010.json',
).paises;
/** Territorios con independencia de hecho y el país que los reclama (Somalilandia → Somalia). */
const reclamante = new Map(
  leerJson<{ paises: { id: string; reclamadoPor?: string | null }[] }>('fuentes/datos/paises.json')
    .paises.filter((p) => p.reclamadoPor)
    .map((p) => [p.id, p.reclamadoPor!]),
);

interface Recurso {
  n: number;
  ejemplos: string[];
  origenes: Set<string>;
}
const recursos = new Map<string, Map<string, Recurso>>();
function anotar(region: string, clave: string, nombre: string, origen: string): void {
  const deRegion = recursos.get(region) ?? new Map<string, Recurso>();
  const recurso = deRegion.get(clave) ?? { n: 0, ejemplos: [], origenes: new Set<string>() };
  recurso.n++;
  if (nombre && recurso.ejemplos.length < EJEMPLOS && !recurso.ejemplos.includes(nombre)) {
    recurso.ejemplos.push(nombre);
  }
  recurso.origenes.add(origen);
  deRegion.set(clave, recurso);
  recursos.set(region, deRegion);
}

console.log('Descargando los grandes yacimientos minerales del USGS…');
const temporal = mkdtempSync(join(tmpdir(), 'usgs-'));
let yacimientos = 0;
let fueraDeRegion = 0;
const paisDistinto: string[] = [];
try {
  const zip = join(temporal, 'yacimientos.zip');
  writeFileSync(zip, Buffer.from(await (await descargar(URL_USGS)).arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zip, '-d', temporal]);
  const filas = leerCsv(readFileSync(join(temporal, 'ofr20051294', 'deposit.csv'), 'utf8'));
  for (const fila of filas) {
    const lon = numero(fila.longitude);
    const lat = numero(fila.latitude);
    if (lon === null || lat === null) continue;
    let region = regionDelPunto(lon, lat);
    if (!region) {
      fueraDeRegion++;
      continue;
    }
    // Si cae en otro país del que dice el USGS: si está a menos de 80 km de ese país (en la
    // frontera, o en un territorio separado en el juego), se lleva a su región más cercana; si
    // no, las coordenadas están mal y se descarta.
    let destino: string | null = region;
    const esperados = paisesUsgs(fila.country ?? '');
    const pais = region.split('-')[0]!;
    const aceptados = new Set([pais, soberanos[pais]?.soberano, reclamante.get(pais)]);
    if (esperados && !esperados.some((e) => aceptados.has(e))) {
      destino = null;
      for (const esperado of esperados) {
        destino ??= localizadorRegiones.regionDe(esperado, lon, lat, 80, true);
      }
      if (!destino) {
        paisDistinto.push(`${fila.dep_name} (${fila.country} → ${pais})`);
        continue;
      }
    }
    region = destino;
    for (const clave of claves(fila.commodity ?? ''))
      anotar(region, clave, fila.dep_name ?? '', 'USGS');
    yacimientos++;
  }
} finally {
  rmSync(temporal, { recursive: true, force: true });
}

console.log('Consultando en Wikidata los campos de petróleo y gas y las minas de carbón…');
const ENERGIA: [string, string][] = [
  ['petroleo', '?m wdt:P31/wdt:P279* wd:Q211748 .'],
  ['gas', '?m wdt:P31/wdt:P279* wd:Q1349255 .'],
  [
    'carbon',
    '{ ?m wdt:P31/wdt:P279* wd:Q820477 ; wdt:P1056/wdt:P279* wd:Q24489 . } UNION { ?m wdt:P31/wdt:P279* wd:Q959309 . }',
  ],
];
const resumenEnergia: Record<string, number> = {};
for (const [clave, patron] of ENERGIA) {
  const filas = await consultar(`SELECT ?m ?coord ?es ?en ?fin ?inicio WHERE {
    ${patron}
    ?m wdt:P625 ?coord .
    OPTIONAL { ?m rdfs:label ?es FILTER(LANG(?es) = "es") }
    OPTIONAL { ?m rdfs:label ?en FILTER(LANG(?en) = "en") }
    OPTIONAL { ?m wdt:P576|wdt:P582|wdt:P3999 ?fin }
    OPTIONAL { ?m wdt:P575|wdt:P1619|wdt:P571 ?inicio } }`);
  const vistos = new Set<string>();
  const descartados = new Set<string>();
  // Fuera los cerrados antes de 2010 y los descubiertos o abiertos después.
  for (const fila of filas) {
    const id = fila.m!.value;
    const fin = fila.fin?.value.slice(0, 10);
    const inicio = fila.inicio?.value.slice(0, 10);
    if ((fin && fin < `${ANIO}-01-01`) || (inicio && inicio > `${ANIO}-12-31`)) descartados.add(id);
  }
  // En orden de identificador, para que los ejemplos salgan siempre iguales.
  const numeroQ = (fila: Fila): number => Number(fila.m!.value.split('/Q').pop());
  for (const fila of [...filas].sort((a, b) => numeroQ(a) - numeroQ(b))) {
    const id = fila.m!.value;
    if (vistos.has(id) || descartados.has(id)) continue;
    vistos.add(id);
    const punto = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(fila.coord!.value);
    if (!punto) continue;
    const region = regionDelPunto(Number(punto[1]), Number(punto[2]));
    if (!region) continue;
    anotar(region, clave, fila.es?.value ?? fila.en?.value ?? '', 'WD');
    resumenEnergia[clave] = (resumenEnergia[clave] ?? 0) + 1;
  }
}

// ── 5. Salida ────────────────────────────────────────────────────────────────────────────────
const redondear3 = (x: number): number => Math.round(x * 1000) / 1000;
const resultado: Record<string, unknown> = {};
const cuenta = { sectores: 0, recursos: 0, capital: 0, capitalWd: 0, superficieWd: 0 };
for (const region of regiones) {
  const sup = superficie(region);
  if (sup.origen === 'WD') cuenta.superficieWd++;
  const lista = (ciudadesPorRegion.get(region.id) ?? []).sort(
    (a, b) => (b.poblacion ?? 0) - (a.poblacion ?? 0),
  );
  const cap = capital(region, lista);
  if (cap) cuenta.capital++;
  if (cap?.origen === 'WD') cuenta.capitalWd++;
  const sector = sectores.get(region.id);
  let sectoresRegion: number[] | null = null;
  if (sector) {
    const total = sector.valores.reduce((s, v) => s + v, 0);
    if (total > 0) {
      sectoresRegion = sector.valores.map((v) => redondear3(v / total));
      cuenta.sectores++;
    }
  }
  const deRegion = [...(recursos.get(region.id) ?? new Map<string, Recurso>())]
    .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
    .map(([clave, r]) => [clave, r.n, r.ejemplos, [...r.origenes].sort().join('+')]);
  if (deRegion.length > 0) cuenta.recursos++;
  resultado[region.id] = {
    superficie: sup.valor,
    origenSuperficie: sup.origen,
    capital: cap?.nombre ?? null,
    origenCapital: cap?.origen ?? null,
    ciudades: lista
      .slice(0, CIUDADES_POR_REGION)
      .map((c) => [
        c.nombre,
        c.poblacion,
        c.capital ? 'pais' : c.nombre === cap?.nombre ? 'region' : '',
      ]),
    sectores: sectoresRegion,
    origenSectores: sector ? (sector.conjunto ? `DOSE:${ANIO}:conjunto` : `DOSE:${ANIO}`) : null,
    recursos: deRegion,
  };
}

escribirJsonCompacto(
  'public/data/regiones-2010-economia.json',
  {
    fuente:
      'DOSE V2.14 (Wenz et al., Zenodo 20035157, CC BY 4.0); USGS, Major Mineral Deposits of the World (Open-File Report 2005-1294, dominio público); Wikidata (CC0); Natural Earth (dominio público).',
    fecha: String(ANIO),
    notas: {
      sectores:
        'Peso de la agricultura, la industria y los servicios en el valor añadido de la región en 2010 (DOSE). «conjunto»: dato de una región de DOSE que abarca varias nuestras.',
      recursos:
        'Grandes yacimientos minerales del USGS (2005) y campos de petróleo y gas y minas de carbón de Wikidata activos en 2010, asignados a la región en la que están. No es un inventario completo.',
      superficie:
        'Suma de la superficie de las unidades de la región en Wikidata (WD); si falta alguna, la medida en el mapa (estimada). En los países de una sola región, la del país.',
      capital:
        'Solo cuando es segura: la capital de la región en Natural Earth (NE), la de Wikidata en las regiones de varias unidades si cae dentro de ellas (WD) o la del país en los de una sola región (pais).',
    },
    regiones: resultado,
  },
  3,
);
console.log(
  `regiones-2010-economia.json: ${regiones.length} regiones · sectores de DOSE en ${cuenta.sectores} ` +
    `(filas sin casar: ${filasSinCasar}) · recursos en ${cuenta.recursos} · capital en ${cuenta.capital} ` +
    `(${cuenta.capitalWd} de Wikidata) · ` +
    `superficie de Wikidata en ${cuenta.superficieWd}.`,
);
console.log(
  `Yacimientos del USGS asignados: ${yacimientos} (fuera de toda región: ${fueraDeRegion}; ` +
    `descartados por caer en otro país: ${paisDistinto.length}). ` +
    `Wikidata: ${JSON.stringify(resumenEnergia)}.`,
);
if (paisDistinto.length > 0) console.log('Descartados:', paisDistinto.join('; '));
if (otros.size > 0) {
  console.log(
    'Minerales del USGS en «otros minerales»:',
    [...otros]
      .sort((x, y) => y[1] - x[1])
      .map(([k, n]) => `${k} (${n})`)
      .join(', '),
  );
}
