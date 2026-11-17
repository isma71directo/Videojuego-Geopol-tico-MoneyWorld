// @vitest-environment happy-dom
/** Audiovisual de la Fase 11: noche y día, reloj de manecillas y sonidos (tarea f11-t4). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EFECTOS } from '../src/av/sonido';
import type { ConjuntoPaises } from '../src/datos/paises';
import { t } from '../src/i18n';
import {
  alturaDelSol,
  pintarNoche,
  posicionDelSol,
  SOMBRA_NOCHE,
  sombraPara,
} from '../src/map/noche';
import { crearPartida } from '../src/sim/partida';
import { leerAjuste } from '../src/ui/ajustes';
import { crearBarraPartida } from '../src/ui/barra-partida';
import { angulosAgujas, crearRelojAnalogico, esDeNoche } from '../src/ui/reloj-analogico';

afterEach(() => document.body.replaceChildren());

describe('posición del Sol (tarea f11-t4)', () => {
  it('1 de enero de 2010 a mediodía UTC: el Sol a −23° y casi sobre Greenwich', () => {
    const sol = posicionDelSol(Date.UTC(2010, 0, 1, 12));
    expect(sol.declinacion).toBeCloseTo(-23.0, 0);
    // La ecuación del tiempo es de unos −3,5 min: el Sol pasa por Greenwich a las 12:03.
    expect(sol.longitud).toBeGreaterThan(0.5);
    expect(sol.longitud).toBeLessThan(1.2);
  });

  it('equinoccio y solsticio de 2010; a medianoche UTC, el Sol sobre el Pacífico', () => {
    expect(Math.abs(posicionDelSol(Date.UTC(2010, 2, 20, 17, 32)).declinacion)).toBeLessThan(0.1);
    expect(posicionDelSol(Date.UTC(2010, 5, 21, 11, 28)).declinacion).toBeCloseTo(23.44, 1);
    expect(Math.abs(posicionDelSol(Date.UTC(2010, 0, 1, 0)).longitud)).toBeGreaterThan(178);
    // Cada hora, el Sol avanza 15° hacia el oeste.
    const a = posicionDelSol(Date.UTC(2010, 0, 1, 12)).longitud;
    const b = posicionDelSol(Date.UTC(2010, 0, 1, 13)).longitud;
    expect(a - b).toBeCloseTo(15, 1);
  });

  it('altura del Sol: 90° bajo él, −90° en las antípodas; noche polar en enero', () => {
    const sol = posicionDelSol(Date.UTC(2010, 0, 1, 12));
    expect(alturaDelSol(sol.declinacion, sol.longitud, sol)).toBeCloseTo(90, 3);
    expect(alturaDelSol(-sol.declinacion, sol.longitud + 180, sol)).toBeCloseTo(-90, 3);
    // Mediodía en Tromsø (69,6° N): el Sol no sale.
    expect(alturaDelSol(69.6, 18.9, sol)).toBeLessThan(0);
    // Mediodía en Madrid: el Sol a 90 − 40,4 − 23,0 = 26,6°.
    const madrid = alturaDelSol(40.4, -3.7, posicionDelSol(Date.UTC(2010, 0, 1, 12, 15)));
    expect(madrid).toBeCloseTo(26.6, 0);
  });
});

describe('sombra de la noche (tarea f11-t4)', () => {
  it('ninguna de día, entera de noche y un degradado suave en el crepúsculo', () => {
    expect(sombraPara(30)).toBe(0);
    expect(sombraPara(-30)).toBe(SOMBRA_NOCHE);
    let anterior = 0;
    for (let altura = 1; altura >= -12; altura -= 0.5) {
      const sombra = sombraPara(altura);
      expect(sombra).toBeGreaterThanOrEqual(anterior);
      anterior = sombra;
    }
    expect(sombraPara(-6)).toBeGreaterThan(0.1);
    expect(sombraPara(-6)).toBeLessThan(SOMBRA_NOCHE);
  });

  it('la imagen: de día en el meridiano 0, de noche en el 180 y en el Ártico en enero', () => {
    const ancho = 36;
    const alto = 18;
    const datos = new Uint8ClampedArray(ancho * alto * 4);
    // Filas de 85° N a 85° S, para la prueba (el mapa usa su proyección).
    pintarNoche(datos, ancho, alto, -23, (fila) => 85 - (fila + 0.5) * (170 / alto));
    const alfa = (x: number, y: number) => datos[(y * ancho + x) * 4 + 3]!;
    const ecuador = Math.floor(alto / 2);
    expect(alfa(ancho / 2, ecuador)).toBe(0);
    expect(alfa(0, ecuador)).toBe(Math.round(SOMBRA_NOCHE * 255));
    expect(alfa(ancho / 2, 0)).toBe(Math.round(SOMBRA_NOCHE * 255));
    // En el sur es verano: a 80° S tampoco anochece a medianoche.
    expect(alfa(0, alto - 1)).toBeLessThan(Math.round(SOMBRA_NOCHE * 255));
  });

  it('se puede quitar en Ajustes (por defecto, se ve)', () => {
    expect(leerAjuste('nocheMapa')).toBe(true);
    expect(t('juego.ajustes.nocheMapa')).toBe('Noche y día en el mapa');
  });
});

describe('reloj de manecillas (tarea f11-t4)', () => {
  it('agujas: las 6 en punto, las 15:30 y sin minutero a velocidad alta', () => {
    expect(angulosAgujas(6, 0, true)).toEqual({ horas: 180, minutos: 0 });
    expect(angulosAgujas(15, 0.5, true)).toEqual({ horas: 105, minutos: 180 });
    expect(angulosAgujas(15, 0.5, false).minutos).toBe(0);
    expect(angulosAgujas(0, 0, true).horas).toBe(0);
  });

  it('la esfera se oscurece de noche (de las 20:00 a las 7:00)', () => {
    expect([esDeNoche(0), esDeNoche(6), esDeNoche(7), esDeNoche(19), esDeNoche(20)]).toEqual([
      true,
      true,
      false,
      false,
      true,
    ]);
    const reloj = crearRelojAnalogico();
    reloj.poner(22, 0.25, true);
    expect(reloj.elemento.classList.contains('reloj--noche')).toBe(true);
    expect(reloj.elemento.querySelector('.reloj__minutos')!.getAttribute('transform')).toBe(
      'rotate(90.00 12 12)',
    );
    reloj.poner(12, 0, true);
    expect(reloj.elemento.classList.contains('reloj--noche')).toBe(false);
  });

  it('en la barra: junto a la hora, se mueve dentro de la hora y parpadea en pausa', () => {
    const paises = JSON.parse(
      readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
    ) as ConjuntoPaises;
    const partida = crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 1 },
      paises.paises,
    );
    const barra = crearBarraPartida({ partida, alIrAlPais: () => undefined });
    const hora = barra.elemento.querySelector('.partida-barra__hora')!;
    expect(hora.querySelector('.reloj svg')).not.toBeNull();
    expect(hora.textContent).toBe('00:00');
    barra.ponerFraccion(0.5, true);
    expect(hora.querySelector('.reloj__horas')!.getAttribute('transform')).toBe(
      'rotate(15.00 12 12)',
    );
    barra.marcarPausa(true);
    expect(barra.elemento.classList.contains('partida-barra--pausa')).toBe(true);
    barra.marcarPausa(false);
    expect(barra.elemento.classList.contains('partida-barra--pausa')).toBe(false);
    barra.destruir();
  });
});

describe('sonidos del reloj (tarea f11-t4)', () => {
  it('pausa baja, seguir sube y el cambio de velocidad es un tic; con nombre en la galería', () => {
    const tonos = (efecto: 'pausa' | 'seguir') => EFECTOS[efecto].map((n) => n.frecuencia);
    expect(tonos('pausa')[0]).toBeGreaterThan(tonos('pausa')[1]!);
    expect(tonos('seguir')[0]).toBeLessThan(tonos('seguir')[1]!);
    expect(EFECTOS.velocidad.length).toBeGreaterThan(0);
    for (const efecto of ['pausa', 'seguir', 'velocidad']) {
      expect(t(`galeria.sonidos.${efecto}`)).not.toMatch(/^galeria\./);
    }
  });
});
