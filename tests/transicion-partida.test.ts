// @vitest-environment happy-dom
/** Audiovisual de la Fase 10: transición al empezar una partida y su sonido (tarea f10-t4). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EFECTOS } from '../src/av/sonido';
import { t } from '../src/i18n';
import { TIEMPOS_TRANSICION, transicionAPartida } from '../src/ui/transicion-partida';

const visible = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.transicion:not(.retirandose)');

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('transición al empezar una partida (tarea f10-t4)', () => {
  it('cubre la pantalla con la bandera, el país y la fecha; la partida se abre debajo', () => {
    vi.useFakeTimers();
    const alCubrir = vi.fn();
    const alTerminar = vi.fn();
    transicionAPartida({
      pais: { id: 'JPN', nombre: 'Japón' },
      fecha: '2010-01-01',
      alCubrir,
      alTerminar,
      sinAnimacion: false,
    });
    const tarjeta = visible()!;
    expect(tarjeta.textContent).toContain('Japón');
    expect(tarjeta.textContent).toContain('1 de enero de 2010');
    expect(tarjeta.textContent).toContain('Al frente del Gobierno');
    expect(tarjeta.querySelector('img')!.getAttribute('src')).toContain('JPN');
    expect(tarjeta.getAttribute('aria-label')).toBe('Empieza la partida con Japón');
    expect(alCubrir).not.toHaveBeenCalled();
    vi.advanceTimersByTime(TIEMPOS_TRANSICION.cubrir);
    expect(alCubrir).toHaveBeenCalledOnce();
    expect(alTerminar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(TIEMPOS_TRANSICION.mantener + TIEMPOS_TRANSICION.descubrir);
    expect(alTerminar).toHaveBeenCalledOnce();
    expect(visible()).toBeNull();
    expect(alCubrir).toHaveBeenCalledOnce();
  });

  it('una tecla la salta sin llegar a los atajos del mapa; un clic también', () => {
    vi.useFakeTimers();
    const alCubrir = vi.fn();
    const atajos = vi.fn();
    document.addEventListener('keydown', atajos);
    transicionAPartida({
      pais: { id: 'ESP', nombre: 'España' },
      fecha: '2010-01-01',
      alCubrir,
      sinAnimacion: false,
    });
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    expect(alCubrir).toHaveBeenCalledOnce();
    expect(atajos).not.toHaveBeenCalled();
    expect(visible()).toBeNull();
    // Ya terminada, las teclas vuelven a llegar al mapa.
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    expect(atajos).toHaveBeenCalledOnce();
    document.removeEventListener('keydown', atajos);
    vi.advanceTimersByTime(5000);
    expect(alCubrir).toHaveBeenCalledOnce();

    const otra = vi.fn();
    const transicion = transicionAPartida({
      pais: { id: 'FRA', nombre: 'Francia' },
      fecha: '2010-01-01',
      alCubrir: otra,
      sinAnimacion: false,
    });
    transicion.elemento!.click();
    expect(otra).toHaveBeenCalledOnce();
  });

  it('con «reducir movimiento», sin transición: la partida se abre al instante', () => {
    const alCubrir = vi.fn();
    const alTerminar = vi.fn();
    const transicion = transicionAPartida({
      pais: { id: 'ESP', nombre: 'España' },
      fecha: '2010-01-01',
      alCubrir,
      alTerminar,
      sinAnimacion: true,
    });
    expect(alCubrir).toHaveBeenCalledOnce();
    expect(alTerminar).toHaveBeenCalledOnce();
    expect(transicion.elemento).toBeNull();
    expect(document.querySelector('.transicion')).toBeNull();
  });

  it('suena una fanfarria corta que sube, con nombre en la galería', () => {
    const notas = EFECTOS.comenzar;
    expect(notas.length).toBeGreaterThanOrEqual(3);
    const primeras = notas.slice(0, 3).map((n) => n.frecuencia);
    expect(primeras).toEqual([...primeras].sort((a, b) => a - b));
    expect(t('galeria.sonidos.comenzar')).toBe('Empezar una partida');
  });
});
