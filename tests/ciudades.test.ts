/** Capitales y ciudades del mapa (Fase 4, tarea f4-t3). */
import { readFileSync } from 'node:fs';
import { geoDistance } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  ciudadEnPunto,
  ciudadVisible,
  colocarCiudades,
  zoomDeAparicion,
  ZOOM_TODAS_CAPITALES,
  type CandidatoCiudad,
  type CiudadColocada,
  type Ciudad,
  type ConjuntoCiudades,
} from '../src/map/ciudades';
import { prepararFiguras, type TopologiaMapa } from '../src/map/geometria';
import { crearProyeccion } from '../src/map/proyeccion';
import { cajasSeSolapan } from '../src/map/rotulos';
import { origenDePoblacion, subtituloCiudad, textoPoblacion } from '../src/ui/ficha-ciudad';
import { paisEnPunto } from '../src/map/seleccion';

const leer = <T>(ruta: string): T =>
  JSON.parse(readFileSync(new URL(`../public/data/${ruta}`, import.meta.url), 'utf8')) as T;
const { ciudades } = leer<ConjuntoCiudades>('ciudades-2010.json');
const { paises } = leer<ConjuntoPaises>('paises-2010.json');
const buscar = (nombre: string): Ciudad | undefined => ciudades.find((c) => c.nombre === nombre);

describe('datos de capitales y ciudades', () => {
  it('cada país y territorio tiene su capital de 2010, con el mismo nombre que en su ficha', () => {
    for (const pais of Object.values(paises)) {
      const suyas = ciudades.filter((c) => c.capital && c.pais === pais.id);
      expect(suyas.length, pais.id).toBeGreaterThan(0);
      // Las Islas del Canal tienen dos: Saint Helier (Jersey) y Saint Peter Port (Guernsey).
      if (suyas.length === 1) expect(suyas[0]!.nombre, pais.id).toBe(pais.capital);
    }
  });

  it('usa las capitales y fronteras de 2010', () => {
    expect(buscar('Buyumbura')).toMatchObject({ pais: 'BDI', capital: true });
    expect(buscar('Guitega')?.capital ?? false).toBe(false); // capital desde 2019
    expect(buscar('Yuba')?.capital ?? false).toBe(false); // Sudán del Sur, desde 2011
    expect(buscar('Simferópol')).toMatchObject({ pais: 'UKR', capital: false });
    expect(buscar('Sujumi')).toMatchObject({ pais: 'ABK', capital: true });
    expect(buscar('Tiráspol')).toMatchObject({ pais: 'PMR', capital: true });
    expect(buscar('Madrid')).toMatchObject({ pais: 'ESP', capital: true });
  });

  it('cada capital está dentro de su país o, si es costera, a menos de 25 km', () => {
    const proyeccion = crearProyeccion();
    const invertir = (punto: [number, number]): [number, number] | null => {
      const lugar = proyeccion.invert?.(punto);
      return lugar ? [lugar[0], lugar[1]] : null;
    };
    const figuras = prepararFiguras(leer<TopologiaMapa>('mapa-2010-detalle.json')).paises;
    const fuera: string[] = [];
    for (const ciudad of ciudades.filter((c) => c.capital)) {
      const [x, y] = proyeccion([ciudad.lon, ciudad.lat])!;
      if (paisEnPunto(figuras, x, y, 1000, invertir) === ciudad.pais) continue;
      // Puede caer en el mar por la simplificación de la costa (islas pequeñas, atolones):
      // basta con que su país tenga algún punto del contorno a menos de 25 km.
      const figura = figuras.find((f) => f.id === ciudad.pais)!;
      const geometria = figura.forma.geometry;
      const anillos =
        geometria.type === 'Polygon'
          ? geometria.coordinates
          : geometria.type === 'MultiPolygon'
            ? geometria.coordinates.flat()
            : [];
      const cerca = anillos.some((anillo) =>
        anillo.some(
          (punto) => geoDistance(punto as [number, number], [ciudad.lon, ciudad.lat]) * 6371 < 25,
        ),
      );
      if (!cerca) fuera.push(`${ciudad.nombre} (${ciudad.pais})`);
    }
    expect(fuera).toEqual([]);
  });

  it('guarda la población de 2010 o la más cercana, con su fuente y su año', () => {
    const conDato = ciudades.filter((c) => c.poblacion !== null);
    expect(conDato.length / ciudades.length).toBeGreaterThan(0.9);
    for (const ciudad of conDato) {
      expect(ciudad.origenPoblacion, ciudad.nombre).toMatch(/^(WD:(\d{4}|sin-fecha)|ONU:2010)$/);
      expect(ciudad.poblacion!, ciudad.nombre).toBeGreaterThan(0);
    }
    for (const ciudad of ciudades.filter((c) => c.poblacion === null)) {
      expect(ciudad.origenPoblacion).toBeNull();
    }
    // Ejemplos de España con su dato de 2010 (Wikidata).
    expect(buscar('Zaragoza')).toMatchObject({ origenPoblacion: 'WD:2010' });
    expect(buscar('Madrid')!.poblacion).toBeGreaterThan(3_000_000);
  });

  it('las ciudades salen por orden de población: Zaragoza, después Córdoba y después Oviedo', () => {
    const espana = (nombre: string): Ciudad =>
      ciudades.find((c) => c.nombre === nombre && c.pais === 'ESP')!;
    const [zaragoza, cordoba, oviedo] = ['Zaragoza', 'Córdoba', 'Oviedo'].map(espana);
    expect(zoomDeAparicion(zaragoza!)).toBeLessThan(zoomDeAparicion(cordoba!));
    expect(zoomDeAparicion(cordoba!)).toBeLessThan(zoomDeAparicion(oviedo!));
    // En general: una ciudad más poblada nunca aparece después que otra menos poblada.
    const normales = ciudades.filter((c) => !c.capital && c.poblacion !== null);
    const ordenadas = [...normales].sort((a, b) => b.poblacion! - a.poblacion!);
    for (let i = 1; i < ordenadas.length; i++) {
      expect(zoomDeAparicion(ordenadas[i - 1]!)).toBeLessThanOrEqual(
        zoomDeAparicion(ordenadas[i]!),
      );
    }
  });
});

