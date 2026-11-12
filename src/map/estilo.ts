/**
 * Estilo visual del mapa (tareas audiovisuales de las Fases 3 y 4): océano, agua, bordes y una
 * paleta de colores de país suaves que combinan con el relieve. Qué color lleva cada país lo
 * decide colores.ts (siempre el mismo y nunca el de un vecino).
 */
import type { Estilo } from './mapa';

/**
 * Tonos de mapa político, apagados para el tema oscuro y para que se lea el relieve.
 * Doce tonos bien distintos entre sí (ajuste f4-a1: el jugador pidió más colores).
 */
export const PALETA = [
  '#6f8fb5', // azul
  '#7fa66b', // verde
  '#cc9459', // ocre
  '#9b7fb8', // violeta
  '#4fae96', // turquesa
  '#b86b6b', // teja
  '#a9ae5c', // oliva
  '#c587a5', // rosa
  '#8a7a58', // caqui
  '#6cb6cf', // celeste
  '#d3ab98', // arena
  '#4f8486', // petróleo
];

export const ESTILO_MAPA: Estilo = {
  fondo: '#060b14',
  oceano: '#173a5e',
  agua: '#2f6595',
  zona: '#9aa3b4',
  borde: 'rgba(10, 16, 28, 0.8)',
  paleta: PALETA,
};
