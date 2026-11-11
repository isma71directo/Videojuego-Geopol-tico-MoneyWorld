/**
 * Utilidades comunes de los scripts de datos (GDD, sección 4).
 * Los scripts se ejecutan con Node 22 directamente sobre TypeScript.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Ruta absoluta de un archivo del repositorio, p. ej. `ruta('fuentes/datos/paises.json')`. */
export function ruta(relativa: string): string {
  return fileURLToPath(new URL(`../../../${relativa}`, import.meta.url));
}

export function leerJson<T>(relativa: string): T {
  return JSON.parse(readFileSync(ruta(relativa), 'utf8')) as T;
}

/** Escribe JSON con formato estable, para que los cambios se vean bien en GitHub. */
export function escribirJson(relativa: string, datos: unknown): void {
  escribirTexto(relativa, `${JSON.stringify(datos, null, 2)}\n`);
}

export function escribirTexto(relativa: string, texto: string | Uint8Array): void {
  const destino = ruta(relativa);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, texto);
}

const pausa = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

export interface OpcionesDescarga {
  cabeceras?: Record<string, string>;
  /** Algunos servidores rechazan identificadores de cliente propios. */
  sinAgente?: boolean;
  intentos?: number;
}

/** Identificador genérico del cliente: sin datos personales ni del proyecto. */
const AGENTE = 'script-datos-publicos/1.0';

/** Descarga con reintentos y espera creciente (también ante «demasiadas peticiones»). */
export async function descargar(url: string, opciones: OpcionesDescarga = {}): Promise<Response> {
  const intentos = opciones.intentos ?? 5;
  let ultimoError: unknown;
  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      const respuesta = await fetch(url, {
        headers: { ...(opciones.sinAgente ? {} : { 'User-Agent': AGENTE }), ...opciones.cabeceras },
        redirect: 'follow',
      });
      if (respuesta.ok) return respuesta;
      ultimoError = new Error(`HTTP ${respuesta.status} en ${url}`);
      // Un 404 no se arregla reintentando.
      if (respuesta.status === 404) break;
    } catch (error) {
      ultimoError = error;
    }
    if (intento < intentos) await pausa(1500 * 2 ** (intento - 1));
  }
  throw ultimoError;
}

export async function descargarJson<T>(url: string, opciones?: OpcionesDescarga): Promise<T> {
  return (await (await descargar(url, opciones)).json()) as T;
}

export async function descargarTexto(url: string, opciones?: OpcionesDescarga): Promise<string> {
  return (await descargar(url, opciones)).text();
}

/** Lee un CSV sencillo (con comillas dobles) y devuelve una fila por objeto. */
export function leerCsv(texto: string): Record<string, string>[] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i]!;
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else if (c !== '\r') campo += c;
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  const [cabecera, ...resto] = filas;
  if (!cabecera) return [];
  return resto
    .filter((valores) => valores.length === cabecera.length)
    .map((valores) => Object.fromEntries(cabecera.map((nombre, i) => [nombre, valores[i]!])));
}

/** Redondea a un número de cifras significativas (los datos no necesitan 15 decimales). */
export function redondear(valor: number, cifras = 6): number {
  if (valor === 0 || !Number.isFinite(valor)) return valor;
  return Number(valor.toPrecision(cifras));
}

/** Convierte un texto en número; devuelve null si está vacío o no es un número. */
export function numero(texto: string | undefined | null): number | null {
  if (texto === undefined || texto === null || texto.trim() === '') return null;
  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : null;
}
