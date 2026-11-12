import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALTO_MUNDO, ANCHO_MUNDO } from '../src/map/proyeccion';
import { nivelPara, teselasVisibles, type ManifiestoRelieve } from '../src/map/relieve';

const manifiesto = JSON.parse(
  readFileSync(new URL('../public/av/relieve/relieve.json', import.meta.url), 'utf8'),
) as ManifiestoRelieve;

describe('relieve del mapa', () => {
  it('tiene varios niveles, de menos a más detalle, con las proporciones del mapa Miller', () => {
    const anchos = manifiesto.niveles.map((n) => n.ancho);
    expect(anchos.length).toBeGreaterThanOrEqual(3);
    expect([...anchos].sort((a, b) => a - b)).toEqual(anchos);
    for (const nivel of manifiesto.niveles) {
      expect(nivel.alto / nivel.ancho).toBeCloseTo(ALTO_MUNDO / ANCHO_MUNDO, 2);
      expect(nivel.columnas).toBe(Math.ceil(nivel.ancho / manifiesto.tesela));
      expect(nivel.filas).toBe(Math.ceil(nivel.alto / manifiesto.tesela));
    }
  });

  it('existen todas las teselas de todos los niveles', () => {
    for (const nivel of manifiesto.niveles) {
      for (let fila = 0; fila < nivel.filas; fila += 1) {
        for (let columna = 0; columna < nivel.columnas; columna += 1) {
          const ruta = `../public/av/relieve/${nivel.ancho}/${columna}_${fila}.${manifiesto.formato}`;
          expect(existsSync(new URL(ruta, import.meta.url)), ruta).toBe(true);
        }
      }
    }
  });

  it('las teselas de un nivel cubren el mundo entero sin huecos', () => {
    for (const nivel of manifiesto.niveles) {
      const teselas = teselasVisibles(manifiesto, nivel, [0, 0, ANCHO_MUNDO, ALTO_MUNDO]);
      expect(teselas).toHaveLength(nivel.columnas * nivel.filas);
      const area = teselas.reduce((suma, t) => suma + t.ancho * t.alto, 0);
      expect(area).toBeCloseTo(ANCHO_MUNDO * ALTO_MUNDO, 0);
    }
  });

  it('solo pide las teselas de la zona visible', () => {
    const nivel = manifiesto.niveles.at(-1)!;
    const europa = teselasVisibles(manifiesto, nivel, [480, 100, 560, 160]);
    expect(europa.length).toBeGreaterThan(0);
    expect(europa.length).toBeLessThan((nivel.columnas * nivel.filas) / 4);
  });

  it('elige el nivel según lo que mide el mundo en la pantalla', () => {
    const anchos = manifiesto.niveles.map((n) => n.ancho);
    expect(nivelPara(manifiesto, 500).ancho).toBe(anchos[0]);
    expect(nivelPara(manifiesto, 3000).ancho).toBe(anchos.find((a) => a >= 2250));
    expect(nivelPara(manifiesto, 1e6).ancho).toBe(anchos.at(-1));
  });
});

describe('terreno del mapa (tarea f6-t3)', () => {
  const terreno = JSON.parse(
    readFileSync(new URL('../public/av/terreno/terreno.json', import.meta.url), 'utf8'),
  ) as ManifiestoRelieve;

  it('tiene los mismos niveles y teselas que el relieve, todas en su sitio', () => {
    expect(terreno.niveles).toEqual(manifiesto.niveles);
    expect(terreno.tesela).toBe(manifiesto.tesela);
    for (const nivel of terreno.niveles) {
      for (let fila = 0; fila < nivel.filas; fila += 1) {
        for (let columna = 0; columna < nivel.columnas; columna += 1) {
          const ruta = `../public/av/terreno/${nivel.ancho}/${columna}_${fila}.${terreno.formato}`;
          expect(existsSync(new URL(ruta, import.meta.url)), ruta).toBe(true);
        }
      }
    }
  });

  it('con menos nitidez pide teselas más pequeñas (menos memoria gráfica)', () => {
    const nitido = nivelPara(terreno, 3000).ancho;
    const suave = nivelPara(terreno, 3000, 0.4).ancho;
    expect(suave).toBeLessThan(nitido);
  });
});
