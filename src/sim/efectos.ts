/**
 * Efectos y modificadores (tarea f13-t1, GDD sección 8): la forma común de aplicar consecuencias
 * que comparten leyes, tecnologías, eventos y edificios. Un efecto cambia un dato de un país
 * (sumando, multiplicando o fijando un valor) desde una fecha (con su retraso) hasta otra (su
 * duración). El dato guardado en la partida es el de base; lo que ve el jugador es ese dato con
 * los efectos vigentes aplicados. Motor puro, sin interfaz.
 */
import type { EstadoPais } from './partida';

export const OPERACIONES = ['sumar', 'multiplicar', 'fijar'] as const;
export type Operacion = (typeof OPERACIONES)[number];

/** Datos de un país que pueden cambiar los efectos (crecerá con cada sistema). */
export type CampoEstado = keyof EstadoPais;

/** Límites de cada dato con los efectos aplicados. */
export const LIMITES: Record<CampoEstado, [number, number]> = {
  popularidad: [0, 100],
  tesoreria: [-Infinity, Infinity],
};

/** De dónde viene un efecto (para explicárselo al jugador). */
export type OrigenEfecto = 'ley' | 'tecnologia' | 'evento' | 'edificio' | 'prueba';

export interface Efecto {
  id: string;
  /** Qué es, en palabras del jugador («Subida del IVA»). */
  nombre: string;
  origen: OrigenEfecto;
  variable: { pais: string; campo: CampoEstado };
  operacion: Operacion;
  valor: number;
  /** Primer día en que actúa (AAAA-MM-DD), con el retraso ya contado. */
  desde: string;
  /** Primer día en que ya no actúa, o null si es permanente. */
  hasta: string | null;
}

/** Cómo se pide un efecto: lo de la sección 8 del GDD, con el retraso y la duración. */
export interface DefinicionEfecto {
  nombre: string;
  origen: OrigenEfecto;
  variable: { pais: string; campo: CampoEstado };
  operacion: Operacion;
  valor: number;
  retrasoMeses?: number;
  retrasoDias?: number;
  /** Duración en meses o en días; sin ninguna de las dos, es permanente. */
  duracionMeses?: number;
  duracionDias?: number;
}

const partes = (fecha: string): [number, number, number] => {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!coincidencia) throw new Error(`Fecha no válida: ${fecha}`);
  return [Number(coincidencia[1]), Number(coincidencia[2]), Number(coincidencia[3])];
};

const texto = (fecha: Date): string => fecha.toISOString().slice(0, 10);

/** Suma días a una fecha. */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = partes(fecha);
  return texto(new Date(Date.UTC(a, m - 1, d + dias)));
}

/** Suma meses a una fecha; si el día no existe en el mes de llegada, el último del mes. */
export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = partes(fecha);
  const ultimoDia = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate();
  return texto(new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimoDia))));
}

/** Crea un efecto a partir de su definición, contando el retraso y la duración desde `hoy`. */
export function crearEfecto(definicion: DefinicionEfecto, hoy: string, id: string): Efecto {
  if (!OPERACIONES.includes(definicion.operacion)) {
    throw new Error(`Operación desconocida: ${definicion.operacion}`);
  }
  if (!Number.isFinite(definicion.valor)) throw new Error(`Valor no válido: ${definicion.valor}`);
  let desde = hoy;
  if (definicion.retrasoMeses) desde = sumarMeses(desde, definicion.retrasoMeses);
  if (definicion.retrasoDias) desde = sumarDias(desde, definicion.retrasoDias);
  let hasta: string | null = null;
  if (definicion.duracionMeses !== undefined) hasta = sumarMeses(desde, definicion.duracionMeses);
  if (definicion.duracionDias !== undefined)
    hasta = sumarDias(hasta ?? desde, definicion.duracionDias);
  return {
    id,
    nombre: definicion.nombre,
    origen: definicion.origen,
    variable: { ...definicion.variable },
    operacion: definicion.operacion,
    valor: definicion.valor,
    desde,
    hasta,
  };
}

/** ¿Actúa el efecto en esa fecha? (Las fechas AAAA-MM-DD se comparan como texto.) */
export function activo(efecto: Efecto, fecha: string): boolean {
  return efecto.desde <= fecha && (efecto.hasta === null || fecha < efecto.hasta);
}

/** Efectos que actúan en una fecha sobre un dato de un país. */
export function efectosDe(
  efectos: readonly Efecto[],
  pais: string,
  campo: CampoEstado,
  fecha: string,
): Efecto[] {
  return efectos.filter(
    (e) => e.variable.pais === pais && e.variable.campo === campo && activo(e, fecha),
  );
}

/**
 * Valor de un dato con los efectos aplicados: primero los que lo fijan (manda el último), luego
 * los que multiplican y por último los que suman; dentro de sus límites.
 */
export function valorEfectivo(
  base: number,
  efectos: readonly Efecto[],
  campo: CampoEstado,
): number {
  let valor = base;
  for (const e of efectos) if (e.operacion === 'fijar') valor = e.valor;
  for (const e of efectos) if (e.operacion === 'multiplicar') valor *= e.valor;
  for (const e of efectos) if (e.operacion === 'sumar') valor += e.valor;
  const [minimo, maximo] = LIMITES[campo];
  return Math.min(maximo, Math.max(minimo, valor));
}

/** Dato de un país en una fecha, con los efectos aplicados. */
export function datoEfectivo(
  estado: EstadoPais,
  efectos: readonly Efecto[],
  pais: string,
  campo: CampoEstado,
  fecha: string,
): number {
  return valorEfectivo(estado[campo], efectosDe(efectos, pais, campo, fecha), campo);
}

/**
 * Al empezar un día: qué efectos empiezan, cuáles terminan (y se quitan) y cuáles siguen
 * guardados (los vigentes y los que aún no han empezado).
 */
export function revisarEfectos(
  efectos: readonly Efecto[],
  fecha: string,
): { empiezan: Efecto[]; terminan: Efecto[]; quedan: Efecto[] } {
  const empiezan = efectos.filter((e) => e.desde === fecha);
  const terminan = efectos.filter((e) => e.hasta !== null && e.hasta <= fecha);
  const quedan = efectos.filter((e) => e.hasta === null || e.hasta > fecha);
  return { empiezan, terminan, quedan };
}
