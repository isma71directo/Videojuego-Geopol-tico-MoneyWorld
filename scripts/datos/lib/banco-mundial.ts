/**
 * Descarga de un indicador del Banco Mundial (WDI, API v2), compartida por los scripts de datos
 * (02-banco-mundial.ts y 26-bm-presupuesto.ts).
 */
import { execFileSync } from 'node:child_process';
import type { SeriePorPais } from './tipos.ts';

export interface IndicadorBM {
  codigo: string;
  descripcion: string;
  unidad: string;
  /** Años que se descargan; por defecto 2008–2010. */
  anios?: [number, number];
}

interface FilaBM {
  countryiso3code: string;
  date: string;
  value: number | null;
}
type RespuestaBM = [{ pages: number; lastupdated?: string }, FilaBM[] | null];

export const URL_BASE_BM = 'https://api.worldbank.org/v2';

/** Valores de un indicador para los países pedidos (código ISO3 del Banco Mundial → año → valor). */
export function descargarIndicadorBM(
  indicador: IndicadorBM,
  codigos: Set<string>,
): { valores: SeriePorPais; actualizadoFuente?: string } {
  const [desde, hasta] = indicador.anios ?? [2008, 2010];
  const valores: SeriePorPais = {};
  let actualizadoFuente: string | undefined;
  for (let pagina = 1; ; pagina += 1) {
    const url = `${URL_BASE_BM}/country/all/indicator/${indicador.codigo}?format=json&date=${desde}:${hasta}&per_page=2000&page=${pagina}`;
    // Con curl y un minuto como mucho: con fetch, algunas peticiones se quedaban colgadas minutos.
    const texto = execFileSync(
      'curl',
      ['--silent', '--show-error', '--fail', '--location', '--retry', '1', '--max-time', '60', url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    const [meta, filas] = JSON.parse(texto) as RespuestaBM;
    actualizadoFuente = meta.lastupdated;
    for (const fila of filas ?? []) {
      if (fila.value === null || !codigos.has(fila.countryiso3code)) continue;
      (valores[fila.countryiso3code] ??= {})[fila.date] = fila.value;
    }
    if (pagina >= meta.pages) break;
  }
  // Orden estable: países y años ordenados.
  const ordenados: SeriePorPais = {};
  for (const codigo of Object.keys(valores).sort()) {
    ordenados[codigo] = Object.fromEntries(
      Object.entries(valores[codigo]!).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return { valores: ordenados, actualizadoFuente };
}