describe('cuándo y dónde se dibujan', () => {
  const capital: Ciudad = {
    nombre: 'Buyumbura',
    pais: 'BDI',
    lon: 29.36,
    lat: -3.38,
    capital: true,
    poblacion: null,
    origenPoblacion: null,
    rango: 10,
  };
  const ciudad: Ciudad = {
    nombre: 'Kindu',
    pais: 'COD',
    lon: 25.9,
    lat: -2.9,
    capital: false,
    poblacion: 170_000,
    origenPoblacion: 'WD:2010',
    rango: 9,
  };

  it('las capitales aparecen antes que las demás ciudades al acercarse', () => {
    expect(ciudadVisible(capital, 2.5)).toBe(false); // mundo entero
    expect(ciudadVisible(capital, ZOOM_TODAS_CAPITALES)).toBe(true);
    expect(ciudadVisible(ciudad, ZOOM_TODAS_CAPITALES)).toBe(false);
    expect(ciudadVisible(ciudad, 7.5)).toBe(true);
  });

  const medir = (texto: string): number => texto.length * 6.5;
  const altura = (esCapital: boolean): number => (esCapital ? 12 : 11);

  it('primero las capitales, y ningún punto ni nombre se pisa', () => {
    const candidatos: CandidatoCiudad[] = [
      { ciudad, x: 100, y: 100 },
      { ciudad: capital, x: 104, y: 102 },
      { ciudad: { ...ciudad, nombre: 'Uvira' }, x: 300, y: 300 },
    ];
    const colocadas = colocarCiudades(candidatos, medir, altura, 1280, 720);
    expect(colocadas.map((c) => c.ciudad.nombre)).toEqual(['Buyumbura', 'Uvira']);
    const cajas = colocadas.flatMap((c) => [c.cajaPunto, ...(c.cajaTexto ? [c.cajaTexto] : [])]);
    for (let i = 0; i < cajas.length; i++) {
      for (let j = i + 1; j < cajas.length; j++) {
        expect(cajasSeSolapan(cajas[i]!, cajas[j]!)).toBe(false);
      }
    }
  });

  it('si no cabe a la derecha, el nombre va a la izquierda', () => {
    const [colocada] = colocarCiudades(
      [{ ciudad: capital, x: 1270, y: 300 }],
      medir,
      altura,
      1280,
      720,
    );
    expect(colocada?.lado).toBe('izquierda');
  });

  it('respeta lo que ya está ocupado (por ejemplo, el nombre de un país)', () => {
    const colocadas = colocarCiudades(
      [{ ciudad: capital, x: 100, y: 100 }],
      medir,
      altura,
      1280,
      720,
      [[80, 80, 300, 120]],
    );
    expect(colocadas).toEqual([]);
  });
});

