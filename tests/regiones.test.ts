/** Regiones del mapa como eran en 2010 (Fase 5, tarea f5-t1). */
import { readFileSync } from 'node:fs';
import type { Feature, MultiPolygon } from 'geojson';
import { geoArea, geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';

interface PropiedadesRegion {
  id: string;
  pais: string;
  nombre: string;
  etiqueta: [number, number];
}

const ruta = (archivo: string): URL => new URL(`../public/data/${archivo}`, import.meta.url);
const texto = readFileSync(ruta('regiones-2010.json'), 'utf8');
const topo = JSON.parse(texto) as Topology<{ regiones: GeometryCollection<PropiedadesRegion> }>;
const regiones = (
  feature(topo, topo.objects.regiones) as unknown as {
    features: Feature<MultiPolygon, PropiedadesRegion>[];
  }
).features;
const { paises } = JSON.parse(readFileSync(ruta('paises-2010.json'), 'utf8')) as ConjuntoPaises;
const manual = JSON.parse(
  readFileSync(new URL('../scripts/datos/manual/regiones-2010.json', import.meta.url), 'utf8'),
) as { maximo: number; excepciones: Record<string, string> };

const de = (pais: string): string[] =>
  regiones.filter((r) => r.properties.pais === pais).map((r) => r.properties.nombre);

describe('regiones de 2010', () => {
  it('cada región pertenece a un país existente y cada país tiene al menos una región', () => {
    for (const region of regiones)
      expect(paises, region.properties.id).toHaveProperty(region.properties.pais);
    for (const id of Object.keys(paises)) expect(de(id).length, id).toBeGreaterThan(0);
  });

  it('los identificadores son únicos y no hay dos regiones con el mismo nombre en un país', () => {
    const ids = regiones.map((r) => r.properties.id);
    expect(new Set(ids).size).toBe(ids.length);
    const claves = regiones.map((r) => `${r.properties.pais}|${r.properties.nombre}`);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('como mucho unas 30 por país (40 en la tabla), salvo las excepciones anotadas', () => {
    const cuenta = new Map<string, number>();
    for (const r of regiones)
      cuenta.set(r.properties.pais, (cuenta.get(r.properties.pais) ?? 0) + 1);
    for (const [pais, n] of cuenta) {
      if (pais in manual.excepciones) continue;
      expect(n, pais).toBeLessThanOrEqual(manual.maximo);
    }
  });

  it('España por comunidades autónomas, con Ceuta y Melilla', () => {
    const espana = de('ESP');
    expect(espana).toHaveLength(19);
    for (const nombre of ['Cataluña', 'Andalucía', 'Comunidad de Madrid', 'Ceuta', 'Melilla']) {
      expect(espana).toContain(nombre);
    }
  });

  it('Francia con sus 22 regiones metropolitanas de 2010', () => {
    const francia = de('FRA');
    for (const nombre of [
      'Alsacia',
      'Lorena',
      'Champaña-Ardenas',
      'Mediodía-Pirineos',
      'Ródano-Alpes',
    ]) {
      expect(francia).toContain(nombre);
    }
    // Las de 2016 no existían.
    for (const nombre of ['Gran Este', 'Occitania', 'Nueva Aquitania'])
      expect(francia).not.toContain(nombre);
  });

  it('deshace los cambios posteriores a 2010', () => {
    expect(de('KEN')).toHaveLength(8); // provincias de 2010
    expect(de('IND')).toContain('Andhra Pradesh');
    expect(de('IND')).not.toContain('Telangana'); // creado en 2014
    expect(de('IRN')).not.toContain('Elburz'); // creada en 2010
    expect(de('UKR')).toContain('República Autónoma de Crimea');
    expect(de('SDN')).toContain('Ecuatoria Central'); // Sudán del Sur aún era parte de Sudán
    expect(de('SDN').filter((n) => n.startsWith('Darfur'))).toHaveLength(3);
    expect(de('SOS')).toEqual(['Osetia del Sur']);
  });

  it('el punto de la etiqueta cae dentro de su región (salvo islotes casi sin superficie)', () => {
    // Las islas y municipios diminutos (menos de 50 km²) pueden quedar casi sin área al simplificar.
    const conSuperficie = regiones.filter((r) => geoArea(r) * 6371 ** 2 > 50);
    const fuera = conSuperficie.filter((r) => !geoContains(r, r.properties.etiqueta));
    expect(fuera.map((r) => r.properties.id)).toEqual([]);
    expect(de('CZE')).toContain('Bohemia Central');
  });

  it('los nombres están limpios (sin «Voivodato de», «Parroquia de»… ni artículos sueltos)', () => {
    const raros = regiones
      .map((r) => r.properties.nombre)
      .filter((n) =>
        /^(Voivodato|Municipio|Municipalidad|Parroquia) |^(del|de|las|los|la|el) /u.test(n),
      );
    expect(raros).toEqual([]);
  });

  it('el archivo pesa menos de 2 MB', () => {
    expect(texto.length).toBeLessThan(2 * 1024 * 1024);
  });
});
