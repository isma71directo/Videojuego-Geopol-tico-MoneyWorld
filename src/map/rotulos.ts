/**
 * Nombres de los países sobre el mapa (tarea f4-t2). Lógica pura, con tests.
 * Cada país muestra su nombre siempre que no pise a otro ya colocado (los grandes van primero),
 * aunque el nombre sea más ancho que el país (ajuste f4-a2: Marruecos o República Checa se ven
 * con el mundo entero a la vista). Solo los países diminutos en pantalla (Hong Kong,
 * Luxemburgo…) esperan a que el jugador se acerque.
 */

/** Caja en píxeles de pantalla: [x0, y0, x1, y1]. */
export type Caja = [number, number, number, number];

export interface CandidatoRotulo {
  id: string;
  texto: string;
  /** Forma corta («Rep. Checa») que se prueba si el nombre entero no cabe. */
  textoCorto?: string;
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
/** Tamaño en pantalla (px, raíz de su área) desde el que un país muestra su nombre. */
export const TAMANO_MINIMO_NOMBRE = 6;
const INTERLINEA = 1.15;
/** Sitios que se prueban para un nombre, en este orden: centro, arriba, abajo, lados… */
const DESPLAZAMIENTOS: readonly [number, number][] = [
  [0, 0],
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

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
  /**
   * Intenta colocar unas líneas de texto en el punto del país o, si está tapado, algo más
   * arriba, abajo o a un lado (sin dejar de cubrir el punto del país).
   */
  const colocar = (candidato: CandidatoRotulo, lineas: string[], tamano: number): boolean => {
    const anchoTexto = Math.max(...lineas.map((linea) => medir(linea, tamano)));
    const altoTexto = lineas.length * tamano * INTERLINEA;
    const dx = anchoTexto * 0.35;
    const dy = altoTexto * 1.1;
    for (const [mx, my] of DESPLAZAMIENTOS) {
      const x = candidato.x + mx * dx;
      const y = candidato.y + my * dy;
      const caja: Caja = [
        x - anchoTexto / 2 - 3,
        y - altoTexto / 2 - 2,
        x + anchoTexto / 2 + 3,
        y + altoTexto / 2 + 2,
      ];
      if (caja[2] < 0 || caja[0] > ancho || caja[3] < 0 || caja[1] > alto) continue;
      if (tapadas.some((otra) => cajasSeSolapan(caja, otra))) continue;
      colocados.push({ id: candidato.id, lineas, x, y, tamano, caja });
      tapadas.push(caja);
      return true;
    }
    return false;
  };
  for (const candidato of orden) {
    if (candidato.tamanoPais < TAMANO_MINIMO_NOMBRE) continue;
    const tamano = tamanoLetra(candidato.tamanoPais);
    const mayusculas = (texto: string): string => texto.toLocaleUpperCase('es');
    // Primero el nombre entero (en dos líneas si es largo); si no cabe, la forma corta en una.
    if (colocar(candidato, partirNombre(mayusculas(candidato.texto)), tamano)) continue;
    if (candidato.textoCorto) colocar(candidato, [mayusculas(candidato.textoCorto)], tamano);
  }
  return colocados;
}
