import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION, etiquetaVersion } from '../src/compartido/version';

const leer = (ruta: string): string => readFileSync(new URL(ruta, import.meta.url), 'utf8');

const paquete = JSON.parse(leer('../package.json')) as { version: string };
const roadmap = JSON.parse(leer('../roadmap.json')) as {
  versionActual: string;
  historial: { version: string }[];
};

describe('versión del juego', () => {
  it('sale de package.json (única fuente)', () => {
    expect(VERSION).toBe(paquete.version);
  });

  it('sigue el formato semver', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('coincide con la versión actual de la hoja de ruta', () => {
    expect(roadmap.versionActual).toBe(paquete.version);
  });

  it('tiene su entrada en el historial de la hoja de ruta', () => {
    expect(roadmap.historial.map((entrada) => entrada.version)).toContain(paquete.version);
  });

  it('tiene su apartado en CHANGELOG.md', () => {
    expect(leer('../CHANGELOG.md')).toContain(`## ${paquete.version} - `);
  });

  it('se muestra con el prefijo «v»', () => {
    expect(etiquetaVersion('0.1.0')).toBe('v0.1.0');
  });
});
