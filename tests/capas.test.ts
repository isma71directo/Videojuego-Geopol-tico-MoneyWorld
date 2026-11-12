import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises, PaisDatos } from '../src/datos/paises';
import {
  CAPAS,
  capaPorId,
  claseDe,
  colorDe,
  colorearCapa,
  colorearRegiones,
  COLOR_SIN_DATOS,
  COLOR_SIN_RESERVAS,
  entradasLeyenda,
  SUPERFICIE_MINIMA_KM2,
  superficieKm2,
  valorRegion,
  type CapaDatos,
} from '../src/map/capas';
import { etiquetaCapa, opcionesCapas, POLITICA } from '../src/ui/selector-capas';
import { ESTILO_MAPA } from '../src/map/estilo';
import {
  distancia,
  hexDeOklch,
  mezclarHex,
  oklabDeHex,
  rampaDivergente,
  rampaSecuencial,
  simularDaltonismo,
  type Daltonismo,
} from '../src/map/rampas';
import { textoEntrada, textoValorCapa } from '../src/ui/leyenda';

const conjunto = JSON.parse(readFileSync('public/data/paises-2010.json', 'utf8')) as ConjuntoPaises;
const topologia = JSON.parse(readFileSync('public/data/mapa-2010-mundo.json', 'utf8')) as {
  objects: { paises: { geometries: { id: string }[] } };
};

const capa = (id: string): CapaDatos => capaPorId(id)!;
/** Todos los colores que puede dar una capa, incluido el de «sin reservas». */
const coloresDe = (c: CapaDatos): string[] =>
  c.cero ? [COLOR_SIN_RESERVAS, ...c.colores] : [...c.colores];
const VISIONES: (Daltonismo | 'normal')[] = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];
const ver = (color: string, vision: Daltonismo | 'normal'): string =>
  vision === 'normal' ? color : simularDaltonismo(color, vision);

describe('colores en OKLCH (tarea f6-t1)', () => {
  it('convierte colores conocidos', () => {
    expect(hexDeOklch([1, 0, 0])).toBe('#ffffff');
    expect(hexDeOklch([0, 0, 0])).toBe('#000000');
    expect(hexDeOklch([0.62796, 0.25768, 29.234])).toBe('#ff0000');
  });

  it('baja el croma de los colores que no caben en la pantalla, sin cambiar su luminosidad', () => {
    const color = hexDeOklch([0.9, 0.4, 260]);
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    expect(oklabDeHex(color)[0]).toBeCloseTo(0.9, 2);
  });

  it('las rampas secuenciales suben de luminosidad de forma pareja', () => {
    const rampa = rampaSecuencial(5, [0.4, 0.1, 250], [0.9, 0.1, 100]);
    const luz = rampa.map((c) => oklabDeHex(c)[0]);
    for (let i = 1; i < luz.length; i++) expect(luz[i]! - luz[i - 1]!).toBeCloseTo(0.125, 2);
  });

  it('las rampas divergentes se alejan del centro por los dos lados', () => {
    const rampa = rampaDivergente(
      2,
      3,
      [0.4, 0, 0],
      { extremo: [0.8, 0.12, 50] },
      { extremo: [0.8, 0.12, 240] },
    );
    expect(rampa).toHaveLength(5);
    const luz = rampa.map((c) => oklabDeHex(c)[0]);
    expect(luz[0]).toBeGreaterThan(luz[1]!);
    expect(luz[2]).toBeLessThan(luz[3]!);
    expect(luz[3]).toBeLessThan(luz[4]!);
  });
});

