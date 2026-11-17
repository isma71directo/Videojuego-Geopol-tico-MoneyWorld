/**
 * Partida nueva (tarea f10-t1): el estado con el que empieza una partida el 1 de enero de 2010.
 * Motor puro, sin interfaz. Guarda lo que se elige en la pantalla «Nueva partida» y la tesorería
 * y la popularidad iniciales (provisionales, tarea f10-t2) de cada país jugable; el resto del
 * estado (sección 8 del GDD) se irá añadiendo en cada fase, y el guardado llega en la Fase 14
 * (con migraciones si cambia el formato).
 */
import type { Efecto } from './efectos';
import { avanzarHoras, HUSO_UTC, type Huso, type Paso } from './reloj';
import {
  valoresIniciales,
  type DatosParaInicio,
  type GobiernoParaInicio,
  type ValoresIniciales,
} from './valores-iniciales';

/** Versión del formato del estado de la partida (para migrar partidas guardadas). */
export const FORMATO_PARTIDA = 1;

export const FECHA_INICIO = '2010-01-01';
/** La partida empieza a medianoche (hora local de la capital del jugador, tarea f11-t1). */
export const HORA_INICIO = 0;

/** Dificultades del GDD (sección 13): sus efectos llegan en la Fase 103. */
export const DIFICULTADES = ['facil', 'normal', 'realista'] as const;
export type Dificultad = (typeof DIFICULTADES)[number];

export interface OpcionesPartida {
  paisId: string;
  dificultad: Dificultad;
  /** Eventos históricos opcionales (GDD, sección 3): activados por defecto. */
  eventosHistoricos: boolean;
  /**
   * Semilla del azar de esta partida: distinta en cada una y sin elegir (ajuste f11-a5, decisión
   * del jugador); se anota solo para poder reproducir un fallo.
   */
  semilla: number;
}

export interface Partida {
  formato: number;
  semilla: number;
  /** Fecha de la partida (AAAA-MM-DD), en la hora local de la capital del jugador. */
  fecha: string;
  /** Hora en punto (0 a 23), local de la capital del jugador (el reloj corre por horas). */
  hora: number;
  /** Huso horario de la capital del jugador el 1 de enero de 2010 (tarea f11-t2). */
  huso: Huso;
  jugador: { paisId: string; rol: 'gobierno' };
  opciones: { dificultad: Dificultad; eventosHistoricos: boolean };
  /** Estado de cada país jugable (por ahora, sus valores iniciales provisionales). */
  paises: Record<string, EstadoPais>;
  /** Efectos en curso o por empezar (tarea f13-t1): cambian los datos de los países. */
  efectos: Efecto[];
}

/** Estado de un país en la partida; crece con cada fase (GDD, sección 8). */
export type EstadoPais = ValoresIniciales;

/** Lo que el motor necesita saber de cada país para crear la partida. */
export interface PaisParaPartida {
  jugable: boolean;
  /** Datos de 2010 (paises-2010.json). */
  datos: DatosParaInicio;
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

/** Huso de un país; sin el dato (si no se ha podido cargar), UTC. */
function husoDe(paisId: string, husos: Record<string, readonly [string, number]>): Huso {
  const huso = husos[paisId];
  return huso ? { zona: huso[0], minutos: huso[1] } : { ...HUSO_UTC };
}

/**
 * Crea la partida, o lanza un error si el país no existe o no es jugable. Sin los gobiernos
 * (si no se han podido cargar), la popularidad no tiene en cuenta el líder ni el régimen.
 */
export function crearPartida(
  opciones: OpcionesPartida,
  paises: Record<string, PaisParaPartida>,
  gobiernos: Record<string, GobiernoParaInicio> = {},
  husos: Record<string, readonly [string, number]> = {},
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
    hora: HORA_INICIO,
    huso: husoDe(opciones.paisId, husos),
    jugador: { paisId: opciones.paisId, rol: 'gobierno' },
    opciones: { dificultad: opciones.dificultad, eventosHistoricos: opciones.eventosHistoricos },
    efectos: [],
    paises: Object.fromEntries(
      paisesJugables(paises).map((id) => [
        id,
        valoresIniciales(paises[id]!.datos, gobiernos[id], FECHA_INICIO),
      ]),
    ),
  };
}

/**
 * Avanza la partida `horas` horas (tarea f11-t1). Devuelve la partida con la fecha y la hora
 * nuevas y los pasos de la simulación que tocan (diarios, semanales, mensuales y anuales), que
 * los sistemas de las próximas fases irán atendiendo.
 */
export function avanzarPartida(
  partida: Partida,
  horas: number,
): { partida: Partida; pasos: Paso[] } {
  const { momento, pasos } = avanzarHoras({ fecha: partida.fecha, hora: partida.hora }, horas);
  return { partida: { ...partida, fecha: momento.fecha, hora: momento.hora }, pasos };
}
