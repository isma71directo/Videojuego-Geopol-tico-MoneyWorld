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

describe('población y PIB de las regiones (f5-t2)', () => {
  interface DatosRegion {
    poblacion: number | null;
    origenPoblacion: string | null;
    pib: number | null;
    origenPib: string | null;
  }
  const { regiones: datos } = JSON.parse(
    readFileSync(ruta('regiones-2010-datos.json'), 'utf8'),
  ) as {
    regiones: Record<string, DatosRegion>;
  };
  const porPais = (pais: string): [string, DatosRegion][] =>
    regiones
      .filter((r) => r.properties.pais === pais)
      .map((r) => [r.properties.nombre, datos[r.properties.id]!]);

  it('cada región tiene sus datos y no sobra ninguno', () => {
    for (const r of regiones) expect(datos, r.properties.id).toHaveProperty(r.properties.id);
    expect(Object.keys(datos)).toHaveLength(regiones.length);
  });

  it('la población de las regiones suma la del país, y el PIB, el del país', () => {
    for (const [id, pais] of Object.entries(paises)) {
      const lista = porPais(id);
      const poblacion = pais.datos.poblacion;
      if (poblacion !== null && poblacion !== undefined) {
        const suma = lista.reduce((s, [, d]) => s + (d.poblacion ?? 0), 0);
        expect(Math.abs(suma - poblacion), id).toBeLessThanOrEqual(lista.length);
      }
      const pib = pais.datos.pib;
      if (pib !== null && pib !== undefined) {
        const suma = lista.reduce((s, [, d]) => s + (d.pib ?? 0), 0);
        expect(Math.abs(suma - pib), id).toBeLessThanOrEqual(lista.length);
      }
    }
  });

  it('cada valor dice de dónde sale (dato real con su año o estimación marcada)', () => {
    const valido =
      /^(DOSE:2010|WD:\d{4}|EST:(superficie|dose-poblacion|poblacion)|BM:\d{4}|FMI:\d{4}|OWID:\d{4}|WD:\d{4}|DER|EST:[a-z-]+)$/;
    for (const d of Object.values(datos)) {
      if (d.poblacion !== null) expect(d.origenPoblacion).toMatch(valido);
      if (d.pib !== null) expect(d.origenPib).toMatch(valido);
    }
  });

  it('España: datos de DOSE de 2010 y Madrid con más PIB por habitante que Extremadura', () => {
    const espana = new Map(porPais('ESP'));
    const madrid = espana.get('Comunidad de Madrid')!;
    const extremadura = espana.get('Extremadura')!;
    expect(madrid.origenPib).toBe('DOSE:2010');
    expect(espana.get('Cataluña')!.origenPoblacion).toBe('DOSE:2010');
    expect(madrid.pib! / madrid.poblacion!).toBeGreaterThan(
      (1.5 * extremadura.pib!) / extremadura.poblacion!,
    );
  });

  it('las regiones de un país dividido por DOSE de otra forma quedan marcadas como estimadas', () => {
    // DOSE trae Inglaterra entera: sus 9 regiones se reparten por población.
    expect(new Map(porPais('GBR')).get('Londres')!.origenPib).toBe('EST:dose-poblacion');
  });
});

