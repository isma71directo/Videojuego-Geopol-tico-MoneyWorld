/**
 * Ventana de confirmación (tarea f10-t3): pregunta antes de algo que no se puede deshacer, como
 * sobrescribir una ranura o salir de una partida sin guardar. Con «pedirEleccion» (tarea f14-t2)
 * admite más de dos respuestas.
 *
 * - Bloquea lo de detrás: el foco se queda en sus botones (Tab y Mayús + Tab).
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

/** Una de las respuestas de una elección (tarea f14-t2). */
export interface Respuesta<T extends string> {
  id: T;
  texto: string;
  /** Aspecto del botón: el principal (azul), el de peligro (rojo) o uno normal. */
  estilo?: 'principal' | 'peligro' | 'normal';
}

export interface OpcionesEleccion<T extends string> {
  titulo: string;
  texto: string;
  /**
   * Respuestas, de izquierda a derecha. La primera es la segura: el foco empieza en ella, y Escape
   * o un clic fuera devuelven null (como elegir no hacer nada).
   */
  respuestas: readonly Respuesta<T>[];
}

let abierta: { responder(respuesta: string | null): void } | null = null;
let contador = 0;

/** ¿Hay una confirmación esperando respuesta? */
export function confirmacionAbierta(): boolean {
  return abierta !== null;
}

/**
 * Abre la ventana y espera la respuesta: true si se confirma, false si se cancela. Si ya había
 * otra abierta, esa se cancela.
 */
export async function pedirConfirmacion(opciones: OpcionesConfirmacion): Promise<boolean> {
  const respuesta = await pedirEleccion({
    titulo: opciones.titulo,
    texto: opciones.texto,
    respuestas: [
      { id: 'cancelar', texto: opciones.cancelar, estilo: 'normal' },
      {
        id: 'aceptar',
        texto: opciones.aceptar,
        estilo: opciones.peligro ? 'peligro' : 'principal',
      },
    ],
  });
  return respuesta === 'aceptar';
}

/**
 * Pregunta con varias respuestas (tarea f14-t2, p. ej. «¿Guardar antes de salir?»): devuelve el
 * id de la elegida, o null si se cierra sin elegir. Si ya había otra abierta, esa se cancela.
 */
export function pedirEleccion<T extends string>(opciones: OpcionesEleccion<T>): Promise<T | null> {
  abierta?.responder(null);
  const id = `confirmacion-${++contador}`;
  const foco = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const botones = opciones.respuestas.map((respuesta, indice) =>
    el(
      'button',
      {
        class: [
          'boton',
          indice === 0 ? 'confirmacion__cancelar' : 'confirmacion__aceptar',
          respuesta.estilo === 'peligro'
            ? 'boton--peligro'
            : respuesta.estilo === 'principal'
              ? 'boton--principal'
              : '',
        ]
          .filter(Boolean)
          .join(' '),
        type: 'button',
        'data-respuesta': respuesta.id,
      },
      respuesta.texto,
    ),
  );
  const fondo = el('div', { class: 'confirmacion__fondo' });
  const caja = el(
    'div',
    {
      class: `confirmacion__caja${botones.length > 2 ? ' confirmacion__caja--ancha' : ''}`,
    },
    el('h2', { id: `${id}-titulo`, class: 'confirmacion__titulo' }, opciones.titulo),
    el('p', { id: `${id}-texto`, class: 'confirmacion__texto' }, opciones.texto),
    el('div', { class: 'confirmacion__botones' }, ...botones),
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

  return new Promise<T | null>((resolver) => {
    const alTeclear = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        evento.stopPropagation();
        responder(null);
        return;
      }
      if (evento.key === 'Tab') {
        // El foco no sale de la ventana: de un botón al siguiente (o al anterior con Mayús).
        evento.preventDefault();
        const actual = botones.indexOf(document.activeElement as HTMLButtonElement);
        const paso = evento.shiftKey ? -1 : 1;
        botones[(actual + paso + botones.length) % botones.length]!.focus();
        return;
      }
      // Las teclas del mapa (C, B, M…) no actúan detrás de la ventana.
      if (!ventana.contains(evento.target as Node)) evento.stopPropagation();
    };
    const responder = (respuesta: string | null): void => {
      if (abierta !== estado) return;
      abierta = null;
      document.removeEventListener('keydown', alTeclear, true);
      retirar(ventana, [{ opacity: 1 }, { opacity: 0 }], DURACIONES.cerrarVentana);
      const segura = respuesta === null || respuesta === opciones.respuestas[0]?.id;
      sonar(segura ? 'cerrar' : 'boton');
      if (segura && foco?.isConnected) foco.focus({ preventScroll: true });
      resolver(respuesta as T | null);
    };
    const estado = { responder };
    abierta = estado;
    botones.forEach((boton, indice) =>
      boton.addEventListener('click', () => responder(opciones.respuestas[indice]!.id)),
    );
    fondo.addEventListener('click', () => responder(null));
    // Lo que se teclea en la ventana no llega a los atajos del mapa.
    ventana.addEventListener('keydown', (evento) => evento.stopPropagation());
    // En la fase de captura, para que Escape no llegue al mapa (que quitaría la selección).
    document.addEventListener('keydown', alTeclear, true);
    document.body.appendChild(ventana);
    void animar(caja, FOTOGRAMAS.ventana, DURACIONES.abrirVentana);
    void animar(fondo, [{ opacity: 0 }, { opacity: 1 }], DURACIONES.abrirVentana);
    sonar('abrirVentana');
    botones[0]?.focus();
  });
}
