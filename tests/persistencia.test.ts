/** Cuándo se pide al navegador que no borre las partidas (ajuste f14-a2). */
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { crearPartida } from '../src/sim/partida';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const partida = crearPartida(
  { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 1 },
  paises.paises,
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('almacenamiento persistente (ajuste f14-a2)', () => {
  it('no se pide al abrir el juego, sino al guardar a mano por primera vez, y una sola vez', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('navigator', { storage: { persist } });
    vi.stubGlobal('indexedDB', new IDBFactory());
    const { almacenPartidas, guardarPartida } = await import('../src/ui/almacen-partidas');
    const almacen = almacenPartidas();
    expect(almacen.persistente).toBe(true);
    // Abrir el juego (y listar los guardados para «Continuar») no lo pide.
    await almacen.listar();
    expect(persist).not.toHaveBeenCalled();
    // Un guardado automático (no lo ha pedido el jugador) tampoco.
    await guardarPartida(almacen, partida, { tipo: 'automatico' }, '0.15.1');
    expect(persist).not.toHaveBeenCalled();
    // Guardar a mano, sí; la segunda vez ya no.
    await guardarPartida(almacen, partida, { tipo: 'manual', ranura: 1 }, '0.15.1');
    await guardarPartida(almacen, partida, { tipo: 'manual', ranura: 2 }, '0.15.1');
    expect(persist).toHaveBeenCalledOnce();
  });

  it('sin la API de almacenamiento se guarda igual', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('indexedDB', new IDBFactory());
    const { almacenPartidas, guardarPartida } = await import('../src/ui/almacen-partidas');
    const resumen = await guardarPartida(
      almacenPartidas(),
      partida,
      { tipo: 'manual', ranura: 1 },
      '0.15.1',
    );
    expect(resumen.id).toBe('ranura-1');
  });
});
