/**
 * Motor de la partida (tarea f12-t1): guarda la partida y el reloj, y atiende las órdenes de la
 * pantalla. Es puro y síncrono: no sabe de hilos, de mensajes ni de temporizadores (de eso se
 * ocupan bucle.ts y el Web Worker de trabajador.ts), así que se prueba sin navegador.
 *
 * - `atender(orden)`: empezar una partida, cambiar la velocidad o terminar. Devuelve los mensajes
 *   para la pantalla (el estado nuevo).
 * - `avanzar(ms)`: han pasado `ms` milisegundos reales; avanza las horas que tocan (con el tope de
 *   cada fotograma del reloj: si un paso tarda en calcularse, el tiempo del juego va más despacio
 *   en lugar de dar saltos) y da los pasos de la simulación a los sistemas.
 */
import { avanzarPartida, type Partida } from './partida';
import { horasQueTocan, msPorHora, VELOCIDADES, type Paso, type Velocidad } from './reloj';

/** Órdenes que la pantalla manda al motor. */
export type OrdenMotor =
  | {
      tipo: 'empezar';
      partida: Partida;
      /**
       * Solo para pruebas en desarrollo: milisegundos de cálculo inútil en cada paso diario, para
       * comprobar que la pantalla no se bloquea aunque el motor vaya cargado.
       */
      cargaPruebaMs?: number;
    }
  | { tipo: 'velocidad'; velocidad: Velocidad }
  | { tipo: 'terminar' };

/** Lo que el motor cuenta a la pantalla. */
export type MensajeMotor = {
  tipo: 'estado';
  fecha: string;
  hora: number;
  /** Parte de la hora en curso que ya ha pasado (0 a 1), para mover el reloj sin saltos. */
  fraccion: number;
  velocidad: Velocidad;
};

/** Un sistema de la simulación: recibe los pasos de cada avance y cambia la partida. */
export type Sistema = (pasos: readonly Paso[], partida: Partida) => void;

export interface Motor {
  readonly partida: Partida | null;
  readonly velocidad: Velocidad;
  atender(orden: OrdenMotor): MensajeMotor[];
  avanzar(ms: number): MensajeMotor[];
}

export interface OpcionesMotor {
  /** Sistemas que atienden los pasos (llegan con las próximas fases). */
  sistemas?: Sistema[];
  /** Reloj para la carga de prueba (por defecto, Date.now). */
  ahora?: () => number;
}

/** Tope de la carga de prueba por paso diario (milisegundos). */
export const CARGA_PRUEBA_MAXIMA = 500;

export function crearMotor(opciones: OpcionesMotor = {}): Motor {
  const ahora = opciones.ahora ?? (() => Date.now());
  let partida: Partida | null = null;
  let velocidad: Velocidad = 0;
  let fraccion = 0;
  let cargaPruebaMs = 0;

  const estado = (): MensajeMotor[] =>
    partida
      ? [{ tipo: 'estado', fecha: partida.fecha, hora: partida.hora, fraccion, velocidad }]
      : [];

  /** Cálculo inútil que ocupa el hilo (solo con la carga de prueba). */
  const ocupar = (ms: number): void => {
    const fin = ahora() + ms;
    while (ahora() < fin) {
      // Nada: solo pasa el tiempo.
    }
  };

  return {
    get partida() {
      return partida;
    },
    get velocidad() {
      return velocidad;
    },
    atender(orden) {
      if (orden.tipo === 'empezar') {
        partida = orden.partida;
        velocidad = 0;
        fraccion = 0;
        cargaPruebaMs = Math.min(CARGA_PRUEBA_MAXIMA, Math.max(0, orden.cargaPruebaMs ?? 0));
        return estado();
      }
      if (orden.tipo === 'velocidad') {
        if (!VELOCIDADES.includes(orden.velocidad)) return [];
        velocidad = orden.velocidad;
        return estado();
      }
      partida = null;
      velocidad = 0;
      return [];
    },
    avanzar(ms) {
      if (!partida || velocidad === 0) return [];
      const porHora = msPorHora(velocidad);
      const { horas, restoMs } = horasQueTocan(velocidad, ms, fraccion * porHora);
      fraccion = restoMs / porHora;
      if (horas === 0) return [];
      const { partida: nueva, pasos } = avanzarPartida(partida, horas);
      partida = nueva;
      for (const sistema of opciones.sistemas ?? []) sistema(pasos, partida);
      if (cargaPruebaMs > 0) {
        for (const paso of pasos) if (paso.ritmo === 'diario') ocupar(cargaPruebaMs);
      }
      return estado();
    },
  };
}
