// @vitest-environment happy-dom
/** Nueva partida: el motor y la pantalla (tarea f10-t1). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConjuntoGobiernos } from '../src/datos/gobiernos';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  crearPartida,
  FECHA_INICIO,
  FORMATO_PARTIDA,
  paisesJugables,
  type Partida,
} from '../src/sim/partida';
import { semillaNueva } from '../src/sim/azar';
import {
  abrirPantallaNuevaPartida,
  datoDeLista,
  filtrarPaises,
  ordenarPaises,
} from '../src/ui/nueva-partida';
import { TIEMPOS_TRANSICION } from '../src/ui/transicion-partida';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(resolve(ruta), 'utf8')) as T;
const paises = leer<ConjuntoPaises>('public/data/paises-2010.json');
const gobiernos = leer<ConjuntoGobiernos>('public/data/gobiernos-2010.json');

describe('crear la partida (motor, tarea f10-t1)', () => {
  it('se puede crear una partida con cualquier país jugable (prueba del GDD)', () => {
    const jugables = paisesJugables(paises.paises);
    expect(jugables.length).toBeGreaterThan(200);
    for (const id of jugables) {
      const partida = crearPartida(
        { paisId: id, dificultad: 'normal', eventosHistoricos: true, semilla: 7 },
        paises.paises,
      );
      expect(partida).toEqual<Partida>({
        formato: FORMATO_PARTIDA,
        semilla: 7,
        fecha: FECHA_INICIO,
        hora: 0,
        // Sin los husos, UTC (con ellos, la hora de la capital: tests/husos.test.ts).
        huso: { zona: 'UTC', minutos: 0 },
        jugador: { paisId: id, rol: 'gobierno' },
        opciones: { dificultad: 'normal', eventosHistoricos: true },
        paises: partida.paises,
        efectos: [],
        agenda: [],
      });
      expect(partida.paises[id]).toBeDefined();
    }
    expect(FECHA_INICIO).toBe('2010-01-01');
  });

  it('no deja empezar con un país no jugable, inexistente o con datos raros', () => {
    const crear = (paisId: string, extra = {}) =>
      crearPartida(
        { paisId, dificultad: 'normal', eventosHistoricos: true, semilla: 1, ...extra },
        paises.paises,
      );
    expect(() => crear('VAT')).toThrow(/no es jugable/);
    expect(() => crear('ESH')).toThrow(/no es jugable/);
    expect(() => crear('XXX')).toThrow(/No existe/);
    expect(() => crear('ESP', { semilla: 0 })).toThrow(/Semilla/);
    expect(() => crear('ESP', { semilla: 1.5 })).toThrow(/Semilla/);
    expect(() => crear('ESP', { dificultad: 'imposible' })).toThrow(/Dificultad/);
  });

  it('cada partida, su propio azar: una semilla nueva que no se elige (ajuste f11-a5)', () => {
    const semillas = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const s = semillaNueva();
      expect(Number.isSafeInteger(s) && s >= 1 && s < 2 ** 32).toBe(true);
      semillas.add(s);
    }
    // Cincuenta partidas, cincuenta azares distintos.
    expect(semillas.size).toBe(50);
  });
});

describe('lista de países (tarea f10-t1)', () => {
  const jugables = Object.values(paises.paises).filter((p) => p.jugable);

  it('se ordena por nombre, población, PIB, PIB por habitante o región', () => {
    expect(ordenarPaises(jugables, 'nombre')[0]!.nombre).toBe('Abjasia');
    expect(ordenarPaises(jugables, 'poblacion')[0]!.id).toBe('CHN');
    expect(ordenarPaises(jugables, 'pib')[0]!.id).toBe('USA');
    const porRegion = ordenarPaises(jugables, 'region');
    expect(
      porRegion[0]!.regionNombre.localeCompare(porRegion.at(-1)!.regionNombre, 'es'),
    ).toBeLessThanOrEqual(0);
    expect(datoDeLista(paises.paises.ESP!, 'poblacion')).toMatch(/millones/);
    expect(datoDeLista(paises.paises.ESP!, 'region')).toBe('Europa y Asia Central');
  });

  it('se filtra con y sin tildes', () => {
    expect(filtrarPaises(jugables, 'espana').map((p) => p.id)).toContain('ESP');
    expect(filtrarPaises(jugables, 'Japón').map((p) => p.id)).toEqual(['JPN']);
    expect(filtrarPaises(jugables, '').length).toBe(jugables.length);
  });
});

describe('pantalla «Nueva partida» (tarea f10-t1)', () => {
  afterEach(() => document.body.replaceChildren());

  const abrir = () => {
    const alEmpezar = vi.fn();
    const alVolver = vi.fn();
    const pantalla = abrirPantallaNuevaPartida({
      alEmpezar,
      alVolver,
      sinMapa: true,
      datos: { paises, gobiernos },
    });
    return { pantalla, alEmpezar, alVolver };
  };
  const opciones = (): HTMLElement[] => [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ];
  const boton = (): HTMLButtonElement =>
    document.querySelector<HTMLButtonElement>('.nueva-partida__empezar')!;

  it('lista los países jugables y no deja empezar sin elegir', () => {
    abrir();
    expect(opciones()).toHaveLength(paisesJugables(paises.paises).length);
    expect(boton().disabled).toBe(true);
    expect(boton().textContent).toContain('Elige un país');
  });

  it('al elegir (clic en la lista) enseña el país, su líder y permite empezar', () => {
    const { alEmpezar } = abrir();
    opciones()
      .find((o) => o.dataset.pais === 'ESP')!
      .click();
    const resumen = document.querySelector('.nueva-partida__resumen')!.textContent!;
    expect(resumen).toContain('España');
    expect(resumen).toContain('Rodríguez Zapatero');
    expect(resumen).toContain('Monarquía parlamentaria');
    expect(document.querySelector('.nueva-partida__retrato svg')).not.toBeNull();
    // Tesorería y popularidad iniciales, marcadas como estimación, y cómo se estiman.
    const tesoreria = document.querySelector('.nueva-partida__inicio--tesoreria dd')!;
    expect(tesoreria.textContent).toMatch(/^43\.\d{3} M\$\*$/);
    expect(tesoreria.classList.contains('es-estimado')).toBe(true);
    const popularidad = document.querySelector('.nueva-partida__inicio--popularidad dd')!;
    expect(popularidad.textContent).toMatch(/^\d{2} %\*$/);
    const factores = [...document.querySelectorAll<HTMLElement>('.nueva-partida__desglose li')];
    expect(factores.map((f) => f.dataset.factor)).toEqual([
      'base',
      'crecimiento',
      'paro',
      'inflacion',
      'desgaste',
    ]);
    expect(factores[4]!.textContent).toMatch(/Desgaste por años en el cargo−6,9/);
    expect(boton().disabled).toBe(false);
    expect(boton().textContent).toBe('Empezar con España');
    // Opciones: dificultad realista, sin eventos y una semilla escrita.
    document.querySelector<HTMLInputElement>('input[value="realista"]')!.click();
    const eventos = document.querySelector<HTMLInputElement>(
      '.nueva-partida__opcion--casilla input',
    )!;
    eventos.click();
    // Sin campo de semilla (ajuste f11-a5): cada partida tiene su propio azar.
    expect(document.querySelector('.nueva-partida__semilla')).toBeNull();
    // Al empezar, la transición (tarea f10-t4) cubre la pantalla y la partida se abre debajo.
    vi.useFakeTimers();
    boton().click();
    expect(boton().disabled).toBe(true);
    const transicion = document.querySelector<HTMLElement>('.transicion')!;
    expect(transicion.textContent).toContain('España');
    expect(transicion.textContent).toContain('1 de enero de 2010');
    expect(alEmpezar).not.toHaveBeenCalled();
    boton().click();
    vi.advanceTimersByTime(TIEMPOS_TRANSICION.cubrir);
    expect(alEmpezar).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(TIEMPOS_TRANSICION.mantener + TIEMPOS_TRANSICION.descubrir + 200);
    vi.useRealTimers();
    expect(document.querySelector('.transicion:not(.retirandose)')).toBeNull();
    expect(alEmpezar).toHaveBeenCalledWith(
      expect.objectContaining({
        semilla: expect.any(Number),
        jugador: { paisId: 'ESP', rol: 'gobierno' },
        opciones: { dificultad: 'realista', eventosHistoricos: false },
      }),
    );
    // La partida empieza con la popularidad que se ha enseñado.
    const partida = alEmpezar.mock.calls[0]![0] as Partida;
    expect(`${partida.paises.ESP!.popularidad} %*`).toBe(popularidad.textContent);
  });

  it('un país no jugable no se puede elegir y lo dice', () => {
    const { pantalla } = abrir();
    pantalla.elegir('VAT');
    expect(document.querySelector('.nueva-partida__aviso')!.textContent).toContain(
      'no se puede elegir',
    );
    expect(boton().disabled).toBe(true);
  });

  it('filtro, orden y teclado en la lista', () => {
    abrir();
    const filtro = document.querySelector<HTMLInputElement>('.nueva-partida__filtro')!;
    filtro.value = 'japon';
    filtro.dispatchEvent(new Event('input'));
    expect(opciones().map((o) => o.dataset.pais)).toEqual(['JPN']);
    filtro.value = '';
    filtro.dispatchEvent(new Event('input'));
    const orden = document.querySelector<HTMLSelectElement>('.nueva-partida__orden')!;
    orden.value = 'poblacion';
    orden.dispatchEvent(new Event('change'));
    expect(opciones()[0]!.dataset.pais).toBe('CHN');
    // Flecha abajo: elige el siguiente (la India, segunda en población).
    const lista = document.querySelector<HTMLElement>('[role="listbox"]')!;
    lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(
      document.querySelector('[role="option"][aria-selected="true"]')!.getAttribute('data-pais'),
    ).toBe('IND');
  });

  it('el botón de volver avisa', () => {
    const { alVolver } = abrir();
    document.querySelector<HTMLButtonElement>('.nueva-partida__volver')!.click();
    expect(alVolver).toHaveBeenCalled();
  });
});
