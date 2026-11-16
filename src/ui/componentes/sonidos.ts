/**
 * Sonidos de navegación de los componentes (tarea f7-t4, GDD 7.1). Los componentes solo dicen
 * qué ha pasado; cada pantalla decide cómo suena: el juego, con los ajustes del jugador
 * (silencio y volumen); la galería, siempre. Sin nadie escuchando, no suena nada.
 *
 * Suenan las acciones del jugador (abrir, cerrar, cambiar de pestaña, abrir el menú), nunca el
 * paso del ratón por encima de algo.
 */
import type { Efecto } from '../../av/sonido';

let oyente: ((efecto: Efecto) => void) | null = null;

/** Elige quién hace sonar los componentes (o `null` para que callen). */
export function sonidosDeComponentes(reproducir: ((efecto: Efecto) => void) | null): void {
  oyente = reproducir;
}

export function sonar(efecto: Efecto): void {
  oyente?.(efecto);
}
