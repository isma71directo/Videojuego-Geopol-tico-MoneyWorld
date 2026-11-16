/**
 * Colores de país del mapa político (tarea f4-t2 y ajustes f4-a1, f6-a1, f7-a1 y f7-a3).
 * Lógica pura, con tests.
 *
 * - Cada país lleva su color representativo, el que se le asocia al pensar en él (decisión del
 *   jugador): el de la tabla config/colores-pais.json, hecha a mano y revisable, o, para los
 *   territorios que no están en ella, el de su bandera (config/colores-banderas.json).
 * - No hay paleta cerrada (ajuste f7-a3): cada país prueba variantes de su color (más claro,
 *   más oscuro, algo más o menos vivo o con el tono un poco girado) y lleva la más cercana a su
 *   color que no se parezca a las de su entorno.
 * - Regla fija: dos países con frontera común nunca llevan colores parecidos.
 * - Después, que no haya colores casi iguales en el entorno de cada país: los países cercanos
 *   sin frontera (islas, estrechos), los vecinos de sus vecinos y los que se ven juntos con el
 *   mundo entero (a menos de 1.800 km), para que no se note la repetición (ajuste f6-a1).
 * - Después, que se parezca lo menos posible a su entorno y lo más posible a su color. Los
 *   países grandes eligen antes y les pesa más su color.
 * - Los países muy grandes no llevan tonos claros, que sobre el terreno parecen desvaídos.
 */
import { geoArea, geoCentroid, geoDistance } from 'd3-geo';
import { feature, neighbors } from 'topojson-client';
import type { MultiPolygon, Polygon } from 'geojson';
import type { TopologiaMapa } from './geometria';
import { hexDeOklch, oklabDeHex } from './rampas';
import banderas from './config/colores-banderas.json';
import tabla from './config/colores-pais.json';

/** Distancia (grados) por debajo de la cual dos países sin frontera se consideran cercanos. */
export const RADIO_CERCANOS = 2;
/** Países a menos de esta distancia entre sus centros: se ven juntos con el mundo entero. */
export const RADIO_PROXIMOS_KM = 1800;
const PESO_CERCANO = 3;
const PESO_SEGUNDO_GRADO = 1;
const PESO_TERCER_GRADO = 0.35;
const PESO_PROXIMO = 1;
const PESO_VECINO = 4;

/** Dos vecinos nunca llevan colores más cercanos que esto (OKLab): se distinguen bien. */
export const DISTANCIA_MINIMA_VECINOS = 0.1;
/** Por debajo de esto, dos colores parecen el mismo: en el entorno, solo si no queda otra. */
export const DISTANCIA_CASI_IGUAL = 0.05;
/** Hasta esta distancia, dos colores del entorno todavía «se parecen» un poco (coste suave). */
const DISTANCIA_PARECIDO = 0.15;
/** Y entre vecinos, aunque ya cumplan la regla, mejor cuanto más distintos hasta aquí. */
const DISTANCIA_VECINOS_COMODA = 0.18;

/** Superficie (km²) a partir de la cual un país es «muy grande». */
export const SUPERFICIE_GRANDE_KM2 = 1_500_000;
/** Luminosidad máxima de los países muy grandes (más claros parecen desvaídos o hielo). */
export const LUZ_MAXIMA_GRANDES = 0.72;
/** Margen de luminosidad (OKLCH) de los colores del mapa: ni casi negros ni casi blancos. */
export const LUZ_MINIMA = 0.48;
export const LUZ_MAXIMA = 0.84;
/** Croma (viveza) de los colores: van semitransparentes sobre el terreno. */
const CROMA_MINIMA = 0.09;
const CROMA_MAXIMA = 0.15;
/** Por debajo de este croma, un color es neutro (blanco, negro, gris) y no sirve. */
const CROMA_NEUTRO = 0.04;

