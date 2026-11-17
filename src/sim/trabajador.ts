/**
 * Web Worker del motor (tarea f12-t1): la simulación corre aquí, en otro hilo, para que la
 * pantalla nunca se bloquee aunque calcular un paso lleve tiempo. Solo une el motor y su bucle
 * con los mensajes del navegador; la lógica está en motor.ts y bucle.ts.
 */
import { arrancarBucle } from './bucle';
import { crearMotor, type MensajeMotor, type OrdenMotor } from './motor';
import { sistemaAlertas } from './alertas';
import { sistemaEconomia } from './economia';

/** Lo que se usa del ámbito del worker (sin depender de los tipos de la ventana). */
const ambito = self as unknown as {
  postMessage(mensaje: MensajeMotor): void;
  onmessage: ((evento: MessageEvent<OrdenMotor>) => void) | null;
};

// Los sistemas de la simulación (tarea f15-t2: la economía; f16-t4: sus alertas, después).
const sistemas = [sistemaEconomia, sistemaAlertas];
const bucle = arrancarBucle(crearMotor({ ahora: () => performance.now(), sistemas }), {
  enviar: (mensaje) => ambito.postMessage(mensaje),
  ahora: () => performance.now(),
  programar: (accion, ms) => setTimeout(accion, ms),
  cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
});

ambito.onmessage = (evento) => bucle.atender(evento.data);
