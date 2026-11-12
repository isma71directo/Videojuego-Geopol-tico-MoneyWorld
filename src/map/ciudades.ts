/**
 * Capitales y ciudades principales del mapa (tarea f4-t3). Lógica pura, con tests.
 * Los datos salen de /public/data/ciudades-2010.json (script 13-ciudades.ts): capitales de 2010
 * y ciudades grandes de Natural Earth, con el zoom desde el que se muestra cada una.
 */
import { cajasSeSolapan, type Caja } from './rotulos';

export interface Ciudad {
  nombre: string;
  /** País según las fronteras de 2010. */
  pais: string;
  lon: number;
  lat: number;
  /** Clase de población de Natural Earth (0 a 14); solo sirve para ordenar. */
  rango: number;
  /** Zoom (escala de los mapas web) desde el que Natural Earth la muestra. */
  zoom: number;
  capital: boolean;
}

export interface ConjuntoCiudades {
  fuente: string;
  ciudades: Ciudad[];
}

/** Desde este zoom (escala web) se ven las capitales más importantes… */
export const ZOOM_PRIMERAS_CAPITALES = 3.2;
/** …y desde este, todas las capitales (si no se pisan con otros nombres). */
export const ZOOM_TODAS_CAPITALES = 4.5;
/** Las demás ciudades salen un poco más tarde que en Natural Earth, para no recargar. */
export const RETRASO_CIUDADES = 0.5;
export const ZOOM_PRIMERAS_CIUDADES = 4;

/** ¿Se dibuja esta ciudad con este zoom (escala web)? */
export function ciudadVisible(ciudad: Ciudad, z: number): boolean {
  if (ciudad.capital) {
    return z >= Math.min(Math.max(ciudad.zoom, ZOOM_PRIMERAS_CAPITALES), ZOOM_TODAS_CAPITALES);
  }
  return z >= Math.max(ciudad.zoom + RETRASO_CIUDADES, ZOOM_PRIMERAS_CIUDADES);
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
  /** El nombre va a la derecha del punto o a la izquierda si no cabía. */
  lado: 'derecha' | 'izquierda';
  cajaPunto: Caja;
  cajaTexto: Caja;
}

/** Distancia entre el punto y el nombre. */
const SEPARACION = 6;

/**
 * Coloca puntos y nombres de ciudades sin pisarse entre sí ni con lo ya ocupado: primero las
 * capitales y después las ciudades más grandes. Una ciudad sin sitio para su nombre no se dibuja.
 */
export function colocarCiudades(
  candidatos: readonly CandidatoCiudad[],
  medir: (texto: string, capital: boolean) => number,
  alturaTexto: (capital: boolean) => number,
  ancho: number,
  alto: number,
  ocupadas: readonly Caja[] = [],
): CiudadColocada[] {
  const tapadas: Caja[] = [...ocupadas];
  const colocadas: CiudadColocada[] = [];
  const orden = [...candidatos].sort(
    (a, b) =>
      Number(b.ciudad.capital) - Number(a.ciudad.capital) ||
      b.ciudad.rango - a.ciudad.rango ||
      a.ciudad.zoom - b.ciudad.zoom ||
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
    if (!libre) continue;
    const [lado, cajaTexto] = libre;
    colocadas.push({ ciudad, x, y, lado, cajaPunto, cajaTexto });
    tapadas.push(cajaPunto, cajaTexto);
  }
  return colocadas;
}

/** Separación entre el punto de una ciudad y su nombre, para dibujarlo. */
export const SEPARACION_NOMBRE = SEPARACION;