/** Variantes que prueba cada país alrededor de cada uno de sus colores. */
const GIROS_TONO = [-20, -10, 0, 10, 20];
const CAMBIOS_LUZ = [-0.16, -0.08, 0, 0.08, 0.16];
const FACTORES_CROMA = [1, 0.8];
/** Desajuste: un punto por cada 20° de tono, por cada 0,2 de luz y por 0,08 de croma; dos por puesto. */
const GRADOS_POR_PUNTO = 20;
const LUZ_POR_PUNTO = 0.2;
const CROMA_POR_PUNTO = 0.08;
const PUNTOS_POR_PUESTO = 2;
/** Cuánto pesa alejarse del color propio frente a parecerse al entorno. */
export const PESO_PREFERENCIA = 1.5;
/** Superficie (km²) con la que la importancia de un país sube un punto (escala logarítmica). */
const SUPERFICIE_IMPORTANCIA_KM2 = 50_000;
/** Los países de la tabla (elegidos a mano) pesan más que los que usan su bandera. */
const FACTOR_TABLA = 1.5;
const REPASOS = 8;

/** Parte mínima de la bandera para que uno de sus colores cuente como preferido. */
export const PARTE_MINIMA_BANDERA = 0.08;
/** Dos colores preferidos más cercanos que esto (OKLab) cuentan como uno solo. */
const MISMO_PREFERIDO = 0.1;

type Lab = readonly [number, number, number];

