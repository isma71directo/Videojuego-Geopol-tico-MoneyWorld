/**
 * Descarga de un indicador del Banco Mundial (WDI), compartida por los scripts de datos
 * (02-banco-mundial.ts y 26-bm-presupuesto.ts). Primero, por el API v2 en JSON; si su servidor
 * no responde (le pasa con las consultas de todos los países), por la descarga en CSV del mismo
 * indicador, que da los mismos datos desde otro servicio.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { leerCsv } from './comun.ts';
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

/** Descarga con curl, con un minuto como mucho (con fetch, algunas peticiones se colgaban). */
function curl(url: string, salida?: string): string {
  return execFileSync(
    'curl',
    [
      '--silent',
      '--show-error',
      '--fail',
      '--location',
      '--retry',
      '1',
      '--max-time',
      '60',
      ...(salida ? ['--output', salida] : []),
      url,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
}

type Descarga = { valores: SeriePorPais; actualizadoFuente?: string };

/** Por el API v2 en JSON. */
function porApi(indicador: IndicadorBM, codigos: Set<string>): Descarga {
  const [desde, hasta] = indicador.anios ?? [2008, 2010];
  const valores: SeriePorPais = {};
  let actualizadoFuente: string | undefined;
  for (let pagina = 1; ; pagina += 1) {
    const url = `${URL_BASE_BM}/country/all/indicator/${indicador.codigo}?format=json&date=${desde}:${hasta}&per_page=2000&page=${pagina}`;
    const [meta, filas] = JSON.parse(curl(url)) as RespuestaBM;
    actualizadoFuente = meta.lastupdated;
    for (const fila of filas ?? []) {
      if (fila.value === null || !codigos.has(fila.countryiso3code)) continue;
      (valores[fila.countryiso3code] ??= {})[fila.date] = fila.value;
    }
    if (pagina >= meta.pages) break;
  }
  return { valores, actualizadoFuente };
}

/** Por la descarga en CSV (un zip con todos los países y todos los años). */
function porCsv(indicador: IndicadorBM, codigos: Set<string>): Descarga {
  const [desde, hasta] = indicador.anios ?? [2008, 2010];
  // En su propia carpeta temporal (lo descargado se trata como datos, nunca se ejecuta).
  const carpeta = mkdtempSync(join(tmpdir(), 'bm-csv-'));
  try {
    const zip = join(carpeta, 'indicador.zip');
    curl(`${URL_BASE_BM}/en/indicator/${indicador.codigo}?downloadformat=csv`, zip);
    const texto = execFileSync('unzip', ['-p', zip, 'API_*'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }).replace(/^\uFEFF/, '');
    const lineas = texto.split(/\r?\n/);
    const actualizado = /"Last Updated Date","([^"]+)"/.exec(texto)?.[1];
    const cabecera = lineas.findIndex((linea) => linea.startsWith('"Country Name"'));
    const valores: SeriePorPais = {};
    for (const fila of leerCsv(lineas.slice(cabecera).join('\n'))) {
      const codigo = fila['Country Code'];
      if (!codigo || !codigos.has(codigo)) continue;
      for (let anio = desde; anio <= hasta; anio++) {
        const valor = fila[String(anio)];
        if (valor === undefined || valor === '') continue;
        (valores[codigo] ??= {})[String(anio)] = Number(valor);
      }
    }
    return { valores, actualizadoFuente: actualizado };
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
}

/** Valores de un indicador para los países pedidos (código ISO3 del Banco Mundial → año → valor). */
export function descargarIndicadorBM(indicador: IndicadorBM, codigos: Set<string>): Descarga {
  let descarga: Descarga;
  try {
    descarga = porApi(indicador, codigos);
  } catch {
    descarga = porCsv(indicador, codigos);
  }
  // Orden estable: países y años ordenados.
  const ordenados: SeriePorPais = {};
  for (const codigo of Object.keys(descarga.valores).sort()) {
    ordenados[codigo] = Object.fromEntries(
      Object.entries(descarga.valores[codigo]!).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return { valores: ordenados, actualizadoFuente: descarga.actualizadoFuente };
}
