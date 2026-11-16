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
import {
  COLORES_SERIES,
  ajustarAlPaso,
  escalaLineal,
  formatoEje,
  marcasBonitas,
  ordenarFilas,
  posicionInformacion,
} from '../src/ui/componentes/escalas';
import { crearTabla } from '../src/ui/componentes/tabla';
import { crearDeslizador } from '../src/ui/componentes/deslizador';
import { conInformacion, ESPERA_INFORMACION_MS } from '../src/ui/componentes/info';
import { abrirMenuContextual, menuAbierto, SEPARADOR } from '../src/ui/componentes/menu';
import {
  barraDePartes,
  graficoBarras,
  graficoLineas,
  minigrafico,
} from '../src/ui/componentes/graficos';

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

describe('cuentas de tablas, gráficos e información (tarea f7-t2)', () => {
  it('escalas y marcas redondas de los ejes', () => {
    const x = escalaLineal([2000, 2010], [0, 100]);
    expect(x(2005)).toBe(50);
    expect(marcasBonitas(0, 37)).toEqual([0, 10, 20, 30, 40]);
    expect(marcasBonitas(-2.3, 8.1)).toEqual([-5, 0, 5, 10]);
    expect(marcasBonitas(0.1, 0.3, 3)).toEqual([0.1, 0.2, 0.3]);
    expect(formatoEje([0, 2500, 5000])(2500)).toBe('2.500');
    expect(formatoEje([0, 20000])(20000)).toMatch(/^20\smil$/);
    expect(formatoEje([-5, 5])(-5)).toBe('−5');
  });

  it('ordena filas: cifras, textos en español y los vacíos al final', () => {
    const filas = [
      { n: 'Ávila', v: 3 },
      { n: 'Albacete', v: null },
      { n: 'Zamora', v: 10 },
      { n: 'cáceres', v: 1 },
    ];
    expect(ordenarFilas(filas, (f) => f.v, 'desc').map((f) => f.n)).toEqual([
      'Zamora',
      'Ávila',
      'cáceres',
      'Albacete',
    ]);
    expect(ordenarFilas(filas, (f) => f.v, 'asc').map((f) => f.n)).toEqual([
      'cáceres',
      'Ávila',
      'Zamora',
      'Albacete',
    ]);
    expect(ordenarFilas(filas, (f) => f.n, 'asc').map((f) => f.n)).toEqual([
      'Albacete',
      'Ávila',
      'cáceres',
      'Zamora',
    ]);
  });

  for (const pantalla of PANTALLAS) {
    it(`la información cabe en la pantalla (${pantalla.ancho} × ${pantalla.alto})`, () => {
      const info = { ancho: 200, alto: 60 };
      const arriba = posicionInformacion({ x: 500, y: 300, ancho: 40, alto: 20 }, info, pantalla);
      expect(arriba).toEqual({ x: 420, y: 232, lado: 'arriba' });
      const abajo = posicionInformacion({ x: 2, y: 10, ancho: 40, alto: 20 }, info, pantalla);
      expect(abajo).toEqual({ x: 8, y: 38, lado: 'abajo' });
      const borde = posicionInformacion(
        { x: pantalla.ancho - 10, y: 400, ancho: 10, alto: 10 },
        info,
        pantalla,
      );
      expect(borde.x + info.ancho).toBeLessThanOrEqual(pantalla.ancho - 8);
    });
  }

  it('los deslizadores se quedan en su intervalo y en un múltiplo del paso', () => {
    expect(ajustarAlPaso(23.3, 0, 50, 0.5)).toBe(23.5);
    expect(ajustarAlPaso(-4, 0, 50, 1)).toBe(0);
    expect(ajustarAlPaso(99, 0, 50, 1)).toBe(50);
  });

  it('los colores de las series son los ocho validados, en su orden', () => {
    expect(COLORES_SERIES).toHaveLength(8);
    expect(new Set(COLORES_SERIES).size).toBe(8);
  });
});

