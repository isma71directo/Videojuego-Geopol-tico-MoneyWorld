/**
 * Partida nueva (tarea f10-t1): el estado con el que empieza una partida el 1 de enero de 2010.
 * Motor puro, sin interfaz. Por ahora guarda lo que se elige en la pantalla «Nueva partida»;
 * el resto del estado (sección 8 del GDD) se irá añadiendo en cada fase, y el guardado llega en
 * la Fase 14 (con migraciones si cambia el formato).
 */

/** Versión del formato del estado de la partida (para migrar partidas guardadas). */
export const FORMATO_PARTIDA = 1;

export const FECHA_INICIO = '2010-01-01';

/** Dificultades del GDD (sección 13): sus efectos llegan en la Fase 103. */
export const DIFICULTADES = ['facil', 'normal', 'realista'] as const;
export type Dificultad = (typeof DIFICULTADES)[number];

export interface OpcionesPartida {
  paisId: string;
  dificultad: Dificultad;
  /** Eventos históricos opcionales (GDD, sección 3): activados por defecto. */
  eventosHistoricos: boolean;
  /** Semilla del azar: la misma semilla y las mismas decisiones dan la misma partida. */
  semilla: number;
}

export interface Partida {
  formato: number;
  semilla: number;
  /** Fecha de la partida (AAAA-MM-DD). */
  fecha: string;
  jugador: { paisId: string; rol: 'gobierno' };
  opciones: { dificultad: Dificultad; eventosHistoricos: boolean };
}

/** Lo que el motor necesita saber de cada país para crear la partida. */
export interface PaisParaPartida {
  jugable: boolean;
}

export const OPCIONES_POR_DEFECTO: Omit<OpcionesPartida, 'paisId' | 'semilla'> = {
  dificultad: 'normal',
  eventosHistoricos: true,
};

/** Códigos de los países jugables, en el orden en que llegan. */
export function paisesJugables(paises: Record<string, PaisParaPartida>): string[] {
  return Object.entries(paises)
    .filter(([, pais]) => pais.jugable)
    .map(([id]) => id);
}

/** Semilla nueva al azar: un entero de 1 a 999 999 999 (fácil de leer y de copiar). */
export function semillaAlAzar(azar: () => number = Math.random): number {
  return 1 + Math.floor(azar() * 999_999_999);
}

/**
 * Semilla a partir de lo que escribe el jugador: un número tal cual (entero positivo) o, si es
 * una palabra, un número calculado a partir de ella («España» da siempre la misma semilla).
 * null si no hay nada escrito.
 */
export function semillaDeTexto(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === '') return null;
  if (/^\d{1,15}$/.test(limpio)) {
    const numero = Number(limpio);
    return numero > 0 && Number.isSafeInteger(numero) ? numero : null;
  }
  // FNV-1a de 32 bits, sin el 0.
  let h = 2166136261;
  for (const caracter of limpio) {
    h ^= caracter.codePointAt(0)!;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h === 0 ? 1 : h;
}

/** Crea la partida, o lanza un error si el país no existe o no es jugable. */
export function crearPartida(
  opciones: OpcionesPartida,
  paises: Record<string, PaisParaPartida>,
): Partida {
  const pais = paises[opciones.paisId];
  if (!pais) throw new Error(`No existe el país ${opciones.paisId}`);
  if (!pais.jugable) throw new Error(`${opciones.paisId} no es jugable`);
  if (!DIFICULTADES.includes(opciones.dificultad)) {
    throw new Error(`Dificultad desconocida: ${opciones.dificultad}`);
  }
  if (!Number.isSafeInteger(opciones.semilla) || opciones.semilla <= 0) {
    throw new Error(`Semilla no válida: ${opciones.semilla}`);
  }
  return {
    formato: FORMATO_PARTIDA,
    semilla: opciones.semilla,
    fecha: FECHA_INICIO,
    jugador: { paisId: opciones.paisId, rol: 'gobierno' },
    opciones: { dificultad: opciones.dificultad, eventosHistoricos: opciones.eventosHistoricos },
  };
}
