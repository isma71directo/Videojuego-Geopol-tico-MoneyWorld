/**
 * Noche y día sobre el mapa (tarea f11-t4 y ajuste f11-a1, decisiones del jugador). Cálculos
 * puros, sin dibujar.
 *
 * - Un «Sol del juego», sin estaciones (como en el equinoccio): en la capital del jugador anochece
 *   a las 20:00 y amanece a las 7:00 todo el año, en su hora local. El resto del mundo se oscurece
 *   según su longitud (y un poco según su latitud, para que la sombra tenga forma de globo).
 * - La altura de ese Sol en cada punto, y de ahí cuánta sombra lleva: ninguna de día, un
 *   degradado en el crepúsculo y la sombra entera de noche.
 * - Una imagen pequeña del mundo (en la proyección del mapa) con esa sombra para el Sol sobre el
 *   meridiano 0; el mapa la desplaza con la longitud del Sol, así que se hace una sola vez.
 */

/** Horas (locales de la capital del jugador) a las que amanece y anochece todo el año. */
export const AMANECER = 7;
export const ANOCHECER = 20;

export interface SolDelJuego {
  /** Declinación (grados): 0, sin estaciones. */
  declinacion: number;
  /** Longitud (grados, −180 a 180) donde el Sol está en lo más alto. */
  longitud: number;
  /** Altura del Sol (grados) a la que la sombra va por la mitad: la del anochecer en la capital. */
  umbral: number;
}

const RAD = Math.PI / 180;

/** Ángulo en grados llevado a (−180, 180]. */
function normalizar(grados: number): number {
  const g = ((((grados + 180) % 360) + 360) % 360) - 180;
  return g === -180 ? 180 : g;
}

/**
 * El Sol del juego a una hora local (con decimales) en la capital del jugador: está sobre ella a
 * mediodía del juego (entre el amanecer y el anochecer, las 13:30) y se mueve 15° por hora hacia
 * el oeste. El umbral es la altura que tiene el Sol en la capital a las 20:00 y a las 7:00.
 */
export function solDelJuego(horaLocal: number, capital: { lat: number; lon: number }): SolDelJuego {
  const mediodia = (AMANECER + ANOCHECER) / 2;
  const anguloOcaso = ((ANOCHECER - AMANECER) / 2) * 15;
  return {
    declinacion: 0,
    longitud: normalizar(capital.lon - (horaLocal - mediodia) * 15),
    umbral: Math.asin(Math.cos(capital.lat * RAD) * Math.cos(anguloOcaso * RAD)) / RAD,
  };
}

/** Altura del Sol (grados) en un punto, con el Sol en `sol`. */
export function alturaDelSol(
  latitud: number,
  longitud: number,
  sol: Pick<SolDelJuego, 'declinacion' | 'longitud'>,
): number {
  const seno =
    Math.sin(latitud * RAD) * Math.sin(sol.declinacion * RAD) +
    Math.cos(latitud * RAD) *
      Math.cos(sol.declinacion * RAD) *
      Math.cos((longitud - sol.longitud) * RAD);
  return Math.asin(Math.max(-1, Math.min(1, seno))) / RAD;
}

/** Sombra máxima de la noche (0 a 1). */
export const SOMBRA_NOCHE = 0.5;
/**
 * Medio ancho del crepúsculo (grados de altura del Sol) a cada lado del umbral: en una capital
 * de latitud media, unos 20 minutos antes y después de las 20:00 y de las 7:00.
 */
export const CREPUSCULO = 4;

/** Cuánta sombra lleva un punto con el Sol a esa altura: 0 de día, SOMBRA_NOCHE de noche. */
export function sombraPara(altura: number, umbral: number): number {
  if (altura >= umbral + CREPUSCULO) return 0;
  if (altura <= umbral - CREPUSCULO) return SOMBRA_NOCHE;
  const t = (umbral + CREPUSCULO - altura) / (2 * CREPUSCULO);
  // Suave al empezar y al terminar.
  return SOMBRA_NOCHE * t * t * (3 - 2 * t);
}

/** Color de la sombra (azul noche). */
export const COLOR_NOCHE: readonly [number, number, number] = [6, 12, 34];

/**
 * Rellena una imagen RGBA de `ancho` × `alto` con la sombra de la noche para un Sol sobre el
 * meridiano 0. Cada columna es una longitud (de −180° a 180°) y cada fila, la latitud que da
 * `latitudDeFila` (la proyección del mapa).
 */
export function pintarNoche(
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number,
  sol: Pick<SolDelJuego, 'declinacion' | 'umbral'>,
  latitudDeFila: (fila: number) => number,
): void {
  const sinD = Math.sin(sol.declinacion * RAD);
  const cosD = Math.cos(sol.declinacion * RAD);
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
      datos[i + 3] = Math.round(sombraPara(altura, sol.umbral) * 255);
    }
  }
}
