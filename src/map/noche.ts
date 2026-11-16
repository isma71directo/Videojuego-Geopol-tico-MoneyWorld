/**
 * Noche y día sobre el mapa (tarea f11-t4, decisión del jugador). Cálculos puros, sin dibujar:
 *
 * - La posición del Sol (declinación y longitud del punto subsolar) para un instante, con las
 *   fórmulas aproximadas del Almanaque Astronómico (error de unas centésimas de grado, de sobra
 *   para un mapa).
 * - La altura del Sol en cada punto, y de ahí cuánta sombra lleva: ninguna de día, un degradado
 *   en el crepúsculo (de 0° a −12°) y la sombra entera de noche.
 * - Una imagen pequeña del mundo (en la proyección del mapa) con esa sombra para el Sol sobre el
 *   meridiano 0; el mapa la desplaza con la longitud del Sol, así que solo hay que rehacerla
 *   cuando cambia la declinación (unas décimas de grado al día).
 */

export interface PosicionSol {
  /** Declinación (grados): positiva en el verano del norte. En enero, unos −23°. */
  declinacion: number;
  /** Longitud (grados, −180 a 180) donde el Sol está en lo más alto. */
  longitud: number;
}

const RAD = Math.PI / 180;
/** 1 de enero de 2000 a las 12:00 UTC, en milisegundos (época J2000). */
const J2000 = Date.UTC(2000, 0, 1, 12);
const MS_DIA = 86_400_000;

/** Ángulo en grados llevado a (−180, 180]. */
function normalizar(grados: number): number {
  const g = ((((grados + 180) % 360) + 360) % 360) - 180;
  return g === -180 ? 180 : g;
}

/** Posición del Sol en un instante (milisegundos desde 1970, UTC). */
export function posicionDelSol(instante: number): PosicionSol {
  const n = (instante - J2000) / MS_DIA;
  const media = 280.46 + 0.9856474 * n;
  const anomalia = (357.528 + 0.9856003 * n) * RAD;
  const eclipticaGrados = media + 1.915 * Math.sin(anomalia) + 0.02 * Math.sin(2 * anomalia);
  const ecliptica = eclipticaGrados * RAD;
  const oblicuidad = (23.439 - 0.0000004 * n) * RAD;
  const declinacion = Math.asin(Math.sin(oblicuidad) * Math.sin(ecliptica)) / RAD;
  const ascension =
    Math.atan2(Math.cos(oblicuidad) * Math.sin(ecliptica), Math.cos(ecliptica)) / RAD;
  // Ecuación del tiempo (en grados): lo que el Sol va adelantado o atrasado sobre la hora media.
  const ecuacion = normalizar(media - ascension);
  const horasUTC = (((instante % MS_DIA) + MS_DIA) % MS_DIA) / 3_600_000;
  return { declinacion, longitud: normalizar(15 * (12 - horasUTC) - ecuacion) };
}

/** Altura del Sol (grados) en un punto, con el Sol en `sol`. */
export function alturaDelSol(latitud: number, longitud: number, sol: PosicionSol): number {
  const seno =
    Math.sin(latitud * RAD) * Math.sin(sol.declinacion * RAD) +
    Math.cos(latitud * RAD) *
      Math.cos(sol.declinacion * RAD) *
      Math.cos((longitud - sol.longitud) * RAD);
  return Math.asin(Math.max(-1, Math.min(1, seno))) / RAD;
}

/** Sombra máxima de la noche (0 a 1) y alturas del Sol donde empieza y acaba el crepúsculo. */
export const SOMBRA_NOCHE = 0.5;
export const ALTURA_ATARDECER = 1;
export const ALTURA_NOCHE = -12;

/** Cuánta sombra lleva un punto con el Sol a esa altura: 0 de día, SOMBRA_NOCHE de noche. */
export function sombraPara(altura: number): number {
  if (altura >= ALTURA_ATARDECER) return 0;
  if (altura <= ALTURA_NOCHE) return SOMBRA_NOCHE;
  const t = (ALTURA_ATARDECER - altura) / (ALTURA_ATARDECER - ALTURA_NOCHE);
  // Suave al empezar y al terminar.
  return SOMBRA_NOCHE * t * t * (3 - 2 * t);
}

/** Color de la sombra (azul noche). */
export const COLOR_NOCHE: readonly [number, number, number] = [6, 12, 34];

/**
 * Rellena una imagen RGBA de `ancho` × `alto` con la sombra de la noche para un Sol sobre el
 * meridiano 0 con esa declinación. Cada columna es una longitud (de −180° a 180°) y cada fila,
 * la latitud que da `latitudDeFila` (la proyección del mapa).
 */
export function pintarNoche(
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number,
  declinacion: number,
  latitudDeFila: (fila: number) => number,
): void {
  const sinD = Math.sin(declinacion * RAD);
  const cosD = Math.cos(declinacion * RAD);
  const cosLon = Array.from({ length: ancho }, (_, x) =>
    Math.cos((-180 + ((x + 0.5) / ancho) * 360) * RAD),
  );
  const [r, g, b] = COLOR_NOCHE;
  for (let y = 0; y < alto; y++) {
    const lat = latitudDeFila(y) * RAD;
    const a = Math.sin(lat) * sinD;
    const c = Math.cos(lat) * cosD;
    for (let x = 0; x < ancho; x++) {
      const altura = Math.asin(Math.max(-1, Math.min(1, a + c * cosLon[x]!))) / RAD;
      const i = (y * ancho + x) * 4;
      datos[i] = r;
      datos[i + 1] = g;
      datos[i + 2] = b;
      datos[i + 3] = Math.round(sombraPara(altura) * 255);
    }
  }
}
