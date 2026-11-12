import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatearFecha } from '../src/compartido/fechas';
import { numeroDeFase, rangoVersiones, type Roadmap } from '../src/compartido/roadmap';
import { hayVersionNueva, pareceRoadmap } from '../src/compartido/sincronizacion';

const roadmap = JSON.parse(
  readFileSync(new URL('../roadmap.json', import.meta.url), 'utf8'),
) as Roadmap;

describe('aviso de versión nueva', () => {
  it('avisa solo si la versión publicada es posterior a la abierta', () => {
    expect(hayVersionNueva('0.1.0', '0.2.0')).toBe(true);
    expect(hayVersionNueva('0.9.0', '0.10.0')).toBe(true);
    expect(hayVersionNueva('0.2.0', '0.2.0')).toBe(false);
    expect(hayVersionNueva('0.2.0', '0.1.0')).toBe(false);
  });
});

describe('lectura de roadmap.json desde las webs', () => {
  it('acepta el roadmap real', () => {
    expect(pareceRoadmap(roadmap)).toBe(true);
  });

  it('rechaza lo que no tiene forma de hoja de ruta', () => {
    expect(pareceRoadmap(null)).toBe(false);
    expect(pareceRoadmap('texto')).toBe(false);
    expect(pareceRoadmap({ versionActual: '0.1.0' })).toBe(false);
  });
});

describe('textos de la Hoja de ruta', () => {
  it('distingue las fases numeradas del lanzamiento y las ampliaciones', () => {
    expect(numeroDeFase('fase-0')).toBe(0);
    expect(numeroDeFase('fase-50')).toBe(50);
    expect(numeroDeFase('lanzamiento')).toBeNull();
    expect(numeroDeFase('v1-1')).toBeNull();
  });

  it('resume el rango de versiones de una etapa', () => {
    const etapaA = roadmap.fases.filter((fase) => fase.etapa === 'A');
    expect(rangoVersiones(etapaA)).toBe('0.1 – 0.11');
    expect(rangoVersiones(etapaA.slice(0, 1))).toBe('0.1');
    expect(rangoVersiones([])).toBe('');
  });

  it('escribe las fechas como día/mes/año', () => {
    expect(formatearFecha('2026-11-11')).toBe('11/11/2026');
    expect(formatearFecha('sin fecha')).toBe('sin fecha');
  });
});
