import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prepararAgua, zoomWeb, type TopologiaAgua } from '../src/map/agua';
import { camaraInicial } from '../src/map/camara';
import { ALTO_MUNDO, ANCHO_MUNDO } from '../src/map/proyeccion';

const texto = readFileSync(new URL('../public/data/mapa-agua.json', import.meta.url), 'utf8');
const { rios, lagos } = prepararAgua(JSON.parse(texto) as TopologiaAgua);

describe('ríos y lagos del mapa', () => {
  it('trae los ríos y lagos de Natural Earth, con un archivo ligero', () => {
    expect(rios.length).toBeGreaterThan(300);
    expect(lagos.length).toBeGreaterThan(300);
    expect(texto.length).toBeLessThan(400 * 1024);
  });

  it('incluye ríos y lagos conocidos', () => {
    const nombres = new Set([...rios, ...lagos].map((e) => e.nombre));
    for (const nombre of ['Danube', 'Mississippi', 'Victoria', 'Baikal']) {
      expect(
        [...nombres].some((n) => n.includes(nombre)),
        nombre,
      ).toBe(true);
    }
  });

  it('todo queda dentro del mundo', () => {
    for (const e of [...rios, ...lagos]) {
      expect(e.caja[0]).toBeGreaterThanOrEqual(-0.001);
      expect(e.caja[2]).toBeLessThanOrEqual(ANCHO_MUNDO + 0.001);
      expect(e.caja[3]).toBeLessThanOrEqual(ALTO_MUNDO + 0.001);
    }
  });

  it('desde lejos solo se ven los grandes ríos; al acercarse aparecen los demás', () => {
    const z = zoomWeb(camaraInicial(1280, 800).k);
    expect(z).toBeGreaterThan(2);
    expect(z).toBeLessThan(3.5);
    const visiblesLejos = rios.filter((r) => r.z <= z + 0.6).length;
    const visiblesCerca = rios.filter(
      (r) => r.z <= zoomWeb(camaraInicial(1280, 800).k * 8) + 0.6,
    ).length;
    expect(visiblesLejos).toBeGreaterThan(10);
    expect(visiblesLejos).toBeLessThan(rios.length / 2);
    expect(visiblesCerca).toBe(rios.length);
  });

  it('el zoom web dobla cada vez que el mapa se hace el doble de grande', () => {
    expect(zoomWeb(2) - zoomWeb(1)).toBeCloseTo(1, 6);
    expect(zoomWeb(256 / ANCHO_MUNDO)).toBeCloseTo(0, 6);
  });
});
