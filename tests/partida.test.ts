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
  semillaAlAzar,
  semillaDeTexto,
  type Partida,
} from '../src/sim/partida';
import {
  abrirPantallaNuevaPartida,
  datoDeLista,
  filtrarPaises,
  ordenarPaises,
} from '../src/ui/nueva-partida';

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
        jugador: { paisId: id, rol: 'gobierno' },
        opciones: { dificultad: 'normal', eventosHistoricos: true },
      });
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

  it('semillas: al azar, un número tal cual o una palabra (siempre la misma)', () => {
    for (let i = 0; i < 50; i++) {
      const s = semillaAlAzar();
      expect(Number.isInteger(s) && s >= 1 && s <= 999_999_999).toBe(true);
    }
    expect(semillaAlAzar(() => 0)).toBe(1);
    expect(semillaDeTexto('12345')).toBe(12345);
    expect(semillaDeTexto(' 42 ')).toBe(42);
    expect(semillaDeTexto('España')).toBe(semillaDeTexto('España'));
    expect(semillaDeTexto('España')).not.toBe(semillaDeTexto('Francia'));
    expect(semillaDeTexto('España')).toBeGreaterThan(0);
    expect(semillaDeTexto('')).toBeNull();
    expect(semillaDeTexto('   ')).toBeNull();
    expect(semillaDeTexto('0')).toBeNull();
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
    expect(boton().disabled).toBe(false);
    expect(boton().textContent).toBe('Empezar con España');
    // Opciones: dificultad realista, sin eventos y una semilla escrita.
    document.querySelector<HTMLInputElement>('input[value="realista"]')!.click();
    const eventos = document.querySelector<HTMLInputElement>(
      '.nueva-partida__opcion--casilla input',
    )!;
    eventos.click();
    const semilla = document.querySelector<HTMLInputElement>('.nueva-partida__semilla')!;
    semilla.value = '2010';
    semilla.dispatchEvent(new Event('input'));
    boton().click();
    expect(alEmpezar).toHaveBeenCalledWith(
      expect.objectContaining({
        semilla: 2010,
        jugador: { paisId: 'ESP', rol: 'gobierno' },
        opciones: { dificultad: 'realista', eventosHistoricos: false },
      }),
    );
  });

  it('un país no jugable no se puede elegir y lo dice', () => {
    const { pantalla } = abrir();
    pantalla.elegir('VAT');
    expect(document.querySelector('.nueva-partida__aviso')!.textContent).toContain(
      'no se puede elegir',
    );
    expect(boton().disabled).toBe(true);
  });

  it('sin semilla válida no se puede empezar; el dado pone otra', () => {
    const { pantalla } = abrir();
    pantalla.elegir('JPN');
    const semilla = document.querySelector<HTMLInputElement>('.nueva-partida__semilla')!;
    semilla.value = '';
    semilla.dispatchEvent(new Event('input'));
    expect(boton().disabled).toBe(true);
    expect(document.querySelector<HTMLElement>('.nueva-partida__error')!.hidden).toBe(false);
    document.querySelector<HTMLButtonElement>('.nueva-partida__dado')!.click();
    expect(semilla.value).toMatch(/^\d+$/);
    expect(boton().disabled).toBe(false);
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
