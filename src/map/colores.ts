/**
 * Colores de país (tarea f4-t2): cada país tiene siempre el mismo color y nunca coincide con
 * el de un vecino. Lógica pura, con tests.
 *
 * Se colorea primero a los países con más vecinos (Rusia, China…) y cada uno toma su color
 * «preferido» (derivado de su código, para que no cambie de una versión a otra) si ningún
 * vecino ya coloreado lo tiene; si no, el color libre menos usado, para que el mapa quede
 * equilibrado.
 */
import { neighbors } from 'topojson-client';
import type { TopologiaMapa } from './geometria';

/** Índice de color derivado del código del país (siempre el mismo para el mismo código). */
export function indiceEstable(id: string, numColores: number): number {
  let h = 0;
  for (const caracter of id) h = (h * 31 + caracter.charCodeAt(0)) >>> 0;
  return h % numColores;
}

/**
 * Asigna a cada país un índice de color entre 0 y `numColores − 1`.
 * `vecinos[i]` son los índices de los países que comparten frontera con `ids[i]`.
 */
export function asignarColores(
  ids: readonly string[],
  vecinos: readonly (readonly number[])[],
  numColores: number,
): number[] {
  const colores = new Array<number>(ids.length).fill(-1);
  const usos = new Array<number>(numColores).fill(0);
  const orden = ids
    .map((_, i) => i)
    .sort((a, b) => vecinos[b]!.length - vecinos[a]!.length || ids[a]!.localeCompare(ids[b]!));
  for (const i of orden) {
    const ocupados = new Set(vecinos[i]!.map((j) => colores[j]!));
    const preferido = indiceEstable(ids[i]!, numColores);
    let elegido = preferido;
    if (ocupados.has(preferido)) {
      elegido = -1;
      for (let c = 0; c < numColores; c++) {
        if (ocupados.has(c)) continue;
        if (elegido === -1 || usos[c]! < usos[elegido]!) elegido = c;
      }
      // Imposible con un mapa real y suficientes colores; los tests lo vigilan.
      if (elegido === -1) elegido = preferido;
    }
    colores[i] = elegido;
    usos[elegido]!++;
  }
  return colores;
}

/** Color de cada país del mapa, con los vecinos sacados de las fronteras compartidas. */
export function coloresDelMapa(
  topo: TopologiaMapa,
  paleta: readonly string[],
): Map<string, string> {
  const geometrias = topo.objects.paises.geometries;
  const ids = geometrias.map((g) => String(g.id));
  const indices = asignarColores(ids, neighbors(geometrias), paleta.length);
  return new Map(ids.map((id, i) => [id, paleta[indices[i]!]!]));
}
