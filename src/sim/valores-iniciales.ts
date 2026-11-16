/**
 * Valores iniciales PROVISIONALES de cada país el 1 de enero de 2010 (tarea f10-t2, decisión del
 * jugador: estimados con fórmula). Motor puro: los parámetros están en config/inicio.json y las
 * fórmulas, explicadas en docs/GDD.md (sección 13).
 *
 * - Tesorería: los ingresos públicos de un mes (ingresos en % del PIB, del FMI, por el PIB).
 * - Popularidad del gobierno: una base corregida por el crecimiento, el paro, la inflación, los
 *   años del líder en el cargo y el tipo de régimen.
 *
 * Se sustituirán por el presupuesto (Fase 21) y por la opinión pública (Fase 56).
 */
import config from './config/inicio.json';

/** Lo que hace falta de los datos de un país (paises-2010.json, campo «datos»). */
export type DatosParaInicio = Record<string, number | null | undefined>;

/** Lo que hace falta del gobierno de un país (gobiernos-2010.json). */
export interface GobiernoParaInicio {
  regimen: string | null;
  estado: { desde: string } | null;
  /** «estado» si el jefe de Estado encabeza también el Gobierno. */
  gobierno: { desde: string } | 'estado' | null;
}

export type FactorPopularidad =
  'base' | 'crecimiento' | 'paro' | 'inflacion' | 'desgaste' | 'lunaDeMiel' | 'regimen';

export interface AportePopularidad {
  factor: FactorPopularidad;
  /** Puntos que suma (o resta) este factor, sin redondear. */
  puntos: number;
}

export interface PopularidadInicial {
  /** De 0 a 100, entero. */
  valor: number;
  /** Cómo se llega al valor, para enseñárselo al jugador. */
  desglose: AportePopularidad[];
}

export interface ValoresIniciales {
  /** Dinero en caja, en dólares. */
  tesoreria: number;
  popularidad: number;
}

const { tesoreria: parametrosTesoreria, popularidad: parametros } = config;

const recortar = (valor: number, minimo: number, maximo: number): number =>
  Math.min(maximo, Math.max(minimo, valor));

const numero = (valor: number | null | undefined): number | null =>
  typeof valor === 'number' && Number.isFinite(valor) ? valor : null;

/**
 * Tesorería inicial en dólares: los ingresos públicos de un mes, redondeados al millón.
 * 0 si falta el PIB o los ingresos (no debería pasar: el conjunto de datos los estima).
 */
export function tesoreriaInicial(datos: DatosParaInicio): number {
  const pib = numero(datos.pib);
  const ingresos = numero(datos.ingresosPublicosPib);
  if (pib === null || ingresos === null || pib <= 0 || ingresos <= 0) return 0;
  const dinero = ((ingresos / 100) * pib * parametrosTesoreria.mesesDeIngresos) / 12;
  return Math.round(dinero / parametrosTesoreria.redondeo) * parametrosTesoreria.redondeo;
}

/** Fecha «AAAA-MM-DD» del jefe de Gobierno (o del de Estado si también gobierna), o null. */
export function llegadaDelLider(gobierno: GobiernoParaInicio | null | undefined): string | null {
  if (!gobierno) return null;
  const cargo = gobierno.gobierno === 'estado' ? gobierno.estado : gobierno.gobierno;
  return cargo?.desde ?? null;
}

/** Años (con decimales) entre la llegada al cargo y la fecha dada; null si no se sabe. */
export function aniosEnElCargo(desde: string | null, fecha: string): number | null {
  if (!desde) return null;
  const inicio = Date.parse(`${desde}T00:00:00Z`);
  const fin = Date.parse(`${fecha}T00:00:00Z`);
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return null;
  return Math.max(0, (fin - inicio) / (365.25 * 24 * 3600 * 1000));
}

/** Popularidad inicial del gobierno (0–100) y su desglose. */
export function popularidadInicial(
  datos: DatosParaInicio,
  gobierno: GobiernoParaInicio | null | undefined,
  fecha: string,
): PopularidadInicial {
  const desglose: AportePopularidad[] = [{ factor: 'base', puntos: parametros.base }];
  const factores = parametros.factores as Record<
    'crecimiento' | 'paro' | 'inflacion',
    { campo: string; referencia: number; peso: number; minimo: number; maximo: number }
  >;
  for (const factor of ['crecimiento', 'paro', 'inflacion'] as const) {
    const f = factores[factor];
    const valor = numero(datos[f.campo]);
    if (valor === null) continue;
    desglose.push({
      factor,
      // «|| 0» evita el −0 cuando el valor coincide con la referencia.
      puntos: recortar((valor - f.referencia) * f.peso, f.minimo, f.maximo) || 0,
    });
  }
  const anios = aniosEnElCargo(llegadaDelLider(gobierno), fecha);
  if (anios !== null) {
    desglose.push({
      factor: 'desgaste',
      puntos: Math.max(parametros.desgasteMaximo, anios * parametros.desgastePorAnio),
    });
    if (anios < parametros.lunaDeMiel.aniosMenos) {
      desglose.push({ factor: 'lunaDeMiel', puntos: parametros.lunaDeMiel.puntos });
    }
  }
  if (gobierno?.regimen && parametros.regimenesCerrados.regimenes.includes(gobierno.regimen)) {
    desglose.push({ factor: 'regimen', puntos: parametros.regimenesCerrados.puntos });
  }
  const suma = desglose.reduce((total, aporte) => total + aporte.puntos, 0);
  const [minimo, maximo] = parametros.limites as [number, number];
  return { valor: Math.round(recortar(suma, minimo, maximo)), desglose };
}

/** Tesorería y popularidad iniciales de un país. */
export function valoresIniciales(
  datos: DatosParaInicio,
  gobierno: GobiernoParaInicio | null | undefined,
  fecha: string,
): ValoresIniciales {
  return {
    tesoreria: tesoreriaInicial(datos),
    popularidad: popularidadInicial(datos, gobierno, fecha).valor,
  };
}
