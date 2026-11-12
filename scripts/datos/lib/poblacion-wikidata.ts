/**
 * Población de Wikidata (CC0, propiedad P1082) de una lista de lugares, y elección de la de un
 * año o la de la fecha más cercana. La usan las ciudades (13-ciudades.ts) y las regiones
 * (14-regiones.ts).
 */
import { descargarJson } from './comun.ts';

export interface Declaracion {
  valor: number;
  /** Fecha del dato (AAAA-MM-DD) o null si no la tiene. */
  fecha: string | null;
  preferida: boolean;
}

interface FilaPoblacion {
  lugar: { value: string };
  valor: { value: string };
  fecha?: { value: string };
  rango: { value: string };
}

/** Todas las declaraciones de población (no obsoletas) de cada identificador, por lotes. */
export async function consultarPoblaciones(
  qids: readonly string[],
): Promise<Map<string, Declaracion[]>> {
  const declaraciones = new Map<string, Declaracion[]>();
  const validos = [...new Set(qids.filter((q) => /^Q\d+$/.test(q)))];
  for (let i = 0; i < validos.length; i += 200) {
    const lote = validos.slice(i, i + 200);
    const consulta = `SELECT ?lugar ?valor ?fecha ?rango WHERE {
      VALUES ?lugar { ${lote.map((q) => `wd:${q}`).join(' ')} }
      ?lugar p:P1082 ?declaracion .
      ?declaracion ps:P1082 ?valor ; wikibase:rank ?rango .
      OPTIONAL { ?declaracion pq:P585 ?fecha }
    }`;
    const filas = (
      await descargarJson<{ results: { bindings: FilaPoblacion[] } }>(
        `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(consulta)}`,
        { cabeceras: { Accept: 'application/sparql-results+json' } },
      )
    ).results.bindings;
    for (const fila of filas) {
      if (fila.rango.value.endsWith('DeprecatedRank')) continue;
      const qid = fila.lugar.value.split('/').pop()!;
      const fecha =
        fila.fecha && /^\d{4}-\d{2}-\d{2}/.test(fila.fecha.value)
          ? fila.fecha.value.slice(0, 10)
          : null;
      const lista = declaraciones.get(qid) ?? [];
      lista.push({
        valor: Math.round(Number(fila.valor.value)),
        fecha,
        preferida: fila.rango.value.endsWith('PreferredRank'),
      });
      declaraciones.set(qid, lista);
    }
    // Una pausa corta entre lotes, por cortesía con el servicio.
    await new Promise((resolver) => setTimeout(resolver, 300));
  }
  return declaraciones;
}

/**
 * La población de `anio` o la de la fecha más cercana. En empate gana la anterior a ese año, la
 * preferida, la de fecha más reciente y, por último, la mayor: así el resultado no depende del
 * orden en que Wikidata devuelve los datos. Null si no hay ninguna con fecha.
 */
export function elegirPoblacion(
  lista: readonly Declaracion[],
  anio: number,
): { valor: number; anio: number } | null {
  const conFecha = lista.filter((d) => d.fecha !== null && d.valor > 0);
  if (conFecha.length === 0) return null;
  const anioDe = (d: Declaracion): number => Number(d.fecha!.slice(0, 4));
  const [mejor] = [...conFecha].sort(
    (a, b) =>
      Math.abs(anioDe(a) - anio) - Math.abs(anioDe(b) - anio) ||
      Number(anioDe(a) > anio) - Number(anioDe(b) > anio) ||
      Number(b.preferida) - Number(a.preferida) ||
      b.fecha!.localeCompare(a.fecha!) ||
      b.valor - a.valor,
  );
  return { valor: mejor!.valor, anio: anioDe(mejor!) };
}

/** Población sin fecha (la preferida o, si no, la mayor), para cuando no hay ninguna con fecha. */
export function poblacionSinFecha(lista: readonly Declaracion[]): number | null {
  const sinFecha = lista.filter((d) => d.valor > 0);
  if (sinFecha.length === 0) return null;
  const [mejor] = [...sinFecha].sort(
    (a, b) => Number(b.preferida) - Number(a.preferida) || b.valor - a.valor,
  );
  return mejor!.valor;
}
