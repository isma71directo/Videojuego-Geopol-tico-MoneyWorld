/** Economía, recursos, superficie y ciudades de cada región en 2010 (tarea f9-t1). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RECURSOS,
  tipoDeRecurso,
  type ConjuntoEconomiaRegiones,
  type EconomiaRegion,
} from '../src/datos/regiones-economia';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(resolve(ruta), 'utf8')) as T;
const datos = leer<ConjuntoEconomiaRegiones>('public/data/regiones-2010-economia.json');
const topo = leer<{ objects: { regiones: { geometries: { properties: { id: string } }[] } } }>(
  'public/data/regiones-2010.json',
);
const de = (id: string): EconomiaRegion => datos.regiones[id]!;

describe('economía y recursos de las regiones (tarea f9-t1)', () => {
  it('todas las regiones del mapa tienen su entrada', () => {
    const ids = topo.objects.regiones.geometries.map((g) => g.properties.id).sort();
    expect(Object.keys(datos.regiones).sort()).toEqual(ids);
    expect(datos.fecha).toBe('2010');
    expect(datos.fuente).toContain('USGS');
  });

  it('los datos son coherentes y dicen de dónde salen', () => {
    for (const [id, r] of Object.entries(datos.regiones)) {
      if (r.sectores) {
        const suma = r.sectores.reduce((s, v) => s + v, 0);
        expect(Math.abs(suma - 1), id).toBeLessThan(0.01);
        for (const v of r.sectores) expect(v >= 0 && v <= 1, id).toBe(true);
        expect(r.origenSectores, id).toMatch(/^DOSE:2010(:conjunto)?$/);
      } else expect(r.origenSectores, id).toBeNull();
      if (r.capital) expect(['NE', 'WD', 'pais'], id).toContain(r.origenCapital);
      if (r.superficie !== null) {
        expect(r.superficie, id).toBeGreaterThan(0);
        expect(r.origenSuperficie, id).not.toBeNull();
      }
      for (const [recurso, n, ejemplos, origen] of r.recursos) {
        expect(RECURSOS, `${id} ${recurso}`).toContain(recurso);
        expect(n, id).toBeGreaterThan(0);
        expect(ejemplos.length, id).toBeLessThanOrEqual(3);
        expect(origen, id).toMatch(/^(USGS|WD|USGS\+WD)$/);
      }
      // Ciudades de más a menos pobladas.
      const poblaciones = r.ciudades.map(([, p]) => p ?? 0);
      expect(poblaciones, id).toEqual([...poblaciones].sort((a, b) => b - a));
    }
  });

  it('cobertura: sectores, recursos, capital y superficie en buena parte de las regiones', () => {
    const regiones = Object.values(datos.regiones);
    expect(regiones.filter((r) => r.sectores).length).toBeGreaterThan(900);
    expect(regiones.filter((r) => r.recursos.length > 0).length).toBeGreaterThan(900);
    expect(regiones.filter((r) => r.capital).length).toBeGreaterThan(2200);
    expect(regiones.filter((r) => r.origenSuperficie === 'WD').length).toBeGreaterThan(2500);
  });

  it('los casos conocidos, como eran en 2010', () => {
    const cataluna = de('ESP-cataluna');
    expect(cataluna.capital).toBe('Barcelona');
    expect(cataluna.superficie).toBeGreaterThan(30000);
    expect(cataluna.superficie).toBeLessThan(34000);
    const [ag, ind, serv] = cataluna.sectores!;
    expect(serv).toBeGreaterThan(ind);
    expect(ind).toBeGreaterThan(ag);
    const texas = de('USA-texas');
    expect(texas.capital).toBe('Austin');
    expect(texas.ciudades[0]![0]).toBe('Houston');
    expect(texas.recursos[0]![0]).toBe('petroleo');
    const antofagasta = de('CHL-antofagasta');
    expect(antofagasta.recursos[0]![0]).toBe('cobre');
    expect(antofagasta.sectores![1]).toBeGreaterThan(0.5);
    const lagos = de('NGA-lagos');
    expect(lagos.capital).toBe('Ikeja');
    expect(lagos.ciudades.map(([n]) => n)).toContain('Lagos');
    // Un yacimiento del Congo con la latitud mal en el USGS no acaba en Sudáfrica.
    const gauteng = de('ZAF-gauteng');
    expect(gauteng.recursos.find(([r]) => r === 'oro')).toBeDefined();
    expect(gauteng.recursos.flatMap(([, , ejemplos]) => ejemplos)).not.toContain(
      'Kivu (Goma Kivu)',
    );
  });

  it('cada recurso tiene su tipo', () => {
    expect(tipoDeRecurso('petroleo')).toBe('energia');
    expect(tipoDeRecurso('oro')).toBe('preciosos');
    expect(tipoDeRecurso('litio')).toBe('estrategicos');
    expect(new Set(RECURSOS).size).toBe(RECURSOS.length);
    for (const recurso of RECURSOS) expect(tipoDeRecurso(recurso)).toBeDefined();
  });
});
