/** Guardar y cargar partidas: motor y almacén en IndexedDB (tarea f14-t1). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { crearMotor } from '../src/sim/motor';
import { crearPartida, FORMATO_PARTIDA, type Partida } from '../src/sim/partida';
import {
  automaticosQueSobran,
  desempaquetar,
  empaquetar,
  ErrorGuardado,
  idDeGuardado,
  JUEGO,
  masReciente,
  migrar,
  ordenarResumenes,
  paraSeguir,
  RANURAS_MANUALES,
  type ResumenGuardado,
} from '../src/sim/guardado';
import {
  almacenEnMemoria,
  almacenIndexedDB,
  almacenPartidas,
  cargarPartida,
  guardarPartida,
  type AlmacenPartidas,
} from '../src/ui/almacen-partidas';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;

const nuevaPartida = (semilla = 12345): Partida =>
  crearPartida(
    { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla },
    paises.paises,
  );

/** Una partida jugada: unos meses a ×64, con un efecto y un suceso pendiente. */
function partidaJugada(): Partida {
  const motor = crearMotor();
  motor.atender({ tipo: 'empezar', partida: nuevaPartida(), pausaAutomatica: false });
  motor.atender({
    tipo: 'efecto',
    definicion: {
      nombre: 'Subida del IVA',
      origen: 'ley',
      variable: { pais: 'ESP', campo: 'tesoreria' },
      operacion: 'sumar',
      valor: 5e9,
      duracionDias: 400,
    },
  });
  motor.atender({
    tipo: 'programar',
    suceso: {
      titulo: 'Elecciones generales',
      texto: 'Se celebran elecciones.',
      fecha: '2011-11-20',
      hora: 20,
      importante: true,
      origen: 'politica',
    },
  });
  motor.atender({ tipo: 'velocidad', velocidad: 64 });
  while (motor.partida!.fecha < '2010-04-15') motor.avanzar(250);
  return structuredClone(motor.partida!);
}

const VERSION = '0.15.0';

/** Una partida como las de la v0.11 a la v0.13 (formato 1): sin efectos, agenda ni identificador. */
function comoFormato1(partida: Partida): Record<string, unknown> {
  const antigua: Record<string, unknown> = { ...partida, formato: 1 };
  delete antigua.id;
  delete antigua.efectos;
  delete antigua.agenda;
  return antigua;
}
const momento = (minutos: number) => new Date(Date.UTC(2026, 10, 17, 9, minutos));

describe('qué se guarda (tarea f14-t1)', () => {
  it('guardar y cargar no altera el estado (prueba del GDD)', () => {
    const partida = partidaJugada();
    expect(partida.efectos).toHaveLength(1);
    expect(partida.agenda).toHaveLength(1);
    const { archivo, resumen } = empaquetar(
      partida,
      { tipo: 'manual', ranura: 2 },
      VERSION,
      momento(0),
    );
    // Pasa por JSON, como en un archivo exportado.
    const cargado = desempaquetar(JSON.parse(JSON.stringify(archivo)));
    expect(cargado.partida).toEqual(partida);
    expect(resumen).toEqual<ResumenGuardado>({
      id: 'ranura-2',
      tipo: 'manual',
      ranura: 2,
      partidaId: partida.id,
      paisId: 'ESP',
      fecha: partida.fecha,
      hora: partida.hora,
      guardadoEn: '2026-11-17T09:00:00.000Z',
      version: VERSION,
      formato: FORMATO_PARTIDA,
    });
    expect(archivo).toMatchObject({ juego: JUEGO, formato: FORMATO_PARTIDA, version: VERSION });
  });

  it('lo guardado es una copia: la partida puede seguir sin cambiarlo', () => {
    const partida = nuevaPartida();
    const { archivo } = empaquetar(partida, { tipo: 'automatico' }, VERSION, momento(0));
    partida.fecha = '2012-05-05';
    partida.paises.ESP!.popularidad = 1;
    expect(archivo.partida.fecha).toBe('2010-01-01');
    expect(archivo.partida.paises.ESP!.popularidad).not.toBe(1);
  });

  it('cinco ranuras, un automático por mes y uno por año de cada partida', () => {
    const partida = { ...nuevaPartida(), fecha: '2011-03-01' };
    expect(RANURAS_MANUALES).toBe(5);
    expect(idDeGuardado({ tipo: 'manual', ranura: 5 }, partida)).toBe('ranura-5');
    expect(() => idDeGuardado({ tipo: 'manual', ranura: 6 }, partida)).toThrow();
    expect(() => idDeGuardado({ tipo: 'manual', ranura: 0 }, partida)).toThrow();
    expect(idDeGuardado({ tipo: 'automatico' }, partida)).toBe(`auto-${partida.id}-2011-03`);
    expect(idDeGuardado({ tipo: 'anual' }, partida)).toBe(`anual-${partida.id}-2011`);
    // Cada partida tiene su identificador.
    expect(nuevaPartida(1).id).not.toBe(nuevaPartida(2).id);
  });

  it('al seguir, el azar se vuelve a sembrar pero la partida es la misma', () => {
    const { archivo } = empaquetar(partidaJugada(), { tipo: 'anual' }, VERSION, momento(0));
    const partida = paraSeguir(archivo, 999);
    expect(partida.semilla).toBe(999);
    expect({ ...partida, semilla: archivo.partida.semilla }).toEqual(archivo.partida);
    expect(partida.id).toBe(archivo.partida.id);
  });
});

