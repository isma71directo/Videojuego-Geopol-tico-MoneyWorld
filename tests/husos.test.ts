// @vitest-environment happy-dom
/** Hora de la capital: husos horarios del 1 de enero de 2010 (tarea f11-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ConjuntoGobiernos } from '../src/datos/gobiernos';
import type { ConjuntoHusos } from '../src/datos/husos';
import type { ConjuntoPaises } from '../src/datos/paises';
import { crearPartida } from '../src/sim/partida';
import { etiquetaHuso, instanteUTC, textoHora } from '../src/sim/reloj';
import { crearBarraPartida } from '../src/ui/barra-partida';
import { abrirPantallaNuevaPartida } from '../src/ui/nueva-partida';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(resolve(ruta), 'utf8')) as T;
const paises = leer<ConjuntoPaises>('public/data/paises-2010.json');
const gobiernos = leer<ConjuntoGobiernos>('public/data/gobiernos-2010.json');
const husos = leer<ConjuntoHusos>('public/data/husos-2010.json');
const manual = leer<{ zonas: Record<string, { zona: string; motivo: string }> }>(
  'scripts/datos/manual/husos-2010.json',
);

afterEach(() => document.body.replaceChildren());

describe('husos horarios de 2010 (datos)', () => {
  it('todos los países y territorios tienen su huso, con una zona IANA válida', () => {
    expect(Object.keys(husos.paises).sort()).toEqual(Object.keys(paises.paises).sort());
    for (const [id, [zona, minutos]] of Object.entries(husos.paises)) {
      expect(() => new Intl.DateTimeFormat('es', { timeZone: zona }), id).not.toThrow();
      expect(Math.abs(minutos) % 15, id).toBe(0);
      expect(minutos, id).toBeGreaterThanOrEqual(-12 * 60);
      expect(minutos, id).toBeLessThanOrEqual(14 * 60);
    }
    expect(husos.fecha).toBe('2010-01-01');
    expect(husos.fuente).toContain('IANA');
  });

  it('la hora de 2010, no la de hoy: Caracas a −4:30, Samoa a −11 y el verano del sur', () => {
    const minutos = (id: string) => husos.paises[id]![1];
    expect(minutos('ESP')).toBe(60);
    expect(minutos('GBR')).toBe(0);
    expect(minutos('IND')).toBe(330);
    expect(minutos('NPL')).toBe(345);
    expect(minutos('CHN')).toBe(480);
    expect(minutos('USA')).toBe(-300);
    expect(minutos('RUS')).toBe(180);
    // Venezuela volvió a −4 en 2016; Samoa saltó la línea de fecha a finales de 2011.
    expect(minutos('VEN')).toBe(-270);
    expect(minutos('WSM')).toBe(-660);
    // En enero es verano en el sur: Brasil y Australia (Canberra) tenían su hora de verano.
    expect(minutos('BRA')).toBe(-120);
    expect(minutos('AUS')).toBe(660);
  });

  it('los husos a mano dicen por qué y están en el resultado', () => {
    for (const [id, { zona, motivo }] of Object.entries(manual.zonas)) {
      expect(motivo.length, id).toBeGreaterThan(10);
      expect(husos.paises[id]![0], id).toBe(zona);
    }
    expect(husos.paises.ABK![0]).toBe('Europe/Moscow');
    expect(husos.paises.XKX![1]).toBe(60);
  });

  it('el script dice de dónde salen los datos y de qué año son', () => {
    const script = readFileSync(resolve('scripts/datos/24-husos.ts'), 'utf8');
    expect(script).toContain('IANA');
    expect(script).toContain('dominio público');
    expect(script).toContain('2010');
  });
});

describe('el reloj marca la hora de la capital (tarea f11-t2)', () => {
  it('etiquetas de los husos y de las horas', () => {
    expect(etiquetaHuso(60)).toBe('UTC+1');
    expect(etiquetaHuso(-270)).toBe('UTC−4:30');
    expect(etiquetaHuso(345)).toBe('UTC+5:45');
    expect(etiquetaHuso(0)).toBe('UTC');
    expect(textoHora(0)).toBe('00:00');
    expect(textoHora(17)).toBe('17:00');
  });

  it('la medianoche de Madrid del 1 de enero de 2010 son las 23:00 UTC del día anterior', () => {
    const utc = instanteUTC(
      { fecha: '2010-01-01', hora: 0 },
      { zona: 'Europe/Madrid', minutos: 60 },
    );
    expect(new Date(utc).toISOString()).toBe('2009-12-31T23:00:00.000Z');
    const caracas = instanteUTC(
      { fecha: '2010-01-01', hora: 0 },
      { zona: 'America/Caracas', minutos: -270 },
    );
    expect(new Date(caracas).toISOString()).toBe('2010-01-01T04:30:00.000Z');
  });

  it('la partida guarda el huso de la capital del jugador', () => {
    const crear = (paisId: string) =>
      crearPartida(
        { paisId, dificultad: 'normal', eventosHistoricos: true, semilla: 1 },
        paises.paises,
        gobiernos.paises,
        husos.paises,
      );
    expect(crear('ESP').huso).toEqual({ zona: 'Europe/Madrid', minutos: 60 });
    expect(crear('NPL').huso).toEqual({ zona: 'Asia/Kathmandu', minutos: 345 });
  });

  it('la barra enseña la hora y explica que es la de la capital', () => {
    const partida = crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 1 },
      paises.paises,
      gobiernos.paises,
      husos.paises,
    );
    const barra = crearBarraPartida({ partida, alIrAlPais: () => undefined });
    document.body.appendChild(barra.elemento);
    barra.ponerNombrePais('España', 'Madrid');
    expect(barra.elemento.querySelector('.partida-barra__hora')!.textContent).toBe('00:00');
    expect(barra.elemento.querySelector('time')!.getAttribute('datetime')).toBe('2010-01-01T00:00');
    const fecha = barra.elemento.querySelector<HTMLElement>('.partida-barra__dato--fecha')!;
    fecha.dispatchEvent(new FocusEvent('focus'));
    fecha.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.querySelector('.info:not([hidden])')!.textContent).toContain(
      'hora local de Madrid (UTC+1)',
    );
    barra.actualizar({ ...partida, hora: 9 });
    expect(barra.elemento.querySelector('.partida-barra__hora')!.textContent).toBe('09:00');
    barra.destruir();
  });

  it('«Nueva partida» enseña el huso del país elegido', () => {
    const pantalla = abrirPantallaNuevaPartida({
      alEmpezar: () => undefined,
      alVolver: () => undefined,
      sinMapa: true,
      datos: { paises, gobiernos, husos },
    });
    pantalla.elegir('NPL');
    expect(document.querySelector('.nueva-partida__resumen')!.textContent).toMatch(
      /Huso horarioUTC\+5:45/,
    );
    pantalla.cerrar();
  });
});
