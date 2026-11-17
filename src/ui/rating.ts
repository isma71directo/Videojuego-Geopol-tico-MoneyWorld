/**
 * Distintivo del rating de la deuda (tarea f18-t4): la nota con el color de su escalón (de AAA,
 * en verde, a D, el impago) y, cuando cambia, una animación que la hace saltar con una flecha
 * hacia arriba o hacia abajo. El sonido lo pone la alerta del rating, no el distintivo.
 */
import { t } from '../i18n';
import { RATINGS, type Rating } from '../sim/deuda';
import { animar } from './componentes/animacion';
import { el } from './dom';
import './estilos/rating.css';

/** Los escalones del rating, de mejor a peor. */
export const NIVELES_RATING = [
  'excelente',
  'alto',
  'medio',
  'especulativo',
  'riesgo',
  'impago',
] as const;
export type NivelRating = (typeof NIVELES_RATING)[number];

/** Hasta qué nota llega cada escalón (el impago, D, aparte). */
const HASTA: Record<Exclude<NivelRating, 'impago'>, Rating> = {
  excelente: 'AA-',
  alto: 'A-',
  medio: 'BBB-',
  especulativo: 'B-',
  riesgo: 'C',
};

/** El escalón de una nota: AAA a AA−, excelente; A, alto; BBB, medio; BB y B, especulativo… */
export function nivelRating(rating: Rating): NivelRating {
  const indice = RATINGS.indexOf(rating as (typeof RATINGS)[number]);
  if (rating === 'D' || indice < 0) return 'impago';
  return (Object.keys(HASTA) as Exclude<NivelRating, 'impago'>[]).find(
    (nivel) => indice <= RATINGS.indexOf(HASTA[nivel] as (typeof RATINGS)[number]),
  )!;
}

/** «BBB-» → «BBB−» (con el signo menos tipográfico). */
export const textoRating = (rating: Rating): string => rating.replace('-', '−');

/** ¿Ha subido (1), bajado (−1) o sigue igual (0)? Más abajo en la lista es peor. */
export function cambioRating(antes: Rating, ahora: Rating): -1 | 0 | 1 {
  const a = RATINGS.indexOf(antes as (typeof RATINGS)[number]);
  const b = RATINGS.indexOf(ahora as (typeof RATINGS)[number]);
  if (a === b || a < 0 || b < 0) return 0;
  return b < a ? 1 : -1;
}

/**
 * El distintivo de una nota. Con `antes` distinto, salta (sube o baja) con su flecha: así se ve
 * al llegar el mes en que cambia.
 */
export function distintivoRating(rating: Rating, antes?: Rating): HTMLElement {
  const nivel = nivelRating(rating);
  const cambio = antes ? cambioRating(antes, rating) : 0;
  const elemento = el(
    'span',
    {
      class: 'rating',
      'data-nivel': nivel,
      'data-cambio': cambio > 0 ? 'sube' : cambio < 0 ? 'baja' : undefined,
      role: 'img',
      'aria-label': t('juego.rating.etiqueta', {
        nota: textoRating(rating),
        nivel: t(`juego.rating.niveles.${nivel}`),
      }),
    },
    el('span', { class: 'rating__nota', 'aria-hidden': 'true' }, textoRating(rating)),
    cambio !== 0
      ? el('span', { class: 'rating__flecha', 'aria-hidden': 'true' }, cambio > 0 ? '▲' : '▼')
      : null,
  );
  if (cambio !== 0) {
    // Sube: crece y se eleva; baja: se hunde y tiembla un poco.
    void animar(
      elemento,
      cambio > 0
        ? [
            { transform: 'translateY(6px) scale(0.9)', opacity: 0.4 },
            { transform: 'translateY(-4px) scale(1.12)', opacity: 1, offset: 0.55 },
            { transform: 'translateY(0) scale(1)' },
          ]
        : [
            { transform: 'translateY(-6px) scale(1.1)', opacity: 0.4 },
            { transform: 'translateY(3px) rotate(-3deg)', opacity: 1, offset: 0.45 },
            { transform: 'translateY(0) rotate(2deg)', offset: 0.7 },
            { transform: 'translateY(0) rotate(0)' },
          ],
      700,
    );
  }
  return elemento;
}