describe('capas del mapa (tarea f6-t1)', () => {
  it('están las capas de la Fase 6, con un color por tramo y tramos de menor a mayor', () => {
    expect(CAPAS.map((c) => c.id)).toEqual([
      'riqueza',
      'poblacion',
      'densidad',
      'crecimiento',
      'paro',
      'deuda',
      'inflacion',
      'petroleo',
      'gas',
      'carbon',
    ]);
    for (const c of CAPAS) {
      expect(c.colores, c.id).toHaveLength(c.tramos.length + 1);
      for (let i = 1; i < c.tramos.length; i++) {
        expect(c.tramos[i], c.id).toBeGreaterThan(c.tramos[i - 1]!);
      }
      expect(c.campo in conjunto.campos, c.id).toBe(true);
    }
  });

  it('un valor igual a un tramo va a la clase de arriba', () => {
    const tramos = [1000, 2500, 5000];
    expect(claseDe(999.9, tramos)).toBe(0);
    expect(claseDe(1000, tramos)).toBe(1);
    expect(claseDe(4999, tramos)).toBe(2);
    expect(claseDe(5000, tramos)).toBe(3);
    expect(claseDe(1e9, tramos)).toBe(3);
  });

  it('cada capa da color a todos los países con dato y un color neutro a los que no lo tienen', () => {
    const sinDato: PaisDatos = {
      ...conjunto.paises.ESP!,
      id: 'XXX',
      datos: {},
      origen: {},
    };
    for (const c of CAPAS) {
      const coloreado = colorearCapa(c, { ...conjunto.paises, XXX: sinDato });
      const posibles = new Set(coloresDe(c));
      for (const pais of Object.values(conjunto.paises)) {
        const valor = pais.datos[c.campo];
        if (valor === null || valor === undefined) {
          expect(coloreado.colores.has(pais.id), `${c.id} ${pais.id}`).toBe(false);
        } else {
          expect(posibles.has(coloreado.colores.get(pais.id)!), `${c.id} ${pais.id}`).toBe(true);
        }
      }
      expect(coloreado.colores.has('XXX')).toBe(false);
      expect(coloreado.sinDatos).toBe(COLOR_SIN_DATOS);
      expect(colorDe(c, null)).toBe(COLOR_SIN_DATOS);
      expect(posibles.has(COLOR_SIN_DATOS), c.id).toBe(false);
      // Todos los países del mapa tienen color o el neutro.
      for (const { id } of topologia.objects.paises.geometries) {
        const color = coloreado.colores.get(id) ?? coloreado.sinDatos;
        expect(color === COLOR_SIN_DATOS || posibles.has(color), `${c.id} ${id}`).toBe(true);
      }
    }
  });

  it('marca con rayado justo los países cuyo dato es una estimación', () => {
    for (const c of CAPAS) {
      const { rayados } = colorearCapa(c, conjunto.paises);
      const estimados = Object.values(conjunto.paises)
        .filter((p) => p.origen[c.campo]?.startsWith('EST:'))
        .map((p) => p.id);
      expect([...rayados].sort(), c.id).toEqual(estimados.sort());
    }
  });

  it('colorea con datos reales de 2010', () => {
    const riqueza = capa('riqueza');
    const coloreado = colorearCapa(riqueza, conjunto.paises);
    // España: unos 30.700 $ por habitante (entre 20.000 y 40.000).
    expect(coloreado.colores.get('ESP')).toBe(riqueza.colores[5]);
    expect(coloreado.colores.get('LUX')).toBe(riqueza.colores[6]);
    const petroleo = colorearCapa(capa('petroleo'), conjunto.paises);
    expect(petroleo.colores.get('ESP')).toBe(capa('petroleo').colores[0]);
    expect(petroleo.colores.get('SAU')).toBe(capa('petroleo').colores[5]);
    expect(petroleo.colores.get('CHE')).toBe(COLOR_SIN_RESERVAS);
  });
});

describe('leyenda de las capas (tarea f6-t1)', () => {
  it('va del tramo más alto al más bajo, con textos claros', () => {
    const riqueza = capa('riqueza');
    const textos = entradasLeyenda(riqueza).map((e) => textoEntrada(riqueza, e));
    expect(textos[0]).toBe('40.000 $ o más');
    expect(textos[1]).toBe('20.000 a 40.000 $');
    expect(textos.at(-1)).toBe('Menos de 1.000 $');
    const poblacion = capa('poblacion');
    const enMillones = entradasLeyenda(poblacion).map((e) => textoEntrada(poblacion, e));
    expect(enMillones[0]).toBe('300 o más');
    expect(enMillones.at(-1)).toBe('Menos de 1');
    const paro = capa('paro');
    expect(entradasLeyenda(paro).map((e) => textoEntrada(paro, e))[4]).toBe('5 a 7,5 %');
    const crecimiento = capa('crecimiento');
    expect(textoEntrada(crecimiento, entradasLeyenda(crecimiento).at(-1)!)).toBe('Menos de −5 %');
  });

  it('las capas de recursos tienen la clase «sin reservas» al final', () => {
    const gas = capa('gas');
    const entradas = entradasLeyenda(gas);
    expect(entradas).toHaveLength(gas.colores.length + 1);
    expect(entradas.at(-1)).toMatchObject({ tipo: 'cero', color: COLOR_SIN_RESERVAS });
    expect(textoEntrada(gas, entradas.at(-1)!)).toBe('Sin reservas');
  });

  it('escribe el dato de cada capa para la ficha del país', () => {
    expect(textoValorCapa(capa('riqueza'), 30658.7)).toBe('30.659 $');
    expect(textoValorCapa(capa('paro'), 19.86)).toBe('19,9 %');
    expect(textoValorCapa(capa('poblacion'), 46576897)).toBe('46,6 millones');
    expect(textoValorCapa(capa('petroleo'), 150)).toBe('150 millones de barriles');
    expect(textoValorCapa(capa('carbon'), 0)).toBe('Sin reservas');
    expect(textoValorCapa(capa('densidad'), 93.2)).toBe('93 hab./km²');
    expect(textoValorCapa(capa('densidad'), 1.76)).toBe('1,8 hab./km²');
  });
});

