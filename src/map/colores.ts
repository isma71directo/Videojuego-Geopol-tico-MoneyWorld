/**
 * Colores de país (tarea f4-t2 y ajustes f4-a1 y f6-a1): cada país tiene siempre el mismo
 * color, nunca uno parecido al de un vecino y, en lo posible, tampoco al de los países de su
 * entorno. Lógica pura, con tests.
 *
 * - Lo que cuenta es lo que se parecen dos colores a la vista (distancia en OKLab), no solo si
 *   son el mismo: dos rojos de distinta luminosidad también «se repiten» (ajuste f6-a1).
 * - Regla fija: dos países con frontera común nunca llevan colores parecidos.
 * - Preferencia: que no se parezcan los colores en el entorno de cada país: los países cercanos
 *   sin frontera (islas, estrechos: Reino Unido y Francia, Cuba y Jamaica…), los vecinos de sus
 *   vecinos y, con menos peso, los del tercer grado, para que al ver el mundo entero no se note
 *   la repetición.
 * - Primero se colorea a los países con más vecinos (Rusia, China…); después se repasa el mapa
 *   unas cuantas veces cambiando el color de cada país si así hay menos parecidos cerca.
 * - Se equilibra el uso de cada color y, en los empates, cada país prefiere un color derivado de
 *   su código, para que no cambie de una versión a otra sin motivo.
 */
import { geoArea, geoCentroid, geoDistance } from 'd3-geo';
import { feature, neighbors } from 'topojson-client';
import type { MultiPolygon, Polygon } from 'geojson';
import type { TopologiaMapa } from './geometria';
import { distancia, oklabDeHex } from './rampas';

/** Distancia (grados) por debajo de la cual dos países sin frontera se consideran cercanos. */
export const RADIO_CERCANOS = 2;
const PESO_VECINO = 4;
const PESO_CERCANO = 3;
const PESO_SEGUNDO_GRADO = 1;
const PESO_TERCER_GRADO = 0.35;
/** Países a menos de esta distancia entre sus centros: se ven juntos con el mundo entero. */
export const RADIO_PROXIMOS_KM = 1800;
const PESO_PROXIMO = 1;
/** Cuánto pesa cada uso de un color en el resto del mapa (para repartirlos todos). */
const PESO_USO = 0.012;
const REPASOS = 6;
/**
 * Parecido entre dos colores (0: nada; 1: el mismo) a partir de su distancia en OKLab: a partir
 * de esta distancia ya no se parecen nada.
 */
export const DISTANCIA_SIN_PARECIDO = 0.16;
/**
 * Los países muy grandes (más de esta superficie, en km²) se ven todos a la vez con el mundo
 * entero: no repiten color entre ellos y evitan los tonos más claros y los azules, que en
 * superficies enormes sobre el terreno parecen desvaídos, agua o hielo.
 */
export const SUPERFICIE_GRANDE_KM2 = 1_500_000;
const LUZ_MAXIMA_GRANDES = 0.65;
const PESO_LUZ_GRANDES = 30;
/** Tonos azules (grados en OKLCH) que evitan los países muy grandes. */
const AZULES: readonly [number, number] = [195, 265];
const PESO_AZUL_GRANDES = 2;
/** Dos vecinos nunca llevan colores más parecidos que esto (distancia de unos 0,065). */
export const PARECIDO_MAXIMO_VECINOS = 0.35;

/** Parecido (0 a 1) entre cada par de colores de la paleta. */
export function parecidos(paleta: readonly string[]): number[][] {
  return paleta.map((a) =>
    paleta.map((b) => Math.max(0, 1 - distancia(a, b) / DISTANCIA_SIN_PARECIDO) ** 2),
  );
}

/** Índice de color derivado del código del país (siempre el mismo para el mismo código). */
export function indiceEstable(id: string, numColores: number): number {
  let h = 0;
  for (const caracter of id) h = (h * 31 + caracter.charCodeAt(0)) >>> 0;
  return h % numColores;
}

/** Entorno de cada país: índice del otro país y peso de la repetición. */
export type Entorno = readonly (readonly [number, number])[];

/**
 * Entorno de cada país, sin él ni sus vecinos directos: los países cercanos sin frontera, los
 * vecinos de sus vecinos y los del tercer grado (de más a menos peso).
 */
export function entornos(
  vecinos: readonly (readonly number[])[],
  cercanos: readonly (readonly number[])[] = [],
  proximos: readonly (readonly number[])[] = [],
): Entorno[] {
  return vecinos.map((propios, i) => {
    const directos = new Set(propios);
    const pesos = new Map<number, number>();
    const anadir = (k: number, peso: number): void => {
      if (k !== i && !directos.has(k) && !pesos.has(k)) pesos.set(k, peso);
    };
    for (const j of cercanos[i] ?? []) anadir(j, PESO_CERCANO);
    const segundo: number[] = [];
    for (const j of propios) {
      for (const k of vecinos[j] ?? []) {
        if (!pesos.has(k) && k !== i && !directos.has(k)) segundo.push(k);
        anadir(k, PESO_SEGUNDO_GRADO);
      }
    }
    for (const k of segundo) for (const m of vecinos[k] ?? []) anadir(m, PESO_TERCER_GRADO);
    for (const k of proximos[i] ?? []) {
      // Los del tercer grado que además están cerca pesan como próximos.
      if (pesos.get(k) === PESO_TERCER_GRADO) pesos.delete(k);
      anadir(k, PESO_PROXIMO);
    }
    return [...pesos];
  });
}

