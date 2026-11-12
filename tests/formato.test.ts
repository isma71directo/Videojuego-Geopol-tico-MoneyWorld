/** Formato de cifras en español (fichas de país, Fase 4). */
import { describe, expect, it } from 'vitest';
import { dolares, dolaresPorPersona, personas, porcentaje } from '../src/compartido/formato';

describe('formato de cifras', () => {
  it('personas', () => {
    expect(personas(46576897)).toBe('46,6 millones');
    expect(personas(1337705000)).toBe('1,3 mil millones');
    expect(personas(31248)).toBe('31.248');
    expect(personas(812)).toBe('812');
  });

  it('dólares', () => {
    expect(dolares(1427990000000)).toBe('1,43 billones $');
    expect(dolares(98381300000)).toBe('98.381 M$');
    expect(dolaresPorPersona(30658.7)).toBe('30.659 $');
  });

  it('porcentajes', () => {
    expect(porcentaje(19.86)).toBe('19,9 %');
    expect(porcentaje(-3.85)).toBe('-3,9 %');
  });
});
