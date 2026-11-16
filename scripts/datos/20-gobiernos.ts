/**
 * Régimen político y jefes de Estado y de Gobierno el 1 de enero de 2010 (tarea f8-t1, opción A
 * elegida por el jugador).
 *
 * Fuente: Wikidata (CC0), consultada con SPARQL.
 *  - Cargos de cada país: «cargo del jefe de Estado» (P1906) y «cargo del jefe de Gobierno»
 *    (P1313). Quién los ocupaba: las personas con ese «cargo ocupado» (P39) cuyo inicio (P580)
 *    es anterior al 1 de enero de 2010 y cuyo final (P582) es posterior o no existe. Si hay
 *    varias, la de inicio más reciente.
 *  - De cada persona: nombre en español (o el común a todos los idiomas, o en inglés), sexo
 *    (P21) y año de nacimiento (P569),
 *    que usan los retratos.
 *  - Forma de gobierno (P122): es la de hoy, no la de 2010, así que solo se usa cuando es clara
 *    (monarquía absoluta, sistema presidencial…).
 * Correcciones a mano, con su motivo: scripts/datos/manual/gobiernos-2010.json (cargos que
 * faltan en Wikidata y regímenes que han cambiado desde 2010).
 *
 * Régimen (los 8 del GDD, sección 6.15): la corrección a mano, si la hay; si no, la forma de
 * gobierno de Wikidata cuando es clara; si no, una regla: jefe de Estado monarca → monarquía
 * (absoluta si también gobierna); misma persona en los dos cargos → presidencial; si no,
 * parlamentario. Los territorios dependientes no tienen régimen propio: su jefe de Estado es el
 * de su país soberano.
 *
 * Salida: public/data/gobiernos-2010.json
 * Uso:    node scripts/datos/20-gobiernos.ts
 */
import { descargarJson, escribirJsonCompacto, leerJson } from './lib/comun.ts';

const FECHA = '2010-01-01';
const SPARQL = 'https://query.wikidata.org/sparql?format=json&query=';
const TANDA = 60;

export type Regimen =
  | 'parlamentario'
  | 'presidencial'
  | 'semipresidencial'
  | 'monarquia-parlamentaria'
  | 'monarquia-absoluta'
  | 'partido-unico'
  | 'junta'
  | 'teocracia';

interface Cargo {
  persona: string;
  cargo: string;
  desde: string;
}
interface CorreccionCargos {
  estado?: Cargo;
  gobierno?: Cargo | 'estado';
  motivo: string;
}
interface Manual {
  cargos: Record<string, CorreccionCargos>;
  regimenes: Record<string, { regimen: Regimen; motivo: string }>;
}
interface PaisFuente {
  id: string;
  tipo: 'pais' | 'especial' | 'dependiente';
  soberano?: string;
  codigos: { wikidata: string | null };
}
type Fila = Record<string, { value: string } | undefined>;

const pausa = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const qid = (uri: string): string => uri.slice(uri.lastIndexOf('/') + 1);

async function consultar(consulta: string): Promise<Fila[]> {
  const respuesta = await descargarJson<{ results: { bindings: Fila[] } }>(
    SPARQL + encodeURIComponent(consulta),
    { cabeceras: { Accept: 'application/sparql-results+json' } },
  );
  await pausa(800);
  return respuesta.results.bindings;
}

async function porTandas<T>(
  lista: readonly T[],
  hacer: (tanda: T[]) => Promise<Fila[]>,
): Promise<Fila[]> {
  const filas: Fila[] = [];
  for (let i = 0; i < lista.length; i += TANDA)
    filas.push(...(await hacer(lista.slice(i, i + TANDA))));
  return filas;
}

const paises = leerJson<{ paises: PaisFuente[] }>('fuentes/datos/paises.json').paises;
const manual = leerJson<Manual>('scripts/datos/manual/gobiernos-2010.json');
const delJuego = leerJson<{ paises: Record<string, { tipo: string }> }>(
  'public/data/paises-2010.json',
).paises;

