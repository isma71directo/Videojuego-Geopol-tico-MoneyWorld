// @vitest-environment happy-dom
/** Indicador de guardado y «Continuar» / «Cargar partida» en el inicio (tarea f14-t4). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EFECTOS } from '../src/av/sonido';
import type { ConjuntoPaises } from '../src/datos/paises';
import { crearPartida } from '../src/sim/partida';
import { almacenPartidas, guardarPartida } from '../src/ui/almacen-partidas';
import { cerrarVentanas } from '../src/ui/componentes/ventana';
import { crearIndicadorGuardado, DURACION_INDICADOR } from '../src/ui/indicador-guardado';
import { crearPantallaInicio } from '../src/ui/inicio';
import { t } from '../src/i18n';

const texto = readFileSync(resolve('public/data/paises-2010.json'), 'utf8');
const paises = JSON.parse(texto) as ConjuntoPaises;
const esperar = () => new Promise((r) => setTimeout(r, 0));

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cerrarVentanas();
  document.body.replaceChildren();
  const almacen = almacenPartidas();
  for (const r of await almacen.listar()) await almacen.borrar(r.id);
});

describe('indicador de guardado (tarea f14-t4)', () => {
  it('«Guardando…», lo guardado con su sonido, y se va solo', async () => {
    vi.useFakeTimers();
    const alSonar = vi.fn();
    const indicador = crearIndicadorGuardado({ alSonar });
    document.body.appendChild(indicador.elemento);
    expect(indicador.elemento.hidden).toBe(true);
    expect(indicador.elemento.getAttribute('role')).toBe('status');
    indicador.guardando();
    expect(indicador.estado).toBe('guardando');
    expect(indicador.elemento.textContent).toContain('Guardando…');
    indicador.hecho('Guardada en la ranura 2', true);
    expect(indicador.elemento.dataset.estado).toBe('hecho');
    expect(indicador.elemento.textContent).toContain('Guardada en la ranura 2');
    expect(alSonar).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(DURACION_INDICADOR.hecho + 400);
    expect(indicador.estado).toBeNull();
    expect(indicador.elemento.hidden).toBe(true);
  });

  it('los automáticos no suenan y un error dura más', async () => {
    vi.useFakeTimers();
    const alSonar = vi.fn();
    const indicador = crearIndicadorGuardado({ alSonar });
    indicador.hecho('Guardado automático');
    expect(alSonar).not.toHaveBeenCalled();
    indicador.error('No se ha podido guardar');
    await vi.advanceTimersByTimeAsync(DURACION_INDICADOR.hecho + 400);
    expect(indicador.estado).toBe('error');
    await vi.advanceTimersByTimeAsync(DURACION_INDICADOR.error);
    expect(indicador.estado).toBeNull();
    expect(DURACION_INDICADOR.error).toBeGreaterThan(DURACION_INDICADOR.hecho);
  });

  it('el sonido de guardado es corto y suave, y tiene nombre en la galería', () => {
    const notas = EFECTOS.guardado;
    expect(Math.max(...notas.map((n) => n.inicio + n.duracion))).toBeLessThanOrEqual(0.3);
    expect(Math.max(...notas.map((n) => n.volumen))).toBeLessThanOrEqual(0.25);
    expect(t('galeria.sonidos.guardado')).toBe('Partida guardada');
    expect(t('galeria.iconos.hecho')).toBe('Hecho');
  });
});

describe('«Continuar» y «Cargar partida» en el inicio (tarea f14-t4)', () => {
  const conDatos = () =>
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(texto, { status: 200 }))),
    );

  it('sin guardados, «Continuar» no sale y «Nueva partida» es el principal', async () => {
    conDatos();
    const inicio = crearPantallaInicio();
    await inicio.actualizarGuardados();
    const continuar = inicio.elemento.querySelector<HTMLButtonElement>('.inicio__continuar')!;
    expect(continuar.hidden).toBe(true);
    expect(
      inicio.elemento
        .querySelector('a[href="#nueva-partida"]')!
        .classList.contains('boton--principal'),
    ).toBe(true);
    expect(inicio.elemento.querySelector('.inicio__cargar')!.textContent).toContain(
      'Cargar partida',
    );
  });

  it('con guardados, «Continuar» dice cuál es la más reciente y la abre', async () => {
    conDatos();
    const almacen = almacenPartidas();
    const crear = (paisId: string, semilla: number) =>
      crearPartida(
        { paisId, dificultad: 'normal', eventosHistoricos: true, semilla },
        paises.paises,
      );
    const vieja = { ...crear('ITA', 3), fecha: '2010-07-01' };
    const nueva = { ...crear('JPN', 4), fecha: '2011-02-01', hora: 9 };
    await guardarPartida(almacen, vieja, { tipo: 'automatico' }, '0.15.0', new Date(1000));
    await guardarPartida(almacen, nueva, { tipo: 'manual', ranura: 2 }, '0.15.0', new Date(2000));
    const alCargarPartida = vi.fn();
    const inicio = crearPantallaInicio({ alCargarPartida });
    document.body.appendChild(inicio.elemento);
    await inicio.actualizarGuardados();
    const continuar = inicio.elemento.querySelector<HTMLButtonElement>('.inicio__continuar')!;
    expect(continuar.hidden).toBe(false);
    expect(continuar.textContent).toContain('Japón · 1 de febrero de 2011, 09:00');
    expect(
      inicio.elemento
        .querySelector('a[href="#nueva-partida"]')!
        .classList.contains('boton--principal'),
    ).toBe(false);
    continuar.click();
    await vi.waitFor(() => expect(alCargarPartida).toHaveBeenCalled());
    const [partida, ranura] = alCargarPartida.mock.calls[0]!;
    expect(ranura).toBe(2);
    expect(partida).toMatchObject({ id: nueva.id, fecha: '2011-02-01', hora: 9 });
    // El azar se vuelve a sembrar al cargar.
    expect(typeof partida.semilla).toBe('number');
  });

  it('«Cargar partida» abre la lista con los guardados y el botón de importar', async () => {
    conDatos();
    const almacen = almacenPartidas();
    const partida = crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 9 },
      paises.paises,
    );
    await guardarPartida(almacen, partida, { tipo: 'manual', ranura: 1 }, '0.15.0');
    const inicio = crearPantallaInicio();
    document.body.appendChild(inicio.elemento);
    inicio.elemento.querySelector<HTMLButtonElement>('.inicio__cargar')!.click();
    await vi.waitFor(() => expect(document.querySelector('.guardados__fila')).not.toBeNull());
    await esperar();
    expect(document.querySelector('.guardados__fila')!.textContent).toContain(
      'España · 1 de enero de 2010, 00:00',
    );
    expect(document.querySelector('.guardados__importar')).not.toBeNull();
  });
});