describe('rampas accesibles (tarea f6-t1)', () => {
  it('dos tramos seguidos se distinguen también con los tres tipos de daltonismo', () => {
    for (const c of CAPAS) {
      const colores = coloresDe(c);
      for (const vision of VISIONES) {
        for (let i = 1; i < colores.length; i++) {
          const d = distancia(ver(colores[i - 1]!, vision), ver(colores[i]!, vision));
          expect(d, `${c.id} ${vision} ${i}`).toBeGreaterThan(0.05);
        }
      }
    }
  });

  it('ningún tramo se confunde con «sin datos» ni con el mar', () => {
    for (const c of CAPAS) {
      for (const color of coloresDe(c)) {
        for (const vision of VISIONES) {
          const neutro = distancia(ver(color, vision), ver(COLOR_SIN_DATOS, vision));
          const mar = distancia(ver(color, vision), ver(ESTILO_MAPA.oceano, vision));
          expect(neutro, `${c.id} ${color} ${vision}`).toBeGreaterThan(0.05);
          expect(mar, `${c.id} ${color} ${vision}`).toBeGreaterThan(0.05);
        }
      }
    }
  });

  it('en las capas secuenciales, más claro es siempre más', () => {
    for (const c of CAPAS.filter((capa) => !['crecimiento', 'inflacion'].includes(capa.id))) {
      const luz = c.colores.map((color) => oklabDeHex(color)[0]);
      for (let i = 1; i < luz.length; i++) expect(luz[i], c.id).toBeGreaterThan(luz[i - 1]!);
    }
  });
});

describe('densidad y capas por región (tarea f6-t2)', () => {
  it('la densidad de cada país es su población entre su superficie de tierra', () => {
    const densidad = capa('densidad');
    const espana = conjunto.paises.ESP!;
    expect(espana.datos.densidad).toBeCloseTo(
      espana.datos.poblacion! / espana.datos.superficie!,
      1,
    );
    // España: unos 93 habitantes por km² (entre 50 y 100).
    expect(colorearCapa(densidad, conjunto.paises).colores.get('ESP')).toBe(densidad.colores[3]);
    // El Vaticano no tiene superficie medible: queda sin dato.
    expect(colorearCapa(densidad, conjunto.paises).colores.has('VAT')).toBe(false);
  });

  it('solo riqueza, población y densidad se ven por regiones', () => {
    expect(CAPAS.filter((c) => c.porRegion).map((c) => c.id)).toEqual([
      'riqueza',
      'poblacion',
      'densidad',
    ]);
    expect(colorearRegiones(capa('paro'), {})).toBeUndefined();
  });

  it('calcula el dato de cada región y lo marca estimado si lo es alguna de sus partes', () => {
    const datos = { poblacion: 2e6, origenPoblacion: 'DOSE:2010', pib: 4e10, origenPib: 'EST:x' };
    expect(valorRegion(capa('riqueza'), datos)).toEqual({ valor: 20000, estimado: true });
    expect(valorRegion(capa('poblacion'), datos)).toEqual({ valor: 2e6, estimado: false });
    expect(valorRegion(capa('densidad'), datos, 20000)).toEqual({ valor: 100, estimado: false });
    // Sin superficie fiable, la densidad de la región queda sin dato.
    expect(valorRegion(capa('densidad'), datos, SUPERFICIE_MINIMA_KM2 / 2)).toBeNull();
    expect(valorRegion(capa('paro'), datos)).toBeNull();
    expect(valorRegion(capa('riqueza'), { ...datos, pib: null })).toBeNull();
  });

  it('colorea las regiones con los datos de 2010', () => {
    const datos = JSON.parse(readFileSync('public/data/regiones-2010-datos.json', 'utf8')) as {
      regiones: Record<string, Parameters<typeof valorRegion>[1]>;
    };
    const regionRica = Object.entries(datos.regiones).find(
      ([, d]) => d && d.pib && d.poblacion && d.pib / d.poblacion > 50000,
    )!;
    const color = colorearRegiones(capa('riqueza'), datos.regiones as never)!(regionRica[0], {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [0, 0] },
    });
    expect(color?.color).toBe(capa('riqueza').colores.at(-1));
  });

  it('mide la superficie de una forma en km²', () => {
    // Un cuadrado de 1° × 1° en el ecuador mide unos 12.360 km².
    const cuadrado = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ],
        ],
      },
    };
    expect(superficieKm2(cuadrado)).toBeGreaterThan(12300);
    expect(superficieKm2(cuadrado)).toBeLessThan(12400);
  });
});

describe('desplegable de capas (tarea f6-t2)', () => {
  it('ofrece la capa política y todas las de datos, con rayas entre grupos', () => {
    const opciones = opcionesCapas();
    expect(opciones[0]!.id).toBe(POLITICA);
    expect(opciones.map((o) => o.id).slice(1)).toEqual(CAPAS.map((c) => c.id));
    expect(opciones.filter((o) => o.separadorAntes).map((o) => o.id)).toEqual([
      'riqueza',
      'petroleo',
    ]);
  });

  it('nombra cada opción con claridad', () => {
    expect(etiquetaCapa('politica')).toBe('Política');
    expect(etiquetaCapa('poblacion')).toBe('Población total');
    expect(etiquetaCapa('densidad')).toBe('Densidad de población');
    expect(etiquetaCapa('gas')).toBe('Reservas de gas natural');
  });
});

describe('cambio de capa animado (tarea f6-t4)', () => {
  it('mezcla los colores de una capa y otra', () => {
    expect(mezclarHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mezclarHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mezclarHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mezclarHex('#6f8fb5', '#ecee55', 0.25)).toBe('#8ea79d');
  });
});
