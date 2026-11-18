/**
 * Partida nueva (tarea f10-t1): el estado con el que empieza una partida el 1 de enero de 2010.
 * Motor puro, sin interfaz. Guarda lo que se elige en la pantalla «Nueva partida» y la tesorería
 * y la popularidad iniciales (provisionales, tarea f10-t2) de cada país jugable; el resto del
 * estado (sección 8 del GDD) se irá añadiendo en cada fase; se guarda desde la Fase 14, con
 * migraciones (src/sim/guardado.ts) cada vez que cambia el formato.
 */
import type { Efecto } from './efectos';
import { economiaInicial, nivelDe, type EconomiaPais } from './economia';
import { presupuestoInicial, type PresupuestoPais } from './presupuesto';
import { mercadoInicial, type MercadoDeuda } from './deuda';
import type { PresupuestoDecidido } from './hacienda';
import type { Suceso } from './sucesos';
import { avanzarHoras, HUSO_UTC, type Huso, type Paso } from './reloj';
import {
  valoresIniciales,
  type DatosParaInicio,
  type GobiernoParaInicio,
  type ValoresIniciales,
} from './valores-iniciales';

/**
 * Versión del formato del estado de la partida. Cada vez que cambia, src/sim/guardado.ts lleva la
 * migración desde la anterior (regla 9 de CLAUDE.md):
 *  - 1: v0.11.0 a v0.13.x (sin efectos ni agenda).
 *  - 2: v0.14.0 y v0.15.x: efectos (f13-t1), agenda de sucesos (f13-t3) e identificador (f14-t1).
 *  - 3: v0.16.0: la economía de cada país (f15-t2).
 *  - 4: v0.16.1: los desequilibrios de 2010 en la economía (ajuste f15-a1).
 *  - 5: v0.17.0: el paro y la inflación en la economía (Fase 16).
 *  - 6: v0.18.0: el presupuesto de cada país (Fase 17).
 *  - 7: v0.19.0: el mercado de la deuda de cada país (Fase 18).
 *  - 8: v0.20.0 en adelante: el presupuesto en dinero y fijo hasta que se decida (Fase 19).
 */
export const FORMATO_PARTIDA = 8;

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
  /**
   * Identifica la partida en sus guardados (el guardado de cada año es de una partida). No cambia
   * al cargarla, aunque el azar se vuelva a sembrar (tarea f14-t1).
   */
  id: string;
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
  /** Sucesos programados, por orden (tarea f13-t3). */
  agenda: Suceso[];
  /** Lo que ha decidido el jugador y aún no ha usado ningún sistema (tarea f18-t3). */
  decisiones?: Record<string, string>;
  /** El presupuesto que ha mandado el jugador y aún no se ha aplicado (Fase 19). */
  presupuestoDecidido?: PresupuestoDecidido;
}

/** Estado de un país en la partida; crece con cada fase (GDD, sección 8). */
export interface EstadoPais extends ValoresIniciales {
  /** Su economía (tarea f15-t2); null si no hay datos para crearla. */
  economia: EconomiaPais | null;
  /** Su presupuesto (Fase 17); null si no hay datos para crearlo. */
  presupuesto: PresupuestoPais | null;
  /** El mercado de su deuda: prima de riesgo y rating (Fase 18); null sin presupuesto. */
  mercado: MercadoDeuda | null;
}

/** Cómo empieza un país el 1 de enero de 2010: valores iniciales, economía y presupuesto. */
function estadoInicial(
  id: string,
  pais: PaisParaPartida,
  gobierno: Parameters<typeof valoresIniciales>[1],
): EstadoPais {
  const economia = economiaInicial(pais.datos, pais.nivelRenta);
  const presupuesto = presupuestoInicial(pais.datos, nivelDe(pais.nivelRenta), economia);
  return {
    ...valoresIniciales(pais.datos, gobierno, FECHA_INICIO),
    economia,
    presupuesto,
    mercado:
      economia && presupuesto
        ? mercadoInicial(id, pais.datos, pais.region, economia, presupuesto)
        : null,
  };
}

/** Lo que el motor necesita saber de cada país para crear la partida. */
export interface PaisParaPartida {
  jugable: boolean;
  /** Datos de 2010 (paises-2010.json). */
  datos: DatosParaInicio;
  /** Nivel de renta de 2010 (para el crecimiento de su economía). */
  nivelRenta?: string | null;
  /** Región del Banco Mundial (para el contagio de las crisis de deuda, Fase 18). */
  region?: string | null;
}

export const OPCIONES_POR_DEFECTO: Omit<OpcionesPartida, 'paisId' | 'semilla'> = {
  dificultad: 'normal',
  eventosHistoricos: true,
};

/** Identificador de una partida a partir de su primera semilla (al azar en cada partida). */
export function idDePartida(semilla: number): string {
  return `p${semilla.toString(36)}`;
}

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
    id: idDePartida(opciones.semilla),
    semilla: opciones.semilla,
    fecha: FECHA_INICIO,
    hora: HORA_INICIO,
    huso: husoDe(opciones.paisId, husos),
    jugador: { paisId: opciones.paisId, rol: 'gobierno' },
    opciones: { dificultad: opciones.dificultad, eventosHistoricos: opciones.eventosHistoricos },
    efectos: [],
    agenda: [],
    paises: Object.fromEntries(
      paisesJugables(paises).map((id) => [id, estadoInicial(id, paises[id]!, gobiernos[id])]),
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
