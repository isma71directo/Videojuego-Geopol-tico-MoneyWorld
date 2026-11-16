/**
 * Deslizadores (tarea f7-t2): un control de rango con su nombre y su valor ya escrito
 * («Impuesto sobre la renta: 21 %»). Usa el control nativo del navegador, así que con el
 * teclado funcionan las flechas, Re Pág / Av Pág e Inicio y Fin; la parte recorrida se
 * colorea para ver de un vistazo dónde está.
 */
import { el } from '../dom';
import { ajustarAlPaso } from './escalas';
import '../estilos/componentes.css';

export interface OpcionesDeslizador {
  etiqueta: string;
  min: number;
  max: number;
  paso?: number;
  valor: number;
  /** Texto del valor (por defecto, el número tal cual). */
  formato?: (valor: number) => string;
  /** Explicación breve debajo del nombre. */
  ayuda?: string;
  /** Mientras se mueve. */
  alCambiar?: (valor: number) => void;
  /** Al soltarlo (o al terminar de moverlo con el teclado). */
  alSoltar?: (valor: number) => void;
}

export interface Deslizador {
  readonly elemento: HTMLElement;
  readonly control: HTMLInputElement;
  readonly valor: number;
  ponerValor(valor: number): void;
}

let contador = 0;

export function crearDeslizador(opciones: OpcionesDeslizador): Deslizador {
  contador += 1;
  const id = `deslizador-${contador}`;
  const paso = opciones.paso ?? 1;
  const formato = opciones.formato ?? ((v: number) => String(v));
  const control = el('input', {
    class: 'deslizador__control',
    type: 'range',
    id,
    min: opciones.min,
    max: opciones.max,
    step: paso,
    value: ajustarAlPaso(opciones.valor, opciones.min, opciones.max, paso),
  });
  const salida = el('output', { class: 'deslizador__valor', for: id });
  const elemento = el(
    'div',
    { class: 'deslizador' },
    el(
      'label',
      { class: 'deslizador__etiqueta', for: id },
      el('span', {}, opciones.etiqueta),
      opciones.ayuda ? el('small', {}, opciones.ayuda) : null,
    ),
    el('div', { class: 'deslizador__fila' }, control, salida),
  );

  const pintar = (): void => {
    const valor = Number(control.value);
    const texto = formato(valor);
    salida.textContent = texto;
    // Los lectores de pantalla leen el texto con su unidad, no solo el número.
    control.setAttribute('aria-valuetext', texto);
    const parte = (valor - opciones.min) / (opciones.max - opciones.min || 1);
    control.style.setProperty('--recorrido', `${(parte * 100).toFixed(2)}%`);
  };
  control.addEventListener('input', () => {
    pintar();
    opciones.alCambiar?.(Number(control.value));
  });
  control.addEventListener('change', () => opciones.alSoltar?.(Number(control.value)));
  pintar();

  return {
    elemento,
    control,
    get valor() {
      return Number(control.value);
    },
    ponerValor(valor) {
      control.value = String(ajustarAlPaso(valor, opciones.min, opciones.max, paso));
      pintar();
    },
  };
}