const distanciaLab = (a: Lab, b: Lab): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** «#rrggbb» → [luminosidad, croma, tono en grados] (OKLCH). */
export function oklch(hex: string): [number, number, number] {
  const [l, a, b] = oklabDeHex(hex);
  return [l, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
}

/** Diferencia de tono en grados, por el camino corto (0 a 180). */
export function difTono(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/** Colores que prefiere un país, del más al menos preferido. */
export interface PreferenciaColor {
  colores: readonly string[];
  /** Si vienen de la tabla de colores representativos (elegidos a mano). */
  deTabla: boolean;
}

export interface TablaColores {
  colores: Readonly<Record<string, string>>;
  paises: Readonly<Record<string, readonly string[]>>;
}

type ColorBandera = readonly (string | number)[];

/** Un color de la tabla: su nombre («rojo», «verde azulado»…) o «#rrggbb». */
function resolver(color: string, nombres: Readonly<Record<string, string>>): string | null {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  return nombres[color] ?? null;
}

/**
 * Colores preferidos de cada país: los de la tabla (si está) y después los de su bandera que
 * ocupan una parte apreciable, de más a menos, sin blancos, negros ni grises.
 */
export function preferenciasDeColor(
  deTabla: TablaColores = tabla,
  deBanderas: Readonly<Record<string, readonly ColorBandera[]>> = banderas.paises,
): Map<string, PreferenciaColor> {
  const resultado = new Map<string, PreferenciaColor>();
  for (const id of new Set([...Object.keys(deTabla.paises), ...Object.keys(deBanderas)])) {
    const conColor = (deBanderas[id] ?? []).filter((c) => c[2] !== 'neutro');
    const grandes = conColor.filter((c) => Number(c[1]) >= PARTE_MINIMA_BANDERA);
    // Banderas casi blancas (Corea del Sur): cuentan sus colores aunque ocupen poco.
    const deBandera = (grandes.length > 0 ? grandes : conColor).map((c) => String(c[0]));
    const elegidos = (deTabla.paises[id] ?? []).map((c) => resolver(c, deTabla.colores));
    const colores: string[] = [];
    for (const color of [...elegidos, ...deBandera]) {
      if (!color || oklch(color)[1] < CROMA_NEUTRO) continue;
      const lab = oklabDeHex(color);
      if (colores.every((otro) => distanciaLab(oklabDeHex(otro), lab) >= MISMO_PREFERIDO)) {
        colores.push(color);
      }
    }
    if (colores.length > 0) resultado.set(id, { colores, deTabla: id in deTabla.paises });
  }
  return resultado;
}

/** Un color posible para un país y lo que se aleja de su color preferido. */
export interface Candidato {
  hex: string;
  lab: Lab;
  desajuste: number;
}

/** Desajuste de una variante respecto a un color preferido (0: el mismo, ya llevado al margen). */
export function desajuste(
  [l, c, h]: readonly [number, number, number],
  [lp, cp, hp]: readonly [number, number, number],
  luzMaxima = LUZ_MAXIMA,
): number {
  const luzObjetivo = Math.min(luzMaxima, Math.max(LUZ_MINIMA, lp));
  const cromaObjetivo = Math.min(CROMA_MAXIMA, Math.max(CROMA_MINIMA, cp));
  return (
    difTono(h, hp) / GRADOS_POR_PUNTO +
    Math.abs(l - luzObjetivo) / LUZ_POR_PUNTO +
    Math.abs(c - cromaObjetivo) / CROMA_POR_PUNTO
  );
}

/**
 * Variantes de color que puede llevar un país: alrededor de cada uno de sus colores preferidos,
 * con más o menos luz, más o menos viveza y el tono algo girado. Ordenadas de menor a mayor
 * desajuste.
 */
export function candidatosDeColor(preferencia: PreferenciaColor, grande = false): Candidato[] {
  const luzMaxima = grande ? LUZ_MAXIMA_GRANDES : LUZ_MAXIMA;
  const vistos = new Map<string, Candidato>();
  preferencia.colores.forEach((color, puesto) => {
    const objetivo = oklch(color);
    const [lp, cp, hp] = objetivo;
    const luzBase = Math.min(luzMaxima, Math.max(LUZ_MINIMA, lp));
    const cromaBase = Math.min(CROMA_MAXIMA, Math.max(CROMA_MINIMA, cp));
    for (const cambio of CAMBIOS_LUZ) {
      const l = Math.min(luzMaxima, Math.max(LUZ_MINIMA, luzBase + cambio));
      for (const factor of FACTORES_CROMA) {
        for (const giro of GIROS_TONO) {
          const h = (hp + giro + 360) % 360;
          const hex = hexDeOklch([l, cromaBase * factor, h]);
          // El color real puede tener menos croma si no cabía en la pantalla.
          const real = oklch(hex);
          const coste = desajuste(real, objetivo, luzMaxima) + PUNTOS_POR_PUESTO * puesto;
          const previo = vistos.get(hex);
          if (!previo || coste < previo.desajuste) {
            vistos.set(hex, { hex, lab: oklabDeHex(hex), desajuste: coste });
          }
        }
      }
    }
  });
  return [...vistos.values()].sort((a, b) => a.desajuste - b.desajuste || (a.hex < b.hex ? -1 : 1));
}

/** Entorno de cada país: índice del otro país y peso de la repetición. */
export type Entorno = readonly (readonly [number, number])[];

/**
 * Entorno de cada país, sin él ni sus vecinos directos: los países cercanos sin frontera, los
 * vecinos de sus vecinos, los próximos con el mundo entero y los del tercer grado (de más a
 * menos peso).
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

/** Importancia de un país para quedarse con su color: crece con su superficie. */
export function importancia(superficieKm2: number, deTabla: boolean): number {
  const base = 1 + Math.log10(1 + superficieKm2 / SUPERFICIE_IMPORTANCIA_KM2);
  return deTabla ? base * FACTOR_TABLA : base;
}

/** Compara dos valoraciones, criterio a criterio (menor es mejor). */
function mejorQue(a: readonly number[], b: readonly number[]): boolean {
  for (let k = 0; k < a.length; k++) {
    const margen = k === 2 ? 1e-9 : 0;
    if (a[k]! < b[k]! - margen) return true;
    if (a[k]! > b[k]! + margen) return false;
  }
  return false;
}

/**
 * Dos países de la misma zona del mapa (a menos de RADIO_REPETICION_KM) con colores más cercanos
 * que esto parecen llevar el mismo: se nota la repetición. Cuesta más cuanto más se parecen.
 * Lejos (Canadá y Turquía) no se nota, y así cada país puede llevar su color.
 */
export const DISTANCIA_REPETIDA = 0.05;
export const RADIO_REPETICION_KM = 3500;
const PESO_COLOR_REPETIDO = 3;

/**
 * Elige un color para cada país entre sus candidatos (devuelve el índice del elegido).
 * `vecinos[i]`: países con frontera común; `cercanos[i]`: cerca sin frontera; `proximos[i]`:
 * se ven juntos con el mundo entero; `pesos[i]`: importancia de su color (más alta, elige
 * antes y le pesa más). Cada candidato se valora, por este orden: que no se parezca a ningún
 * vecino, que no haya colores casi iguales cerca y, después, la suma de costes (parecido con
 * el entorno, alejarse de su color y parecerse mucho al de otro país de su zona,
 * `zona[i]`).
 * Se calcula una vez, con el script 19-colores-pais.ts, no al abrir el mapa.
 */
export function colorearPaises(
  vecinos: readonly (readonly number[])[],
  candidatos: readonly (readonly Candidato[])[],
  cercanos: readonly (readonly number[])[] = [],
  proximos: readonly (readonly number[])[] = [],
  pesos: readonly number[] = [],
  zona: readonly (readonly number[])[] = [],
): number[] {
  const n = vecinos.length;
  const zonas = vecinos.map((_, i) => Int32Array.from(zona[i] ?? []));
  const entorno = entornos(vecinos, cercanos, proximos);
  // Datos en arreglos planos: este bucle se repite decenas de millones de veces.
  const labs = candidatos.map((lista) => {
    const plano = new Float64Array(lista.length * 3);
    lista.forEach((c, k) => plano.set(c.lab, k * 3));
    return plano;
  });
  const elegido = new Int32Array(n).fill(-1);
  const actual = new Float64Array(n * 3);
  const entornoIndices = entorno.map((lista) => Int32Array.from(lista.map(([j]) => j)));
  const entornoPesos = entorno.map((lista) => Float64Array.from(lista.map(([, p]) => p)));

  const distancia = (plano: Float64Array, k: number, j: number): number => {
    const a = k * 3;
    const b = j * 3;
    return Math.hypot(
      plano[a]! - actual[b]!,
      plano[a + 1]! - actual[b + 1]!,
      plano[a + 2]! - actual[b + 2]!,
    );
  };

  /** Valora el candidato k del país i: [falta con un vecino, casi iguales, coste]. */
  const valorar = (i: number, k: number, salida: number[], cota?: readonly number[]): boolean => {
    const plano = labs[i]!;
    let falta = 0;
    let suma = PESO_PREFERENCIA * (pesos[i] ?? 1) * candidatos[i]![k]!.desajuste;
    for (const j of vecinos[i]!) {
      if (elegido[j]! < 0) continue;
      const d = distancia(plano, k, j);
      if (DISTANCIA_MINIMA_VECINOS - d > falta) falta = DISTANCIA_MINIMA_VECINOS - d;
      const p = 1 - d / DISTANCIA_VECINOS_COMODA;
      if (p > 0) suma += PESO_VECINO * p * p;
    }
    if (cota && falta > cota[0]! + 1e-12) return false;
    let casiIguales = 0;
    const indices = entornoIndices[i]!;
    const pesosEntorno = entornoPesos[i]!;
    for (let m = 0; m < indices.length; m++) {
      const j = indices[m]!;
      if (elegido[j]! < 0) continue;
      const d = distancia(plano, k, j);
      const peso = pesosEntorno[m]!;
      if (d < DISTANCIA_CASI_IGUAL && peso >= PESO_PROXIMO) casiIguales++;
      const p = 1 - d / DISTANCIA_PARECIDO;
      if (p > 0) suma += peso * p * p;
    }
    // Con los demás países de su zona del mapa: que no lleven casi el mismo color.
    const deZona = zonas[i]!;
    for (let m = 0; m < deZona.length; m++) {
      const j = deZona[m]!;
      if (elegido[j]! < 0) continue;
      const p = 1 - distancia(plano, k, j) / DISTANCIA_REPETIDA;
      if (p > 0) suma += PESO_COLOR_REPETIDO * p;
    }
    salida[0] = falta;
    salida[1] = casiIguales;
    salida[2] = suma;
    return true;
  };

  const mejor = (i: number): number => {
    let indice = 0;
    const valor = [Infinity, Infinity, Infinity];
    const prueba = [0, 0, 0];
    for (let k = 0; k < candidatos[i]!.length; k++) {
      if (!valorar(i, k, prueba, valor)) continue;
      if (mejorQue(prueba, valor)) {
        valor[0] = prueba[0]!;
        valor[1] = prueba[1]!;
        valor[2] = prueba[2]!;
        indice = k;
      }
    }
    return indice;
  };

  const asignar = (i: number, k: number): void => {
    elegido[i] = k;
    actual.set(labs[i]!.subarray(k * 3, k * 3 + 3), i * 3);
  };

  const orden = vecinos
    .map((_, i) => i)
    .sort(
      (a, b) =>
        (pesos[b] ?? 1) - (pesos[a] ?? 1) || vecinos[b]!.length - vecinos[a]!.length || a - b,
    );
  for (const i of orden) asignar(i, mejor(i));
  // Repasos: cada país cambia de color si así mejora (los demás ya tienen el suyo).
  const nuevoValor = [0, 0, 0];
  const actualValor = [0, 0, 0];
  for (let repaso = 0; repaso < REPASOS; repaso++) {
    let cambios = 0;
    for (const i of orden) {
      const nuevo = mejor(i);
      if (nuevo === elegido[i]) continue;
      valorar(i, nuevo, nuevoValor);
      valorar(i, elegido[i]!, actualValor);
      if (mejorQue(nuevoValor, actualValor)) {
        asignar(i, nuevo);
        cambios++;
      }
    }
    if (cambios === 0) break;
  }
  return [...elegido];
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

/** Color de reserva para un país sin ningún color preferido (no debería pasar). */
const SIN_PREFERENCIA: PreferenciaColor = { colores: ['#7a8aa6'], deTabla: false };

/**
 * Color de cada país del mapa, con vecinos y cercanos sacados de su geometría y sus colores
 * preferidos (por defecto, la tabla de colores representativos y las banderas).
 */
export function coloresDelMapa(
  topo: TopologiaMapa,
  preferencias: ReadonlyMap<string, PreferenciaColor> = preferenciasDeColor(),
): Map<string, string> {
  const geometrias = topo.objects.paises.geometries;
  const ids = geometrias.map((g) => String(g.id));
  const formas = feature(topo, topo.objects.paises).features.map(
    (f) => f.geometry as Polygon | MultiPolygon,
  );
  const superficies = formas.map(
    (forma) => geoArea({ type: 'Feature', properties: {}, geometry: forma }) * 6371 ** 2,
  );
  const grandes = superficies.map((km2) => km2 > SUPERFICIE_GRANDE_KM2);
  const prefs = ids.map((id) => preferencias.get(id) ?? SIN_PREFERENCIA);
  const candidatos = prefs.map((preferencia, i) => candidatosDeColor(preferencia, grandes[i]));
  const pesos = prefs.map((preferencia, i) => importancia(superficies[i]!, preferencia.deTabla));
  // Los grandes, «próximos» entre sí: se ven juntos con el mundo entero.
  const proximos = paisesProximos(formas).map((lista, i) =>
    grandes[i]
      ? [...new Set([...lista, ...grandes.flatMap((g, j) => (g && j !== i ? [j] : []))])]
      : lista,
  );
  const elegidos = colorearPaises(
    neighbors(geometrias),
    candidatos,
    paisesCercanos(formas),
    proximos,
    pesos,
    paisesProximos(formas, RADIO_REPETICION_KM),
  );
  return new Map(ids.map((id, i) => [id, candidatos[i]![elegidos[i]!]!.hex]));
}