describe('tablas ordenables (tarea f7-t2)', () => {
  const paises = [
    { nombre: 'España', paro: 19.9 },
    { nombre: 'Alemania', paro: 7.0 },
    { nombre: 'Grecia', paro: 12.7 },
  ];
  const columnas = [
    { id: 'nombre', titulo: 'País', valor: (p: (typeof paises)[number]) => p.nombre },
    {
      id: 'paro',
      titulo: 'Paro',
      valor: (p: (typeof paises)[number]) => p.paro,
      formato: (v: number | string) => `${v} %`,
    },
  ];

  it('ordena al pulsar el título de una columna, y al revés la segunda vez', () => {
    const tabla = crearTabla({ etiqueta: 'Paro', columnas, filas: paises });
    document.body.appendChild(tabla.elemento);
    const [nombre, paro] = [...tabla.elemento.querySelectorAll<HTMLButtonElement>('th button')];
    paro!.click();
    expect(tabla.filasVisibles.map((p) => p.nombre)).toEqual(['España', 'Grecia', 'Alemania']);
    expect(paro!.closest('th')!.getAttribute('aria-sort')).toBe('descending');
    paro!.click();
    expect(tabla.filasVisibles.map((p) => p.nombre)).toEqual(['Alemania', 'Grecia', 'España']);
    expect(paro!.closest('th')!.getAttribute('aria-sort')).toBe('ascending');
    nombre!.click();
    expect(tabla.filasVisibles.map((p) => p.nombre)).toEqual(['Alemania', 'España', 'Grecia']);
    expect(paro!.closest('th')!.hasAttribute('aria-sort')).toBe(false);
    const celdas = [...tabla.elemento.querySelectorAll('tbody tr:first-child td')];
    expect(celdas.map((c) => c.textContent)).toEqual(['Alemania', '7 %']);
    expect(celdas[1]!.classList.contains('tabla__numero')).toBe(true);
  });

  it('con acción por fila, las flechas recorren las filas e Intro elige', () => {
    const elegidas: string[] = [];
    const tabla = crearTabla({
      etiqueta: 'Paro',
      columnas,
      filas: paises,
      alElegir: (p) => elegidas.push(p.nombre),
    });
    document.body.appendChild(tabla.elemento);
    const filas = [...tabla.elemento.querySelectorAll<HTMLElement>('tbody tr')];
    expect(filas.map((f) => f.tabIndex)).toEqual([0, -1, -1]);
    filas[0]!.focus();
    tecla(filas[0]!, 'ArrowDown');
    expect(document.activeElement).toBe(filas[1]);
    tecla(filas[1]!, 'Enter');
    filas[2]!.click();
    expect(elegidas).toEqual(['Alemania', 'Grecia']);
  });
});

describe('deslizadores (tarea f7-t2)', () => {
  it('muestra el valor con su unidad y avisa al moverse', () => {
    const cambios: number[] = [];
    const deslizador = crearDeslizador({
      etiqueta: 'IVA',
      min: 0,
      max: 30,
      paso: 0.5,
      valor: 16,
      formato: (v) => `${v} %`,
      alCambiar: (v) => cambios.push(v),
    });
    document.body.appendChild(deslizador.elemento);
    expect(deslizador.elemento.querySelector('output')!.textContent).toBe('16 %');
    expect(deslizador.control.getAttribute('aria-valuetext')).toBe('16 %');
    expect(deslizador.elemento.querySelector('label')!.getAttribute('for')).toBe(
      deslizador.control.id,
    );
    deslizador.control.value = '21';
    deslizador.control.dispatchEvent(new Event('input', { bubbles: true }));
    expect(cambios).toEqual([21]);
    expect(deslizador.elemento.querySelector('output')!.textContent).toBe('21 %');
    deslizador.ponerValor(80);
    expect(deslizador.valor).toBe(30);
  });
});

