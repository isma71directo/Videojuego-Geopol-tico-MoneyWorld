import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n';

describe('textos de la interfaz (i18n)', () => {
  it('devuelve el texto de una clave existente', () => {
    expect(t('juego.titulo')).toBe('Geopolítica 2010');
  });

  it('devuelve la clave si el texto no existe, para que el fallo se vea', () => {
    expect(t('no.existe')).toBe('no.existe');
    expect(t('juego')).toBe('juego');
  });
});
