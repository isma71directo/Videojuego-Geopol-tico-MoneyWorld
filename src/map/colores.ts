/**
 * Colores de país (tarea f4-t2 y ajuste f4-a1): cada país tiene siempre el mismo color, nunca
 * el de un vecino y, en lo posible, tampoco el de los países de su entorno. Lógica pura, con
 * tests.
 *
 * - Regla fija: dos países con frontera común nunca comparten color.
 * - Preferencia: que no se repita el color en el entorno de cada país, es decir, entre los
 *   vecinos de sus vecinos y entre los países cercanos sin frontera (islas, estrechos: Reino
 *   Unido y Francia, Cuba y Jamaica…). Los cercanos pesan más que los vecinos de vecinos.
 * - Primero se colorea a los países con más vecinos (Rusia, China…); después se repasa el mapa
 *   unas cuantas veces cambiando el color de cada país si así hay menos repeticiones cerca.
 * - En los empates, cada país prefiere un color derivado de su código, para que no cambie de una
 *   versión a otra sin motivo, y se equilibra el uso de cada tono.
 */
import { feature, neighbors } from 'topojson-client';
import type { MultiPolygon, Polygon } from 'geojson';
import type { TopologiaMapa } from './geometria';

/** Distancia (grados) por debajo de la cual dos países sin frontera se consideran cercanos. */
export const RADIO_CERCANOS = 2;
const PESO_CERCANO = 3;
const PESO_SEGUNDO_GRADO = 1;
const REPASOS = 4;

/** Índice de color derivado del código del país (siempre el mismo para el mismo código). */
export function indiceEstable(id: string, numColores: number): number {
  let h = 0;
  for (const caracter of id) h = (h * 31 + caracter.charCodeAt(0)) >>> 0;
  return h % numColores;
}

/** Entorno de cada país: índice del otro país y peso de la repetición. */
export type Entorno = readonly (readonly [number, number])[];

/** Vecinos de vecinos y países cercanos (sin repetir ni incluir a los vecinos directos). */
export function entornos(
  vecinos: readonly (readonly number[])[],
  cercanos: readonly (readonly number[])[] = [],
): Entorno[] {
  return vecinos.map((propios, i) => {
    const directos = new Set(propios);
    const pesos = new Map<number, number>();
    for (const j of cercanos[i] ?? []) {
      if (j !== i && !directos.has(j)) pesos.set(j, PESO_CERCANO);
    }
    for (const j of propios) {
      for (const k of vecinos[j] ?? []) {
        if (k !== i && !directos.has(k) && !pesos.has(k)) pesos.set(k, PESO_SEGUNDO_GRADO);
      }
    }
    return [...pesos];
  });
}

/**
 * Asigna a cada país un índice de color entre 0 y `numColores − 1`.
 * `vecinos[i]` son los países con frontera común con `ids[i]` (nunca comparten color) y
 * `cercanos[i]`, los que están cerca sin frontera (se evita repetir con ellos).
 */
