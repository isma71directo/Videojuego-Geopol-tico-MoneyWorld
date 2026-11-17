// @vitest-environment happy-dom
/** Nombre de los guardados manuales (ajuste f14-a1, petición del jugador). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { crearPartida, type Partida } from '../src/sim/partida';
import { empaquetar, limpiarNombre, LONGITUD_NOMBRE } from '../src/sim/guardado';
import { almacenEnMemoria, almacenPartidas, guardarPartida } from '../src/ui/almacen-partidas';
import { cerrarVentanas } from '../src/ui/componentes/ventana';
import { abrirGuardar, etiquetaGuardado } from '../src/ui/guardar-cargar';
import { crearPantallaInicio } from '../src/ui/inicio';

const texto = readFileSync(resolve('public/data/paises-2010.json'), 'utf8');
const paises = JSON.parse(texto) as ConjuntoPaises;
const partidaDe = (paisId: string, semilla: number): Partida =>
  crearPartida({ paisId, dificultad: 'normal', eventosHistoricos: true, semilla }, paises.paises);
const nombreDe = (id: string): string => paises.paises[id]?.nombre ?? id;
const esperar = () => new Promise((r) => setTimeout(r, 0));

afterEach(async () => {
  vi.unstubAllGlobals();
  cerrarVentanas();
  document.body.replaceChildren();
  const almacen = almacenPartidas();
  for (const r of await almacen.listar()) await almacen.borrar(r.id);
});

describe('el nombre de un guardado manual (ajuste f14-a1)', () => {
  it('se limpia: sin espacios de más ni caracteres raros, y con un largo máximo', () => {
    expect(limpiarNombre('  Antes   de las\telecciones  ')).toBe('Antes de las elecciones');
    expect(limpiarNombre('   ')).toBeUndefined();
    expect(limpiarNombre(undefined)).toBeUndefined();
    expect(limpiarNombre('a\u0000b')).toBe('a b');
    expect(LONGITUD_NOMBRE).toBe(60);
    expect([...limpiarNombre('ñ'.repeat(100))!]).toHaveLength(60);
  });

  it('va en el resumen de los manuales, no en los automáticos', () => {
    const partida = partidaDe('ESP', 1);
    const manual = empaquetar(
      partida,
      { tipo: 'manual', ranura: 1, nombre: ' Plan A ' },
      '0.15.1',
      new Date(),
    );
    expect(manual.resumen.nombre).toBe('Plan A');
    const sinNombre = empaquetar(
      partida,
      { tipo: 'manual', ranura: 1, nombre: '' },
      '0.15.1',
      new Date(),
    );
    expect('nombre' in sinNombre.resumen).toBe(false);
    const auto = empaquetar(partida, { tipo: 'automatico' }, '0.15.1', new Date());
    expect(auto.resumen.nombre).toBeUndefined();
  });

  it('Ctrl+S conserva el nombre de la ranura de esta partida; de otra partida, no', async () => {
    const almacen = almacenEnMemoria();
    const espana = partidaDe('ESP', 1);
    await guardarPartida(
      almacen,
      espana,
      { tipo: 'manual', ranura: 2, nombre: 'Plan A' },
      '0.15.1',
    );
    // Ctrl+S: sin nombre nuevo.
    const otraVez = await guardarPartida(almacen, espana, { tipo: 'manual', ranura: 2 }, '0.15.1');
    expect(otraVez.nombre).toBe('Plan A');
    // Otra partida en la misma ranura no hereda el nombre.
    const francia = await guardarPartida(
      almacen,
      partidaDe('FRA', 2),
      { tipo: 'manual', ranura: 2 },
      '0.15.1',
    );
    expect(francia.nombre).toBeUndefined();
    // Dejar el nombre vacío lo quita.
    await guardarPartida(
      almacen,
      espana,
      { tipo: 'manual', ranura: 3, nombre: 'Plan B' },
      '0.15.1',
    );
    const vacio = await guardarPartida(
      almacen,
      espana,
      { tipo: 'manual', ranura: 3, nombre: '' },
      '0.15.1',
    );
    expect(vacio.nombre).toBeUndefined();
  });

  it('se ve en la etiqueta de la ranura', () => {
    const base = { tipo: 'manual', ranura: 4, fecha: '2011-01-01' } as const;
    expect(etiquetaGuardado({ ...base, nombre: 'Plan A' })).toBe('Ranura 4 · Plan A');
    expect(etiquetaGuardado(base)).toBe('Ranura 4');
  });
});

describe('ventana «Guardar partida» con nombre (ajuste f14-a1)', () => {
  it('empieza con el nombre de la ranura de esta partida y lo pasa al elegir', async () => {
    const almacen = almacenEnMemoria();
    const espana = partidaDe('ESP', 1);
    await guardarPartida(
      almacen,
      espana,
      { tipo: 'manual', ranura: 2, nombre: 'Plan A' },
      '0.15.1',
    );
    const alElegir = vi.fn();
    const ventana = await abrirGuardar({
      almacen,
      nombreDe,
      alElegir,
      partidaId: espana.id,
      ranuraActual: 2,
    });
    const campo = ventana.cuerpo.querySelector<HTMLInputElement>('.guardados__campo')!;
    expect(campo.value).toBe('Plan A');
    expect(campo.maxLength).toBe(60);
    expect(document.activeElement).toBe(campo);
    expect(ventana.cuerpo.textContent).toContain('Ranura 2 · Plan A');
    campo.value = 'Plan C';
    ventana.cuerpo.querySelectorAll<HTMLButtonElement>('.guardados__fila')[3]!.click();
    await esperar();
    expect(alElegir).toHaveBeenCalledWith(4, 'Plan C');
  });

  it('para otra partida, el campo empieza vacío', async () => {
    const almacen = almacenEnMemoria();
    await guardarPartida(
      almacen,
      partidaDe('ESP', 1),
      { tipo: 'manual', ranura: 2, nombre: 'Plan A' },
      '0.15.1',
    );
    const ventana = await abrirGuardar({
      almacen,
      nombreDe,
      alElegir: () => undefined,
      partidaId: partidaDe('FRA', 2).id,
      ranuraActual: 2,
    });
    expect(ventana.cuerpo.querySelector<HTMLInputElement>('.guardados__campo')!.value).toBe('');
  });

  it('«Continuar» en el inicio dice también el nombre', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(texto, { status: 200 }))),
    );
    await guardarPartida(
      almacenPartidas(),
      partidaDe('ITA', 5),
      { tipo: 'manual', ranura: 1, nombre: 'Antes de las elecciones' },
      '0.15.1',
    );
    const inicio = crearPantallaInicio();
    await inicio.actualizarGuardados();
    expect(inicio.elemento.querySelector('.inicio__continuar')!.textContent).toContain(
      'Antes de las elecciones · Italia · 1 de enero de 2010, 00:00',
    );
  });
});
