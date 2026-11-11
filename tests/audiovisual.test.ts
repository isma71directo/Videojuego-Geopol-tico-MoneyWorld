import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { urlBandera } from '../src/av/banderas';
import { NOMBRES_ICONOS } from '../src/av/iconos';
import type { ConjuntoPaises } from '../src/datos/paises';

const leer = (ruta: string): string => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
const conjunto = JSON.parse(leer('public/data/paises-2010.json')) as ConjuntoPaises;
const creditos = JSON.parse(leer('public/av/banderas/creditos.json')) as {
  flagIcons: { banderas: number; licencia: string };
  commons: Record<string, { licencia: string; url: string }>;
};

describe('banderas de 2010', () => {
  const ids = Object.keys(conjunto.paises);

  it('hay una bandera SVG por cada país y territorio', () => {
    for (const id of ids) {
      const svg = leer(`public/av/banderas/${id}.svg`);
      expect(svg, `bandera de ${id}`).toMatch(/<svg[\s>]/);
      expect(svg, `bandera de ${id}`).not.toMatch(/<script/i);
    }
  });

  it('no sobra ninguna bandera', () => {
    const archivos = readdirSync(new URL('../public/av/banderas/', import.meta.url))
      .filter((nombre) => nombre.endsWith('.svg'))
      .map((nombre) => nombre.replace('.svg', ''));
    expect(archivos.sort()).toEqual([...ids].sort());
  });

  it('todas tienen procedencia y licencia', () => {
    expect(creditos.flagIcons.licencia).toBe('MIT');
    expect(creditos.flagIcons.banderas + Object.keys(creditos.commons).length).toBe(ids.length);
    for (const [id, credito] of Object.entries(creditos.commons)) {
      expect(credito.licencia, id).not.toBe('sin indicar');
      expect(credito.url, id).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it('usa la bandera de 2010 donde ha cambiado después', () => {
    for (const id of ['AFG', 'KGZ', 'LBY', 'MMR', 'MRT', 'SYR']) {
      expect(Object.keys(creditos.commons), id).toContain(id);
    }
  });

  it('los créditos están publicados en docs/creditos.md', () => {
    const texto = leer('docs/creditos.md');
    expect(texto).toContain('flag-icons');
    for (const id of Object.keys(creditos.commons)) {
      expect(texto, id).toContain(conjunto.paises[id]!.nombre);
    }
  });

  it('calcula la dirección de la bandera desde cualquier página', () => {
    expect(urlBandera('ESP')).toBe('./av/banderas/ESP.svg');
    expect(urlBandera('ESP', '../')).toBe('../av/banderas/ESP.svg');
  });
});

describe('iconos de indicadores', () => {
  it('cada icono tiene su archivo SVG con trazo de color heredado', () => {
    expect(NOMBRES_ICONOS.length).toBeGreaterThanOrEqual(8);
    for (const nombre of NOMBRES_ICONOS) {
      const ruta = `src/av/iconos/${nombre}.svg`;
      expect(existsSync(new URL(`../${ruta}`, import.meta.url)), ruta).toBe(true);
      const svg = leer(ruta);
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('stroke="currentColor"');
    }
  });
});
