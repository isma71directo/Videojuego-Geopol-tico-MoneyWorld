import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n';

describe('textos de la interfaz (i18n)', () => {
  it('devuelve el texto de una clave existente', () => {
    expect(t('comun.titulo')).toBe('Geopolítica 2010');
  });

  it('sustituye los parámetros entre llaves', () => {
    expect(t('comun.nuevaVersion', { version: 'v0.2.0' })).toBe('Hay una versión nueva: v0.2.0.');
  });

  it('devuelve la clave si el texto no existe, para que el fallo se vea', () => {
    expect(t('no.existe')).toBe('no.existe');
    expect(t('comun')).toBe('comun');
  });
});
