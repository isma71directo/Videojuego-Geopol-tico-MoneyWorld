/**
 * Guardar y cargar partidas (tarea f14-t1, GDD sección 9, Fase 14). Motor puro, sin interfaz ni
 * almacenamiento: qué se guarda, cómo se comprueba al cargar, cómo se migra una partida de un
 * formato anterior y qué guardados automáticos sobran. Donde se guarda (IndexedDB) está en
 * src/ui/almacen-partidas.ts.
 *
 * Decisiones del jugador (17/11/2026): cinco ranuras manuales; guardado automático al empezar
 * cada mes, del que se conservan los tres más recientes, y además el del 1 de enero de cada año.
 */
import config from './config/guardado.json';
import { FORMATO_PARTIDA, idDePartida, type Partida } from './partida';

/** Lo que marca un archivo de partida de este juego. */
export const JUEGO = 'geopolitica-2010';
export const RANURAS_MANUALES: number = config.ranurasManuales;
export const AUTOMATICOS_MENSUALES: number = config.automaticosMensuales;
/** Largo máximo del nombre de un guardado manual (ajuste f14-a1). */
export const LONGITUD_NOMBRE: number = config.longitudNombre;

export type TipoGuardado = 'manual' | 'automatico' | 'anual';

/** Un guardado tal y como se escribe (en IndexedDB y en el archivo .json de la tarea f14-t3). */
export interface ArchivoPartida {
  juego: typeof JUEGO;
  /** Formato de la partida (para migrarla al cargar). */
  formato: number;
  /** Versión del juego que la guardó. */
  version: string;
  /** Cuándo se guardó, en tiempo real (ISO). */
  guardadoEn: string;
  partida: Partida;
}

/** Lo que se enseña de un guardado sin leer la partida entera (pantalla de cargar). */
export interface ResumenGuardado {
  id: string;
  tipo: TipoGuardado;
  /** Ranura de 1 a 5 de un guardado manual; null en los automáticos. */
  ranura: number | null;
  partidaId: string;
  paisId: string;
  /** Fecha y hora de la partida. */
  fecha: string;
  hora: number;
  guardadoEn: string;
  version: string;
  formato: number;
  /** Nombre que le ha puesto el jugador (solo los manuales y si quiere; ajuste f14-a1). */
  nombre?: string;
}

/**
 * Destino de un guardado: una ranura manual (con su nombre, si lo tiene) o uno automático. Sin
 * `nombre`, la ranura conserva el que tenía si es de la misma partida (lo hace el almacén).
 */
export type DestinoGuardado =
  { tipo: 'manual'; ranura: number; nombre?: string } | { tipo: 'automatico' } | { tipo: 'anual' };

/**
 * El nombre tal y como se guarda: sin espacios de más ni caracteres de control, y como mucho
 * LONGITUD_NOMBRE caracteres; vacío, sin nombre (undefined).
 */
export function limpiarNombre(texto: string | undefined): string | undefined {
  if (texto === undefined) return undefined;
  // Los caracteres de control (saltos de línea, tabuladores…) cuentan como un espacio.
  const sinControl = [...texto]
    .map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c))
    .join('');
  const limpio = sinControl.replace(/\s+/g, ' ').trim();
  return limpio === '' ? undefined : [...limpio].slice(0, LONGITUD_NOMBRE).join('').trim();
}

/** Por qué no se puede cargar un guardado. */
export type MotivoError = 'noEsPartida' | 'formatoFuturo' | 'danado';

export class ErrorGuardado extends Error {
  constructor(
    readonly motivo: MotivoError,
    detalle: string,
  ) {
    super(detalle);
    this.name = 'ErrorGuardado';
  }
}

/** Identificador del guardado: cada ranura, cada mes de cada partida y cada año de cada partida. */
export function idDeGuardado(destino: DestinoGuardado, partida: Partida): string {
  switch (destino.tipo) {
    case 'manual':
      if (
        !Number.isInteger(destino.ranura) ||
        destino.ranura < 1 ||
        destino.ranura > RANURAS_MANUALES
      ) {
        throw new Error(`Ranura no válida: ${destino.ranura}`);
      }
      return `ranura-${destino.ranura}`;
    case 'automatico':
      return `auto-${partida.id}-${partida.fecha.slice(0, 7)}`;
    case 'anual':
      return `anual-${partida.id}-${partida.fecha.slice(0, 4)}`;
  }
}