describe('ficha de la ciudad (ajuste f4-a4)', () => {
  const base: Ciudad = {
    nombre: 'Zaragoza',
    pais: 'ESP',
    lon: -0.88,
    lat: 41.66,
    capital: false,
    poblacion: 675_121,
    origenPoblacion: 'WD:2010',
    rango: 11,
  };
  const colocada = (x: number, y: number, ciudad: Ciudad = base): CiudadColocada => ({
    ciudad,
    x,
    y,
    lado: 'derecha',
    cajaPunto: [x - 3, y - 3, x + 3, y + 3],
    cajaTexto: [x + 4, y - 7, x + 70, y + 7],
  });

  it('el ratón señala la ciudad por su punto o por su nombre', () => {
    const lista = [colocada(100, 100), colocada(300, 300, { ...base, nombre: 'Huesca' })];
    expect(ciudadEnPunto(lista, 104, 103)?.ciudad.nombre).toBe('Zaragoza');
    expect(ciudadEnPunto(lista, 150, 100)?.ciudad.nombre).toBe('Zaragoza'); // sobre el nombre
    expect(ciudadEnPunto(lista, 302, 299)?.ciudad.nombre).toBe('Huesca');
    expect(ciudadEnPunto(lista, 200, 200)).toBeNull();
  });

  it('si dos puntos están cerca, gana el más cercano al ratón', () => {
    const lista = [colocada(100, 100), colocada(106, 100, { ...base, nombre: 'Utebo' })];
    expect(ciudadEnPunto(lista, 105, 100)?.ciudad.nombre).toBe('Utebo');
  });

  it('muestra la población con su año y su fuente', () => {
    expect(textoPoblacion(base, false)).toBe('675.121 (2010)');
    expect(textoPoblacion({ ...base, poblacion: 3_273_049 }, true)).toBe('3,3 millones (2010)');
    expect(textoPoblacion({ ...base, poblacion: null, origenPoblacion: null }, false)).toBe(
      'Sin dato',
    );
    expect(origenDePoblacion('WD:2008')).toEqual({
      fuente: 'Wikidata (población del municipio)',
      anio: 2008,
    });
    expect(origenDePoblacion('ONU:2010')?.fuente).toBe('Naciones Unidas (aglomeración urbana)');
    expect(origenDePoblacion('WD:sin-fecha')?.anio).toBeNull();
  });

  it('dice si es la capital y de qué país', () => {
    expect(subtituloCiudad(base, null)).toBe('Ciudad de ESP');
    const paises = { paises: { ESP: { nombre: 'España' } } } as unknown as ConjuntoPaises;
    expect(subtituloCiudad({ ...base, nombre: 'Madrid', capital: true }, paises)).toBe(
      'Capital de España',
    );
  });
});

describe('nombres de las ciudades (ajuste f4-a5)', () => {
  const nombres = new Set(ciudades.map((c) => c.nombre));

  it('corrige las traducciones erróneas de Natural Earth', () => {
    for (const bien of [
      'Tlaxcala',
      'Puerto Plata',
      'Santa Ana del Yacuma',
      'Kilju',
      'Minneapolis',
    ]) {
      expect(nombres, bien).toContain(bien);
    }
    for (const mal of [
      'Señorío de Tlaxcala',
      'El higo luperon',
      'Condado de Kilju',
      'Mineápolis',
    ]) {
      expect(nombres, mal).not.toContain(mal);
    }
  });

  it('usa el nombre que tenían las ciudades en 2010', () => {
    for (const nombre of ['Dnipropetrovsk', 'Kirovogrado', 'Xiangfan', 'Jessore', 'Almatý']) {
      expect(nombres, nombre).toContain(nombre);
    }
    for (const posterior of ['Dnipró', 'Kropivnitskiy', 'Xiangyang', 'Jashore', 'Alma Ata']) {
      expect(nombres, posterior).not.toContain(posterior);
    }
  });

  it('sin transliteraciones con signos poco usados en español (salvo los nombres japoneses)', () => {
    const raros = ciudades.filter((c) => c.pais !== 'JPN' && /[āīūḥṭṣḍẓġ]/.test(c.nombre));
    expect(raros.map((c) => c.nombre)).toEqual([]);
  });

  it('no incluye los lugares erróneos de Natural Earth', () => {
    expect(ciudades.some((c) => c.pais === 'DZA' && c.nombre === 'Arak')).toBe(false);
    expect(ciudades.some((c) => c.pais === 'SAU' && c.nombre.startsWith('Al Ḥ'))).toBe(false);
  });
});
