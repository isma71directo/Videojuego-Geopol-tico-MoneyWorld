/**
 * Orden de las piezas (tarea f12-t3, decisión del jugador: que no se repitan en poco tiempo).
 * Se barajan y suenan todas antes de volver a empezar; al barajar otra vez, la primera nunca es
 * la que acaba de sonar.
 */
import type { Azar } from '../../sim/azar';

export class ListaPiezas<T> {
  private pendientes: T[] = [];
  private ultima: T | null = null;

  constructor(
    private readonly piezas: readonly T[],
    private readonly azar: Azar,
  ) {
    if (piezas.length === 0) throw new Error('Una lista de piezas no puede estar vacía');
  }

  /** La siguiente pieza que suena. */
  siguiente(): T {
    if (this.pendientes.length === 0) {
      this.pendientes = this.azar.barajar(this.piezas);
      if (this.pendientes.length > 1 && this.pendientes[0] === this.ultima) {
        // La que acaba de sonar pasa al final de la ronda nueva.
        this.pendientes.push(this.pendientes.shift()!);
      }
    }
    this.ultima = this.pendientes.shift()!;
    return this.ultima;
  }
}
