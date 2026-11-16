/**
 * Controles del tiempo de la partida (tarea f11-t3): pausa y velocidades ×1, ×2, ×4 y ×8 en la
 * barra superior, con el ratón o con el teclado (espacio y 1 a 4). Mientras no está en pausa,
 * pide un fotograma tras otro, pregunta al motor (src/sim/reloj.ts) cuántas horas tocan por el
 * tiempo real que ha pasado y avisa para que la partida avance. En pausa no gasta nada.
 */
import { icono } from '../av/iconos';
import { t } from '../i18n';
import {
  EMPIEZA_EN_PAUSA,
  horasQueTocan,
  msPorHora,
  VELOCIDADES,
  type Velocidad,
} from '../sim/reloj';
import { el } from './dom';

export interface OpcionesTiempo {
  /** Horas de juego que tocan (una o más) desde el último aviso. */
  alAvanzar: (horas: number) => void;
  /**
   * En cada fotograma con el tiempo en marcha, la parte de la hora en curso que ya ha pasado
   * (0 a 1): para mover las manecillas del reloj y la noche sin saltos (tarea f11-t4).
   */
  alFotograma?: (fraccionHora: number) => void;
  /** Al pausar, seguir o cambiar de velocidad (para el sonido). */
  alCambiarVelocidad?: (velocidad: Velocidad, antes: Velocidad) => void;
  /** Para las pruebas: reloj y fotogramas falsos. */
  ahora?: () => number;
  pedirFotograma?: (accion: (momento: number) => void) => number;
  cancelarFotograma?: (id: number) => void;
}

export interface ControlTiempo {
  /** Los botones de pausa y de velocidad. */
  elemento: HTMLElement;
  readonly velocidad: Velocidad;
  /** Parte de la hora en curso que ya ha pasado (0 a 1). */
  readonly fraccionHora: number;
  ponerVelocidad(velocidad: Velocidad): void;
  /** Pausa o sigue a la última velocidad. */
  alternarPausa(): void;
  /** Atajos: espacio (pausa) y 1 a 4 (velocidades). Devuelve si ha usado la tecla. */
  alTeclear(evento: KeyboardEvent): boolean;
  destruir(): void;
}

/** ¿Se está escribiendo o la tecla va a un control que la necesita (espacio en un botón)? */
function teclaParaOtro(destino: EventTarget | null, tecla: string): boolean {
  if (!(destino instanceof HTMLElement)) return false;
  if (destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName)) {
    return true;
  }
  return tecla === ' ' && ['BUTTON', 'A', 'SUMMARY'].includes(destino.tagName);
}

export function crearControlTiempo(opciones: OpcionesTiempo): ControlTiempo {
  const ahora = opciones.ahora ?? (() => performance.now());
  const pedir = opciones.pedirFotograma ?? ((accion) => requestAnimationFrame(accion));
  const cancelar = opciones.cancelarFotograma ?? ((id) => cancelAnimationFrame(id));
  const velocidades = VELOCIDADES.filter((v) => v > 0);

  let velocidad: Velocidad = EMPIEZA_EN_PAUSA ? 0 : velocidades[0]!;
  /** Velocidad a la que se sigue tras una pausa. */
  let ultima: Velocidad = velocidades[0]!;
  /** Parte de la hora en curso que ya ha pasado: se conserva al pausar y al cambiar de velocidad. */
  let fraccion = 0;
  let anterior = 0;
  let fotograma: number | null = null;

  const pausa = el('button', { class: 'tiempo__boton tiempo__pausa', type: 'button' });
  const botones = velocidades.map((v, i) => {
    const boton = el(
      'button',
      {
        class: 'tiempo__boton tiempo__velocidad',
        type: 'button',
        'data-velocidad': v,
        title: t('juego.partida.tiempo.velocidad', { n: v, tecla: i + 1 }),
        'aria-label': t('juego.partida.tiempo.velocidad', { n: v, tecla: i + 1 }),
      },
      `×${v}`,
    );
    boton.addEventListener('click', () => ponerVelocidad(v));
    return boton;
  });
  const estado = el('span', { class: 'oculto-visual', role: 'status' });
  const elemento = el(
    'div',
    { class: 'tiempo', role: 'group', 'aria-label': t('juego.partida.tiempo.etiqueta') },
    pausa,
    ...botones,
    estado,
  );
  pausa.addEventListener('click', () => alternarPausa());

  function pintar(): void {
    const parado = velocidad === 0;
    const texto = t(parado ? 'juego.partida.tiempo.seguir' : 'juego.partida.tiempo.pausar');
    pausa.replaceChildren(icono(parado ? 'seguir' : 'pausa'));
    pausa.setAttribute('aria-label', texto);
    pausa.title = texto;
    pausa.setAttribute('aria-pressed', String(parado));
    elemento.dataset.velocidad = String(velocidad);
    for (const boton of botones) {
      boton.setAttribute('aria-pressed', String(Number(boton.dataset.velocidad) === velocidad));
    }
    estado.textContent = parado
      ? t('juego.partida.tiempo.enPausa')
      : t('juego.partida.tiempo.aVelocidad', { n: velocidad });
  }

  function paso(): void {
    fotograma = null;
    if (velocidad === 0) return;
    const momento = ahora();
    const porHora = msPorHora(velocidad);
    const resultado = horasQueTocan(velocidad, momento - anterior, fraccion * porHora);
    anterior = momento;
    fraccion = resultado.restoMs / porHora;
    if (resultado.horas > 0) opciones.alAvanzar(resultado.horas);
    opciones.alFotograma?.(fraccion);
    if (velocidad > 0 && fotograma === null) fotograma = pedir(paso);
  }

  function ponerVelocidad(nueva: Velocidad): void {
    if (!VELOCIDADES.includes(nueva) || nueva === velocidad) return;
    const antes = velocidad;
    velocidad = nueva;
    if (nueva > 0) ultima = nueva;
    if (nueva === 0) {
      if (fotograma !== null) cancelar(fotograma);
      fotograma = null;
    } else if (fotograma === null) {
      // Al seguir, el tiempo cuenta desde ahora (no desde que se pausó).
      anterior = ahora();
      fotograma = pedir(paso);
    }
    pintar();
    opciones.alCambiarVelocidad?.(nueva, antes);
  }

  function alternarPausa(): void {
    ponerVelocidad(velocidad === 0 ? ultima : 0);
  }

  pintar();
  if (velocidad > 0) {
    anterior = ahora();
    fotograma = pedir(paso);
  }

  return {
    elemento,
    get velocidad() {
      return velocidad;
    },
    get fraccionHora() {
      return fraccion;
    },
    ponerVelocidad,
    alternarPausa,
    alTeclear(evento) {
      if (evento.ctrlKey || evento.altKey || evento.metaKey || evento.defaultPrevented) {
        return false;
      }
      if (teclaParaOtro(evento.target, evento.key)) return false;
      if (evento.key === ' ') {
        evento.preventDefault();
        if (!evento.repeat) alternarPausa();
        return true;
      }
      const indice = ['1', '2', '3', '4'].indexOf(evento.key);
      if (indice >= 0 && velocidades[indice] !== undefined) {
        evento.preventDefault();
        ponerVelocidad(velocidades[indice]);
        return true;
      }
      return false;
    },
    destruir() {
      if (fotograma !== null) cancelar(fotograma);
      fotograma = null;
      velocidad = 0;
    },
  };
}
