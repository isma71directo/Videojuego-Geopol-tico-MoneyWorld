/**
 * Proyección del mapa de juego: Miller, rectangular y a pantalla completa (decisión del
 * jugador, GDD sección 13). Las coordenadas «de mundo» van de 0 a ANCHO_MUNDO en horizontal
 * (de 180° O a 180° E) y de 0 a ALTO_MUNDO en vertical (de LATITUD_NORTE a LATITUD_SUR).
 */
import { geoProjection, type GeoProjection, type GeoRawProjection } from 'd3-geo';

export const ANCHO_MUNDO = 1024;
/** Límites del mapa: se recorta la Antártida y el Ártico sin tierra, como en los juegos de estrategia. */
export const LATITUD_NORTE = 84;
export const LATITUD_SUR = -60;

/** Proyección de Miller (1942): una Mercator suavizada, con los polos menos estirados. */
export const millerCruda: GeoRawProjection = Object.assign(
  (lambda: number, phi: number): [number, number] => [
    lambda,
    1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * phi)),
  ],
  {
    invert: (x: number, y: number): [number, number] => [
      x,
      2.5 * Math.atan(Math.exp(0.8 * y)) - 0.625 * Math.PI,
    ],
  },
);

const ESCALA = ANCHO_MUNDO / (2 * Math.PI);
const yCruda = (latitud: number): number => millerCruda(0, (latitud * Math.PI) / 180)[1];

export const ALTO_MUNDO = ESCALA * (yCruda(LATITUD_NORTE) - yCruda(LATITUD_SUR));

/** Proyección Miller ajustada a las coordenadas de mundo y recortada a los límites del mapa. */
export function crearProyeccion(): GeoProjection {
  return geoProjection(millerCruda)
    .scale(ESCALA)
    .translate([ANCHO_MUNDO / 2, ESCALA * yCruda(LATITUD_NORTE)])
    .clipExtent([
      [0, 0],
      [ANCHO_MUNDO, ALTO_MUNDO],
    ]);
}
