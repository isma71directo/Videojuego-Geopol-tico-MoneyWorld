/**
 * Almacén de partidas en IndexedDB (tarea f14-t1): guarda, lista, lee y borra guardados. Qué se
 * guarda y cómo se migra está en el motor (src/sim/guardado.ts); aquí solo se escribe y se lee.
 *
 * - Dos almacenes en la misma base: los resúmenes (ligeros, para la pantalla de cargar) y los
 *   archivos (la partida entera). Se escriben juntos en una sola transacción.
 * - Al guardar un automático mensual, se borran los que sobran (se conservan los tres últimos).
 * - Se pide al navegador que no borre los datos por falta de espacio («la partida no se pierde
 *   nunca»), la primera vez que el jugador guarda a mano y no al abrir el juego, porque Firefox
 *   lo pregunta con un aviso (ajuste f14-a2); si no deja, se sigue igual.
 * - Si el navegador no tiene IndexedDB, se guarda en memoria mientras dure la página.
 */
import {
  automaticosQueSobran,
  desempaquetar,
  empaquetar,
  type ArchivoPartida,
  type DestinoGuardado,
  type ResumenGuardado,
} from '../sim/guardado';
import type { Partida } from '../sim/partida';

export const NOMBRE_BASE = 'geopolitica-2010-partidas';
const VERSION_BASE = 1;
const RESUMENES = 'resumenes';
const ARCHIVOS = 'archivos';

/** Lo que se guarda en el almacén de archivos. */
interface Registro {
  id: string;
  archivo: ArchivoPartida;
}

export interface AlmacenPartidas {
  /** ¿Se guarda de verdad (IndexedDB) o solo mientras dure la página? */
  readonly persistente: boolean;
  listar(): Promise<ResumenGuardado[]>;
  /** Escribe un guardado (si ya existe, lo sustituye). */
  escribir(resumen: ResumenGuardado, archivo: ArchivoPartida): Promise<void>;
  /** El archivo tal y como se guardó, o null si no existe. */
  leer(id: string): Promise<unknown>;
  borrar(id: string): Promise<void>;
}

/** Convierte una petición de IndexedDB en una promesa. */
function peticion<T>(p: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rechazar) => {
    p.onsuccess = () => resolver(p.result);
    p.onerror = () => rechazar(p.error ?? new Error('Error de IndexedDB'));
  });
}

/** Espera a que una transacción termine (o falle). */
function terminada(transaccion: IDBTransaction): Promise<void> {
  return new Promise((resolver, rechazar) => {
    transaccion.oncomplete = () => resolver();
    transaccion.onerror = () => rechazar(transaccion.error ?? new Error('Error de IndexedDB'));
    transaccion.onabort = () => rechazar(transaccion.error ?? new Error('Guardado cancelado'));
  });
}

function abrirBase(fabrica: IDBFactory, nombre: string): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const apertura = fabrica.open(nombre, VERSION_BASE);
    apertura.onupgradeneeded = () => {
      const base = apertura.result;
      if (!base.objectStoreNames.contains(RESUMENES)) {
        base.createObjectStore(RESUMENES, { keyPath: 'id' });
      }
      if (!base.objectStoreNames.contains(ARCHIVOS)) {
        base.createObjectStore(ARCHIVOS, { keyPath: 'id' });
      }
    };
    apertura.onsuccess = () => resolver(apertura.result);
    apertura.onerror = () => rechazar(apertura.error ?? new Error('No se abre IndexedDB'));
    apertura.onblocked = () => rechazar(new Error('IndexedDB bloqueada por otra pestaña'));
  });
}

