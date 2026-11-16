// @vitest-environment happy-dom
/** Retratos ilustrados e iconos de los regímenes (tarea f8-t3). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOMBRES_ICONOS } from '../src/av/iconos';
import {
  PIELES,
  RASGOS_LIDERES,
  peloConEdad,
  rasgosDe,
  rasgosGenericos,
  semilla,
  svgRetrato,
  tieneHomenaje,
  tono,
  COLORES_PELO,
  type DatosGenericos,
} from '../src/av/retratos';
import {
  REGIMENES,
  edadEn2010,
  jefeGobierno,
  type ConjuntoGobiernos,
} from '../src/datos/gobiernos';
import type { ConjuntoPaises } from '../src/datos/paises';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(resolve(ruta), 'utf8')) as T;
const gobiernos = leer<ConjuntoGobiernos>('public/data/gobiernos-2010.json');
const paises = leer<ConjuntoPaises>('public/data/paises-2010.json').paises;

/** Datos de retrato de cada cargo de 2010, como los pide la ficha. */
function todosLosCargos(): DatosGenericos[] {
  const lista: DatosGenericos[] = [];
  for (const [id, gobierno] of Object.entries(gobiernos.paises)) {
    for (const cargo of [gobierno.estado, jefeGobierno(gobierno)]) {
      if (!cargo) continue;
      const persona = gobiernos.personas[cargo.persona];
      lista.push({
        pais: id,
        region: paises[id]!.region,
        regimen: gobierno.regimen,
        sexo: persona?.sexo ?? null,
        edad: edadEn2010(persona),
        persona: cargo.persona,
      });
    }
  }
  return lista;
}

/** Comprueba que el texto es un SVG bien formado (lo lee el analizador del navegador). */
function analizar(svg: string): Document {
  const documento = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(documento.querySelector('parsererror')).toBeNull();
  return documento;
}

describe('retratos ilustrados (tarea f8-t3)', () => {
  const base: DatosGenericos = {
    pais: 'ESP',
    region: 'ECS',
    regimen: 'monarquia-parlamentaria',
    sexo: 'h',
    edad: 49,
    persona: 'Q12345',
  };

  it('el retrato de una persona sale siempre igual', () => {
    expect(semilla('Q76')).toBe(semilla('Q76'));
    expect(semilla('Q76')).not.toBe(semilla('Q77'));
    expect(rasgosGenericos(base)).toEqual(rasgosGenericos({ ...base }));
    const svg = svgRetrato(rasgosGenericos(base), '#334455');
    expect(svgRetrato(rasgosGenericos(base), '#334455')).toBe(svg);
  });

  it('todos los cargos de 2010 tienen un retrato válido, sin colores rotos', () => {
    const cargos = todosLosCargos();
    expect(cargos.length).toBeGreaterThan(300);
    for (const datos of cargos) {
      const rasgos = rasgosDe(datos);
      expect(rasgos.piel, datos.persona).toBeGreaterThanOrEqual(0);
      expect(rasgos.piel, datos.persona).toBeLessThan(PIELES.length);
      const svg = svgRetrato(rasgos, '#3a4a66');
      expect(svg, datos.persona).not.toMatch(/undefined|NaN|null/);
      // Todos los colores son «#rrggbb» completos.
      for (const [, color] of svg.matchAll(/(?:fill|stroke)="(#[^"]*)"/g)) {
        expect(color, datos.persona).toMatch(/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i);
      }
      analizar(svg);
    }
  });

  it('el retrato genérico sigue la región, el régimen, el sexo y la edad', () => {
    const mujer = rasgosGenericos({ ...base, sexo: 'm' });
    expect(mujer.ropa).toBe('traje-mujer');
    expect(mujer.barba).toBe('ninguna');
    expect(rasgosGenericos({ ...base, regimen: 'junta' })).toMatchObject({
      ropa: 'uniforme',
      tocado: 'gorra-militar',
    });
    expect(
      rasgosGenericos({ ...base, pais: 'KWT', region: 'MEA', regimen: 'monarquia-absoluta' }),
    ).toMatchObject({ ropa: 'tunica', tocado: 'kufiya' });
    // Tonos de piel según la zona: los de África subsahariana, entre los más oscuros.
    for (let i = 0; i < 40; i++) {
      const africa = rasgosGenericos({ ...base, pais: 'KEN', region: 'SSF', persona: `Q${i}` });
      expect(africa.piel).toBeGreaterThanOrEqual(5);
      const europa = rasgosGenericos({ ...base, persona: `Q${i}` });
      expect(europa.piel).toBeLessThanOrEqual(2);
    }
    // Con los años, el pelo encanece.
    expect(peloConEdad(COLORES_PELO.negro, 40)).toBe(COLORES_PELO.negro);
    expect(peloConEdad(COLORES_PELO.negro, 66)).toBe(COLORES_PELO.canoso);
    expect(peloConEdad(COLORES_PELO.negro, 80)).toBe(COLORES_PELO.blanco);
  });

  it('un homenaje cambia solo lo que dice y el resto sale del genérico', () => {
    const [persona, propios] = Object.entries(RASGOS_LIDERES)[0] ?? [];
    if (!persona || !propios) return; // Los homenajes llegan en la tarea f8-t4.
    expect(tieneHomenaje(persona)).toBe(true);
    const rasgos = rasgosDe({ ...base, persona });
    expect(rasgos).toMatchObject(propios);
    expect(rasgos.ropa).toBeDefined();
  });

  it('accesible: con título se anuncia y sin él es decorativo', () => {
    const rasgos = rasgosGenericos(base);
    const conTitulo = analizar(svgRetrato(rasgos, '#123456', 'Retrato de "X"')).documentElement;
    expect(conTitulo.getAttribute('role')).toBe('img');
    expect(conTitulo.getAttribute('aria-label')).toBe('Retrato de "X"');
    const decorativo = analizar(svgRetrato(rasgos, '#123456')).documentElement;
    expect(decorativo.getAttribute('aria-hidden')).toBe('true');
  });

  it('tono aclara y oscurece sin salirse de rango', () => {
    expect(tono('#808080', 0.5)).toBe('#404040');
    expect(tono('#c0c0c0', 2)).toBe('#ffffff');
    expect(tono('#ff0000', 1)).toBe('#ff0000');
  });

  it('cada régimen tiene su icono', () => {
    for (const regimen of REGIMENES) {
      expect(NOMBRES_ICONOS as string[]).toContain(`regimen-${regimen}`);
    }
  });
});
