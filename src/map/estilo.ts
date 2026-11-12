/**
 * Estilo visual del mapa (tarea audiovisual de la Fase 3): océano, agua, bordes y una paleta
 * de colores de país suaves que combinan con el relieve. Cada país recibe siempre el mismo
 * color; en la Fase 4 se ajustará para que dos vecinos nunca coincidan.
 */
import type { Estilo } from './mapa';

/** Tonos de mapa político, apagados para el tema oscuro y para que se lea el relieve. */
export const PALETA = [
  '#6f8fb5',
  '#83a56f',
  '#c39a62',
  '#9a80b6',
  '#6ba5a0',
  '#b97d72',
  '#a9a669',
  '#7f8fb0',
  '#c08aa0',
  '#8db394',
];

export function colorEstable(id: string, paleta: readonly string[] = PALETA): string {
  let h = 0;
  for (const caracter of id) h = (h * 31 + caracter.charCodeAt(0)) >>> 0;
  return paleta[h % paleta.length]!;
}

export const ESTILO_MAPA: Estilo = {
  fondo: '#060b14',
  oceano: '#173a5e',
  agua: '#2f6595',
  zona: '#9aa3b4',
  borde: 'rgba(10, 16, 28, 0.8)',
  colorPais: (id) => colorEstable(id),
};