/** Almacén en IndexedDB. */
export function almacenIndexedDB(
  fabrica: IDBFactory = indexedDB,
  nombre: string = NOMBRE_BASE,
): AlmacenPartidas {
  let base: Promise<IDBDatabase> | null = null;
  const abrir = (): Promise<IDBDatabase> => {
    base ??= abrirBase(fabrica, nombre).catch((error: unknown) => {
      base = null;
      throw error;
    });
    return base;
  };
  return {
    persistente: true,
    async listar() {
      const db = await abrir();
      const transaccion = db.transaction(RESUMENES, 'readonly');
      return (await peticion(transaccion.objectStore(RESUMENES).getAll())) as ResumenGuardado[];
    },
    async escribir(resumen, archivo) {
      const db = await abrir();
      const transaccion = db.transaction([RESUMENES, ARCHIVOS], 'readwrite');
      transaccion.objectStore(ARCHIVOS).put({ id: resumen.id, archivo } satisfies Registro);
      transaccion.objectStore(RESUMENES).put(resumen);
      await terminada(transaccion);
    },
    async leer(id) {
      const db = await abrir();
      const transaccion = db.transaction(ARCHIVOS, 'readonly');
      const registro = (await peticion(transaccion.objectStore(ARCHIVOS).get(id))) as
        Registro | undefined;
      return registro?.archivo ?? null;
    },
    async borrar(id) {
      const db = await abrir();
      const transaccion = db.transaction([RESUMENES, ARCHIVOS], 'readwrite');
      transaccion.objectStore(ARCHIVOS).delete(id);
      transaccion.objectStore(RESUMENES).delete(id);
      await terminada(transaccion);
    },
  };
}

/** Almacén en memoria: para los tests y si el navegador no tiene IndexedDB. */
export function almacenEnMemoria(): AlmacenPartidas {
  const datos = new Map<string, { resumen: ResumenGuardado; archivo: ArchivoPartida }>();
  return {
    persistente: false,
    listar: () => Promise.resolve([...datos.values()].map((d) => structuredClone(d.resumen))),
    escribir(resumen, archivo) {
      datos.set(resumen.id, structuredClone({ resumen, archivo }));
      return Promise.resolve();
    },
    leer: (id) => Promise.resolve(structuredClone(datos.get(id)?.archivo ?? null)),
    borrar(id) {
      datos.delete(id);
      return Promise.resolve();
    },
  };
}

let almacenDelJuego: AlmacenPartidas | null = null;

/** El almacén del juego: IndexedDB si el navegador lo tiene; si no, en memoria. */
export function almacenPartidas(): AlmacenPartidas {
  if (!almacenDelJuego) {
    almacenDelJuego =
      typeof indexedDB === 'undefined' ? almacenEnMemoria() : almacenIndexedDB(indexedDB);
  }
  return almacenDelJuego;
}

/** ¿Ya se ha pedido en esta visita que no se borren las partidas? */
let persistenciaPedida = false;

/**
 * Pide al navegador que no borre las partidas cuando le falte espacio (si deja), una sola vez por
 * visita: al guardar a mano, que es una acción del jugador (ajuste f14-a2).
 */
function pedirQueNoSeBorre(): void {
  if (persistenciaPedida) return;
  persistenciaPedida = true;
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // Sin la API de almacenamiento: los datos siguen guardados igual.
  }
}

/**
 * Guarda la partida en una ranura o como automático. Tras un automático mensual borra los que
 * sobran. Devuelve el resumen de lo guardado.
 */
export async function guardarPartida(
  almacen: AlmacenPartidas,
  partida: Partida,
  destino: DestinoGuardado,
  version: string,
  ahora: Date = new Date(),
): Promise<ResumenGuardado> {
  if (destino.tipo === 'manual' && destino.nombre === undefined) {
    // Sin nombre nuevo (Ctrl+S): la ranura conserva el suyo si es de esta misma partida.
    const { ranura } = destino;
    const anterior = (await almacen.listar()).find(
      (r) => r.tipo === 'manual' && r.ranura === ranura,
    );
    if (anterior?.nombre && anterior.partidaId === partida.id) {
      destino = { ...destino, nombre: anterior.nombre };
    }
  }
  const { resumen, archivo } = empaquetar(partida, destino, version, ahora);
  await almacen.escribir(resumen, archivo);
  if (destino.tipo === 'manual' && almacen.persistente) pedirQueNoSeBorre();
  if (destino.tipo === 'automatico') {
    for (const id of automaticosQueSobran(await almacen.listar())) await almacen.borrar(id);
  }
  return resumen;
}

/**
 * Lee un guardado, lo migra y lo comprueba (lanza ErrorGuardado si está dañado o es de un formato
 * más nuevo); null si no existe.
 */
export async function cargarPartida(
  almacen: AlmacenPartidas,
  id: string,
): Promise<ArchivoPartida | null> {
  const datos = await almacen.leer(id);
  return datos === null || datos === undefined ? null : desempaquetar(datos);
}
