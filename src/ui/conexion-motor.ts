/**
 * Conexión de la pantalla con el motor (tarea f12-t1). En el juego, el motor corre en un Web
 * Worker (otro hilo) y se habla con él por mensajes. Donde no hay workers (las pruebas) corre en
 * este mismo hilo con el mismo bucle, y los mensajes llegan igual de tarde (en otra tarea), así
 * que la pantalla no nota la diferencia.
 */
import { arrancarBucle } from '../sim/bucle';
import { crearMotor, type MensajeMotor, type OrdenMotor } from '../sim/motor';
import { sistemaAlertas } from '../sim/alertas';
import { sistemaEconomia } from '../sim/economia';

export interface ConexionMotor {
  enviar(orden: OrdenMotor): void;
  /** Lo que llega del motor. */
  alRecibir: ((mensaje: MensajeMotor) => void) | null;
  /** Cierra el worker (o para el bucle local). */
  cerrar(): void;
  /** ¿Corre en otro hilo? */
  readonly enOtroHilo: boolean;
}

export interface OpcionesConexion {
  /** Sin worker, en este mismo hilo (pruebas o navegadores sin workers). */
  sinTrabajador?: boolean;
}

export function conectarMotor(opciones: OpcionesConexion = {}): ConexionMotor {
  let cerrado = false;
  if (!opciones.sinTrabajador && typeof Worker !== 'undefined') {
    const trabajador = new Worker(new URL('../sim/trabajador.ts', import.meta.url), {
      type: 'module',
    });
    const conexion: ConexionMotor = {
      enviar: (orden) => {
        if (!cerrado) trabajador.postMessage(orden);
      },
      alRecibir: null,
      cerrar: () => {
        cerrado = true;
        trabajador.terminate();
      },
      enOtroHilo: true,
    };
    trabajador.addEventListener('message', (evento: MessageEvent<MensajeMotor>) => {
      if (!cerrado) conexion.alRecibir?.(evento.data);
    });
    return conexion;
  }

  // En este mismo hilo.
  const conexion: ConexionMotor = {
    enviar: (orden) => {
      if (!cerrado) bucle.atender(orden);
    },
    alRecibir: null,
    cerrar: () => {
      cerrado = true;
      bucle.atender({ tipo: 'terminar' });
    },
    enOtroHilo: false,
  };
  const bucle = arrancarBucle(crearMotor({ sistemas: [sistemaEconomia, sistemaAlertas] }), {
    // Como con un worker, el mensaje llega después, no en mitad de la orden.
    enviar: (mensaje) =>
      queueMicrotask(() => {
        if (!cerrado) conexion.alRecibir?.(mensaje);
      }),
    ahora: () => performance.now(),
    programar: (accion, ms) => setTimeout(accion, ms),
    cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  });
  return conexion;
}