describe('información al pasar el ratón (tarea f7-t2)', () => {
  it('aparece con el foco y tras un instante con el ratón; se va al salir', () => {
    vi.useFakeTimers();
    const boton = el('button', { type: 'button' }, 'PIB');
    document.body.appendChild(boton);
    const quitar = conInformacion(boton, () => ['Producto interior bruto de 2010']);
    boton.dispatchEvent(new FocusEvent('focus'));
    const info = document.getElementById('info-emergente')!;
    expect(info.hidden).toBe(false);
    expect(info.textContent).toBe('Producto interior bruto de 2010');
    expect(boton.getAttribute('aria-describedby')).toBe('info-emergente');
    boton.dispatchEvent(new FocusEvent('blur'));
    expect(info.hidden).toBe(true);
    boton.dispatchEvent(new PointerEvent('pointerenter'));
    expect(info.hidden).toBe(true);
    vi.advanceTimersByTime(ESPERA_INFORMACION_MS + 10);
    expect(info.hidden).toBe(false);
    boton.dispatchEvent(new PointerEvent('pointerleave'));
    expect(info.hidden).toBe(true);
    quitar();
    vi.useRealTimers();
  });
});

describe('menú contextual (tarea f7-t2)', () => {
  beforeEach(() => ponerPantalla(1280, 720));

  it('se abre con el foco en la primera opción y se maneja con el teclado', () => {
    const origen = el('button', { type: 'button' }, 'Mapa');
    document.body.appendChild(origen);
    origen.focus();
    const hechas: string[] = [];
    const menu = abrirMenuContextual({
      etiqueta: 'Acciones',
      titulo: 'España',
      x: 100,
      y: 100,
      opciones: [
        { etiqueta: 'Ver la ficha', accion: () => hechas.push('ficha') },
        SEPARADOR,
        { etiqueta: 'Desactivada', desactivada: true, accion: () => hechas.push('no') },
        { etiqueta: 'Centrar', accion: () => hechas.push('centrar') },
      ],
    });
    const opciones = [...menu.elemento.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    expect(menu.elemento.getAttribute('role')).toBe('menu');
    expect(opciones).toHaveLength(3);
    expect(document.activeElement).toBe(opciones[0]);
    tecla(opciones[0]!, 'ArrowUp');
    expect(document.activeElement).toBe(opciones[2]);
    opciones[1]!.click();
    expect(hechas).toEqual([]);
    expect(menu.abierto).toBe(true);
    const enDocumento = vi.fn();
    document.addEventListener('keydown', enDocumento);
    tecla(opciones[2]!, 'Escape');
    document.removeEventListener('keydown', enDocumento);
    expect(menu.abierto).toBe(false);
    expect(enDocumento).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(origen);
  });

  it('elegir una opción la hace y cierra el menú; solo hay un menú a la vez', () => {
    const hechas: string[] = [];
    const primero = abrirMenuContextual({
      etiqueta: 'A',
      x: 10,
      y: 10,
      opciones: [{ etiqueta: 'Uno', accion: () => hechas.push('uno') }],
    });
    const segundo = abrirMenuContextual({
      etiqueta: 'B',
      x: 1270,
      y: 700,
      opciones: [{ etiqueta: 'Dos', accion: () => hechas.push('dos') }],
    });
    expect(primero.abierto).toBe(false);
    expect(menuAbierto()).toBe(segundo);
    // Abierto junto al borde, no se sale de la pantalla.
    const [, x, y] = /translate\((\d+)px, (\d+)px\)/.exec(segundo.elemento.style.transform)!;
    expect(Number(x) + 220).toBeLessThanOrEqual(1280);
    expect(Number(y)).toBeLessThan(720);
    segundo.elemento.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click();
    expect(hechas).toEqual(['dos']);
    expect(menuAbierto()).toBeNull();
  });
});

describe('gráficos básicos (tarea f7-t2)', () => {
  const series = [
    {
      nombre: 'España',
      puntos: [
        [2008, 11.3],
        [2009, 17.9],
        [2010, 19.9],
      ] as [number, number][],
    },
    {
      nombre: 'Alemania',
      puntos: [
        [2008, 7.5],
        [2009, 7.7],
        [2010, 7.0],
      ] as [number, number][],
    },
  ];

  it('líneas: una por serie, leyenda, valores con las flechas y vista de tabla', () => {
    const figura = graficoLineas({ titulo: 'Paro', series, formatoY: (v) => `${v} %` });
    document.body.appendChild(figura);
    expect(figura.querySelectorAll('.grafico__linea')).toHaveLength(2);
    expect(figura.querySelectorAll('.grafico__leyenda li')).toHaveLength(2);
    const dibujo = figura.querySelector('svg')!;
    expect(dibujo.getAttribute('aria-label')).toContain('España, Alemania');
    tecla(dibujo, 'End');
    const info = figura.querySelector<HTMLElement>('.grafico__info')!;
    expect(info.hidden).toBe(false);
    expect(info.textContent).toContain('2010');
    expect(info.textContent).toContain('19.9 %');
    tecla(dibujo, 'ArrowLeft');
    expect(info.textContent).toContain('2009');
    const alternar = figura.querySelector<HTMLButtonElement>('.grafico__alternar')!;
    alternar.click();
    const filas = figura.querySelectorAll('.tabla tbody tr');
    expect(filas).toHaveLength(3);
    expect(figura.querySelector<HTMLElement>('.grafico__lienzo')!.hidden).toBe(true);
    alternar.click();
    expect(figura.querySelector<HTMLElement>('.grafico__lienzo')!.hidden).toBe(false);
  });

  it('una sola serie no lleva leyenda (el título ya la nombra)', () => {
    const figura = graficoLineas({ titulo: 'Paro de España', series: [series[0]!] });
    expect(figura.querySelector('.grafico__leyenda')).toBeNull();
  });

  it('barras: una por dato, con su valor en el extremo', () => {
    const figura = graficoBarras({
      titulo: 'PIB',
      barras: [
        { etiqueta: 'España', valor: 1430 },
        { etiqueta: 'Italia', valor: 2130 },
      ],
      formato: (v) => `${v} mil M$`,
    });
    const barras = figura.querySelectorAll('.grafico__barra');
    expect(barras).toHaveLength(2);
    expect(barras[1]!.getAttribute('aria-label')).toBe('Italia: 2130 mil M$');
    expect([...figura.querySelectorAll('.grafico__valor')].map((v) => v.textContent)).toEqual([
      '1430 mil M$',
      '2130 mil M$',
    ]);
  });

  it('barra de partes: cada parte con su porcentaje y leyenda; sin las vacías', () => {
    const figura = barraDePartes({
      titulo: 'Mix eléctrico',
      partes: [
        { etiqueta: 'Gas', valor: 64 },
        { etiqueta: 'Nuclear', valor: 62 },
        { etiqueta: 'Eólica', valor: 44 },
        { etiqueta: 'Solar', valor: 7 },
        { etiqueta: 'Carbón', valor: 0 },
      ],
    });
    const bloques = [...figura.querySelectorAll<HTMLElement>('.partes__bloque')];
    expect(bloques).toHaveLength(4);
    expect(bloques[0]!.textContent).toMatch(/36\s?%/);
    // La solar (4 %) es demasiado estrecha para escribir dentro: va en la leyenda y en la tabla.
    expect(bloques[3]!.textContent).toBe('');
    expect(bloques[3]!.getAttribute('aria-label')).toMatch(/Solar: 7 \(4\s?%\)/);
    expect(figura.querySelectorAll('.grafico__leyenda li')).toHaveLength(4);
  });

  it('minigráfico: una línea y un punto en el último valor', () => {
    const mini = minigrafico([1, 3, 2, 5], { etiqueta: 'Tendencia' });
    expect(mini.querySelector('path')!.getAttribute('d')!.split('L')).toHaveLength(4);
    expect(mini.querySelectorAll('circle')).toHaveLength(1);
    expect(mini.getAttribute('aria-label')).toBe('Tendencia');
  });
});
