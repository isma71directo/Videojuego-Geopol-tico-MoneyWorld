/**
 * Reloj del juego (tarea f11-t1, decisión del jugador e issue n.º 3: corre por horas, como en
 * Power & Revolution). Motor puro: no sabe nada de la pantalla ni del tiempo real; la interfaz le
 * dice cuántos milisegundos han pasado y él responde cuántas horas de juego tocan.
 *
 * - La hora es la local de la capital del jugador (tarea f11-t2): los días empiezan a su
 *   medianoche. Internamente, un calendario sin husos (fecha y hora «de pared»).
 * - Ritmos de la simulación (GDD, sección 5): al empezar cada día se da un paso diario; si es
 *   lunes, también uno semanal; si es día 1, uno mensual, y si es 1 de enero, uno anual.
 * - Velocidades: pausa, ×1 (una hora cada 0,5 s), ×2, ×4 y ×8 (config/tiempo.json).
 */
import config from './config/tiempo.json';

export const RITMOS = ['diario', 'semanal', 'mensual', 'anual'] as const;
export type Ritmo = (typeof RITMOS)[number];

/** Velocidades del reloj; 0 es la pausa. */
export const VELOCIDADES = [0, ...config.velocidades] as readonly number[];
export type Velocidad = number;

export const HORAS_DIA = 24;
const MS_HORA = 3_600_000;

/** Un momento de la partida: fecha («AAAA-MM-DD») y hora en punto (0 a 23), locales. */
export interface Momento {
  fecha: string;
  hora: number;
}

/** Un paso de la simulación que toca dar al empezar el día `fecha`. */
export interface Paso {
  ritmo: Ritmo;
  fecha: string;
}

/** Horas transcurridas desde el 1 de enero de 1970 hasta el momento (sin husos). */
export function horaAbsoluta(momento: Momento): number {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(momento.fecha);
  if (!partes || !Number.isInteger(momento.hora) || momento.hora < 0 || momento.hora > 23) {
    throw new Error(`Momento no válido: ${momento.fecha} ${momento.hora}`);
  }
  const ms = Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]), momento.hora);
  return Math.round(ms / MS_HORA);
}

/** El momento que corresponde a una hora absoluta. */
export function momentoDe(horas: number): Momento {
  const fecha = new Date(horas * MS_HORA);
  return { fecha: fecha.toISOString().slice(0, 10), hora: fecha.getUTCHours() };
}

/** Día de la semana de una fecha: 0 lunes … 6 domingo. */
export function diaDeLaSemana(fecha: string): number {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return (dia + 6) % 7;
}

/** Pasos que tocan al empezar el día `fecha`, de menor a mayor ritmo. */
export function pasosDelDia(fecha: string): Paso[] {
  const pasos: Paso[] = [{ ritmo: 'diario', fecha }];
  if (diaDeLaSemana(fecha) === 0) pasos.push({ ritmo: 'semanal', fecha });
  if (fecha.endsWith('-01')) pasos.push({ ritmo: 'mensual', fecha });
  if (fecha.endsWith('-01-01')) pasos.push({ ritmo: 'anual', fecha });
  return pasos;
}

/**
 * Avanza el reloj `horas` horas (entero, 0 o más). Devuelve el momento nuevo y, en orden, los
 * pasos de cada medianoche que se ha cruzado.
 */
export function avanzarHoras(momento: Momento, horas: number): { momento: Momento; pasos: Paso[] } {
  if (!Number.isInteger(horas) || horas < 0) throw new Error(`Horas no válidas: ${horas}`);
  const inicio = horaAbsoluta(momento);
  const fin = inicio + horas;
  const pasos: Paso[] = [];
  // Cada medianoche entre el inicio (sin contarlo) y el final (contándolo).
  const primerDia = Math.floor(inicio / HORAS_DIA) + 1;
  const ultimoDia = Math.floor(fin / HORAS_DIA);
  for (let dia = primerDia; dia <= ultimoDia; dia++) {
    pasos.push(...pasosDelDia(momentoDe(dia * HORAS_DIA).fecha));
  }
  return { momento: momentoDe(fin), pasos };
}

/** Milisegundos reales que dura una hora de juego a una velocidad (Infinity en pausa). */
export function msPorHora(velocidad: Velocidad): number {
  return velocidad > 0 ? config.msPorHora / velocidad : Infinity;
}

/**
 * Horas de juego que tocan tras `ms` milisegundos reales a una velocidad, con lo que sobra para
 * el siguiente fotograma. Un fotograma nunca cuenta más de `maxMsPorFotograma` (si la pantalla se
 * queda parada, el tiempo no salta de golpe).
 */
export function horasQueTocan(
  velocidad: Velocidad,
  ms: number,
  restoMs = 0,
): { horas: number; restoMs: number } {
  if (velocidad <= 0 || !(ms > 0)) return { horas: 0, restoMs: velocidad <= 0 ? 0 : restoMs };
  const total = restoMs + Math.min(ms, config.maxMsPorFotograma);
  const porHora = msPorHora(velocidad);
  const horas = Math.floor(total / porHora);
  return { horas, restoMs: total - horas * porHora };
}

/** La velocidad siguiente o anterior (para las teclas): de la pausa a ×1 y de ×8 no pasa. */
export function velocidadVecina(velocidad: Velocidad, sentido: 1 | -1): Velocidad {
  const i = VELOCIDADES.indexOf(velocidad);
  const j = Math.min(VELOCIDADES.length - 1, Math.max(0, (i < 0 ? 0 : i) + sentido));
  return VELOCIDADES[j]!;
}

export const EMPIEZA_EN_PAUSA: boolean = config.empiezaEnPausa;
