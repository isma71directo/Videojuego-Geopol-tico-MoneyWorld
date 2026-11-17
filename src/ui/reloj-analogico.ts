/**
 * Reloj de manecillas de la barra de la partida (tarea f11-t4): marca la hora de la capital del
 * jugador y se mueve sin saltos mientras corre el tiempo. A ×8 el minutero daría vueltas
 * demasiado deprisa (parecería ir hacia atrás), así que se queda en las doce y solo se mueve la
 * aguja de las horas. De noche (de las 20:00 a las 7:00) la esfera se oscurece.
 */
import { AMANECER, ANOCHECER } from '../map/noche';

/** Horas de la noche en la esfera: desde las 20:00 hasta antes de las 7:00, como en el mapa. */
export function esDeNoche(hora: number): boolean {
  return hora >= ANOCHECER || hora < AMANECER;
}

/** Ángulos (grados, desde las doce y en el sentido del reloj) de las dos agujas. */
export function angulosAgujas(
  hora: number,
  fraccion: number,
  conMinutero: boolean,
): { horas: number; minutos: number } {
  return {
    horas: (((hora % 12) + fraccion) * 30) % 360,
    minutos: conMinutero ? fraccion * 360 : 0,
  };
}

export interface RelojAnalogico {
  elemento: HTMLElement;
  poner(hora: number, fraccion: number, conMinutero: boolean): void;
}

const MARCAS = Array.from({ length: 12 }, (_, i) => {
  const grande = i % 3 === 0;
  return `<line class="reloj__marca${grande ? ' reloj__marca--grande' : ''}" x1="12" y1="${grande ? 3.2 : 3.6}" x2="12" y2="${grande ? 5 : 4.6}" transform="rotate(${i * 30} 12 12)"/>`;
}).join('');

export function crearRelojAnalogico(): RelojAnalogico {
  const elemento = document.createElement('span');
  elemento.className = 'reloj';
  elemento.setAttribute('aria-hidden', 'true');
  // SVG propio del proyecto, sin texto de fuera.
  elemento.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22">
    <circle class="reloj__esfera" cx="12" cy="12" r="10.4"/>
    ${MARCAS}
    <line class="reloj__horas" x1="12" y1="12" x2="12" y2="7.2"/>
    <line class="reloj__minutos" x1="12" y1="12" x2="12" y2="4.6"/>
    <circle class="reloj__centro" cx="12" cy="12" r="1.2"/>
  </svg>`.replace(/>\s+</g, '><');
  const horas = elemento.querySelector('.reloj__horas')!;
  const minutos = elemento.querySelector('.reloj__minutos')!;
  return {
    elemento,
    poner(hora, fraccion, conMinutero) {
      const angulos = angulosAgujas(hora, fraccion, conMinutero);
      horas.setAttribute('transform', `rotate(${angulos.horas.toFixed(2)} 12 12)`);
      minutos.setAttribute('transform', `rotate(${angulos.minutos.toFixed(2)} 12 12)`);
      elemento.classList.toggle('reloj--noche', esDeNoche(hora));
    },
  };
}
