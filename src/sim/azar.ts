/**
 * Azar de la partida (tarea f12-t2, decisión del jugador). Un generador propio, rápido y de buena
 * calidad (xoshiro128**), que usarán la economía, la IA de los países y los eventos.
 *
 * - Cada partida nueva lo siembra con su propia semilla, distinta cada vez: la IA de los otros
 *   países puede repetir alguna decisión, pero el conjunto de lo que pasa en todos (acuerdos,
 *   alianzas, economías, partidos, guerras…) hace prácticamente imposible que dos partidas sean
 *   iguales, y las decisiones del jugador no tienen siempre la misma consecuencia.
 * - Al cargar una partida guardada (Fase 14) se vuelve a sembrar con una semilla nueva: repetir lo
 *   mismo desde un punto anterior puede dar el mismo resultado o no.
 * - La semilla se anota por dentro solo para los tests y para reproducir un fallo: con la misma
 *   semilla, el generador da siempre la misma serie.
 */

/** Estado del generador: cuatro números de 32 bits. */
export type EstadoAzar = [number, number, number, number];

export interface Azar {
  /** Número al azar en [0, 1). */
  siguiente(): number;
  /** Entero al azar entre `min` y `max`, los dos incluidos. */
  entero(min: number, max: number): number;
  /** Verdadero con probabilidad `p` (0 a 1). */
  probabilidad(p: number): boolean;
  /** Un elemento al azar de una lista que no esté vacía. */
  elegir<T>(lista: readonly T[]): T;
  /** Copia de la lista en otro orden al azar. */
  barajar<T>(lista: readonly T[]): T[];
  /** Número con distribución normal (campana) de media y desviación dadas. */
  normal(media?: number, desviacion?: number): number;
  /** Estado actual (para seguir la misma serie en otro sitio, como el worker). */
  estado(): EstadoAzar;
}

/** SplitMix32: reparte una semilla de 32 bits en un estado bien mezclado. */
function mezclar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

const rotar = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

/** Generador a partir de su estado (los cuatro números no pueden ser todos cero). */
export function azarDesde(estado: EstadoAzar): Azar {
  let [a, b, c, d] = estado.map((n) => n >>> 0) as EstadoAzar;
  if ((a | b | c | d) === 0) {
    // Con todo a cero el generador se atascaría: se llena con números bien mezclados.
    const mezcla = mezclar(0);
    [a, b, c, d] = [mezcla(), mezcla(), mezcla(), mezcla()];
  }
  let normalGuardada: number | null = null;

  /** Siguiente número de 32 bits (xoshiro128**). */
  const siguiente32 = (): number => {
    const resultado = Math.imul(rotar(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
    const t = (b << 9) >>> 0;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rotar(d, 11);
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    return resultado;
  };

  const azar: Azar = {
    siguiente: () => siguiente32() / 4_294_967_296,
    entero(min, max) {
      const bajo = Math.ceil(min);
      const alto = Math.floor(max);
      if (alto < bajo) throw new Error(`Intervalo vacío: ${min}..${max}`);
      return bajo + Math.floor(azar.siguiente() * (alto - bajo + 1));
    },
    probabilidad: (p) => azar.siguiente() < p,
    elegir(lista) {
      if (lista.length === 0) throw new Error('No se puede elegir de una lista vacía');
      return lista[Math.floor(azar.siguiente() * lista.length)]!;
    },
    barajar(lista) {
      const copia = [...lista];
      for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(azar.siguiente() * (i + 1));
        [copia[i], copia[j]] = [copia[j]!, copia[i]!];
      }
      return copia;
    },
    normal(media = 0, desviacion = 1) {
      // Box-Muller: cada dos números uniformes dan dos normales; la segunda se guarda.
      if (normalGuardada !== null) {
        const n = normalGuardada;
        normalGuardada = null;
        return media + desviacion * n;
      }
      const u = 1 - azar.siguiente();
      const v = azar.siguiente();
      const radio = Math.sqrt(-2 * Math.log(u));
      normalGuardada = radio * Math.sin(2 * Math.PI * v);
      return media + desviacion * radio * Math.cos(2 * Math.PI * v);
    },
    estado: () => [a, b, c, d],
  };
  return azar;
}

/** Generador sembrado con una semilla: la misma semilla da siempre la misma serie. */
export function crearAzar(semilla: number): Azar {
  const siguiente = mezclar(semilla);
  return azarDesde([siguiente(), siguiente(), siguiente(), siguiente()]);
}

/**
 * Semilla nueva de verdad al azar (la del navegador o la del sistema), para una partida nueva o
 * para volver a sembrar al cargar. Entre 1 y 2^32 − 1.
 */
export function semillaNueva(): number {
  const valores = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(valores);
  } else {
    valores[0] = Math.floor(Math.random() * 4_294_967_296);
  }
  return valores[0]! || 1;
}