describe('cargar partidas de otras versiones o dañadas (tarea f14-t1)', () => {
  const partidaFormato1 = (): Record<string, unknown> => comoFormato1(nuevaPartida(77));

  it('una partida de una versión anterior se migra (prueba del GDD)', () => {
    const archivo = {
      juego: JUEGO,
      formato: 1,
      version: '0.13.0',
      guardadoEn: '',
      partida: partidaFormato1(),
    };
    const cargado = desempaquetar(archivo);
    expect(cargado.formato).toBe(FORMATO_PARTIDA);
    expect(cargado.partida).toEqual({ ...nuevaPartida(77) });
    expect(cargado.version).toBe('0.13.0');
  });

  it('cada formato anterior tiene su migración hasta el actual', () => {
    expect(migrar(partidaFormato1()).formato).toBe(FORMATO_PARTIDA);
    expect(migrar({ ...nuevaPartida() })).toEqual(nuevaPartida());
  });

  it('lo que no es una partida, la de un formato más nuevo o la dañada no se cargan', () => {
    const motivo = (datos: unknown): string => {
      try {
        desempaquetar(datos);
        return 'cargada';
      } catch (error) {
        return error instanceof ErrorGuardado ? error.motivo : 'otro';
      }
    };
    const bueno = empaquetar(nuevaPartida(), { tipo: 'anual' }, VERSION, momento(0)).archivo;
    expect(motivo(bueno)).toBe('cargada');
    expect(motivo(null)).toBe('noEsPartida');
    expect(motivo({ hola: 1 })).toBe('noEsPartida');
    expect(motivo({ ...bueno, juego: 'otro-juego' })).toBe('noEsPartida');
    expect(motivo({ ...bueno, partida: { ...bueno.partida, formato: FORMATO_PARTIDA + 1 } })).toBe(
      'formatoFuturo',
    );
    expect(motivo({ ...bueno, partida: { ...bueno.partida, formato: 'x' } })).toBe('danado');
    expect(motivo({ ...bueno, partida: { ...bueno.partida, fecha: 'ayer' } })).toBe('danado');
    expect(motivo({ ...bueno, partida: { ...bueno.partida, hora: 24 } })).toBe('danado');
    expect(motivo({ ...bueno, partida: { ...bueno.partida, paises: {} } })).toBe('danado');
    expect(motivo({ ...bueno, partida: { ...bueno.partida, efectos: 'no' } })).toBe('danado');
  });
});

describe('guardados automáticos y orden (tarea f14-t1)', () => {
  const resumen = (
    id: string,
    tipo: ResumenGuardado['tipo'],
    minuto: number,
    ranura: number | null = null,
  ) => ({ id, tipo, ranura, guardadoEn: momento(minuto).toISOString() }) as ResumenGuardado;

  it('se conservan los tres automáticos más recientes; los manuales y anuales no se tocan', () => {
    const resumenes = [
      resumen('auto-a', 'automatico', 1),
      resumen('auto-b', 'automatico', 5),
      resumen('ranura-1', 'manual', 0, 1),
      resumen('auto-c', 'automatico', 3),
      resumen('anual-2010', 'anual', 2),
      resumen('auto-d', 'automatico', 4),
      resumen('auto-e', 'automatico', 2),
    ];
    expect(automaticosQueSobran(resumenes).sort()).toEqual(['auto-a', 'auto-e']);
    expect(masReciente(resumenes)!.id).toBe('auto-b');
    expect(masReciente([])).toBeNull();
    expect(ordenarResumenes(resumenes).map((r) => r.id)).toEqual([
      'ranura-1',
      'auto-b',
      'auto-d',
      'auto-c',
      'auto-e',
      'auto-a',
      'anual-2010',
    ]);
  });
});