/**
 * Asigna a cada país un índice de color entre 0 y `numColores − 1`.
 * `vecinos[i]` son los países con frontera común con `ids[i]` y `cercanos[i]`, los que están
 * cerca sin frontera. `parecido[a][b]` dice cuánto se parecen dos colores (0 a 1); sin él, solo
 * se parecen los iguales. `proximos[i]` son los países que se ven cerca con el mundo entero y
 * `extra(i, c)`, un coste propio de cada país y color (p. ej. tonos claros en países enormes).
 */
export function asignarColores(
  ids: readonly string[],
  vecinos: readonly (readonly number[])[],
  numColores: number,
  cercanos: readonly (readonly number[])[] = [],
  parecido: readonly (readonly number[])[] = Array.from({ length: numColores }, (_, a) =>
    Array.from({ length: numColores }, (_, b) => (a === b ? 1 : 0)),
  ),
  proximos: readonly (readonly number[])[] = [],
  extra: (pais: number, color: number) => number = () => 0,
): number[] {
  const entorno = entornos(vecinos, cercanos, proximos);
  const colores = new Array<number>(ids.length).fill(-1);
  const usos = new Array<number>(numColores).fill(0);
  const preferido = ids.map((id) => indiceEstable(id, numColores));

  /** Coste del color c para el país i y su mayor parecido con un vecino. */
  const coste = (i: number, c: number): [number, number] => {
    let suma = 0;
    let maximoVecino = 0;
    for (const j of vecinos[i]!) {
      const otro = colores[j]!;
      if (otro < 0) continue;
      const p = parecido[c]![otro]!;
      if (p > maximoVecino) maximoVecino = p;
      suma += PESO_VECINO * p;
    }
    for (const [j, peso] of entorno[i]!) {
      const otro = colores[j]!;
      if (otro >= 0) suma += peso * parecido[c]![otro]!;
    }
    suma += PESO_USO * (usos[c]! - (colores[i] === c ? 1 : 0)) + extra(i, c);
    return [suma, maximoVecino];
  };

  /** Mejor color para el país i con lo que ya está coloreado. */
  const mejorColor = (i: number): number => {
    let elegido = -1;
    let mejor: [number, number, number] = [Infinity, Infinity, Infinity];
    for (let c = 0; c < numColores; c++) {
      const [suma, maximoVecino] = coste(i, c);
      // Primero, que no se parezca a ningún vecino; después, el menor coste; después, su
      // preferido.
      const valor: [number, number, number] = [
        maximoVecino > PARECIDO_MAXIMO_VECINOS ? maximoVecino : 0,
        suma,
        (c - preferido[i]! + numColores) % numColores,
      ];
      if (
        valor[0] < mejor[0] ||
        (valor[0] === mejor[0] &&
          (valor[1] < mejor[1] - 1e-9 ||
            (Math.abs(valor[1] - mejor[1]) <= 1e-9 && valor[2] < mejor[2])))
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
    colores[i] = mejorColor(i);
    usos[colores[i]!]!++;
  }

  // Repasos: un país cambia de color solo si así se parece menos a lo que tiene cerca.
  for (let repaso = 0; repaso < REPASOS; repaso++) {
    let cambios = 0;
    for (const i of orden) {
      const actual = colores[i]!;
      const nuevo = mejorColor(i);
      if (nuevo === actual) continue;
      const [costeNuevo, vecinoNuevo] = coste(i, nuevo);
      const [costeActual, vecinoActual] = coste(i, actual);
      const mejoraVecinos = vecinoActual > PARECIDO_MAXIMO_VECINOS && vecinoNuevo < vecinoActual;
      if (
        mejoraVecinos ||
        (vecinoNuevo <= PARECIDO_MAXIMO_VECINOS && costeNuevo < costeActual - 1e-9)
      ) {
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

/** Países cuyos centros están a menos de `radioKm` (para el entorno de la vista del mundo). */
export function paisesProximos(
  formas: readonly (Polygon | MultiPolygon)[],
  radioKm = RADIO_PROXIMOS_KM,
): number[][] {
  const centros = formas.map((forma) =>
    geoCentroid({ type: 'Feature', properties: {}, geometry: forma }),
  );
  const angulo = radioKm / 6371;
  return centros.map((a, i) =>
    centros.flatMap((b, j) => (j !== i && geoDistance(a, b) < angulo ? [j] : [])),
  );
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
  const grandes = formas.map(
    (forma) =>
      geoArea({ type: 'Feature', properties: {}, geometry: forma }) * 6371 ** 2 >
      SUPERFICIE_GRANDE_KM2,
  );
  const luz = paleta.map((color) => oklabDeHex(color)[0]);
  const azul = paleta.map((color) => {
    const [, a, b] = oklabDeHex(color);
    const tono = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    return tono >= AZULES[0] && tono <= AZULES[1];
  });
  const extra = (i: number, c: number): number =>
    grandes[i]
      ? PESO_LUZ_GRANDES * Math.max(0, luz[c]! - LUZ_MAXIMA_GRANDES) +
        (azul[c] ? PESO_AZUL_GRANDES : 0)
      : 0;
  // Los grandes, «próximos» entre sí: se ven juntos con el mundo entero.
  const proximos = paisesProximos(formas).map((lista, i) =>
    grandes[i]
      ? [...new Set([...lista, ...grandes.flatMap((g, j) => (g && j !== i ? [j] : []))])]
      : lista,
  );
  const indices = asignarColores(
    ids,
    neighbors(geometrias),
    paleta.length,
    paisesCercanos(formas),
    parecidos(paleta),
    proximos,
    extra,
  );
  return new Map(ids.map((id, i) => [id, paleta[indices[i]!]!]));
}
