/**
 * Capitales y ciudades principales del mapa (tarea f4-t3 y ajuste f4-a3). Lógica pura, con
 * tests. Los datos salen de /public/data/ciudades-2010.json (script 13-ciudades.ts): capitales
 * de 2010 y ciudades de más de 100 000 habitantes, con su población de 2010 (o la más cercana).
 *
 * Cuándo aparece cada ciudad depende solo de su población (ajuste f4-a3): al acercarse salen
 * primero las más pobladas, así que Zaragoza sale antes que Córdoba y esta antes que Oviedo.
 * Las capitales salen antes que una ciudad del mismo tamaño.
 */
import { cajasSeSolapan, type Caja } from './rotulos';

export interface Ciudad {
  nombre: string;
  /** País según las fronteras de 2010. */
  pais: string;
  lon: number;
  lat: number;
  capital: boolean;
  /** Habitantes (null si no hay dato). */
  poblacion: number | null;
  /** Fuente y año de la población: «WD:2010», «ONU:2010», «WD:sin-fecha» o null. */
  origenPoblacion: string | null;
  /** Clase de población de Natural Earth (0 a 14); solo para ordenar si falta la población. */
  rango: number;
}

export interface ConjuntoCiudades {
  fuente: string;
  origenesPoblacion: Record<string, string>;
  ciudades: Ciudad[];
}

/** Las capitales salen entre estos dos zooms (escala de los mapas web)… */
export const ZOOM_PRIMERAS_CAPITALES = 3.2;
export const ZOOM_TODAS_CAPITALES = 4.5;
/** …y las demás ciudades, no antes de este. */
export const ZOOM_PRIMERAS_CIUDADES = 4;
/** Una ciudad de 10 millones aparece en este zoom… */
const ZOOM_DIEZ_MILLONES = 3.2;
/** …y cada vez que la población se divide entre 10, hace falta este zoom más. */
const ZOOM_POR_DECADA = 1.8;
/** Las capitales aparecen como una ciudad este tanto más grande (en zoom). */
const VENTAJA_CAPITAL = 1.5;

/** Límite inferior de cada clase de población de Natural Earth (para ciudades sin dato). */
const POBLACION_POR_RANGO: Record<number, number> = {
  14: 1e7,
  13: 5e6,
  12: 1e6,
  11: 5e5,
  10: 2e5,
  9: 1e5,
  8: 5e4,
};

/** Población con la que se ordena y se decide el zoom (la de la clase si no hay dato). */
export function poblacionParaOrdenar(ciudad: Ciudad): number {
  return ciudad.poblacion ?? POBLACION_POR_RANGO[ciudad.rango] ?? 2e4;
}

/** Zoom (escala web) desde el que se dibuja una ciudad. */
export function zoomDeAparicion(ciudad: Ciudad): number {
  const zoom =
    ZOOM_DIEZ_MILLONES + ZOOM_POR_DECADA * Math.log10(1e7 / poblacionParaOrdenar(ciudad));
  if (ciudad.capital) {
    return Math.min(
      ZOOM_TODAS_CAPITALES,
      Math.max(ZOOM_PRIMERAS_CAPITALES, zoom - VENTAJA_CAPITAL),
    );
  }
  return Math.max(ZOOM_PRIMERAS_CIUDADES, zoom);
}

/** ¿Se dibuja esta ciudad con este zoom (escala web)? */
export function ciudadVisible(ciudad: Ciudad, z: number): boolean {
  return z >= zoomDeAparicion(ciudad);
}

export interface CandidatoCiudad {
  ciudad: Ciudad;
  /** Posición en pantalla. */
  x: number;
  y: number;
}

export interface CiudadColocada {
  ciudad: Ciudad;
  x: number;
  y: number;
  /** El nombre va a la derecha del punto, a la izquierda si no cabía, o no va (null). */
  lado: 'derecha' | 'izquierda' | null;
  cajaPunto: Caja;
  cajaTexto: Caja | null;
}

