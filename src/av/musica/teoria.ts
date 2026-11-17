/**
 * Teoría musical mínima para la música del juego (tarea f12-t3): escalas, acordes de cada grado y
 * frecuencias. Las notas se escriben como números MIDI (60 = do central, 69 = la 440 Hz).
 */

/** Intervalos (en semitonos desde la tónica) de cada modo. */
export const MODOS = {
  mayor: [0, 2, 4, 5, 7, 9, 11],
  menor: [0, 2, 3, 5, 7, 8, 10],
  dorico: [0, 2, 3, 5, 7, 9, 10],
  mixolidio: [0, 2, 4, 5, 7, 9, 10],
  lidio: [0, 2, 4, 6, 7, 9, 11],
  frigio: [0, 1, 3, 5, 7, 8, 10],
  menorArmonica: [0, 2, 3, 5, 7, 8, 11],
} as const;

export type Modo = keyof typeof MODOS;

/** Frecuencia (Hz) de una nota MIDI. */
export function frecuencia(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Clase de nota (0 = do … 11 = si). */
export function clase(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/** Clases de nota de la escala de una tónica y un modo. */
export function escala(tonica: number, modo: Modo): number[] {
  return MODOS[modo].map((intervalo) => clase(tonica + intervalo));
}

/**
 * Notas (MIDI, desde la fundamental en la octava de la tónica) del acorde de un grado de la
 * escala (1 a 7), apilando terceras de la propia escala: con séptima, cuatro notas.
 */
export function acordeDeGrado(
  tonica: number,
  modo: Modo,
  grado: number,
  septima = false,
): number[] {
  const intervalos = MODOS[modo];
  const indice = (((grado - 1) % 7) + 7) % 7;
  const notas: number[] = [];
  for (let k = 0; k < (septima ? 4 : 3); k++) {
    const i = indice + 2 * k;
    notas.push(tonica + intervalos[i % 7]! + 12 * Math.floor(i / 7));
  }
  return notas;
}

/** La nota de una clase dada más cercana a `cerca`. */
export function notaCercana(clase0: number, cerca: number): number {
  const base = cerca - clase(cerca) + clase0;
  const candidatas = [base - 12, base, base + 12];
  return candidatas.reduce((mejor, n) =>
    Math.abs(n - cerca) < Math.abs(mejor - cerca) ? n : mejor,
  );
}

/** Lleva una nota a un intervalo de alturas cambiando de octava. */
export function enRango(midi: number, minimo: number, maximo: number): number {
  let nota = midi;
  while (nota < minimo) nota += 12;
  while (nota > maximo) nota -= 12;
  return nota;
}
