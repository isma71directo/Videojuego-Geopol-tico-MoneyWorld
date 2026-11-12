/**
 * Sonido del juego (tarea f4-t4): una sola instancia del motor, con los ajustes guardados del
 * jugador. Se activa con el primer clic o la primera tecla (GDD 7.1).
 */
import { MotorSonido, type Efecto } from '../av/sonido';
import { guardarAjuste, leerAjuste } from './ajustes';

export const sonido = new MotorSonido({
  silenciado: leerAjuste('sonidoSilenciado'),
  volumenEfectos: leerAjuste('volumenEfectos'),
  volumenMusica: leerAjuste('volumenMusica'),
});

/** Escucha el primer clic o tecla del jugador para poner en marcha el sonido. */
export function activarSonidoAlInteractuar(destino: Document = document): void {
  const activar = (): void => {
    sonido.activar();
    destino.removeEventListener('pointerdown', activar, true);
    destino.removeEventListener('keydown', activar, true);
  };
  destino.addEventListener('pointerdown', activar, true);
  destino.addEventListener('keydown', activar, true);
}

export function reproducir(efecto: Efecto): void {
  sonido.reproducir(efecto);
}

/** Silencia o devuelve el sonido y lo recuerda. */
export function silenciar(silenciado: boolean): void {
  sonido.silenciado = silenciado;
  guardarAjuste('sonidoSilenciado', silenciado);
}

export function cambiarVolumenEfectos(volumen: number): void {
  sonido.volumenEfectos = volumen;
  guardarAjuste('volumenEfectos', sonido.volumenEfectos);
}