/** El archivo de una partida, con una copia de ella (lo guardado no cambia aunque siga). */
export function archivoDe(partida: Partida, version: string, ahora: Date): ArchivoPartida {
  return {
    juego: JUEGO,
    formato: partida.formato,
    version,
    guardadoEn: ahora.toISOString(),
    partida: structuredClone(partida),
  };
}

/** Prepara un guardado: el archivo (con una copia de la partida) y su resumen. */
export function empaquetar(
  partida: Partida,
  destino: DestinoGuardado,
  version: string,
  ahora: Date,
): { resumen: ResumenGuardado; archivo: ArchivoPartida } {
  const archivo = archivoDe(partida, version, ahora);
  const { guardadoEn } = archivo;
  const nombre = destino.tipo === 'manual' ? limpiarNombre(destino.nombre) : undefined;
  return {
    archivo,
    resumen: {
      id: idDeGuardado(destino, partida),
      tipo: destino.tipo,
      ranura: destino.tipo === 'manual' ? destino.ranura : null,
      partidaId: partida.id,
      paisId: partida.jugador.paisId,
      fecha: partida.fecha,
      hora: partida.hora,
      guardadoEn,
      version,
      formato: partida.formato,
      ...(nombre ? { nombre } : {}),
    },
  };
}

type Datos = Record<string, unknown>;
const esObjeto = (valor: unknown): valor is Datos =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/**
 * Migraciones: cada una lleva una partida del formato N al N + 1. Cuando cambie el formato de la
 * partida, se sube FORMATO_PARTIDA y se añade aquí su migración (con su test).
 */
export const MIGRACIONES: Record<number, (partida: Datos) => Datos> = {
  // 1 → 2 (v0.14.0 y Fase 14): llegan los efectos, la agenda de sucesos y el identificador.
  1: (partida) => ({
    ...partida,
    formato: 2,
    id: typeof partida.id === 'string' ? partida.id : idDePartida(Number(partida.semilla) || 1),
    efectos: Array.isArray(partida.efectos) ? partida.efectos : [],
    agenda: Array.isArray(partida.agenda) ? partida.agenda : [],
  }),
  // 2 → 3 (Fase 15): llega la economía de cada país. Se crea al cargar, con los datos de 2010
  // (completarEconomia), porque la migración no tiene los datos de los países.
  2: (partida) => ({ ...partida, formato: 3 }),
};

/** Lleva una partida de cualquier formato anterior al actual. */
export function migrar(partida: Datos): Datos {
  let actual = partida;
  let formato = Number(actual.formato);
  if (!Number.isInteger(formato) || formato < 1) {
    throw new ErrorGuardado('danado', `Formato no válido: ${String(actual.formato)}`);
  }
  if (formato > FORMATO_PARTIDA) {
    throw new ErrorGuardado(
      'formatoFuturo',
      `La partida es de un formato más nuevo (${formato}) que el del juego (${FORMATO_PARTIDA})`,
    );
  }
  while (formato < FORMATO_PARTIDA) {
    const migracion = MIGRACIONES[formato];
    if (!migracion) throw new ErrorGuardado('danado', `Falta la migración del formato ${formato}`);
    actual = migracion(actual);
    formato = Number(actual.formato);
  }
  return actual;
}

/** Comprueba lo básico de una partida ya migrada; si algo falta, está dañada. */
function comprobar(partida: Datos): Partida {
  const falla = (que: string): never => {
    throw new ErrorGuardado('danado', `Partida dañada: ${que}`);
  };
  if (typeof partida.id !== 'string' || partida.id === '') falla('id');
  if (!Number.isSafeInteger(partida.semilla)) falla('semilla');
  if (typeof partida.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(partida.fecha)) {
    falla('fecha');
  }
  const hora = partida.hora;
  if (typeof hora !== 'number' || !Number.isInteger(hora) || hora < 0 || hora > 23) falla('hora');
  if (!esObjeto(partida.huso) || typeof partida.huso.zona !== 'string') falla('huso');
  const jugador = partida.jugador;
  if (!esObjeto(jugador) || typeof jugador.paisId !== 'string') falla('jugador');
  if (!esObjeto(partida.opciones)) falla('opciones');
  const paises = partida.paises;
  if (!esObjeto(paises) || !esObjeto(paises[(jugador as Datos).paisId as string])) falla('paises');
  if (!Array.isArray(partida.efectos)) falla('efectos');
  if (!Array.isArray(partida.agenda)) falla('agenda');
  return partida as unknown as Partida;
}