// 1. Elemento de Wikidata de cada país: por su código ISO o, en los especiales, por el suyo.
const porIso = await consultar(
  `SELECT ?pais ?iso3 WHERE { ?pais wdt:P298 ?iso3 . ?pais wdt:P1906|wdt:P1313 ?c . }`,
);
const elemento = new Map<string, string>();
for (const fila of porIso) {
  const iso = fila.iso3!.value;
  if (iso in delJuego && !elemento.has(iso)) elemento.set(iso, qid(fila.pais!.value));
}
for (const pais of paises) {
  if (pais.codigos.wikidata && !elemento.has(pais.id)) elemento.set(pais.id, pais.codigos.wikidata);
}
const deElemento = new Map([...elemento].map(([id, q]) => [q, id]));

// 2. Cargos de jefe de Estado y de Gobierno de cada país, con su nombre en español.
const filasCargos = await porTandas([...elemento.values()], (tanda) =>
  consultar(`SELECT ?pais ?tipo ?cargo ?es ?mul ?en WHERE {
    VALUES ?pais { ${tanda.map((q) => `wd:${q}`).join(' ')} }
    { ?pais wdt:P1906 ?cargo . BIND("estado" AS ?tipo) } UNION { ?pais wdt:P1313 ?cargo . BIND("gobierno" AS ?tipo) }
    OPTIONAL { ?cargo rdfs:label ?es FILTER(LANG(?es) = "es") }
    OPTIONAL { ?cargo rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
    OPTIONAL { ?cargo rdfs:label ?en FILTER(LANG(?en) = "en") } }`),
);
const cargosDe = new Map<string, { tipo: string; cargo: string; nombre: string }[]>();
const nombreCargo = new Map<string, string>();
for (const fila of filasCargos) {
  const pais = deElemento.get(qid(fila.pais!.value))!;
  const cargo = qid(fila.cargo!.value);
  const nombre = fila.es?.value ?? fila.mul?.value ?? fila.en?.value ?? cargo;
  nombreCargo.set(cargo, nombre);
  const lista = cargosDe.get(pais) ?? [];
  if (!lista.some((c) => c.tipo === fila.tipo!.value && c.cargo === cargo)) {
    lista.push({ tipo: fila.tipo!.value, cargo, nombre });
  }
  cargosDe.set(pais, lista);
}

// 3. Quién ocupaba cada cargo el 1 de enero de 2010.
const todosLosCargos = [...nombreCargo.keys()];
const filasOcupantes = await porTandas(todosLosCargos, (tanda) =>
  consultar(`SELECT ?cargo ?persona ?inicio ?fin WHERE {
    VALUES ?cargo { ${tanda.map((q) => `wd:${q}`).join(' ')} }
    ?persona p:P39 ?pos . ?pos ps:P39 ?cargo ; pq:P580 ?inicio .
    OPTIONAL { ?pos pq:P582 ?fin }
    FILTER(?inicio <= "${FECHA}T00:00:00Z"^^xsd:dateTime)
    FILTER(!BOUND(?fin) || ?fin > "${FECHA}T00:00:00Z"^^xsd:dateTime) }`),
);
const ocupante = new Map<string, Cargo & { inicio: string }>();
for (const fila of filasOcupantes) {
  const cargo = qid(fila.cargo!.value);
  const inicio = fila.inicio!.value.slice(0, 10);
  const previo = ocupante.get(cargo);
  // Si hay varios (un cargo sin fecha de fin olvidada), el que empezó más tarde.
  if (!previo || inicio > previo.inicio) {
    ocupante.set(cargo, {
      persona: qid(fila.persona!.value),
      cargo: nombreCargo.get(cargo)!,
      desde: inicio,
      inicio,
    });
  }
}

