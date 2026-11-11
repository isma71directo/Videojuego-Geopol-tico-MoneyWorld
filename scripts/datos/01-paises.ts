/**
 * Tabla de países y territorios del escenario del 1 de enero de 2010 (tarea f1-t4).
 *
 * Fuentes:
 *  - Banco Mundial, API de países (lista de economías, ISO2, región y capital): consulta actual.
 *  - Wikidata (capital de cada país con sus fechas, nombre en español): consulta actual.
 *  - CLDR, vía Intl.DisplayNames de Node (nombre del país en español).
 *  - Tabla manual scripts/datos/manual/paises-2010.json (territorios especiales, nombres y
 *    capitales de 2010, Sudán unido).
 *
 * Salida: fuentes/datos/paises.json
 * Uso:    node scripts/datos/01-paises.ts
 */
import { descargarJson, escribirJson, leerJson } from './lib/comun.ts';
import type { PaisBase } from './lib/tipos.ts';

const FECHA_ESCENARIO = '2010-01-01';

interface Manual {
  dependenciasExcluidas: { codigos: string[] };
  fusiones: Record<string, string[] | string>;
  regiones: Record<string, string>;
  regionesCorregidas: Record<string, string>;
  nombres: Record<string, string>;
  capitales: Record<string, string>;
  nivelesRenta: Record<string, string>;
  extra: {
    id: string;
    iso2: string;
    region: string;
    jugable: boolean;
    wikidata?: string;
    nivelRenta?: string;
    nota?: string;
  }[];
  especiales: (Pick<PaisBase, 'id' | 'iso2' | 'nombre' | 'capital' | 'region' | 'jugable'> & {
    estatus: string;
    reclamadoPor: string | null;
    nivelRenta?: string;
    codigos: PaisBase['codigos'];
  })[];
}

interface PaisBM {
  id: string;
  iso2Code: string;
  name: string;
  capitalCity: string;
  region: { id: string };
}

interface FilaCapital {
  iso3: { value: string };
  es?: { value: string };
  inicio?: { value: string };
  fin?: { value: string };
  rango: { value: string };
}

const manual = leerJson<Manual>('scripts/datos/manual/paises-2010.json');
const nombresEs = new Intl.DisplayNames('es', { type: 'region' });

/** Capitales válidas el día del escenario, según las fechas de inicio y fin de Wikidata. */
async function capitalesDeWikidata(): Promise<
  Map<string, { nombre: string; preferida: boolean }[]>
