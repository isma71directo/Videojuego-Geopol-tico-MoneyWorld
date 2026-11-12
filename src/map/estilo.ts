/**
 * Colores del mapa (provisionales hasta la tarea audiovisual de la Fase 3).
 * Cada país recibe siempre el mismo color a partir de su identificador.
 */
import type { Estilo } from './mapa';

const PALETA = [
  '#5b7fa8',
  '#7a9a6a',
  '#b08d5e',
  '#8f6fa8',
  '#5e9a98',
  '#a8706a',
  '#9a9a5e',
  '#6a7fa0',
];

export function colorEstable(id: string, paleta: readonly string[] = PALETA): string {
  let h = 0;
  for (const caracter of id) h = (h * 31 + caracter.charCodeAt(0)) >>> 0;
  return paleta[h % paleta.length]!;
}

export const ESTILO_MAPA: Estilo = {
  fondo: '#060b14',
  oceano: '#14304f',
  zona: '#8a93a6',
  borde: 'rgba(8, 14, 26, 0.85)',
  colorPais: (id) => colorEstable(id),
};