// 4. Forma de gobierno de hoy (solo se usa cuando es clara).
const filasForma = await porTandas([...elemento.values()], (tanda) =>
  consultar(`SELECT ?pais ?en WHERE { VALUES ?pais { ${tanda.map((q) => `wd:${q}`).join(' ')} }
    ?pais wdt:P122 ?forma . ?forma rdfs:label ?en FILTER(LANG(?en) = "en") }`),
);
const formas = new Map<string, string[]>();
for (const fila of filasForma) {
  const pais = deElemento.get(qid(fila.pais!.value))!;
  formas.set(pais, [...(formas.get(pais) ?? []), fila.en!.value.toLowerCase()]);
}
const FORMAS_CLARAS: [RegExp, Regimen][] = [
  [/military junta/, 'junta'],
  [/theocracy|papacy/, 'teocracia'],
  [/one-party|communist|juche/, 'partido-unico'],
  [/absolute monarchy|emirate/, 'monarquia-absoluta'],
  [/semi-presidential/, 'semipresidencial'],
  [/presidential system|super-presidential/, 'presidencial'],
  [
    /constitutional monarchy|parliamentary monarchy|federal monarchy|parliamentary coprincipality/,
    'monarquia-parlamentaria',
  ],
  [
    /parliamentary republic|parliamentary system|parliamentary democracy|westminster/,
    'parlamentario',
  ],
];
const MONARCA =
  /\b(rey|reina|monarca|emir|sultán|sultan|gran duque|príncipe|princesa|jeque|copríncipe|king|queen|monarch|grand duke|prince|yang di-pertuan|emperador|emperor)\b/i;

// 5. Ficha de cada país.
interface Gobierno {
  regimen: Regimen | null;
  regimenFuente: string;
  estado: Cargo | null;
  gobierno: Cargo | 'estado' | null;
  fuente: 'wikidata' | 'manual' | 'wikidata y manual';
}
const resultado: Record<string, Gobierno> = {};
const sinCargo = (c: Cargo & { inicio?: string }): Cargo => ({
  persona: c.persona,
  cargo: c.cargo,
  desde: c.desde,
});

for (const pais of paises) {
  if (!(pais.id in delJuego)) continue;
  const cargos = cargosDe.get(pais.id) ?? [];
  const deTipo = (tipo: string): Cargo | null => {
    const encontrados = cargos
      .filter((c) => c.tipo === tipo)
      .map((c) => ocupante.get(c.cargo))
      .filter((c): c is Cargo & { inicio: string } => Boolean(c))
      .sort((a, b) => b.inicio.localeCompare(a.inicio));
    return encontrados[0] ? sinCargo(encontrados[0]) : null;
  };
  let estado = deTipo('estado');
  const delGobierno = deTipo('gobierno');
  let gobierno: Cargo | 'estado' | null =
    estado && delGobierno?.persona === estado.persona ? 'estado' : delGobierno;
  const correccion = manual.cargos[pais.id];
  let fuente: Gobierno['fuente'] = 'wikidata';
  if (correccion) {
    fuente = estado || gobierno ? 'wikidata y manual' : 'manual';
    if (correccion.estado) estado = correccion.estado;
    if (correccion.gobierno) gobierno = correccion.gobierno;
  }
  resultado[pais.id] = { regimen: null, regimenFuente: '', estado, gobierno, fuente };
}

// Los dependientes: su jefe de Estado es el del país soberano; no tienen régimen propio.
for (const pais of paises) {
  const ficha = resultado[pais.id];
  if (!ficha) continue;
  if (pais.tipo === 'dependiente' && pais.soberano) {
    ficha.estado = resultado[pais.soberano]?.estado ?? ficha.estado;
    if (ficha.gobierno === 'estado') ficha.gobierno = null;
    ficha.regimenFuente = `territorio dependiente de ${pais.soberano}`;
    continue;
  }
  // Sin jefe de Estado no hay Estado (el Sáhara Occidental): sin régimen.
  if (!ficha.estado) {
    ficha.regimenFuente = 'sin Estado: territorio en disputa';
    continue;
  }
  const corregido = manual.regimenes[pais.id];
  if (corregido) {
    ficha.regimen = corregido.regimen;
    ficha.regimenFuente = `manual: ${corregido.motivo}`;
    continue;
  }
  // Ordenadas, para que el archivo no cambie de una descarga a otra.
  const forma = [...(formas.get(pais.id) ?? [])].sort().join('; ');
  const clara = FORMAS_CLARAS.find(([patron]) => patron.test(forma));
  // Si el presidente dirige el Gobierno, no es parlamentario aunque Wikidata lo diga.
  if (clara && !(clara[1] === 'parlamentario' && ficha.gobierno === 'estado')) {
    ficha.regimen = clara[1];
    ficha.regimenFuente = `wikidata: ${forma}`;
    continue;
  }
  const monarca = ficha.estado && MONARCA.test(ficha.estado.cargo);
  if (monarca) {
    ficha.regimen = ficha.gobierno === 'estado' ? 'monarquia-absoluta' : 'monarquia-parlamentaria';
    ficha.regimenFuente = 'regla: el jefe de Estado es un monarca';
  } else if (ficha.gobierno === 'estado') {
    ficha.regimen = 'presidencial';
    ficha.regimenFuente = 'regla: el jefe de Estado también encabeza el Gobierno';
  } else {
    ficha.regimen = 'parlamentario';
    ficha.regimenFuente = 'regla: jefe de Estado y jefe de Gobierno distintos';
  }
}