/** Distancia entre el punto y el nombre. */
const SEPARACION = 6;

/**
 * Coloca puntos y nombres de ciudades sin pisarse entre sí ni con lo ya ocupado: primero las
 * capitales y después las ciudades más grandes. Una ciudad sin sitio para su nombre no se dibuja,
 * salvo si `puntoSinNombre` (capitales): entonces queda solo su punto.
 */
export function colocarCiudades(
  candidatos: readonly CandidatoCiudad[],
  medir: (texto: string, capital: boolean) => number,
  alturaTexto: (capital: boolean) => number,
  ancho: number,
  alto: number,
  ocupadas: readonly Caja[] = [],
  puntoSinNombre = false,
): CiudadColocada[] {
  const tapadas: Caja[] = [...ocupadas];
  const colocadas: CiudadColocada[] = [];
  const orden = [...candidatos].sort(
    (a, b) =>
      Number(b.ciudad.capital) - Number(a.ciudad.capital) ||
      poblacionParaOrdenar(b.ciudad) - poblacionParaOrdenar(a.ciudad) ||
      a.ciudad.nombre.localeCompare(b.ciudad.nombre),
  );
  for (const { ciudad, x, y } of orden) {
    if (x < 0 || x > ancho || y < 0 || y > alto) continue;
    const radio = ciudad.capital ? 4 : 3;
    const cajaPunto: Caja = [x - radio, y - radio, x + radio, y + radio];
    if (tapadas.some((otra) => cajasSeSolapan(cajaPunto, otra))) continue;
    const anchoTexto = medir(ciudad.nombre, ciudad.capital);
    const mitad = alturaTexto(ciudad.capital) / 2 + 1;
    const opciones: [CiudadColocada['lado'], Caja][] = [
      ['derecha', [x + SEPARACION - 2, y - mitad, x + SEPARACION + anchoTexto + 2, y + mitad]],
      ['izquierda', [x - SEPARACION - anchoTexto - 2, y - mitad, x - SEPARACION + 2, y + mitad]],
    ];
    const libre = opciones.find(
      ([, caja]) =>
        caja[0] >= 0 && caja[2] <= ancho && !tapadas.some((otra) => cajasSeSolapan(caja, otra)),
    );
    if (!libre) {
      if (puntoSinNombre) {
        colocadas.push({ ciudad, x, y, lado: null, cajaPunto, cajaTexto: null });
        tapadas.push(cajaPunto);
      }
      continue;
    }
    const [lado, cajaTexto] = libre;
    colocadas.push({ ciudad, x, y, lado, cajaPunto, cajaTexto });
    tapadas.push(cajaPunto, cajaTexto);
  }
  return colocadas;
}

/** Separación entre el punto de una ciudad y su nombre, para dibujarlo. */
export const SEPARACION_NOMBRE = SEPARACION;

/** Distancia (px) a la que el ratón señala el punto de una ciudad. */
export const RADIO_CIUDAD_PX = 8;

/**
 * Ciudad dibujada bajo el ratón (ajuste f4-a4): la de punto más cercano a menos de
 * RADIO_CIUDAD_PX o, si no, aquella cuyo nombre está debajo. Null si no hay ninguna.
 */
export function ciudadEnPunto(
  colocadas: readonly CiudadColocada[],
  x: number,
  y: number,
): CiudadColocada | null {
  let elegida: CiudadColocada | null = null;
  let distanciaMejor = RADIO_CIUDAD_PX;
  for (const colocada of colocadas) {
    const distancia = Math.hypot(colocada.x - x, colocada.y - y);
    if (distancia <= distanciaMejor) {
      elegida = colocada;
      distanciaMejor = distancia;
    }
  }
  if (elegida) return elegida;
  return (
    colocadas.find(
      ({ cajaTexto }) =>
        cajaTexto !== null &&
        x >= cajaTexto[0] &&
        x <= cajaTexto[2] &&
        y >= cajaTexto[1] &&
        y <= cajaTexto[3],
    ) ?? null
  );
}