export function asignarColores(
  ids: readonly string[],
  vecinos: readonly (readonly number[])[],
  numColores: number,
  cercanos: readonly (readonly number[])[] = [],
): number[] {
  const entorno = entornos(vecinos, cercanos);
  const colores = new Array<number>(ids.length).fill(-1);
  const usos = new Array<number>(numColores).fill(0);
  const preferido = ids.map((id) => indiceEstable(id, numColores));

  /** Mejor color para el país i con lo que ya está coloreado (−1 si no hay ninguno libre). */
  const mejorColor = (i: number): number => {
    const ocupados = new Set(vecinos[i]!.map((j) => colores[j]!));
    const castigo = new Array<number>(numColores).fill(0);
    for (const [j, peso] of entorno[i]!) {
      const color = colores[j]!;
      if (color >= 0) castigo[color]! += peso;
    }
    let elegido = -1;
    let mejor: [number, number, number] = [Infinity, Infinity, Infinity];
    for (let c = 0; c < numColores; c++) {
      if (ocupados.has(c)) continue;
      // Menos repeticiones cerca; después, el tono menos usado; después, su preferido.
      const usosSinEl = usos[c]! - (colores[i] === c ? 1 : 0);
      const valor: [number, number, number] = [
        castigo[c]!,
        usosSinEl,
        (c - preferido[i]! + numColores) % numColores,
      ];
      if (
        valor[0] < mejor[0] ||
        (valor[0] === mejor[0] &&
          (valor[1] < mejor[1] || (valor[1] === mejor[1] && valor[2] < mejor[2])))
      ) {
        mejor = valor;
        elegido = c;
      }
    }
    return elegido;
  };

  const orden = ids
    .map((_, i) => i)
    .sort((a, b) => vecinos[b]!.length - vecinos[a]!.length || ids[a]!.localeCompare(ids[b]!));
  for (const i of orden) {
    // Imposible con un mapa real y suficientes colores; los tests lo vigilan.
    const elegido = mejorColor(i);
    colores[i] = elegido === -1 ? preferido[i]! : elegido;
    usos[colores[i]!]!++;
  }

  // Repasos: un país cambia de color solo si así tiene menos repeticiones en su entorno.
  const castigoDe = (i: number, c: number): number =>
    entorno[i]!.reduce((suma, [j, peso]) => suma + (colores[j] === c ? peso : 0), 0);
  for (let repaso = 0; repaso < REPASOS; repaso++) {
    let cambios = 0;
    for (const i of orden) {
      const actual = colores[i]!;
      const nuevo = mejorColor(i);
      if (nuevo === -1 || nuevo === actual) continue;
      if (castigoDe(i, nuevo) < castigoDe(i, actual)) {
        usos[actual]!--;
        usos[nuevo]!++;
        colores[i] = nuevo;
        cambios++;
      }
    }
    if (cambios === 0) break;
  }
  return colores;
}

/**
 * Países cercanos sin frontera, con una rejilla de casillas de medio `radio`: dos países son
 * cercanos si tienen algún punto del contorno en la misma casilla o en una de al lado (a menos
 * de unos `radio` grados). Es una aproximación rápida, suficiente para elegir colores.
 */
export function paisesCercanos(
  formas: readonly (Polygon | MultiPolygon)[],
  radio = RADIO_CERCANOS,
): number[][] {
  const lado = radio / 2;
  const casillas = new Map<string, Set<number>>();
  formas.forEach((forma, i) => {
    const anillos = forma.type === 'Polygon' ? forma.coordinates : forma.coordinates.flat();
    for (const anillo of anillos) {
      for (const [x, y] of anillo as [number, number][]) {
        const clave = `${Math.floor(x / lado)},${Math.floor(y / lado)}`;
        const paises = casillas.get(clave) ?? new Set<number>();
        paises.add(i);
        casillas.set(clave, paises);
      }
    }
  });
  const cerca = formas.map(() => new Set<number>());
  for (const [clave, paises] of casillas) {
    const [cx, cy] = clave.split(',').map(Number) as [number, number];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const otros = casillas.get(`${cx + dx},${cy + dy}`);
        if (!otros) continue;
        for (const i of paises) {
          for (const j of otros) if (i !== j) cerca[i]!.add(j);
        }
      }
    }
  }
  return cerca.map((conjunto) => [...conjunto].sort((a, b) => a - b));
}

/** Color de cada país del mapa, con vecinos y cercanos sacados de su geometría. */
export function coloresDelMapa(
  topo: TopologiaMapa,
  paleta: readonly string[],
): Map<string, string> {
  const geometrias = topo.objects.paises.geometries;
  const ids = geometrias.map((g) => String(g.id));
  const formas = feature(topo, topo.objects.paises).features.map(
    (f) => f.geometry as Polygon | MultiPolygon,
  );
  const indices = asignarColores(ids, neighbors(geometrias), paleta.length, paisesCercanos(formas));
  return new Map(ids.map((id, i) => [id, paleta[indices[i]!]!]));
}
