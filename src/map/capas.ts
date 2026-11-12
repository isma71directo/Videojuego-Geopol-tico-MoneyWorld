/**
 * Capas del mapa (tarea f6-t1): cada capa da a cada país un color según un dato de 2010, por
 * tramos redondos. Los países sin dato van en gris neutro y los datos estimados se marcan con
 * un rayado. Lógica pura, con tests; los tramos y las rampas están en config/capas.json.
 */
import { esEstimado, type PaisDatos } from '../datos/paises';
import configuracion from './config/capas.json';
import { hexDeOklch, rampaDivergente, rampaSecuencial, type Brazo, type Oklch } from './rampas';

export type FormatoCapa = 'dolaresPorPersona' | 'personas' | 'porcentaje' | 'reservas';

type RampaConfig =
  | { tipo: 'secuencial'; desde: Oklch; hasta: Oklch }
  | { tipo: 'divergente'; centro: Oklch; bajo: Brazo; alto: Brazo };

interface CapaConfig {
  id: string;
  grupo?: string;
  campo: string;
  formato: FormatoCapa;
  tramos: number[];
  /** Valor que separa los dos brazos de una rampa divergente (debe ser uno de los tramos). */
  centro?: number;
  /** Si el valor 0 tiene clase propia («sin reservas»). */
  cero?: boolean;
  /** La leyenda muestra los tramos divididos entre esto (p. ej. millones de habitantes). */
  escalaLeyenda?: number;
  rampa: RampaConfig;
}

export interface CapaDatos {
  id: string;
  /** Capas que se eligen juntas (p. ej. «recursos»: petróleo, gas y carbón). */
  grupo: string;
  campo: string;
  formato: FormatoCapa;
  tramos: readonly number[];
  cero: boolean;
  escalaLeyenda: number;
  /** Un color por clase, de la más baja a la más alta (sin la clase del cero). */
  colores: readonly string[];
}

/** La capa política (la de siempre: un color por país) o una capa de datos. */
export type IdCapa = 'politica' | string;

export const COLOR_SIN_DATOS = hexDeOklch(configuracion.sinDatos as unknown as Oklch);
export const COLOR_SIN_RESERVAS = hexDeOklch(configuracion.sinReservas as unknown as Oklch);

function crearCapa(config: CapaConfig): CapaDatos {
  const clases = config.tramos.length + 1;
  const { rampa } = config;
  let colores: string[];
  if (rampa.tipo === 'secuencial') {
    colores = rampaSecuencial(clases, rampa.desde, rampa.hasta);
  } else {
    const indice = config.tramos.indexOf(config.centro ?? Number.NaN);
    if (indice < 0) throw new Error(`Capa ${config.id}: el centro debe ser uno de los tramos`);
    colores = rampaDivergente(
      indice + 1,
      clases - indice - 1,
      rampa.centro,
      rampa.bajo,
      rampa.alto,
    );
  }
  return {
    id: config.id,
    grupo: config.grupo ?? config.id,
    campo: config.campo,
    formato: config.formato,
    tramos: config.tramos,
    cero: config.cero ?? false,
    escalaLeyenda: config.escalaLeyenda ?? 1,
    colores,
  };
}

/** Capas de datos, en el orden en que se ofrecen. */
export const CAPAS: readonly CapaDatos[] = (configuracion.capas as unknown as CapaConfig[]).map(
  crearCapa,
);

export function capaPorId(id: string): CapaDatos | null {
  return CAPAS.find((capa) => capa.id === id) ?? null;
}

/**
 * Clase de un valor: 0 para lo que queda por debajo del primer tramo y tramos.length para lo
 * que llega al último. Un valor igual a un tramo va a la clase de arriba.
 */
export function claseDe(valor: number, tramos: readonly number[]): number {
  let clase = 0;
  while (clase < tramos.length && valor >= tramos[clase]!) clase++;
  return clase;
}

/** Color de un valor en una capa; las capas con «cero» dan su color propio al 0. */
export function colorDe(capa: CapaDatos, valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return COLOR_SIN_DATOS;
  if (capa.cero && valor <= 0) return COLOR_SIN_RESERVAS;
  return capa.colores[claseDe(valor, capa.tramos)]!;
}

/** Lo que el mapa necesita para pintar una capa de datos. */
export interface Coloreado {
  /** Color de cada país con dato. */
  colores: Map<string, string>;
  /** Países cuyo dato es una estimación (se dibujan con rayado). */
  rayados: Set<string>;
  /** Color de los países que no tienen dato. */
  sinDatos: string;
}

export function colorearCapa(capa: CapaDatos, paises: Record<string, PaisDatos>): Coloreado {
  const colores = new Map<string, string>();
  const rayados = new Set<string>();
  for (const pais of Object.values(paises)) {
    const valor = pais.datos[capa.campo];
    if (valor === null || valor === undefined) continue;
    colores.set(pais.id, colorDe(capa, valor));
    if (esEstimado(pais.origen[capa.campo])) rayados.add(pais.id);
  }
  return { colores, rayados, sinDatos: COLOR_SIN_DATOS };
}

/** Una línea de la leyenda: su color y sus límites (null en el extremo abierto). */
export interface EntradaLeyenda {
  color: string;
  /** «cero»: la clase del valor 0 («sin reservas»). */
  tipo: 'tramo' | 'cero';
  desde: number | null;
  hasta: number | null;
}

/** Entradas de la leyenda, de la clase más alta a la más baja (como se leen de arriba abajo). */
export function entradasLeyenda(capa: CapaDatos): EntradaLeyenda[] {
  const escala = capa.escalaLeyenda;
  const entradas: EntradaLeyenda[] = capa.colores.map((color, clase) => ({
    color,
    tipo: 'tramo',
    desde: clase === 0 ? null : capa.tramos[clase - 1]! / escala,
    hasta: clase === capa.tramos.length ? null : capa.tramos[clase]! / escala,
  }));
  if (capa.cero) entradas.unshift({ color: COLOR_SIN_RESERVAS, tipo: 'cero', desde: 0, hasta: 0 });
  return entradas.reverse();
}