/**
 * Abre un guardado (de IndexedDB o de un archivo): comprueba que es una partida de este juego, la
 * migra al formato actual y comprueba que no está dañada. Lanza ErrorGuardado si no se puede.
 */
export function desempaquetar(datos: unknown): ArchivoPartida {
  if (!esObjeto(datos) || datos.juego !== JUEGO || !esObjeto(datos.partida)) {
    throw new ErrorGuardado('noEsPartida', 'No es una partida de este juego');
  }
  const partida = comprobar(migrar(structuredClone(datos.partida)));
  return {
    juego: JUEGO,
    formato: partida.formato,
    version: typeof datos.version === 'string' ? datos.version : '',
    guardadoEn: typeof datos.guardadoEn === 'string' ? datos.guardadoEn : '',
    partida,
  };
}

/**
 * La partida lista para seguir jugando: con el azar sembrado de nuevo (decisión del jugador en la
 * Fase 12: al cargar, repetir lo mismo puede dar el mismo resultado o no).
 */
export function paraSeguir(archivo: ArchivoPartida, semillaNueva: number): Partida {
  return { ...structuredClone(archivo.partida), semilla: semillaNueva };
}

/** Los guardados automáticos mensuales que sobran: se conservan los más recientes. */
export function automaticosQueSobran(
  resumenes: readonly ResumenGuardado[],
  maximo: number = AUTOMATICOS_MENSUALES,
): string[] {
  return resumenes
    .filter((r) => r.tipo === 'automatico')
    .sort((a, b) => b.guardadoEn.localeCompare(a.guardadoEn))
    .slice(maximo)
    .map((r) => r.id);
}

/** El guardado más reciente («Continuar» en el inicio), o null si no hay ninguno. */
export function masReciente(resumenes: readonly ResumenGuardado[]): ResumenGuardado | null {
  return resumenes.reduce<ResumenGuardado | null>(
    (reciente, r) => (reciente === null || r.guardadoEn > reciente.guardadoEn ? r : reciente),
    null,
  );
}

/** Orden de la pantalla de cargar: ranuras 1 a 5, después automáticos y anuales, más nuevos antes. */
export function ordenarResumenes(resumenes: readonly ResumenGuardado[]): ResumenGuardado[] {
  const orden: Record<TipoGuardado, number> = { manual: 0, automatico: 1, anual: 2 };
  return [...resumenes].sort(
    (a, b) =>
      orden[a.tipo] - orden[b.tipo] ||
      (a.ranura ?? 0) - (b.ranura ?? 0) ||
      b.guardadoEn.localeCompare(a.guardadoEn),
  );
}

/** Tamaño máximo de un archivo de partida que se deja importar (para no colgar la página). */
export const TAMANO_MAXIMO_ARCHIVO = 50 * 1024 * 1024;

/**
 * Nombre del archivo .json al exportar (tarea f14-t3): el juego, el país y la fecha de la
 * partida, p. ej. «geopolitica-2010-ESP-2011-03-01.json».
 */
export function nombreArchivo(partida: Pick<Partida, 'jugador' | 'fecha'>): string {
  return `${JUEGO}-${partida.jugador.paisId}-${partida.fecha}.json`;
}

/** El texto del archivo .json de una partida. */
export function aTexto(archivo: ArchivoPartida): string {
  return JSON.stringify(archivo);
}

/**
 * Lee el texto de un archivo .json importado (tarea f14-t3): comprueba que es una partida de
 * este juego, la migra al formato actual y comprueba que no está dañada.
 */
export function deTexto(texto: string): ArchivoPartida {
  if (texto.length > TAMANO_MAXIMO_ARCHIVO) {
    throw new ErrorGuardado('noEsPartida', 'Archivo demasiado grande');
  }
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new ErrorGuardado('noEsPartida', 'No es un archivo JSON');
  }
  return desempaquetar(datos);
}
