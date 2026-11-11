import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION, etiquetaVersion } from '../src/compartido/version';

const paquete = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

describe('versión del juego', () => {
  it('sale de package.json (única fuente)', () => {
    expect(VERSION).toBe(paquete.version);
  });

  it('sigue el formato semver', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('se muestra con el prefijo «v»', () => {
    expect(etiquetaVersion('0.1.0')).toBe('v0.1.0');
  });
});
