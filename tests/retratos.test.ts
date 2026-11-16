// @vitest-environment happy-dom
/** Retratos ilustrados e iconos de los regímenes (tarea f8-t3). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOMBRES_ICONOS } from '../src/av/iconos';
import {
  PIELES,
  azarDe,
  colorPiel,
  type Rasgos,
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

/** Rasgos (de 16) en los que se diferencian, como mínimo, dos personas cualesquiera. */
const MINIMO_RASGOS_DISTINTOS = 3;

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
    // Berlusconi: pelo oscuro aunque tuviera 74 años (el color del homenaje no encanece).
    const persona = 'Q11860';
    expect(tieneHomenaje(persona)).toBe(true);
    const propios = RASGOS_LIDERES[persona]!;
    const rasgos = rasgosDe({ ...base, pais: 'ITA', edad: 74, persona });
    expect(rasgos).toMatchObject(propios);
    expect(rasgos.colorFijo).toBe(true);
    expect(svgRetrato(rasgos, '#334455')).toContain(`fill="${propios.colorPelo}"`);
    // Lo que el homenaje no dice (la edad) sale de los datos.
    expect(rasgos.edad).toBe(74);
    expect(tieneHomenaje('Q12345')).toBe(false);
  });

  it('los homenajes (tarea f8-t4) son de personas con cargo en 2010 y con su sexo', () => {
    const lideres = leer<{ lideres: Record<string, { quien: string; rasgos: object }> }>(
      'src/av/config/retratos-lideres.json',
    ).lideres;
    expect(Object.keys(lideres).length).toBeGreaterThanOrEqual(80);
    const conCargo = new Set(
      Object.values(gobiernos.paises).flatMap((g) =>
        [g.estado, jefeGobierno(g)].filter((c) => c !== null).map((c) => c.persona),
      ),
    );
    for (const [persona, { quien, rasgos }] of Object.entries(lideres)) {
      expect(conCargo.has(persona), persona).toBe(true);
      expect(quien, persona).toContain(gobiernos.personas[persona]!.nombre);
      const sexo = (rasgos as { sexo?: string }).sexo;
      if (sexo) expect(sexo, persona).toBe(gobiernos.personas[persona]!.sexo);
      const gafas = (rasgos as { gafas?: string }).gafas;
      if (gafas) expect(['ninguna', 'finas', 'gruesas', 'redondas', 'sol']).toContain(gafas);
    }
  });

  it('los jefes de Estado y de Gobierno del G20 y las grandes figuras tienen homenaje', () => {
    const g20 = 'USA CHN JPN DEU FRA GBR ITA ESP RUS IND BRA CAN AUS KOR MEX IDN TUR SAU ARG ZAF';
    for (const pais of g20.split(' ')) {
      const g = gobiernos.paises[pais]!;
      for (const cargo of [g.estado, jefeGobierno(g)]) {
        expect(tieneHomenaje(cargo!.persona), `${pais} ${cargo!.persona}`).toBe(true);
      }
    }
    // El papa, el líder supremo de Irán, Kim Jong-il, Gadafi, Chávez y Raúl Castro.
    for (const persona of ['Q2494', 'Q57336', 'Q10665', 'Q19878', 'Q8440', 'Q46809']) {
      expect(tieneHomenaje(persona), persona).toBe(true);
    }
  });

  it('ajuste f8-a1: la piel admite tonos intermedios y matices', () => {
    expect(colorPiel(0)).toBe(PIELES[0]);
    expect(colorPiel(7)).toBe(PIELES[7]);
    const medio = colorPiel(2.5);
    expect(medio).not.toBe(PIELES[2]);
    expect(medio).not.toBe(PIELES[3]);
    expect(colorPiel(2, 'oliva')).not.toBe(colorPiel(2));
    expect(colorPiel(-3)).toBe(PIELES[0]);
    // El azar es estable para la misma persona.
    const a = azarDe('Q42');
    const b = azarDe('Q42');
    const serie = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(serie);
    for (const x of serie) expect(x >= 0 && x < 1).toBe(true);
  });

  it('ajuste f8-a1: las caras de los genéricos son variadas en cada región', () => {
    const porRegion = new Map<string, Rasgos[]>();
    for (const datos of todosLosCargos()) {
      if (tieneHomenaje(datos.persona)) continue;
      const lista = porRegion.get(datos.region) ?? [];
      lista.push(rasgosGenericos(datos));
      porRegion.set(datos.region, lista);
    }
    for (const [region, lista] of porRegion) {
      if (lista.length < 20) continue;
      const distintos = (clave: keyof Rasgos): number => new Set(lista.map((r) => r[clave])).size;
      expect(distintos('cara'), region).toBeGreaterThanOrEqual(4);
      expect(distintos('nariz'), region).toBeGreaterThanOrEqual(3);
      expect(distintos('ojos'), region).toBeGreaterThanOrEqual(2);
      expect(distintos('cejas'), region).toBeGreaterThanOrEqual(4);
      expect(distintos('orejas'), region).toBeGreaterThanOrEqual(3);
      expect(distintos('expresion'), region).toBeGreaterThanOrEqual(3);
    }
  });

  it('ningún retrato se parece demasiado a otro (ajustes f8-a1 y f8-a2)', () => {
    const firma = (r: Rasgos): unknown[] => [
      r.cara ?? 'ovalada',
      r.ojos ?? 'normales',
      r.nariz ?? 'recta',
      r.labios ?? 'medios',
      r.orejas ?? 'normales',
      r.cejas ?? 'normales',
      r.expresion ?? 'neutra',
      r.pelo,
      r.colorFijo ? r.colorPelo : peloConEdad(r.colorPelo, r.edad),
      r.barba,
      r.gafas,
      r.ropa,
      r.colorRopa,
      r.colorDetalle,
      r.tocado,
      Math.round(r.piel),
    ];
    const firmas = todosLosCargos().map((d) => [d.persona, firma(rasgosDe(d))] as const);
    let minimo = Infinity;
    let par = '';
    for (let i = 0; i < firmas.length; i++) {
      for (let j = i + 1; j < firmas.length; j++) {
        const [pa, a] = firmas[i]!;
        const [pb, b] = firmas[j]!;
        if (pa === pb) continue;
        const distintos = a.filter((x, k) => x !== b[k]).length;
        if (distintos < minimo) [minimo, par] = [distintos, `${pa} y ${pb}`];
      }
    }
    expect(minimo, par).toBeGreaterThanOrEqual(MINIMO_RASGOS_DISTINTOS);
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
