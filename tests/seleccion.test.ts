/** Selección de países en el mapa (Fase 4, tarea f4-t1). */
import { readFileSync } from 'node:fs';
import { geoContains } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { prepararFiguras, type Figura, type TopologiaMapa } from '../src/map/geometria';
import { ANCHO_MUNDO, crearProyeccion } from '../src/map/proyeccion';
import { paisEnPunto } from '../src/map/seleccion';

const proyeccion = crearProyeccion();
const invertir = (punto: [number, number]): [number, number] | null => {
  const lugar = proyeccion.invert?.(punto);
  return lugar ? [lugar[0], lugar[1]] : null;
};

function figuras(nivel: 'mundo' | 'detalle'): Figura[] {
  const topo = JSON.parse(
    readFileSync(new URL(`../public/data/mapa-2010-${nivel}.json`, import.meta.url), 'utf8'),
  ) as TopologiaMapa;
  return prepararFiguras(topo).paises;
}

const mundo = figuras('mundo');
const detalle = figuras('detalle');

/** País en una longitud y latitud con el zoom `k` (px por unidad de mundo). */
function paisEn(lista: Figura[], lon: number, lat: number, k: number): string | null {
  const [x, y] = proyeccion([lon, lat])!;
  return paisEnPunto(lista, x, y, k, invertir);
}

/** Generador pseudoaleatorio fijo, para que el test sea siempre el mismo. */
function aleatorio(semilla: number): () => number {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

describe('qué país hay bajo el ratón', () => {
  it('al hacer clic en cualquier punto del interior de un país, se selecciona ese país', () => {
    const azar = aleatorio(2010);
    let comprobados = 0;
    for (const figura of detalle) {
      // Puntos al azar dentro de la caja del país que caen en su territorio y no en otro.
      const [x0, y0, x1, y1] = figura.caja;
      for (let intento = 0, hallados = 0; intento < 400 && hallados < 5; intento++) {
        const x = x0 + (x1 - x0) * azar();
        const y = y0 + (y1 - y0) * azar();
        const lugar = invertir([x, y]);
        if (!lugar || !geoContains(figura.forma, lugar)) continue;
        // Zoom grande: los países se ven como polígono (sin el atajo de los diminutos).
        expect(paisEnPunto(detalle, x, y, 400, invertir), figura.id).toBe(figura.id);
        hallados++;
        comprobados++;
      }
    }
    expect(comprobados).toBeGreaterThan(detalle.length * 4);
  });

  it('reconoce ciudades conocidas con las fronteras de 2010', () => {
    expect(paisEn(detalle, -3.7, 40.42, 40)).toBe('ESP'); // Madrid
    expect(paisEn(detalle, 2.35, 48.86, 40)).toBe('FRA'); // París
    expect(paisEn(detalle, 34.1, 44.95, 40)).toBe('UKR'); // Simferópol (Crimea, 2010)
    expect(paisEn(detalle, 31.58, 4.85, 40)).toBe('SDN'); // Yuba (Sudán, 2010)
    expect(paisEn(detalle, 41.02, 43.0, 40)).toBe('ABK'); // Sujumi (Abjasia)
    expect(paisEn(detalle, 114.17, 22.32, 40)).toBe('HKG'); // Hong Kong
  });

  it('el mar no es ningún país', () => {
    expect(paisEn(mundo, -30, 30, 2)).toBeNull(); // Atlántico
    expect(paisEn(mundo, -140, -20, 2)).toBeNull(); // Pacífico
  });

  it('dentro de un enclave gana el país pequeño', () => {
    expect(paisEn(detalle, 12.4534, 41.9029, 400)).toBe('VAT'); // Vaticano dentro de Italia
    expect(paisEn(detalle, 12.4578, 43.9424, 400)).toBe('SMR'); // San Marino
    expect(paisEn(detalle, 27.48, -29.31, 40)).toBe('LSO'); // Maseru (Lesoto)
  });

  it('con el mapa entero a la vista, Luxemburgo y Singapur se señalan por su punto', () => {
    const k = 1.5; // zoom de un PC de 1280 px con todo el mundo a la vista
    const luxemburgo = mundo.find((f) => f.id === 'LUX')!;
    const singapur = mundo.find((f) => f.id === 'SGP')!;
    for (const figura of [luxemburgo, singapur]) {
      const [x, y] = figura.etiqueta!;
      // Hasta unos píxeles de distancia del punto.
      expect(paisEnPunto(mundo, x + 4 / k, y - 3 / k, k, invertir)).toBe(figura.id);
    }
    expect(paisEn(mundo, 6.13, 49.61, k)).toBe('LUX');
    expect(paisEn(mundo, 103.85, 1.29, k)).toBe('SGP');
    expect(paisEn(mundo, 7.42, 43.74, k)).toBe('MCO'); // Mónaco
  });

  it('funciona en cualquier copia del mundo (desplazamiento continuo)', () => {
    const [x, y] = proyeccion([-3.7, 40.42])!;
    expect(paisEnPunto(detalle, x + ANCHO_MUNDO, y, 40, invertir)).toBe('ESP');
    expect(paisEnPunto(detalle, x - 2 * ANCHO_MUNDO, y, 40, invertir)).toBe('ESP');
  });
});
