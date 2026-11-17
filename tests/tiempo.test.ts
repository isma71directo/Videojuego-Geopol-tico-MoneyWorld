// @vitest-environment happy-dom
/** Controles del tiempo de la partida: pausa, velocidades y teclado (tarea f11-t3). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOMBRES_ICONOS } from '../src/av/iconos';
import { t } from '../src/i18n';
import { crearControlTiempo } from '../src/ui/tiempo';

/** Reloj y fotogramas falsos: `correr(ms)` avanza el tiempo en fotogramas de 10 ms (exactos). */
function relojFalso() {
  let ahora = 0;
  let siguienteId = 1;
  const pendientes = new Map<number, (momento: number) => void>();
  return {
    ahora: () => ahora,
    pedirFotograma: (accion: (momento: number) => void) => {
      const id = siguienteId++;
      pendientes.set(id, accion);
      return id;
    },
    cancelarFotograma: (id: number) => pendientes.delete(id),
    get pendientes() {
      return pendientes.size;
    },
    correr(ms: number, paso = 10) {
      for (let hecho = 0; hecho < ms; hecho += paso) {
        ahora += paso;
        const ahoraMismo = [...pendientes.entries()];
        pendientes.clear();
        for (const [, accion] of ahoraMismo) accion(ahora);
      }
    },
  };
}

function crear() {
  const reloj = relojFalso();
  const alAvanzar = vi.fn();
  const alCambiarVelocidad = vi.fn();
  const tiempo = crearControlTiempo({ alAvanzar, alCambiarVelocidad, ...reloj });
  document.body.appendChild(tiempo.elemento);
  const horas = () => alAvanzar.mock.calls.reduce((total, [h]) => total + (h as number), 0);
  return { reloj, tiempo, alAvanzar, alCambiarVelocidad, horas };
}

const tecla = (key: string, opciones: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opciones });

afterEach(() => document.body.replaceChildren());

describe('controles del tiempo (tarea f11-t3)', () => {
  it('empiezan en pausa y en pausa no se pide ningún fotograma', () => {
    const { tiempo, reloj, horas } = crear();
    expect(tiempo.velocidad).toBe(0);
    expect(reloj.pendientes).toBe(0);
    reloj.correr(5000);
    expect(horas()).toBe(0);
    const pausa = tiempo.elemento.querySelector<HTMLButtonElement>('.tiempo__pausa')!;
    expect(pausa.getAttribute('aria-pressed')).toBe('true');
    expect(pausa.getAttribute('aria-label')).toBe('Seguir (espacio)');
    expect(tiempo.elemento.textContent).toContain('En pausa');
  });

  it('a ×1 pasa una hora cada 2 s; a ×8, un día en 6 s (ajuste f11-a2)', () => {
    const { tiempo, reloj, horas, alCambiarVelocidad } = crear();
    tiempo.alternarPausa();
    expect(tiempo.velocidad).toBe(1);
    expect(alCambiarVelocidad).toHaveBeenLastCalledWith(1, 0);
    reloj.correr(6000);
    expect(horas()).toBe(3);
    tiempo.ponerVelocidad(8);
    reloj.correr(6000);
    expect(horas()).toBe(3 + 24);
    expect(tiempo.elemento.textContent).toContain('Velocidad ×8');
  });

  it('la pausa para el tiempo y al seguir vuelve a la última velocidad, sin contar lo parado', () => {
    const { tiempo, reloj, horas } = crear();
    tiempo.ponerVelocidad(8);
    reloj.correr(500);
    expect(horas()).toBe(2);
    tiempo.alternarPausa();
    expect(reloj.pendientes).toBe(0);
    reloj.correr(10_000);
    expect(horas()).toBe(2);
    tiempo.alternarPausa();
    expect(tiempo.velocidad).toBe(8);
    reloj.correr(250);
    expect(horas()).toBe(3);
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

  it('al destruirlo deja de pedir fotogramas', () => {
    const { tiempo, reloj, horas } = crear();
    tiempo.ponerVelocidad(1);
    tiempo.destruir();
    expect(reloj.pendientes).toBe(0);
    reloj.correr(2000);
    expect(horas()).toBe(0);
  });

  it('iconos de pausa y seguir registrados y con nombre', () => {
    for (const nombre of ['pausa', 'seguir']) {
      expect(NOMBRES_ICONOS as string[]).toContain(nombre);
      expect(t(`galeria.iconos.${nombre}`)).not.toMatch(/^galeria\./);
    }
  });
});