// 6. Personas: nombre, sexo y año de nacimiento.
const personas = [
  ...new Set(
    Object.values(resultado).flatMap((f) => [
      f.estado?.persona,
      f.gobierno && f.gobierno !== 'estado' ? f.gobierno.persona : undefined,
    ]),
  ),
].filter((p): p is string => Boolean(p));
const filasPersonas = await porTandas(personas, (tanda) =>
  // Algunos identificadores son redirecciones (fichas fusionadas): se siguen hasta la buena.
  consultar(`SELECT ?p ?es ?mul ?en ?sexo ?nacimiento WHERE { VALUES ?p { ${tanda.map((q) => `wd:${q}`).join(' ')} }
    OPTIONAL { ?p owl:sameAs ?destino } BIND(COALESCE(?destino, ?p) AS ?q)
    OPTIONAL { ?q rdfs:label ?es FILTER(LANG(?es) = "es") }
    OPTIONAL { ?q rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
    OPTIONAL { ?q rdfs:label ?en FILTER(LANG(?en) = "en") }
    OPTIONAL { ?q wdt:P21 ?sexo } OPTIONAL { ?q wdt:P569 ?nacimiento } }`),
);
const datosPersonas: Record<
  string,
  { nombre: string; sexo: 'h' | 'm' | null; nacimiento: number | null }
> = {};
// Una persona puede salir en varias filas (dos fechas de nacimiento…): se junta lo de todas.
for (const fila of filasPersonas) {
  const id = qid(fila.p!.value);
  const sexo = fila.sexo ? qid(fila.sexo.value) : null;
  const previa = datosPersonas[id];
  // En español; si no, el nombre común a todos los idiomas («mul») o el inglés.
  const nombre = fila.es?.value ?? fila.mul?.value ?? fila.en?.value;
  datosPersonas[id] = {
    nombre: previa && previa.nombre !== id ? previa.nombre : (nombre ?? id),
    sexo: previa?.sexo ?? (sexo === 'Q6581097' ? 'h' : sexo === 'Q6581072' ? 'm' : null),
    nacimiento:
      previa?.nacimiento ?? (fila.nacimiento ? Number(fila.nacimiento.value.slice(0, 4)) : null),
  };
}
const sinNombre = Object.keys(datosPersonas).filter((id) => datosPersonas[id]!.nombre === id);

// 7. Cargos en femenino si los ocupa una mujer (Wikidata los nombra en masculino) y con
// mayúscula inicial.
const FEMENINOS: [RegExp, string][] = [
  [/^rey\b/i, 'reina'],
  [/^presidente\b/i, 'presidenta'],
  [/^primer ministro\b/i, 'primera ministra'],
  [/^gobernador\b/i, 'gobernadora'],
  [/^emperador\b/i, 'emperatriz'],
  [/^jefe\b/i, 'jefa'],
  [/^secretario\b/i, 'secretaria'],
  [/^canciller\b/i, 'canciller'],
];
/**
 * Cargos que Wikidata solo nombra en inglés («monarch of Bahrain»): se traduce el cargo y el país
 * se escribe con su nombre en español.
 */
