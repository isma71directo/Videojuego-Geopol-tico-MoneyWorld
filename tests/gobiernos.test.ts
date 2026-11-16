/** Régimen y jefes de Estado y de Gobierno de 2010 (tarea f8-t1). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  REGIMENES,
  edadEn2010,
  jefeGobierno,
  type ConjuntoGobiernos,
  type GobiernoPais,
} from '../src/datos/gobiernos';
import type { ConjuntoPaises } from '../src/datos/paises';

const leer = <T>(ruta: string): T =>
  JSON.parse(readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8')) as T;
const gobiernos = leer<ConjuntoGobiernos>('public/data/gobiernos-2010.json');
const paises = leer<ConjuntoPaises>('public/data/paises-2010.json').paises;
const manual = leer<{
  cargos: Record<string, { motivo: string }>;
  regimenes: Record<string, { regimen: string; motivo: string }>;
}>('scripts/datos/manual/gobiernos-2010.json');

const nombre = (id: string): string => gobiernos.personas[id]!.nombre;
const de = (iso: string): GobiernoPais => gobiernos.paises[iso]!;

describe('gobiernos de 2010 (tarea f8-t1)', () => {
  it('todos los países del juego tienen su entrada, con un régimen de los 8 del GDD', () => {
    expect(Object.keys(gobiernos.paises).sort()).toEqual(Object.keys(paises).sort());
    expect(gobiernos.fecha).toBe('2010-01-01');
    for (const [id, g] of Object.entries(gobiernos.paises)) {
      const pais = paises[id]!;
      if (pais.tipo === 'dependiente' || id === 'ESH') {
        // Los dependientes no tienen régimen propio; el Sáhara Occidental, tampoco Estado.
        expect(g.regimen, id).toBeNull();
      } else {
        expect(REGIMENES, id).toContain(g.regimen);
        expect(g.regimenFuente, id).not.toBe('');
      }
    }
  });

  it('todos (salvo el Sáhara Occidental) tienen jefe de Estado y de Gobierno con nombre', () => {
    for (const [id, g] of Object.entries(gobiernos.paises)) {
      if (id === 'ESH') continue;
      expect(g.estado, id).not.toBeNull();
      if (paises[id]!.tipo !== 'dependiente') expect(g.gobierno, id).not.toBeNull();
      for (const cargo of [g.estado, jefeGobierno(g)]) {
        if (!cargo) continue;
        const persona = gobiernos.personas[cargo.persona];
        expect(persona, `${id} ${cargo.persona}`).toBeDefined();
        expect(persona!.nombre, id).not.toMatch(/^Q\d+$/);
        // En el cargo desde antes del 1 de enero de 2010, con su nombre en español.
        expect(cargo.desde <= '2010-01-01', `${id} ${cargo.desde}`).toBe(true);
        expect(cargo.cargo, id).not.toMatch(/\b(of|the)\b|Anexo/);
        expect(cargo.cargo.charAt(0), id).toBe(cargo.cargo.charAt(0).toUpperCase());
      }
    }
  });

  it('los conocidos, como estaban el 1 de enero de 2010', () => {
    const casos: [string, string, string, string][] = [
      ['ESP', 'monarquia-parlamentaria', 'Juan Carlos I', 'Rodríguez Zapatero'],
      ['USA', 'presidencial', 'Obama', 'Obama'],
      ['GBR', 'monarquia-parlamentaria', 'Isabel II', 'Gordon Brown'],
      ['FRA', 'semipresidencial', 'Sarkozy', 'Fillon'],
      ['DEU', 'parlamentario', 'Köhler', 'Merkel'],
      ['JPN', 'monarquia-parlamentaria', 'Akihito', 'Hatoyama'],
      ['RUS', 'semipresidencial', 'Medvédev', 'Putin'],
      ['CHN', 'partido-unico', 'Hu Jintao', 'Wen Jiabao'],
      ['IRN', 'teocracia', 'Jameneí', 'Ahmadineyad'],
      ['TUR', 'parlamentario', 'Gül', 'Erdoğan'],
      ['SAU', 'monarquia-absoluta', 'Abdalá', 'Abdalá'],
      ['MMR', 'junta', 'Than Shwe', 'Thein Sein'],
      ['SOL', 'presidencial', 'Riyale', 'Riyale'],
    ];
    for (const [iso, regimen, estado, gobierno] of casos) {
      const g = de(iso);
      expect(g.regimen, iso).toBe(regimen);
      expect(nombre(g.estado!.persona), iso).toContain(estado);
      expect(nombre(jefeGobierno(g)!.persona), iso).toContain(gobierno);
    }
    // Un territorio dependiente lleva el jefe de Estado de su soberano.
    expect(de('PRI').estado!.persona).toBe(de('USA').estado!.persona);
    expect(nombre(jefeGobierno(de('PRI'))!.persona)).toContain('Fortuño');
  });

  it('los cargos de las mujeres van en femenino', () => {
    expect(de('ARG').estado!.cargo).toMatch(/^Presidenta/);
    expect(de('NLD').estado!.cargo).toMatch(/^Reina/);
    expect(de('UKR').gobierno).toMatchObject({ cargo: expect.stringMatching(/^Primera ministra/) });
  });

  it('cada corrección a mano dice por qué está', () => {
    for (const [id, c] of Object.entries(manual.cargos)) expect(c.motivo, id).not.toBe('');
    for (const [id, r] of Object.entries(manual.regimenes)) {
      expect(r.motivo, id).not.toBe('');
      expect(REGIMENES, id).toContain(r.regimen);
      expect(de(id).regimen, id).toBe(r.regimen);
    }
  });

  it('utilidades: jefe de Gobierno y edad en 2010', () => {
    expect(jefeGobierno(de('USA'))).toBe(de('USA').estado);
    expect(edadEn2010(gobiernos.personas[de('USA').estado!.persona])).toBe(49);
    expect(edadEn2010(undefined)).toBeNull();
  });
});
