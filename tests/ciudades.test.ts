/** Capitales y ciudades del mapa (Fase 4, tarea f4-t3). */
import { readFileSync } from 'node:fs';
import { geoDistance } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  ciudadVisible,
  colocarCiudades,
  ZOOM_TODAS_CAPITALES,
  type CandidatoCiudad,
  type Ciudad,
  type ConjuntoCiudades,
} from '../src/map/ciudades';
import { prepararFiguras, type TopologiaMapa } from '../src/map/geometria';
import { crearProyeccion } from '../src/map/proyeccion';
import { cajasSeSolapan } from '../src/map/rotulos';
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

  it('no guarda poblaciones (las de Natural Earth no son de 2010)', () => {
    for (const ciudad of ciudades) expect(Object.keys(ciudad)).not.toContain('poblacion');
  });
});

describe('cuándo y dónde se dibujan', () => {
  const capital: Ciudad = {
    nombre: 'Buyumbura',
    pais: 'BDI',
    lon: 29.36,
    lat: -3.38,
    rango: 10,
    zoom: 5.6,
    capital: true,
  };
  const ciudad: Ciudad = {
    nombre: 'Kindu',
    pais: 'COD',
    lon: 25.9,
    lat: -2.9,
    rango: 10,
    zoom: 6.7,
    capital: false,
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
    const cajas = colocadas.flatMap((c) => [c.cajaPunto, c.cajaTexto]);
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