> {
  const consulta = `
    SELECT ?iso3 ?es ?inicio ?fin ?rango WHERE {
      ?pais wdt:P298 ?iso3 .
      ?pais p:P36 ?declaracion .
      ?declaracion ps:P36 ?capital ; wikibase:rank ?rango .
      OPTIONAL { ?declaracion pq:P580 ?inicio }
      OPTIONAL { ?declaracion pq:P582 ?fin }
      OPTIONAL { ?capital rdfs:label ?es FILTER(LANG(?es) = "es") }
    }`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(consulta)}`;
  const respuesta = await descargarJson<{ results: { bindings: FilaCapital[] } }>(url, {
    cabeceras: { Accept: 'application/sparql-results+json' },
  });
  const porPais = new Map<string, { nombre: string; preferida: boolean }[]>();
  for (const fila of respuesta.results.bindings) {
    const nombre = fila.es?.value;
    const inicio = fila.inicio?.value.slice(0, 10);
    const fin = fila.fin?.value.slice(0, 10);
    if (!nombre || fila.rango.value.endsWith('DeprecatedRank')) continue;
    // Las fechas de Wikidata son ISO; las mal formadas (URL) se ignoran.
    if (inicio && /^\d{4}-/.test(inicio) && inicio > FECHA_ESCENARIO) continue;
    if (fin && /^\d{4}-/.test(fin) && fin <= FECHA_ESCENARIO) continue;
    const lista = porPais.get(fila.iso3.value) ?? [];
    if (!lista.some((c) => c.nombre === nombre)) {
      // «Preferida» solo cuenta si no depende de una fecha posterior al escenario.
      lista.push({ nombre, preferida: fila.rango.value.endsWith('PreferredRank') });
    }
    porPais.set(fila.iso3.value, lista);
  }
  return porPais;
}

/** Países cuya capital hay que fijar a mano; si queda alguno, el script falla al final. */
const capitalesDudosas: string[] = [];

function elegirCapital(
  id: string,
  candidatas: { nombre: string; preferida: boolean }[] | undefined,
  capitalBM: string,
): { capital: string; capitalFuente: string } {
  const manualCapital = manual.capitales[id];
  if (manualCapital) return { capital: manualCapital, capitalFuente: 'manual' };
  const lista = candidatas ?? [];
  const preferidas = lista.filter((c) => c.preferida);
  const elegida = preferidas.length === 1 ? preferidas[0] : lista.length === 1 ? lista[0] : null;
  if (elegida) return { capital: elegida.nombre, capitalFuente: 'wikidata' };
  if (lista.length > 1) {
    capitalesDudosas.push(`${id}: ${lista.map((c) => c.nombre).join(' / ')}`);
    return { capital: '', capitalFuente: '' };
  }
  if (capitalBM) return { capital: capitalBM, capitalFuente: 'banco-mundial' };
  capitalesDudosas.push(`${id}: sin capital en ninguna fuente`);
  return { capital: '', capitalFuente: '' };
}

const respuestaBM = await descargarJson<[unknown, PaisBM[]]>(
  'https://api.worldbank.org/v2/country?format=json&per_page=400',
);
const capitales = await capitalesDeWikidata();

const excluidos = new Set(manual.dependenciasExcluidas.codigos);
const absorbidos = new Set(
  Object.entries(manual.fusiones)
    .filter(([clave]) => !clave.startsWith('_'))
    .flatMap(([destino, partes]) => (partes as string[]).filter((parte) => parte !== destino)),
);
const idsEspeciales = new Set(manual.especiales.map((especial) => especial.id));

const paises: PaisBase[] = [];

// 1) Estados soberanos de 2010 según la lista del Banco Mundial.
for (const pais of respuestaBM[1]) {
  // Los agregados («Mundo», «Zona euro»…) no tienen región.
  if (pais.region.id === 'NA') continue;
  if (excluidos.has(pais.id) || absorbidos.has(pais.id) || idsEspeciales.has(pais.id)) continue;
  const region = manual.regionesCorregidas[pais.id] ?? pais.region.id;
  const fusion = manual.fusiones[pais.id];
  paises.push({
    id: pais.id,
    iso2: pais.iso2Code,
    nombre: manual.nombres[pais.id] ?? nombresEs.of(pais.iso2Code) ?? pais.name,
    tipo: 'pais',
    jugable: true,
    ...elegirCapital(pais.id, capitales.get(pais.id), pais.capitalCity),
    region,
    regionNombre: manual.regiones[region]!,
    codigos: { bm: pais.id, fmi: pais.id, owid: pais.id, wikidata: null },
    ...(manual.nivelesRenta[pais.id] ? { nivelRentaManual: manual.nivelesRenta[pais.id] } : {}),
    ...(Array.isArray(fusion) ? { componentes: fusion } : {}),
  });
}

// 2) Estados que el Banco Mundial no lista (Vaticano).
for (const extra of manual.extra) {
  paises.push({
    id: extra.id,
    iso2: extra.iso2,
    nombre: manual.nombres[extra.id] ?? nombresEs.of(extra.iso2)!,
    tipo: 'pais',
    jugable: extra.jugable,
    ...elegirCapital(extra.id, capitales.get(extra.id), ''),
    region: extra.region,
    regionNombre: manual.regiones[extra.region]!,
    codigos: { bm: null, fmi: null, owid: extra.id, wikidata: extra.wikidata ?? null },
    ...(extra.nivelRenta ? { nivelRentaManual: extra.nivelRenta } : {}),
    ...(extra.nota ? { nota: extra.nota } : {}),
  });
}

// 3) Territorios de estatus especial o en disputa (GDD, sección 3).
for (const especial of manual.especiales) {
  paises.push({
    id: especial.id,
    iso2: especial.iso2,
    nombre: especial.nombre,
    tipo: 'especial',
    jugable: especial.jugable,
    capital: especial.capital,
    capitalFuente: 'manual',
    region: especial.region,
    regionNombre: manual.regiones[especial.region]!,
    estatus: especial.estatus,
    reclamadoPor: especial.reclamadoPor,
    codigos: especial.codigos,
    ...(especial.nivelRenta ? { nivelRentaManual: especial.nivelRenta } : {}),
  });
}

paises.sort((a, b) => a.id.localeCompare(b.id));

if (capitalesDudosas.length > 0) {
  throw new Error(
    'Capitales por decidir; añádelas a «capitales» en scripts/datos/manual/paises-2010.json:\n' +
      capitalesDudosas.join('\n'),
  );
}

const soberanos = paises.filter((pais) => pais.tipo === 'pais').length;
// 192 miembros de la ONU el 1 de enero de 2010 (Sudán del Sur ingresó en 2011) más el Vaticano.
if (soberanos !== 193) {
  throw new Error(`Se esperaban 193 Estados soberanos en 2010 y hay ${soberanos}.`);
}
if (new Set(paises.map((pais) => pais.id)).size !== paises.length) {
  throw new Error('Hay identificadores de país repetidos.');
}

escribirJson('fuentes/datos/paises.json', {
  fuente:
    'Banco Mundial (API de países), Wikidata (capitales con fechas), CLDR (nombres en español) y tabla manual',
  fechaEscenario: FECHA_ESCENARIO,
  paises,
});
console.log(
  `Tabla de países: ${paises.length} (${soberanos} Estados y ${paises.length - soberanos} territorios especiales).`,
);
