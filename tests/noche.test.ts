// @vitest-environment happy-dom
/** Audiovisual de la Fase 11: noche y día (tarea f11-t4 y ajuste f11-a1), reloj y sonidos. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EFECTOS } from '../src/av/sonido';
import type { ConjuntoPaises } from '../src/datos/paises';
import { t } from '../src/i18n';
import {
  alturaDelSol,
  AMANECER,
  ANOCHECER,
  CREPUSCULO,
  pintarNoche,
  solDelJuego,
  SOMBRA_NOCHE,
  sombraPara,
} from '../src/map/noche';
import { crearPartida } from '../src/sim/partida';
import { leerAjuste } from '../src/ui/ajustes';
import { crearBarraPartida } from '../src/ui/barra-partida';
import { angulosAgujas, crearRelojAnalogico, esDeNoche } from '../src/ui/reloj-analogico';

afterEach(() => document.body.replaceChildren());

/** Sombra que lleva un punto a una hora local de la capital. */
const sombraEn = (hora: number, punto: { lat: number; lon: number }, capital = punto) => {
  const sol = solDelJuego(hora, capital);
  return sombraPara(alturaDelSol(punto.lat, punto.lon, sol), sol.umbral);
};
const MADRID = { lat: 40.4, lon: -3.7 };

describe('noche de las 20:00 a las 7:00 en la capital del jugador (ajuste f11-a1)', () => {
  it('en Madrid: anochece a las 20:00 y amanece a las 7:00, todo el año', () => {
    expect([AMANECER, ANOCHECER]).toEqual([7, 20]);
    expect(sombraEn(20, MADRID)).toBeCloseTo(SOMBRA_NOCHE / 2, 6);
    expect(sombraEn(7, MADRID)).toBeCloseTo(SOMBRA_NOCHE / 2, 6);
    // A las 18:00 (lo que pedía el jugador) todavía es de día; a las 2:00, noche cerrada.
    expect(sombraEn(18, MADRID)).toBe(0);
    expect(sombraEn(13.5, MADRID)).toBe(0);
    expect(sombraEn(2, MADRID)).toBe(SOMBRA_NOCHE);
    expect(sombraEn(23, MADRID)).toBe(SOMBRA_NOCHE);
    // El crepúsculo dura poco: a las 19:30 casi de día y a las 20:30 casi de noche.
    expect(sombraEn(19.5, MADRID)).toBeLessThan(0.05);
    expect(sombraEn(20.5, MADRID)).toBeGreaterThan(SOMBRA_NOCHE - 0.05);
    // Sin estaciones: el Sol del juego no tiene declinación.
    expect(solDelJuego(12, MADRID).declinacion).toBe(0);
  });

  it('también en capitales muy al norte, en el ecuador y en el sur', () => {
    for (const capital of [
      { lat: 64.1, lon: -21.9 }, // Reikiavik
      { lat: -0.2, lon: -78.5 }, // Quito
      { lat: -34.6, lon: -58.4 }, // Buenos Aires
      { lat: 35.7, lon: 139.7 }, // Tokio
    ]) {
      expect(sombraEn(20, capital), JSON.stringify(capital)).toBeCloseTo(SOMBRA_NOCHE / 2, 6);
      expect(sombraEn(7, capital)).toBeCloseTo(SOMBRA_NOCHE / 2, 6);
      expect(sombraEn(14, capital)).toBe(0);
      expect(sombraEn(1, capital)).toBe(SOMBRA_NOCHE);
    }
  });

  it('el Sol avanza 15° por hora hacia el oeste: al este anochece antes', () => {
    const a = solDelJuego(12, MADRID).longitud;
    const b = solDelJuego(13, MADRID).longitud;
    expect(a - b).toBeCloseTo(15, 6);
    // A las 20:00 de Madrid, Moscú (37,6° E) ya es de noche y Nueva York (74° O), de día.
    expect(sombraEn(20, { lat: 55.8, lon: 37.6 }, MADRID)).toBe(SOMBRA_NOCHE);
    expect(sombraEn(20, { lat: 40.7, lon: -74 }, MADRID)).toBe(0);
  });
});

describe('sombra de la noche (tarea f11-t4)', () => {
  it('ninguna de día, entera de noche y un degradado suave en el crepúsculo', () => {
    const umbral = -5;
    expect(sombraPara(30, umbral)).toBe(0);
    expect(sombraPara(-30, umbral)).toBe(SOMBRA_NOCHE);
    let anterior = 0;
    for (let altura = umbral + CREPUSCULO; altura >= umbral - CREPUSCULO; altura -= 0.5) {
      const sombra = sombraPara(altura, umbral);
      expect(sombra).toBeGreaterThanOrEqual(anterior);
      anterior = sombra;
    }
    expect(sombraPara(umbral, umbral)).toBeCloseTo(SOMBRA_NOCHE / 2, 6);
  });

  it('la imagen: de día en el meridiano del Sol y de noche en el opuesto', () => {
    const ancho = 36;
    const alto = 18;
    const datos = new Uint8ClampedArray(ancho * alto * 4);
    const sol = solDelJuego(13.5, { lat: 40, lon: 0 });
    // Filas de 85° N a 85° S, para la prueba (el mapa usa su proyección).
    pintarNoche(datos, ancho, alto, sol, (fila) => 85 - (fila + 0.5) * (170 / alto));
    const alfa = (x: number, y: number) => datos[(y * ancho + x) * 4 + 3]!;
    const ecuador = Math.floor(alto / 2);
    expect(alfa(ancho / 2, ecuador)).toBe(0);
    expect(alfa(0, ecuador)).toBe(Math.round(SOMBRA_NOCHE * 255));
    // Sin estaciones, el norte y el sur se ven igual.
    expect(alfa(0, 1)).toBe(alfa(0, alto - 2));
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