describe('regiones en el mapa (f5-t3)', async () => {
  const {
    prepararRegiones,
    regionEnPunto,
    regionesVisibles,
    colocarNombresRegiones,
    TAMANO_REGIONES_PX,
  } = await import('../src/map/regiones');
  const { crearProyeccion } = await import('../src/map/proyeccion');
  const capa = prepararRegiones(topo as unknown as Parameters<typeof prepararRegiones>[0]);
  const proyeccion = crearProyeccion();
  const invertir = (punto: [number, number]): [number, number] | null => {
    const lugar = proyeccion.invert?.(punto);
    return lugar ? [lugar[0], lugar[1]] : null;
  };
  const regionDe = (pais: string, lon: number, lat: number): string | null => {
    const [x, y] = proyeccion([lon, lat])!;
    return regionEnPunto(capa.porPais.get(pais) ?? [], x, y, invertir)?.nombre ?? null;
  };

  it('un punto de una región la selecciona', () => {
    expect(regionDe('ESP', 2.17, 41.39)).toBe('Cataluña'); // Barcelona
    expect(regionDe('ESP', -5.98, 37.39)).toBe('Andalucía'); // Sevilla
    expect(regionDe('ESP', -3.7, 40.42)).toBe('Comunidad de Madrid');
    expect(regionDe('FRA', 2.35, 48.86)).toBe('Isla de Francia');
    expect(regionDe('UKR', 34.1, 44.95)).toBe('República Autónoma de Crimea');
    // También en otra copia del mundo (desplazamiento continuo).
    const [x, y] = proyeccion([2.17, 41.39])!;
    expect(regionEnPunto(capa.porPais.get('ESP')!, x + 1024, y, invertir)?.nombre).toBe('Cataluña');
  });

  it('las regiones de un país se ven cuando el país es grande en pantalla', () => {
    expect(regionesVisibles(TAMANO_REGIONES_PX - 1)).toBe(false);
    expect(regionesVisibles(TAMANO_REGIONES_PX)).toBe(true);
  });

  it('las fronteras interiores existen en los países con varias regiones y no en los de una', () => {
    expect(capa.fronteras('ESP').length).toBeGreaterThan(100);
    expect(capa.fronteras('SOS')).toBe('');
  });

  it('los nombres de las regiones no se pisan entre sí ni con lo ocupado', () => {
    const medir = (texto: string): number => texto.length * 6;
    const nombres = colocarNombresRegiones(
      [
        { id: 'a', texto: 'Aragón', x: 100, y: 100, tamano: 120 },
        { id: 'b', texto: 'Navarra', x: 104, y: 101, tamano: 80 },
        { id: 'c', texto: 'La Rioja', x: 300, y: 300, tamano: 20 }, // no cabe en su región
        { id: 'd', texto: 'Cataluña', x: 500, y: 100, tamano: 120 },
      ],
      medir,
      11,
      1280,
      720,
      [[480, 90, 560, 110]],
    );
    const ids = nombres.map((n) => n.id);
    expect(ids).toContain('a');
    expect(ids).not.toContain('c');
    for (let i = 0; i < nombres.length; i++) {
      for (let j = i + 1; j < nombres.length; j++) {
        const [p, q] = [nombres[i]!.caja, nombres[j]!.caja];
        expect(p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3]).toBe(false);
      }
    }
  });
});

describe('transición entre países y regiones (f5-t4)', async () => {
  const { prepararRegiones, opacidadRegiones, TAMANO_REGIONES_PX, TAMANO_REGIONES_COMPLETAS_PX } =
    await import('../src/map/regiones');
  const { neighbors } = await import('topojson-client');
  const capa = prepararRegiones(topo as unknown as Parameters<typeof prepararRegiones>[0]);

  it('las regiones aparecen poco a poco según crece el país en pantalla', () => {
    expect(opacidadRegiones(TAMANO_REGIONES_PX)).toBe(0);
    const mitad = (TAMANO_REGIONES_PX + TAMANO_REGIONES_COMPLETAS_PX) / 2;
    expect(opacidadRegiones(mitad)).toBeCloseTo(0.5);
    expect(opacidadRegiones(TAMANO_REGIONES_COMPLETAS_PX)).toBe(1);
    expect(opacidadRegiones(5000)).toBe(1);
  });

  it('dos regiones vecinas del mismo país nunca tienen el mismo tono', () => {
    const geometrias = topo.objects.regiones.geometries;
    const props = geometrias.map((g) => g.properties as PropiedadesRegion);
    const vecinos = neighbors(geometrias as unknown as Parameters<typeof neighbors>[0]);
    let comprobadas = 0;
    props.forEach((a, i) => {
      for (const j of vecinos[i]!) {
        const b = props[j]!;
        if (j === i || b.pais !== a.pais) continue;
        expect(capa.tono.get(a.id), `${a.id} y ${b.id}`).not.toBe(capa.tono.get(b.id));
        comprobadas++;
      }
    });
    expect(comprobadas).toBeGreaterThan(1000);
  });
});
