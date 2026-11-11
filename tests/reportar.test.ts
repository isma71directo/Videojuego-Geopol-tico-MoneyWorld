import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  TIPOS_REPORTE,
  cuerpoReporte,
  urlReporte,
  type ContextoReporte,
} from '../src/compartido/reportar';

const REPO = 'https://github.com/usuario/repo';

const sinPartida: ContextoReporte = {
  version: '0.1.0',
  fechaPartida: null,
  pais: null,
  dispositivo: 'Navegador de prueba',
};

const plantilla = (tipo: string): string =>
  readFileSync(new URL(`../.github/ISSUE_TEMPLATE/${tipo}.md`, import.meta.url), 'utf8');

describe('botón «Reportar fallo / sugerencia»', () => {
  it('abre una issue nueva del repositorio con su plantilla y su etiqueta', () => {
    for (const tipo of TIPOS_REPORTE) {
      const url = new URL(urlReporte(REPO, tipo, sinPartida));
      expect(url.origin + url.pathname).toBe(`${REPO}/issues/new`);
      expect(url.searchParams.get('template')).toBe(`${tipo}.md`);
      expect(url.searchParams.get('labels')).toBe(tipo);
    }
  });

  it('rellena la versión del juego', () => {
    const cuerpo = new URL(urlReporte(REPO, 'idea', sinPartida)).searchParams.get('body');
    expect(cuerpo).toContain('- Versión: v0.1.0');
  });

  it('indica que no hay partida cuando no la hay', () => {
    const cuerpo = cuerpoReporte('datos', sinPartida);
    expect(cuerpo).toContain('- Fecha de la partida: sin partida en curso');
    expect(cuerpo).toContain('- País: sin partida en curso');
  });

  it('incluye la fecha de la partida y el país cuando hay partida', () => {
    const cuerpo = cuerpoReporte('fallo', {
      ...sinPartida,
      fechaPartida: '2010-03-01',
      pais: 'España',
    });
    expect(cuerpo).toContain('- Fecha de la partida: 2010-03-01');
    expect(cuerpo).toContain('- País: España');
  });

  it('solo los fallos incluyen el dispositivo', () => {
    expect(cuerpoReporte('fallo', sinPartida)).toContain('Navegador de prueba');
    expect(cuerpoReporte('idea', sinPartida)).not.toContain('Navegador de prueba');
    expect(cuerpoReporte('datos', sinPartida)).not.toContain('Dispositivo');
  });

  it('conserva los caracteres especiales al pasar por la dirección', () => {
    const contexto = { ...sinPartida, pais: 'Côte d’Ivoire & Cía. #1' };
    const cuerpo = new URL(urlReporte(REPO, 'fallo', contexto)).searchParams.get('body');
    expect(cuerpo).toBe(cuerpoReporte('fallo', contexto));
  });
});

describe('plantillas de issue', () => {
  it.each(TIPOS_REPORTE)('la plantilla «%s» existe y lleva su etiqueta', (tipo) => {
    expect(plantilla(tipo)).toMatch(new RegExp(`^labels: ${tipo}$`, 'm'));
  });

  it.each(TIPOS_REPORTE)('el botón del juego usa los apartados de «%s»', (tipo) => {
    // Apartados en negrita y líneas de datos («- Versión:») de la plantilla.
    const apartados = plantilla(tipo).match(/^\*\*.+\*\*$|^- [^:]+:/gm) ?? [];
    expect(apartados.length).toBeGreaterThan(3);
    const cuerpo = cuerpoReporte(tipo, sinPartida);
    for (const apartado of apartados) expect(cuerpo).toContain(apartado);
  });

  it.each(TIPOS_REPORTE)('el título prerrellenado coincide con el de «%s»', (tipo) => {
    const titulo = new URL(urlReporte(REPO, tipo, sinPartida)).searchParams.get('title');
    expect(plantilla(tipo)).toContain(`title: '${titulo}'`);
  });
});