const DEL_INGLES: [RegExp, string][] = [
  [/^president of /i, 'presidente'],
  [/^prime minister of /i, 'primer ministro'],
  [/^premier of /i, 'primer ministro'],
  [/^governor of /i, 'gobernador'],
  [/^chief minister of /i, 'ministro principal'],
  [/^king of /i, 'rey'],
  [/^monarch of /i, 'monarca'],
];
const nombresPaises = leerJson<{ paises: Record<string, { nombre: string; soberano?: string }> }>(
  'public/data/paises-2010.json',
).paises;
/**
 * Algunos cargos tienen en español el nombre de su lista en Wikipedia («Anexo:Primeros ministros
 * de Letonia»): se quita el «Anexo:» y se pasa a singular.
 */
const DE_ANEXO: [RegExp, string][] = [
  [/^primeros ministros\b/i, 'primer ministro'],
  [/^presidentes\b/i, 'presidente'],
  [/^gobernadores\b/i, 'gobernador'],
  [/^reyes\b/i, 'rey'],
];
const ajustarCargo = (c: Cargo | null, pais: string): void => {
  if (!c) return;
  let texto = c.cargo;
  if (/^anexo:/i.test(texto)) {
    texto = texto.replace(/^anexo:\s*/i, '');
    for (const [patron, singular] of DE_ANEXO) texto = texto.replace(patron, singular);
  }
  const ingles = DEL_INGLES.find(([patron]) => patron.test(texto));
  if (ingles) texto = `${ingles[1]} de ${nombresPaises[pais]?.nombre ?? pais}`;
  if (datosPersonas[c.persona]?.sexo === 'm') {
    for (const [patron, femenino] of FEMENINOS) texto = texto.replace(patron, femenino);
  }
  c.cargo = texto.charAt(0).toUpperCase() + texto.slice(1);
};
for (const [id, ficha] of Object.entries(resultado)) {
  // Los dependientes comparten el jefe de Estado del soberano: se copia antes de tocarlo, y su
  // cargo es el del soberano.
  const soberano = nombresPaises[id]?.soberano;
  if (ficha.estado) ficha.estado = { ...ficha.estado };
  ajustarCargo(ficha.estado, soberano ?? id);
  if (ficha.gobierno && ficha.gobierno !== 'estado') {
    ficha.gobierno = { ...ficha.gobierno };
    ajustarCargo(ficha.gobierno, id);
  }
}

// 8. Informe y salida.
const ordenados = Object.fromEntries(
  Object.entries(resultado).sort(([a], [b]) => a.localeCompare(b)),
);
const sinEstado = Object.keys(ordenados).filter((id) => !ordenados[id]!.estado);
const sinGobierno = Object.keys(ordenados).filter(
  (id) => !ordenados[id]!.gobierno && delJuego[id]!.tipo !== 'dependiente',
);
const cuenta: Record<string, number> = {};
for (const f of Object.values(ordenados))
  if (f.regimen) cuenta[f.regimen] = (cuenta[f.regimen] ?? 0) + 1;
escribirJsonCompacto(
  'public/data/gobiernos-2010.json',
  {
    fuente: `Wikidata (CC0), cargos a ${FECHA}, con correcciones a mano en scripts/datos/manual/gobiernos-2010.json; calculado por scripts/datos/20-gobiernos.ts.`,
    fecha: FECHA,
    paises: ordenados,
    personas: Object.fromEntries(
      Object.entries(datosPersonas).sort(([a], [b]) => a.localeCompare(b)),
    ),
  },
  2,
);
console.log(`Gobiernos de ${Object.keys(ordenados).length} países y ${personas.length} personas.`);
console.log('Regímenes:', cuenta);
console.log('Sin jefe de Estado:', sinEstado.join(' ') || 'ninguno');
console.log('Sin jefe de Gobierno (no dependientes):', sinGobierno.join(' ') || 'ninguno');
console.log('Personas sin nombre:', sinNombre.join(' ') || 'ninguna');
