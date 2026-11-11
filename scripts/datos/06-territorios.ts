/**
 * Población de los territorios que no cubren el Banco Mundial, el FMI ni OWID
 * (Somalilandia, Chipre del Norte, Transnistria, Abjasia, Osetia del Sur, Vaticano).
 *
 * Fuente: Wikidata (propiedad «población», P1082, con su fecha), consulta actual.
 * Método: se toma el dato más cercano a 2010. Si dista más de dos años, se lleva a 2010 con
 * el crecimiento de la población del país del que el territorio forma parte (Banco Mundial)
 * y el conjunto final lo marca como estimado.
 *
 * Salida: fuentes/datos/territorios.json
 * Uso:    node scripts/datos/06-territorios.ts
 */
import { descargarJson, escribirJson, leerJson } from './lib/comun.ts';
import { hoy, leerPaises } from './lib/paises.ts';
import type { ArchivoFuente } from './lib/tipos.ts';

const ANIO = 2010;

const bm = leerJson<ArchivoFuente>('fuentes/datos/banco-mundial.json');
const fmi = leerJson<ArchivoFuente>('fuentes/datos/fmi.json');
const owid = leerJson<ArchivoFuente>('fuentes/datos/owid-energia.json');

const sinPoblacion = leerPaises().filter(
  (pais) =>
    pais.codigos.wikidata !== null &&
    !(pais.codigos.bm && bm.indicadores.poblacion!.valores[pais.codigos.bm]) &&
    !(pais.codigos.fmi && fmi.indicadores.poblacion!.valores[pais.codigos.fmi]) &&
    !(pais.codigos.owid && owid.indicadores.poblacion!.valores[pais.codigos.owid]),
);

const consulta = `
  SELECT ?item ?poblacion ?fecha WHERE {
    VALUES ?item { ${sinPoblacion.map((pais) => `wd:${pais.codigos.wikidata}`).join(' ')} }
    ?item p:P1082 ?declaracion .
    ?declaracion ps:P1082 ?poblacion ; pq:P585 ?fecha .
    FILTER NOT EXISTS { ?declaracion wikibase:rank wikibase:DeprecatedRank }
  }`;
interface Fila {
  item: { value: string };
  poblacion: { value: string };
  fecha: { value: string };
}
const respuesta = await descargarJson<{ results: { bindings: Fila[] } }>(
  `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(consulta)}`,
  { cabeceras: { Accept: 'application/sparql-results+json' } },
);

/** Población del Banco Mundial de un país en un año cualquiera (para el crecimiento). */
async function poblacionBM(codigo: string, anio: number): Promise<number | null> {
  type Respuesta = [unknown, { value: number | null }[] | null];
  const [, filas] = await descargarJson<Respuesta>(
    `https://api.worldbank.org/v2/country/${codigo}/indicator/SP.POP.TOTL?format=json&date=${anio}`,
  );
  return filas?.[0]?.value ?? null;
}

interface PoblacionTerritorio {
  valor: number;
  /** Año del dato de Wikidata. */
  anioDato: number;
  metodo: 'directo' | 'retroproyectado';
  /** País cuyo crecimiento se ha usado para llevar el dato a 2010. */
  referencia?: string;
}

const territorios: Record<string, { poblacion: PoblacionTerritorio }> = {};

for (const pais of [...sinPoblacion].sort((a, b) => a.id.localeCompare(b.id))) {
  const datos = respuesta.results.bindings
    .filter((fila) => fila.item.value.endsWith(`/${pais.codigos.wikidata}`))
    .map((fila) => ({
      anio: Number(fila.fecha.value.slice(0, 4)),
      valor: Number(fila.poblacion.value),
    }))
    // El más cercano a 2010; a igual distancia, el anterior.
    .sort((a, b) => Math.abs(a.anio - ANIO) - Math.abs(b.anio - ANIO) || a.anio - b.anio);
  const cercano = datos[0];
  if (!cercano) {
    console.warn(`Sin población en Wikidata para ${pais.nombre}`);
    continue;
  }
  if (Math.abs(cercano.anio - ANIO) <= 2) {
    territorios[pais.id] = {
      poblacion: { valor: cercano.valor, anioDato: cercano.anio, metodo: 'directo' },
    };
  } else {
    const referencia = pais.reclamadoPor;
    const [entonces, en2010] = referencia
      ? await Promise.all([poblacionBM(referencia, cercano.anio), poblacionBM(referencia, ANIO)])
      : [null, null];
    const factor = entonces && en2010 ? en2010 / entonces : 1;
    territorios[pais.id] = {
      poblacion: {
        valor: Math.round(cercano.valor * factor),
        anioDato: cercano.anio,
        metodo: 'retroproyectado',
        ...(referencia && factor !== 1 ? { referencia } : {}),
      },
    };
  }
  const p = territorios[pais.id]!.poblacion;
  console.log(
    `${pais.nombre.padEnd(20)} ${String(p.valor).padStart(9)}  (${p.metodo}, dato de ${p.anioDato})`,
  );
}

escribirJson('fuentes/datos/territorios.json', {
  fuente: 'Wikidata (población con fecha) y Banco Mundial (crecimiento del país de referencia)',
  url: 'https://query.wikidata.org',
  descargado: hoy(),
  territorios,
});
