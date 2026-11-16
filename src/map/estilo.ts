/**
 * Estilo visual del mapa (tareas audiovisuales de las Fases 3 y 4): océano, agua, bordes y una
 * paleta de colores de país que combinan con el terreno. Qué color lleva cada país lo decide
 * colores.ts (siempre el mismo, nunca uno parecido al de un vecino).
 */
import type { Estilo } from './mapa';
import { hexDeOklch } from './rampas';

/**
 * Tonos del mapa político (ajuste f6-a1: el jugador pidió muchos más colores para que no se
 * note la repetición al ver el mundo entero). Se crean con código en OKLCH: 15 tonos del
 * círculo cromático, cada 24°, con tres luminosidades (cada nivel girado unos grados para que
 * no coincidan los tonos). En total, 45 colores; colores.ts evita que los parecidos queden
 * cerca. Croma moderado: van semitransparentes sobre el terreno y con el tema oscuro.
 */
const TONOS_PALETA = 15;
const NIVELES_PALETA: readonly (readonly [number, number, number])[] = [
  // [luminosidad, croma, giro del tono en grados]
  [0.61, 0.12, 0],
  [0.69, 0.115, 8],
  [0.77, 0.105, 16],
];

export const PALETA: readonly string[] = NIVELES_PALETA.flatMap(([luz, croma, giro]) =>
  Array.from({ length: TONOS_PALETA }, (_, i) =>
    hexDeOklch([luz, croma, (i * 360) / TONOS_PALETA + giro]),
  ),
);

export const ESTILO_MAPA: Estilo = {
  fondo: '#060b14',
  oceano: '#173a5e',
  agua: '#2f6595',
  zona: '#9aa3b4',
  borde: 'rgba(10, 16, 28, 0.8)',
  paleta: PALETA,
};
