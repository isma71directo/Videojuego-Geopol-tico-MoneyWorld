// @vitest-environment happy-dom
/** Exportar e importar la partida como archivo .json (tarea f14-t3). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { crearMotor } from '../src/sim/motor';
import { crearPartida, FORMATO_PARTIDA, type Partida } from '../src/sim/partida';
import {
  archivoDe,
  aTexto,
  deTexto,
  ErrorGuardado,
  JUEGO,
  nombreArchivo,
  TAMANO_MAXIMO_ARCHIVO,
} from '../src/sim/guardado';
import { descargarArchivo, leerArchivo } from '../src/ui/archivos-partida';
import { almacenEnMemoria } from '../src/ui/almacen-partidas';
import { cerrarVentanas } from '../src/ui/componentes/ventana';
import { abrirCargar } from '../src/ui/guardar-cargar';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;

/** Una partida jugada unos meses, con un efecto. */
function partidaJugada(): Partida {
  const motor = crearMotor();
  motor.atender({
    tipo: 'empezar',
    partida: crearPartida(
      { paisId: 'MEX', dificultad: 'realista', eventosHistoricos: false, semilla: 31 },
      paises.paises,
    ),
  });
  motor.atender({
    tipo: 'efecto',
    definicion: {
      nombre: 'Reforma',
      origen: 'ley',
      variable: { pais: 'MEX', campo: 'popularidad' },
      operacion: 'sumar',
      valor: 2,
      duracionDias: 300,
    },
  });
  motor.atender({ tipo: 'velocidad', velocidad: 64 });
  while (motor.partida!.fecha < '2010-05-03') motor.avanzar(250);
  return structuredClone(motor.partida!);
}

const motivoDe = (hacer: () => unknown): string => {
  try {
    hacer();
    return 'cargada';
  } catch (error) {
    return error instanceof ErrorGuardado ? error.motivo : 'otro';
  }
};

afterEach(() => {
  cerrarVentanas();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('el archivo .json de una partida (tarea f14-t3)', () => {
  it('exportar e importar no altera el estado', () => {
    const partida = partidaJugada();
    const archivo = archivoDe(partida, '0.15.0', new Date(Date.UTC(2026, 10, 17)));
    const importado = deTexto(aTexto(archivo));
    expect(importado.partida).toEqual(partida);
    expect(importado).toMatchObject({
      juego: JUEGO,
      formato: FORMATO_PARTIDA,
      version: '0.15.0',
      guardadoEn: '2026-11-17T00:00:00.000Z',
    });
  });

  it('se llama con el juego, el país y la fecha de la partida', () => {
    expect(nombreArchivo(partidaJugada())).toBe('geopolitica-2010-MEX-2010-05-03.json');
  });

  it('un archivo de una versión anterior se migra al importarlo', () => {
    const antigua: Record<string, unknown> = { ...partidaJugada(), formato: 1 };
    delete antigua.id;
    delete antigua.efectos;
    delete antigua.agenda;
    const texto = JSON.stringify({ juego: JUEGO, formato: 1, version: '0.13.0', partida: antigua });
    const importado = deTexto(texto);
    expect(importado.partida.formato).toBe(FORMATO_PARTIDA);
    expect(importado.partida.efectos).toEqual([]);
    expect(importado.partida.id).toBe('pv');
  });

  it('lo que no es una partida de este juego no se importa', () => {
    expect(motivoDe(() => deTexto('esto no es JSON'))).toBe('noEsPartida');
    expect(motivoDe(() => deTexto('[1, 2, 3]'))).toBe('noEsPartida');
    expect(motivoDe(() => deTexto('{"juego":"otro","partida":{}}'))).toBe('noEsPartida');
    expect(motivoDe(() => deTexto(' '.repeat(TAMANO_MAXIMO_ARCHIVO + 1)))).toBe('noEsPartida');
    const archivo = archivoDe(partidaJugada(), '0.15.0', new Date());
    const danado = { ...archivo, partida: { ...archivo.partida, jugador: null } };
    expect(motivoDe(() => deTexto(JSON.stringify(danado)))).toBe('danado');
  });
});

describe('descargar y leer el archivo (tarea f14-t3)', () => {
  it('descarga un .json con su nombre', async () => {
    const crear = vi.fn<(blob: Blob) => string>(() => 'blob:partida');
    URL.createObjectURL = crear as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const pulsado = vi.fn<(enlace: HTMLAnchorElement) => void>();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      pulsado(this);
    });
    const partida = partidaJugada();
    const nombre = descargarArchivo(archivoDe(partida, '0.15.0', new Date()));
    expect(nombre).toBe('geopolitica-2010-MEX-2010-05-03.json');
    const enlace = pulsado.mock.calls[0]![0];
    expect(enlace.download).toBe(nombre);
    expect(enlace.href).toBe('blob:partida');
    // El enlace no se queda en la página.
    expect(enlace.isConnected).toBe(false);
    const blob = crear.mock.calls[0]![0];
    expect(blob.type).toBe('application/json');
    // Lo descargado se vuelve a leer igual.
    expect((await leerArchivo(blob)).partida).toEqual(partida);
  });

  it('un archivo demasiado grande no se lee', async () => {
    const grande = { size: TAMANO_MAXIMO_ARCHIVO + 1, text: () => Promise.resolve('') } as Blob;
    await expect(leerArchivo(grande)).rejects.toMatchObject({ motivo: 'noEsPartida' });
  });

  it('«Cargar partida» tiene «Importar un archivo…»', async () => {
    const alImportar = vi.fn();
    const ventana = await abrirCargar({
      almacen: almacenEnMemoria(),
      nombreDe: (id) => id,
      alElegir: () => undefined,
      alImportar,
    });
    const boton = ventana.cuerpo.querySelector<HTMLButtonElement>('.guardados__importar')!;
    expect(boton.textContent!.trim()).toBe('Importar un archivo…');
    boton.click();
    expect(alImportar).toHaveBeenCalledOnce();
    expect(ventana.abierta).toBe(false);
    // Sin quien importe, no hay botón.
    const otra = await abrirCargar({
      almacen: almacenEnMemoria(),
      nombreDe: (id) => id,
      alElegir: () => undefined,
    });
    expect(otra.cuerpo.querySelector('.guardados__importar')).toBeNull();
  });
});
