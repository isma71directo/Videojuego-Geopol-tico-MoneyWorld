/**
 * Sonido del juego (tarea f4-t4): una sola instancia del motor, con los ajustes guardados del
 * jugador. Se activa con el primer clic o la primera tecla (GDD 7.1).
 */
import { PIEZAS_TRANQUILAS } from '../av/musica/piezas-tranquilas';
import { ReproductorMusica } from '../av/musica/reproductor';
import { MotorSonido, type Efecto } from '../av/sonido';
import { guardarAjuste, leerAjuste } from './ajustes';

export const sonido = new MotorSonido({
  silenciado: leerAjuste('sonidoSilenciado'),
  volumenEfectos: leerAjuste('volumenEfectos'),
  volumenMusica: leerAjuste('volumenMusica'),
});

/**
 * Música ambiental (tarea f12-t3, decisión del jugador): piezas fijas que se reparten sin
 * repetirse, en el menú y en la partida.
 */
export const musica = new ReproductorMusica({ tranquila: PIEZAS_TRANQUILAS, tensa: [] }, () =>
  sonido.salidaMusica(),
);

/** Escucha el primer clic o tecla del jugador para poner en marcha el sonido y la música. */
export function activarSonidoAlInteractuar(destino: Document = document): void {
  const activar = (): void => {
    sonido.activar();
    musica.empezar();
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

export function cambiarVolumenMusica(volumen: number): void {
  sonido.volumenMusica = volumen;
  guardarAjuste('volumenMusica', sonido.volumenMusica);
}

/** En pausa, la música baja un poco (tarea f12-t3). */
export function atenuarMusica(atenuada: boolean): void {
  musica.atenuar(atenuada);
}
