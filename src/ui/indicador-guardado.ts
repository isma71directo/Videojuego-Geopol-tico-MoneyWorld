/**
 * Indicador de guardado (tarea f14-t4, GDD sección 9: «indicador de guardado»). Una píldora arriba
 * en el centro que dice qué pasa:
 *  - «Guardando…», con el icono del disquete latiendo mientras se escribe;
 *  - lo guardado («Guardada en la ranura 2», «Guardado automático»…), con una marca verde y, si
 *    lo ha pedido el jugador, el sonido de guardado (los automáticos no suenan, para no cansar);
 *  - un error, en rojo, que se queda más tiempo.
 * Aparece bajando un poco y se va desvaneciéndose; con «reducir movimiento», sin animación.
 */
import { icono } from '../av/iconos';
import { t } from '../i18n';
import { animar, retirar } from './componentes/animacion';
import { el } from './dom';
import './estilos/indicador-guardado.css';

/** Cuánto se queda a la vista (ms). */
export const DURACION_INDICADOR = { hecho: 2500, error: 6000 } as const;

export type EstadoIndicador = 'guardando' | 'hecho' | 'error';

export interface IndicadorGuardado {
  readonly elemento: HTMLElement;
  readonly estado: EstadoIndicador | null;
  guardando(): void;
  /** Lo guardado; con `sonar`, suena (lo pide quien guarda, p. ej. al guardar a mano). */
  hecho(texto: string, sonar?: boolean): void;
  error(texto: string): void;
  /** Lo quita en el acto (al salir de la pantalla). */
  destruir(): void;
}

export function crearIndicadorGuardado(opciones: { alSonar?: () => void } = {}): IndicadorGuardado {
  const elemento = el('p', { class: 'indicador-guardado', role: 'status', hidden: true });
  let estado: EstadoIndicador | null = null;
  let temporizador: number | null = null;

  const parar = (): void => {
    if (temporizador !== null) clearTimeout(temporizador);
    temporizador = null;
  };
  const ocultar = (): void => {
    parar();
    estado = null;
    // Se desvanece y queda oculto (sin sacarlo del documento: se reutiliza). Se oculta justo
    // antes de que acabe el desvanecido, para que no vuelva a verse un instante.
    void animar(elemento, [{ opacity: 1 }, { opacity: 0 }], 220);
    temporizador = window.setTimeout(() => {
      temporizador = null;
      if (estado === null) elemento.hidden = true;
    }, 200);
  };
  const mostrar = (nuevo: EstadoIndicador, nombreIcono: 'guardar' | 'hecho', texto: string) => {
    parar();
    const aparece = elemento.hidden;
    estado = nuevo;
    elemento.dataset.estado = nuevo;
    elemento.replaceChildren(icono(nombreIcono), el('span', {}, texto));
    elemento.hidden = false;
    if (aparece) {
      void animar(
        elemento,
        [
          { opacity: 0, translate: '-50% -8px' },
          { opacity: 1, translate: '-50% 0' },
        ],
        200,
      );
    } else if (nuevo !== 'guardando') {
      // Ya estaba a la vista: un pequeño latido al cambiar a «hecho» o a error.
      void animar(elemento, [{ scale: '1' }, { scale: '1.06' }, { scale: '1' }], 260);
    }
  };

  return {
    elemento,
    get estado() {
      return estado;
    },
    guardando() {
      mostrar('guardando', 'guardar', t('juego.guardado.guardando'));
    },
    hecho(texto, sonar = false) {
      mostrar('hecho', 'hecho', texto);
      if (sonar) opciones.alSonar?.();
      temporizador = window.setTimeout(ocultar, DURACION_INDICADOR.hecho);
    },
    error(texto) {
      mostrar('error', 'guardar', texto);
      temporizador = window.setTimeout(ocultar, DURACION_INDICADOR.error);
    },
    destruir() {
      parar();
      estado = null;
      retirar(elemento, [], 0, true);
    },
  };
}
