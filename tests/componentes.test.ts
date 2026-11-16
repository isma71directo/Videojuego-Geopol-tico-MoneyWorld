// @vitest-environment happy-dom
/** Componentes de interfaz (Fase 7, tarea f7-t1): ventanas, paneles y pestañas. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BARRA_VISIBLE,
  MARGEN_PANTALLA,
  indiceConTecla,
  limitarVentana,
  pasoConTecla,
  posicionEnCascada,
} from '../src/ui/componentes/geometria';
import { abrirPanel, panelEn } from '../src/ui/componentes/panel';
import { crearPestanas } from '../src/ui/componentes/pestanas';
import { abrirVentana, cerrarVentanas, ventanasAbiertas } from '../src/ui/componentes/ventana';
import { el } from '../src/ui/dom';

const PANTALLAS = [
  { ancho: 1280, alto: 720 },
  { ancho: 1920, alto: 1080 },
] as const;

function ponerPantalla(ancho: number, alto: number): void {
  Object.defineProperty(window, 'innerWidth', { value: ancho, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: alto, configurable: true });
}

function tecla(destino: Element, key: string, extra: KeyboardEventInit = {}): KeyboardEvent {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
  destino.dispatchEvent(evento);
  return evento;
}

function puntero(destino: Element, tipo: string, x: number, y: number): void {
  destino.dispatchEvent(
    new PointerEvent(tipo, {
      clientX: x,
      clientY: y,
      button: 0,
      pointerId: 1,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe('cuentas de los componentes (tarea f7-t1)', () => {
  for (const pantalla of PANTALLAS) {
    it(`una ventana nunca se sale de la pantalla (${pantalla.ancho} × ${pantalla.alto})`, () => {
      const ventana = { ancho: 420, alto: 300 };
      expect(limitarVentana({ ...ventana, x: 5000, y: 5000 }, pantalla)).toEqual({
        x: pantalla.ancho - 420 - MARGEN_PANTALLA,
        y: pantalla.alto - BARRA_VISIBLE - MARGEN_PANTALLA,
      });
      expect(limitarVentana({ ...ventana, x: -300, y: -50 }, pantalla)).toEqual({
        x: MARGEN_PANTALLA,
        y: MARGEN_PANTALLA,
      });
      // Más ancha que la pantalla: pegada al margen izquierdo.
      expect(limitarVentana({ x: 300, y: 100, ancho: 4000, alto: 200 }, pantalla).x).toBe(
        MARGEN_PANTALLA,
      );
      // Las ventanas nuevas se abren en cascada, dentro de la pantalla.
      for (let n = 0; n < 40; n++) {
        const { x, y } = posicionEnCascada(n, pantalla, 420);
        expect(x + 420).toBeLessThanOrEqual(pantalla.ancho);
        expect(y).toBeLessThan(pantalla.alto - 100);
      }
    });
  }

  it('las flechas recorren una lista dando la vuelta; Inicio y Fin van a los extremos', () => {
    expect(indiceConTecla(0, 'ArrowRight', 4)).toBe(1);
    expect(indiceConTecla(3, 'ArrowRight', 4)).toBe(0);
    expect(indiceConTecla(0, 'ArrowLeft', 4)).toBe(3);
    expect(indiceConTecla(2, 'Home', 4)).toBe(0);
    expect(indiceConTecla(1, 'End', 4)).toBe(3);
    expect(indiceConTecla(1, 'ArrowDown', 4)).toBeNull();
    expect(indiceConTecla(1, 'ArrowDown', 4, 'vertical')).toBe(2);
    expect(indiceConTecla(0, 'a', 4)).toBeNull();
    expect(pasoConTecla('ArrowRight', false)).toEqual([16, 0]);
    expect(pasoConTecla('ArrowUp', true)).toEqual([0, -64]);
    expect(pasoConTecla('Enter', false)).toBeNull();
  });
});

describe('ventanas flotantes (tarea f7-t1)', () => {
  beforeEach(() => {
    localStorage.clear();
    ponerPantalla(1280, 720);
  });
  afterEach(() => cerrarVentanas());

  it('se abre con su título, recibe el foco y no se abre dos veces', () => {
    const ventana = abrirVentana({ id: 'prueba', titulo: 'Economía', contenido: ['Hola'] });
    expect(ventana.elemento.getAttribute('role')).toBe('dialog');
    const titulo = document.getElementById(ventana.elemento.getAttribute('aria-labelledby')!);
    expect(titulo?.textContent).toBe('Economía');
    expect(ventana.cuerpo.textContent).toBe('Hola');
    expect(document.activeElement).toBe(ventana.elemento);
    expect(abrirVentana({ id: 'prueba', titulo: 'Otra', contenido: [] })).toBe(ventana);
    expect(ventanasAbiertas()).toHaveLength(1);
  });

  it('varias a la vez: la que se toca pasa delante', () => {
    const a = abrirVentana({ id: 'a', titulo: 'A', contenido: [] });
    const b = abrirVentana({ id: 'b', titulo: 'B', contenido: [] });
    expect(ventanasAbiertas().map((v) => v.id)).toEqual(['a', 'b']);
    puntero(a.cuerpo, 'pointerdown', 200, 200);
    expect(ventanasAbiertas().map((v) => v.id)).toEqual(['b', 'a']);
    b.elemento.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(ventanasAbiertas().at(-1)).toBe(b);
  });

  it('se mueve arrastrando el título, sin salirse de la pantalla, y recuerda su sitio', () => {
    const ventana = abrirVentana({ id: 'mover', titulo: 'Mover', contenido: [], ancho: 400 });
    ventana.mover(100, 100);
    const cabecera = ventana.elemento.querySelector('.ventana__cabecera')!;
    puntero(cabecera, 'pointerdown', 150, 110);
    puntero(cabecera, 'pointermove', 450, 310);
    expect(ventana.posicion()).toEqual({ x: 400, y: 300 });
    // Muy lejos: se queda dentro.
    puntero(cabecera, 'pointermove', 5000, 5000);
    expect(ventana.posicion()).toEqual({
      x: 1280 - 400 - MARGEN_PANTALLA,
      y: 720 - BARRA_VISIBLE - MARGEN_PANTALLA,
    });
    puntero(cabecera, 'pointermove', 450, 310);
    puntero(cabecera, 'pointerup', 450, 310);
    ventana.cerrar();
    const otra = abrirVentana({ id: 'mover', titulo: 'Mover', contenido: [], ancho: 400 });
    expect(otra.posicion()).toEqual({ x: 400, y: 300 });
  });

  it('con el teclado: Alt + flechas la mueven y Escape la cierra sin llegar al mapa', () => {
    const alCerrar = vi.fn();
    const ventana = abrirVentana({ id: 'teclado', titulo: 'T', contenido: [], alCerrar });
    ventana.mover(300, 200);
    tecla(ventana.elemento, 'ArrowRight', { altKey: true });
    expect(ventana.posicion()).toEqual({ x: 316, y: 200 });
    tecla(ventana.elemento, 'ArrowDown', { altKey: true, shiftKey: true });
    expect(ventana.posicion()).toEqual({ x: 316, y: 264 });
    // Sin Alt, las flechas no la mueven (son para su contenido).
    tecla(ventana.elemento, 'ArrowRight');
    expect(ventana.posicion().x).toBe(316);
    const enDocumento = vi.fn();
    document.addEventListener('keydown', enDocumento);
    tecla(ventana.elemento, 'Escape');
    document.removeEventListener('keydown', enDocumento);
    expect(ventana.abierta).toBe(false);
    expect(alCerrar).toHaveBeenCalledOnce();
    expect(enDocumento).not.toHaveBeenCalled();
    expect(ventana.elemento.isConnected).toBe(false);
  });

  it('se cierra con su botón', () => {
    const ventana = abrirVentana({ id: 'boton', titulo: 'Botón', contenido: [] });
    (ventana.elemento.querySelector('.ventana__cerrar') as HTMLButtonElement).click();
    expect(ventana.abierta).toBe(false);
  });

  for (const pantalla of PANTALLAS) {
    it(`cabe en la pantalla aunque se guardara fuera (${pantalla.ancho} × ${pantalla.alto})`, () => {
      localStorage.setItem(
        'geopolitica-2010.ventanas.grande',
        JSON.stringify({ x: 3000, y: 2000 }),
      );
      ponerPantalla(pantalla.ancho, pantalla.alto);
      const ventana = abrirVentana({ id: 'grande', titulo: 'G', contenido: [], ancho: 900 });
      const { x, y } = ventana.posicion();
      expect(x + 900).toBeLessThanOrEqual(pantalla.ancho);
      expect(y + BARRA_VISIBLE).toBeLessThanOrEqual(pantalla.alto);
      // Si la pantalla se hace más pequeña, la ventana vuelve a caber.
      ponerPantalla(1280, 720);
      window.dispatchEvent(new Event('resize'));
      expect(ventana.posicion().x + 900).toBeLessThanOrEqual(1280);
    });
  }
});

describe('paneles laterales (tarea f7-t1)', () => {
  it('uno por lado: el nuevo sustituye al anterior; Escape lo cierra', () => {
    const cerrado = vi.fn();
    const primero = abrirPanel({
      titulo: 'Gobierno',
      lado: 'izquierda',
      contenido: ['a'],
      alCerrar: cerrado,
    });
    const derecho = abrirPanel({ titulo: 'Ficha', lado: 'derecha', contenido: [] });
    const segundo = abrirPanel({ titulo: 'Economía', lado: 'izquierda', contenido: ['b'] });
    expect(primero.abierto).toBe(false);
    expect(cerrado).toHaveBeenCalledOnce();
    expect(panelEn('izquierda')).toBe(segundo);
    expect(panelEn('derecha')).toBe(derecho);
    expect(segundo.elemento.classList.contains('panel--izquierda')).toBe(true);
    expect(document.activeElement).toBe(segundo.elemento);
    tecla(segundo.elemento, 'Escape');
    expect(panelEn('izquierda')).toBeNull();
    (derecho.elemento.querySelector('.panel__cerrar') as HTMLButtonElement).click();
    expect(panelEn('derecha')).toBeNull();
  });
});

describe('pestañas (tarea f7-t1)', () => {
  function grupo() {
    const creadas: string[] = [];
    const cambios: string[] = [];
    const pestanas = ['resumen', 'economia', 'politica'].map((id) => ({
      id,
      titulo: id,
      contenido: () => {
        creadas.push(id);
        return [el('p', {}, `Contenido de ${id}`)];
      },
    }));
    const pestanasGrupo = crearPestanas(pestanas, {
      etiqueta: 'Secciones',
      alCambiar: (id) => cambios.push(id),
    });
    document.body.appendChild(pestanasGrupo.elemento);
    const botones = [...pestanasGrupo.elemento.querySelectorAll<HTMLElement>('[role="tab"]')];
    const paneles = [...pestanasGrupo.elemento.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    return { pestanasGrupo, botones, paneles, creadas, cambios };
  }

  it('empieza en la primera y solo crea su contenido', () => {
    const { pestanasGrupo, botones, paneles, creadas, cambios } = grupo();
    expect(pestanasGrupo.activa).toBe('resumen');
    expect(botones.map((b) => b.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(botones.map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    expect(paneles.map((p) => p.hidden)).toEqual([false, true, true]);
    expect(creadas).toEqual(['resumen']);
    expect(cambios).toEqual([]);
    expect(paneles[0]!.getAttribute('aria-labelledby')).toBe(botones[0]!.id);
  });

  it('se maneja con las flechas, Inicio y Fin, y con el ratón', () => {
    const { pestanasGrupo, botones, paneles, creadas, cambios } = grupo();
    botones[0]!.focus();
    tecla(botones[0]!, 'ArrowRight');
    expect(pestanasGrupo.activa).toBe('economia');
    expect(document.activeElement).toBe(botones[1]);
    expect(paneles[1]!.hidden).toBe(false);
    tecla(botones[1]!, 'End');
    expect(pestanasGrupo.activa).toBe('politica');
    tecla(botones[2]!, 'ArrowRight');
    expect(pestanasGrupo.activa).toBe('resumen');
    tecla(botones[0]!, 'ArrowLeft');
    expect(pestanasGrupo.activa).toBe('politica');
    tecla(botones[2]!, 'Home');
    expect(pestanasGrupo.activa).toBe('resumen');
    botones[1]!.click();
    expect(pestanasGrupo.activa).toBe('economia');
    // Cada contenido se crea una sola vez.
    expect(creadas).toEqual(['resumen', 'economia', 'politica']);
    expect(cambios).toEqual(['economia', 'politica', 'resumen', 'politica', 'resumen', 'economia']);
  });
});
