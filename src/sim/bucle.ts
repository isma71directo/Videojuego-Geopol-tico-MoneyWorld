/**
 * Bucle del motor (tarea f12-t1): mientras el tiempo corre, cada pocos milisegundos mira cuánto
 * tiempo real ha pasado, hace avanzar el motor y manda a la pantalla lo que haya cambiado. En
 * pausa no programa nada. Los temporizadores y el envío se le dan desde fuera (el Web Worker en
 * el juego; unos falsos en las pruebas).
 */
import type { Motor, MensajeMotor, OrdenMotor } from './motor';

/** Cada cuánto mira el bucle el reloj, en milisegundos (unas 60 veces por segundo). */
export const INTERVALO_BUCLE_MS = 16;

export interface OpcionesBucle {
  enviar: (mensaje: MensajeMotor) => void;
  ahora: () => number;
  programar: (accion: () => void, ms: number) => unknown;
  cancelar: (id: unknown) => void;
}

export interface Bucle {
  atender(orden: OrdenMotor): void;
  /** ¿Hay una vuelta del bucle programada? */
  readonly enMarcha: boolean;
}

export function arrancarBucle(motor: Motor, opciones: OpcionesBucle): Bucle {
  let programado: unknown = null;
  let anterior = 0;

  const vuelta = (): void => {
    programado = null;
    const momento = opciones.ahora();
    const transcurrido = momento - anterior;
    anterior = momento;
    for (const mensaje of motor.avanzar(transcurrido)) opciones.enviar(mensaje);
    // El siguiente paso se programa después de calcular este: si un paso tarda, el siguiente
    // espera, y el tiempo del juego va más despacio en lugar de amontonar trabajo.
    if (motor.velocidad > 0 && motor.partida) {
      programado = opciones.programar(vuelta, INTERVALO_BUCLE_MS);
    }
  };

  const parar = (): void => {
    if (programado !== null) opciones.cancelar(programado);
    programado = null;
  };

  return {
    atender(orden) {
      for (const mensaje of motor.atender(orden)) opciones.enviar(mensaje);
      if (motor.velocidad > 0 && motor.partida) {
        if (programado === null) {
          anterior = opciones.ahora();
          programado = opciones.programar(vuelta, INTERVALO_BUCLE_MS);
        }
      } else {
        parar();
      }
    },
    get enMarcha() {
      return programado !== null;
    },
  };
}
