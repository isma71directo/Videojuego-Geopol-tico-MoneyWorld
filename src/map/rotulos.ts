/**
 * Nombres de los países sobre el mapa (tarea f4-t2). Lógica pura, con tests.
 * Al alejarse solo caben los nombres de los países grandes; al acercarse van apareciendo
 * los demás. Un nombre se pone dentro de su país si cabe más o menos y no pisa a otro ya
 * colocado (los países grandes van primero). Los países pequeños que ya se ven bien (islas,
 * Luxemburgo…) llevan el nombre debajo, después de todos los demás.
 */

/** Caja en píxeles de pantalla: [x0, y0, x1, y1]. */
export type Caja = [number, number, number, number];

export interface CandidatoRotulo {
  id: string;
  texto: string;
  /** Punto de etiqueta en pantalla. */
  x: number;
  y: number;
  /** Tamaño del país en pantalla (raíz de su área, en px). */
  tamanoPais: number;
}

export interface Rotulo {
  id: string;
  lineas: string[];
  x: number;
  y: number;
  /** Tamaño de letra en px. */
  tamano: number;
  caja: Caja;
}

export const LETRA_MINIMA = 10;
export const LETRA_MAXIMA = 22;
/** Un nombre puede salirse un poco de su país, pero no mucho. */
const HOLGURA = 1.6;
/** Tamaño en pantalla (px) desde el que un país pequeño lleva el nombre debajo. */
export const TAMANO_NOMBRE_DEBAJO = 22;
const INTERLINEA = 1.15;

/** Tamaño de letra según lo grande que se ve el país. */
export function tamanoLetra(tamanoPais: number): number {
  const tamano = 7 + 0.06 * tamanoPais;
  return Math.round(Math.min(LETRA_MAXIMA, Math.max(LETRA_MINIMA, tamano)) * 2) / 2;
}

/** Los nombres largos se parten en dos líneas por el espacio más cercano a la mitad. */
export function partirNombre(texto: string): string[] {
  if (texto.length <= 14 || !texto.includes(' ')) return [texto];
  const mitad = texto.length / 2;
  let corte = -1;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] === ' ' && (corte === -1 || Math.abs(i - mitad) < Math.abs(corte - mitad))) {
      corte = i;
    }
  }
  return [texto.slice(0, corte), texto.slice(corte + 1)];
}

export function cajasSeSolapan(a: Caja, b: Caja): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

/**
 * Elige qué nombres se dibujan y dónde. `medir` da el ancho en px de un texto con un tamaño
 * de letra; `ocupadas` son zonas de la pantalla que ya están tapadas.
 */
export function colocarRotulos(
  candidatos: readonly CandidatoRotulo[],
  medir: (texto: string, tamano: number) => number,
  ancho: number,
  alto: number,
  ocupadas: readonly Caja[] = [],
): Rotulo[] {
  const colocados: Rotulo[] = [];
  const tapadas: Caja[] = [...ocupadas];
  const orden = [...candidatos].sort(
    (a, b) => b.tamanoPais - a.tamanoPais || a.id.localeCompare(b.id),
  );
  const colocar = (candidato: CandidatoRotulo, debajo: boolean): void => {
    const tamano = tamanoLetra(candidato.tamanoPais);
    const lineas = partirNombre(candidato.texto.toLocaleUpperCase('es'));
    const anchoTexto = Math.max(...lineas.map((linea) => medir(linea, tamano)));
    const altoTexto = lineas.length * tamano * INTERLINEA;
    const x = candidato.x;
    const y = debajo ? candidato.y + candidato.tamanoPais / 2 + altoTexto / 2 + 3 : candidato.y;
    const caja: Caja = [
      x - anchoTexto / 2 - 3,
      y - altoTexto / 2 - 2,
      x + anchoTexto / 2 + 3,
      y + altoTexto / 2 + 2,
    ];
    if (caja[2] < 0 || caja[0] > ancho || caja[3] < 0 || caja[1] > alto) return;
    if (tapadas.some((otra) => cajasSeSolapan(caja, otra))) return;
    colocados.push({ id: candidato.id, lineas, x, y, tamano, caja });
    tapadas.push(caja);
  };
  const pequenos: CandidatoRotulo[] = [];
  for (const candidato of orden) {
    const tamano = tamanoLetra(candidato.tamanoPais);
    const lineas = partirNombre(candidato.texto.toLocaleUpperCase('es'));
    const anchoTexto = Math.max(...lineas.map((linea) => medir(linea, tamano)));
    if (anchoTexto <= candidato.tamanoPais * HOLGURA) colocar(candidato, false);
    else if (candidato.tamanoPais >= TAMANO_NOMBRE_DEBAJO) pequenos.push(candidato);
  }
  for (const candidato of pequenos) colocar(candidato, true);
  return colocados;
}
