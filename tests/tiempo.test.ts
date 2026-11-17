// @vitest-environment happy-dom
/**
 * Controles del tiempo de la partida: pausa, velocidades y teclado (tarea f11-t3). Desde la tarea
 * f12-t1 el tiempo lo cuenta el motor (tests/motor.test.ts); los controles solo eligen la velocidad.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOMBRES_ICONOS } from '../src/av/iconos';
import { t } from '../src/i18n';
import { crearControlTiempo } from '../src/ui/tiempo';

function crear() {
  const alCambiarVelocidad = vi.fn();
  const tiempo = crearControlTiempo({ alCambiarVelocidad });
  document.body.appendChild(tiempo.elemento);
  return { tiempo, alCambiarVelocidad };
}

const tecla = (key: string, opciones: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opciones });

afterEach(() => document.body.replaceChildren());

describe('controles del tiempo (tarea f11-t3)', () => {
  it('empiezan en pausa', () => {
    const { tiempo, alCambiarVelocidad } = crear();
    expect(tiempo.velocidad).toBe(0);
    expect(alCambiarVelocidad).not.toHaveBeenCalled();
    const pausa = tiempo.elemento.querySelector<HTMLButtonElement>('.tiempo__pausa')!;
    expect(pausa.getAttribute('aria-pressed')).toBe('true');
    expect(pausa.getAttribute('aria-label')).toBe('Seguir (espacio)');
    expect(tiempo.elemento.textContent).toContain('En pausa');
  });

  it('al pausar y seguir avisan de la velocidad nueva y de la anterior; siguen a la última', () => {
    const { tiempo, alCambiarVelocidad } = crear();
    tiempo.alternarPausa();
    expect(tiempo.velocidad).toBe(1);
    expect(alCambiarVelocidad).toHaveBeenLastCalledWith(1, 0);
    tiempo.ponerVelocidad(8);
    expect(alCambiarVelocidad).toHaveBeenLastCalledWith(8, 1);
    expect(tiempo.elemento.textContent).toContain('Velocidad ×8');
    tiempo.alternarPausa();
    expect(alCambiarVelocidad).toHaveBeenLastCalledWith(0, 8);
    tiempo.alternarPausa();
    expect(tiempo.velocidad).toBe(8);
    // Una velocidad que no existe (×4 se quitó) no hace nada.
    tiempo.ponerVelocidad(4);
    expect(tiempo.velocidad).toBe(8);
  });

  it('botones: cada velocidad con el ratón, marcada como pulsada', () => {
    const { tiempo } = crear();
    const boton = (v: number) =>
      tiempo.elemento.querySelector<HTMLButtonElement>(`[data-velocidad="${v}"]`)!;
    boton(2).click();
    expect(tiempo.velocidad).toBe(2);
    expect(boton(2).getAttribute('aria-pressed')).toBe('true');
    expect(boton(8).getAttribute('aria-pressed')).toBe('false');
    // Sin ×4 (ajuste f11-a4).
    expect(tiempo.elemento.querySelector('[data-velocidad="4"]')).toBeNull();
    expect(boton(2).getAttribute('aria-label')).toBe('Velocidad ×2 (tecla 2)');
    tiempo.elemento.querySelector<HTMLButtonElement>('.tiempo__pausa')!.click();
    expect(tiempo.velocidad).toBe(0);
  });

  it('teclado: espacio pausa o sigue; 1 a 6 eligen ×1, ×2, ×8, ×16, ×32 y ×64', () => {
    const { tiempo } = crear();
    const pulsar = (key: string, destino: EventTarget = document.body, extra = {}) => {
      const evento = tecla(key, extra);
      destino.dispatchEvent(evento);
      return tiempo.alTeclear(evento);
    };
    expect(pulsar(' ')).toBe(true);
    expect(tiempo.velocidad).toBe(1);
    pulsar('3');
    expect(tiempo.velocidad).toBe(8);
    pulsar('2');
    expect(tiempo.velocidad).toBe(2);
    pulsar('4');
    expect(tiempo.velocidad).toBe(16);
    pulsar('5');
    expect(tiempo.velocidad).toBe(32);
    pulsar('6');
    expect(tiempo.velocidad).toBe(64);
    expect(tiempo.elemento.querySelector('[data-velocidad="64"]')!.getAttribute('aria-label')).toBe(
      'Velocidad ×64 (tecla 6)',
    );
    pulsar(' ');
    expect(tiempo.velocidad).toBe(0);
    // Mantener el espacio pulsado no hace parpadear la pausa.
    pulsar(' ', document.body, { repeat: true });
    expect(tiempo.velocidad).toBe(0);
    // Escribiendo, con Ctrl o con el espacio sobre un botón, la tecla no es un atajo.
    const campo = document.createElement('input');
    document.body.appendChild(campo);
    expect(pulsar('1', campo)).toBe(false);
    expect(pulsar('1', document.body, { ctrlKey: true })).toBe(false);
    const boton = document.createElement('button');
    document.body.appendChild(boton);
    expect(pulsar(' ', boton)).toBe(false);
    expect(pulsar('7')).toBe(false);
    expect(pulsar('0')).toBe(false);
    expect(tiempo.velocidad).toBe(0);
  });

  it('iconos de pausa y seguir registrados y con nombre', () => {
    for (const nombre of ['pausa', 'seguir']) {
      expect(NOMBRES_ICONOS as string[]).toContain(nombre);
      expect(t(`galeria.iconos.${nombre}`)).not.toMatch(/^galeria\./);
    }
  });
});
