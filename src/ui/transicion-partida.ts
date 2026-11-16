/**
 * Transición al empezar una partida (tarea f10-t4, audiovisual de la Fase 10). Al pulsar
 * «Empezar», la pantalla se cubre con la bandera del país elegido, su nombre y la fecha
 * (1 de enero de 2010) y suena una fanfarria corta; debajo se abre la partida y el mapa vuela
 * al país, y después la tarjeta se desvanece.
 *
 * - Se puede saltar con un clic o con cualquier tecla.
 * - Con «reducir movimiento» activado en el sistema no hay transición: la partida se abre al
 *   instante (con su sonido).
 */
import { urlBandera } from '../av/banderas';
import { formatearFechaLarga } from '../compartido/fechas';
import { t } from '../i18n';
import { animar, CURVA, reducirMovimiento, retirar } from './componentes/animacion';
import { el } from './dom';
import { reproducir } from './sonido';
import './estilos/transicion.css';

/** Duración de cada momento, en milisegundos. */
export const TIEMPOS_TRANSICION = {
  /** La tarjeta cubre la pantalla. */
  cubrir: 450,
  /** Se queda a la vista mientras se abre la partida debajo. */
  mantener: 1000,
  /** Se desvanece y deja ver el mapa. */
  descubrir: 550,
} as const;

export interface OpcionesTransicion {
  pais: { id: string; nombre: string };
  /** Fecha de la partida («AAAA-MM-DD»). */
  fecha: string;
  /** Con la pantalla ya cubierta: es el momento de abrir la partida debajo. */
  alCubrir: () => void;
  /** Cuando la tarjeta ya se ha ido. */
  alTerminar?: () => void;
  /** Sin animación (por defecto, si el sistema pide reducir el movimiento). */
  sinAnimacion?: boolean;
}

export interface Transicion {
  /** Pasa directamente al final (clic o tecla). */
  saltar(): void;
  readonly elemento: HTMLElement | null;
}

export function transicionAPartida(opciones: OpcionesTransicion): Transicion {
  reproducir('comenzar');
  if (opciones.sinAnimacion ?? reducirMovimiento()) {
    opciones.alCubrir();
    opciones.alTerminar?.();
    return { saltar: () => undefined, elemento: null };
  }
  const { pais } = opciones;
  const bandera = el(
    'div',
    { class: 'transicion__bandera' },
    el('img', { src: urlBandera(pais.id), alt: '', width: 240, height: 180 }),
  );
  // El brillo usa la propia bandera como máscara, para no salirse de su forma.
  bandera.style.setProperty('--bandera', `url("${urlBandera(pais.id)}")`);
  const tarjeta = el(
    'div',
    { class: 'transicion__tarjeta' },
    bandera,
    el('p', { class: 'transicion__rol' }, t('juego.partida.transicion.rol')),
    el('h2', { class: 'transicion__pais' }, pais.nombre),
    el(
      'p',
      { class: 'transicion__fecha' },
      el('time', { datetime: opciones.fecha }, formatearFechaLarga(opciones.fecha)),
    ),
    el('p', { class: 'transicion__saltar' }, t('juego.partida.transicion.saltar')),
  );
  const fondo = el('div', { class: 'transicion__fondo' });
  const elemento = el(
    'div',
    {
      class: 'transicion',
      role: 'status',
      'aria-label': t('juego.partida.transicion.etiqueta', { pais: pais.nombre }),
    },
    fondo,
    tarjeta,
  );
  document.body.appendChild(elemento);
  void animar(fondo, [{ opacity: 0 }, { opacity: 1 }], TIEMPOS_TRANSICION.cubrir);
  void animar(
    tarjeta,
    [
      { opacity: 0, scale: '0.9', translate: '0 16px' },
      { opacity: 1, scale: '1', translate: '0 0' },
    ],
    TIEMPOS_TRANSICION.cubrir,
    CURVA,
  );
  void animar(
    bandera,
    [
      { scale: '0.6', rotate: '-4deg' },
      { scale: '1.06', rotate: '1deg', offset: 0.7 },
      { scale: '1', rotate: '0deg' },
    ],
    TIEMPOS_TRANSICION.cubrir + 150,
  );

  let cubierta = false;
  let terminada = false;
  const temporizadores: ReturnType<typeof setTimeout>[] = [];
  const cubrir = (): void => {
    if (cubierta) return;
    cubierta = true;
    opciones.alCubrir();
  };
  const descubrir = (): void => {
    if (terminada) return;
    terminada = true;
    cubrir();
    for (const temporizador of temporizadores) clearTimeout(temporizador);
    document.removeEventListener('keydown', alTeclear, true);
    retirar(
      elemento,
      [
        { opacity: 1, scale: '1' },
        { opacity: 0, scale: '1.04' },
      ],
      TIEMPOS_TRANSICION.descubrir,
    );
    temporizadores.push(setTimeout(() => opciones.alTerminar?.(), TIEMPOS_TRANSICION.descubrir));
  };
  // Cualquier tecla la salta, sin llegar a los atajos del mapa que hay debajo.
  const alTeclear = (evento: KeyboardEvent): void => {
    evento.preventDefault();
    evento.stopPropagation();
    descubrir();
  };
  document.addEventListener('keydown', alTeclear, true);
  elemento.addEventListener('click', descubrir);
  temporizadores.push(
    setTimeout(cubrir, TIEMPOS_TRANSICION.cubrir),
    setTimeout(descubrir, TIEMPOS_TRANSICION.cubrir + TIEMPOS_TRANSICION.mantener),
  );
  return { saltar: descubrir, elemento };
}
