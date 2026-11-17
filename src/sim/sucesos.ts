/**
 * Sucesos de la partida (tarea f13-t3): lo que pasa en un momento concreto (una declaración de
 * guerra, una moción de censura, un referéndum, una crisis…). Los programan los sistemas (y el
 * modo de prueba) en la agenda de la partida; al llegar su hora, el motor avisa a la pantalla y,
 * si son importantes y la pausa automática está activada (decisión del jugador), para el tiempo
 * justo en ese momento. Motor puro, sin interfaz.
 */
import { horaAbsoluta } from './reloj';

/** De dónde viene un suceso. */
export type OrigenSuceso = 'evento' | 'guerra' | 'politica' | 'economia' | 'prueba';

export interface Suceso {
  id: string;
  /** Título y texto para el jugador (los da quien lo programa, ya traducidos). */
  titulo: string;
  texto: string;
  /** Cuándo pasa: fecha y hora locales de la capital del jugador. */
  fecha: string;
  hora: number;
  /** Los importantes paran la partida si la pausa automática está activada. */
  importante: boolean;
  origen: OrigenSuceso;
}

/** Hora absoluta de un suceso (para ordenarlos y compararlos con el reloj). */
export function horaDe(suceso: Pick<Suceso, 'fecha' | 'hora'>): number {
  return horaAbsoluta({ fecha: suceso.fecha, hora: suceso.hora });
}

/** Mete un suceso en la agenda, que queda ordenada por su momento (y por orden de llegada). */
export function programar(agenda: readonly Suceso[], suceso: Suceso): Suceso[] {
  const momento = horaDe(suceso);
  const indice = agenda.findIndex((s) => horaDe(s) > momento);
  return indice < 0
    ? [...agenda, suceso]
    : [...agenda.slice(0, indice), suceso, ...agenda.slice(indice)];
}

/** Horas que faltan hasta el siguiente suceso, o null si la agenda está vacía. */
export function horasHastaSiguiente(agenda: readonly Suceso[], ahora: number): number | null {
  const siguiente = agenda[0];
  return siguiente ? horaDe(siguiente) - ahora : null;
}
