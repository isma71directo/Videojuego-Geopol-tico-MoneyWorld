/**
 * Ventana de confirmación (tarea f10-t3): pregunta antes de algo que no se puede deshacer, como
 * salir de una partida que aún no se puede guardar.
 *
 * - Bloquea lo de detrás: el foco se queda en sus dos botones (Tab y Mayús + Tab).
 * - Empieza en «cancelar», la respuesta segura; Escape o un clic fuera también cancelan.
 * - Aparece y se va con la animación de las ventanas y suena al abrirse y al cerrarse.
 */
import { el } from '../dom';
import { animar, DURACIONES, FOTOGRAMAS, retirar } from './animacion';
import { sonar } from './sonidos';
import '../estilos/componentes.css';

export interface OpcionesConfirmacion {
  titulo: string;
  texto: string;
  /** Texto del botón que confirma (p. ej. «Salir al menú»). */
  aceptar: string;
  /** Texto del botón que cancela (p. ej. «Seguir jugando»). */
  cancelar: string;
  /** El botón de confirmar avisa de que se pierde algo (en rojo). */
  peligro?: boolean;
}

let abierta: { responder(respuesta: boolean): void } | null = null;
let contador = 0;

/** ¿Hay una confirmación esperando respuesta? */
export function confirmacionAbierta(): boolean {
  return abierta !== null;
}

/**
 * Abre la ventana y espera la respuesta: true si se confirma, false si se cancela. Si ya había
 * otra abierta, esa se cancela.
 */
export function pedirConfirmacion(opciones: OpcionesConfirmacion): Promise<boolean> {
  abierta?.responder(false);
  const id = `confirmacion-${++contador}`;
  const foco = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const cancelar = el(
    'button',
    { class: 'boton confirmacion__cancelar', type: 'button' },
    opciones.cancelar,
  );
  const aceptar = el(
    'button',
    {
      class: `boton confirmacion__aceptar ${opciones.peligro ? 'boton--peligro' : 'boton--principal'}`,
      type: 'button',
    },
    opciones.aceptar,
  );
  const fondo = el('div', { class: 'confirmacion__fondo' });
  const caja = el(
    'div',
    { class: 'confirmacion__caja' },
    el('h2', { id: `${id}-titulo`, class: 'confirmacion__titulo' }, opciones.titulo),
    el('p', { id: `${id}-texto`, class: 'confirmacion__texto' }, opciones.texto),
    el('div', { class: 'confirmacion__botones' }, cancelar, aceptar),
  );
  const ventana = el(
    'div',
    {
      class: 'confirmacion',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-labelledby': `${id}-titulo`,
      'aria-describedby': `${id}-texto`,
    },
    fondo,
    caja,
  );

  return new Promise<boolean>((resolver) => {
    const alTeclear = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        evento.stopPropagation();
        responder(false);
        return;
      }
      if (evento.key === 'Tab') {
        // El foco no sale de la ventana: de un botón al otro.
        evento.preventDefault();
        (document.activeElement === cancelar ? aceptar : cancelar).focus();
        return;
      }
      // Las teclas del mapa (C, B, M…) no actúan detrás de la ventana.
      if (!ventana.contains(evento.target as Node)) evento.stopPropagation();
    };
    const responder = (respuesta: boolean): void => {
      if (abierta !== estado) return;
      abierta = null;
      document.removeEventListener('keydown', alTeclear, true);
      retirar(ventana, [{ opacity: 1 }, { opacity: 0 }], DURACIONES.cerrarVentana);
      sonar(respuesta ? 'boton' : 'cerrar');
      if (!respuesta && foco?.isConnected) foco.focus({ preventScroll: true });
      resolver(respuesta);
    };
    const estado = { responder };
    abierta = estado;
    cancelar.addEventListener('click', () => responder(false));
    aceptar.addEventListener('click', () => responder(true));
    fondo.addEventListener('click', () => responder(false));
    // Lo que se teclea en la ventana no llega a los atajos del mapa.
    ventana.addEventListener('keydown', (evento) => evento.stopPropagation());
    // En la fase de captura, para que Escape no llegue al mapa (que quitaría la selección).
    document.addEventListener('keydown', alTeclear, true);
    document.body.appendChild(ventana);
    void animar(caja, FOTOGRAMAS.ventana, DURACIONES.abrirVentana);
    void animar(fondo, [{ opacity: 0 }, { opacity: 1 }], DURACIONES.abrirVentana);
    sonar('abrirVentana');
    cancelar.focus();
  });
}