/** Juega un año y medio guardando como lo hará la partida: cada mes y cada 1 de enero. */
async function unAnoYMedio(almacen: AlmacenPartidas): Promise<void> {
  const partida = nuevaPartida();
  let minuto = 0;
  for (let mes = 0; mes < 18; mes++) {
    const ano = 2010 + Math.floor(mes / 12);
    partida.fecha = `${ano}-${String((mes % 12) + 1).padStart(2, '0')}-01`;
    await guardarPartida(almacen, partida, { tipo: 'automatico' }, VERSION, momento(minuto++));
    if (mes % 12 === 0) {
      await guardarPartida(almacen, partida, { tipo: 'anual' }, VERSION, momento(minuto++));
    }
  }
  await guardarPartida(almacen, partida, { tipo: 'manual', ranura: 1 }, VERSION, momento(minuto));
}

describe('almacén de partidas (tarea f14-t1)', () => {
  for (const [nombre, crear] of [
    ['IndexedDB', () => almacenIndexedDB(new IDBFactory())],
    ['en memoria', () => almacenEnMemoria()],
  ] as const) {
    it(`${nombre}: los tres últimos automáticos, uno por año y las ranuras`, async () => {
      const almacen = crear();
      await unAnoYMedio(almacen);
      const ids = (await almacen.listar()).map((r) => r.id).sort();
      const id = nuevaPartida().id;
      expect(ids).toEqual(
        [
          `anual-${id}-2010`,
          `anual-${id}-2011`,
          `auto-${id}-2011-04`,
          `auto-${id}-2011-05`,
          `auto-${id}-2011-06`,
          'ranura-1',
        ].sort(),
      );
      // Guardar otra vez en la misma ranura la sustituye.
      const otra = { ...nuevaPartida(), fecha: '2015-02-02' };
      await guardarPartida(almacen, otra, { tipo: 'manual', ranura: 1 }, VERSION, momento(99));
      expect((await almacen.listar()).filter((r) => r.tipo === 'manual')).toHaveLength(1);
      expect((await cargarPartida(almacen, 'ranura-1'))!.partida.fecha).toBe('2015-02-02');
      await almacen.borrar('ranura-1');
      expect(await cargarPartida(almacen, 'ranura-1')).toBeNull();
      expect((await almacen.listar()).some((r) => r.id === 'ranura-1')).toBe(false);
    });
  }

  it('IndexedDB: la partida sigue ahí al cerrar el navegador y volver (prueba del GDD)', async () => {
    const fabrica = new IDBFactory();
    const partida = partidaJugada();
    await guardarPartida(
      almacenIndexedDB(fabrica),
      partida,
      { tipo: 'manual', ranura: 3 },
      VERSION,
    );
    // Otro almacén sobre la misma base, como al volver a abrir el juego.
    const despues = almacenIndexedDB(fabrica);
    expect((await despues.listar()).map((r) => r.id)).toEqual(['ranura-3']);
    expect((await cargarPartida(despues, 'ranura-3'))!.partida).toEqual(partida);
  });

  it('IndexedDB: un guardado de un formato anterior se migra al cargarlo', async () => {
    const almacen = almacenIndexedDB(new IDBFactory());
    const { resumen, archivo } = empaquetar(
      nuevaPartida(5),
      { tipo: 'manual', ranura: 4 },
      '0.13.0',
      momento(0),
    );
    await almacen.escribir(resumen, {
      ...archivo,
      formato: 1,
      partida: comoFormato1(archivo.partida) as unknown as Partida,
    });
    expect((await cargarPartida(almacen, 'ranura-4'))!.partida).toEqual(nuevaPartida(5));
  });

  it('sin IndexedDB (aquí, en Node), el juego guarda en memoria', () => {
    expect(almacenPartidas().persistente).toBe(typeof indexedDB !== 'undefined');
  });
});
