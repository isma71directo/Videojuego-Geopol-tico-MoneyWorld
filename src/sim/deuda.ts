/**
 * Deuda, prima de riesgo y rating (Fase 18; decisiones del jugador: fórmula pública calibrada con
 * los tipos reales a 10 años de 2010 de la OCDE; la prima encarece la deuda poco a poco; en una
 * crisis se elige entre el FMI y el impago; una prima alta encarece el crédito y se contagia).
 *
 * Esta parte (tarea f18-t1): la fórmula. El riesgo de un país sale de su renta, su estabilidad
 * política, su inflación, su deuda, su déficit, su déficit exterior y lo que se le van los
 * ingresos en intereses; sin moneda propia (el euro), la deuda y el déficit pesan más. La prima
 * es e elevada al riesgo; el tipo de mercado, un tipo base (provisional hasta el banco central de
 * la Fase 20) más la inflación esperada y la prima; y el rating, según la prima. Motor puro.
 */
import config from './config/deuda.json';

/** Lo que mira el mercado de un país. */
export interface Fundamentos {
  /** País (para saber si tiene moneda propia). */
  id: string;
  /** PIB por habitante (dólares). */
  pibPerCapita: number;
  /** Estabilidad política (índice WGI del Banco Mundial; 0 = media mundial). */
  estabilidad: number;
  /** Inflación (tanto por uno al año). */
  inflacion: number;
  /** Crecimiento del PIB real (tanto por uno al año). */
  crecimiento: number;
  /** Deuda pública (tanto por uno del PIB). */
  deuda: number;
  /** Déficit público (tanto por uno del PIB; negativo si hay superávit). */
  deficit: number;
  /** Déficit exterior: déficit por cuenta corriente (tanto por uno del PIB; negativo si es superávit). */
  deficitExterior: number;
  /** Intereses de la deuda sobre los ingresos públicos (tanto por uno). */
  carga: number;
}

const r = config.riesgo;
const SIN_MONEDA_PROPIA: ReadonlySet<string> = new Set(config.sinMonedaPropia);

/** ¿Tiene el país moneda propia (y banco central que la respalde)? Provisional hasta la Fase 21. */
export function tieneMonedaPropia(id: string): boolean {
  return !SIN_MONEDA_PROPIA.has(id);
}

/** El riesgo de un país (el logaritmo de su prima). */
export function riesgoPais(f: Fundamentos): number {
  const sin = tieneMonedaPropia(f.id) ? 0 : 1;
  return (
    r.constante +
    r.renta * Math.log(Math.max(r.rentaCorte, f.pibPerCapita) / r.rentaReferencia) +
    r.rentaBaja * Math.log(Math.min(r.rentaCorte, Math.max(100, f.pibPerCapita)) / r.rentaCorte) +
    r.estabilidad * (f.estabilidad / r.escalaEstabilidad) +
    r.inflacion * Math.max(0, f.inflacion) +
    r.crecimiento * f.crecimiento +
    Math.max(0, f.deuda - r.deudaSegura) * (r.deuda + sin * r.deudaSinMonedaPropia) +
    Math.max(0, f.deficit) * (r.deficit + sin * r.deficitSinMonedaPropia) +
    Math.max(0, f.deficitExterior) * (r.exterior + sin * r.exteriorSinMonedaPropia) +
    Math.max(0, f.carga - r.cargaSegura) * r.carga
  );
}

/** Prima de riesgo (puntos sobre el tipo base) que pide el mercado. */
export function primaDeRiesgo(f: Fundamentos): number {
  return Math.min(config.primaMaxima, Math.exp(riesgoPais(f)));
}

/** Lo que suma al tipo la inflación esperada (puntos). */
export function parteInflacion(inflacionEsperada: number): number {
  return (
    config.pesoInflacion *
    Math.max(config.inflacionMinima, inflacionEsperada * 100 - config.inflacionReferencia)
  );
}

/** Tipo de interés de mercado (en %) con una prima y una inflación esperada. */
export function tipoDeMercado(prima: number, inflacionEsperada: number): number {
  return config.tipoBase + parteInflacion(inflacionEsperada) + prima;
}

/** La prima que corresponde a un tipo de mercado observado (para empezar con el tipo real). */
export function primaDeTipo(tipo: number, inflacionEsperada: number): number {
  return tipo - config.tipoBase - parteInflacion(inflacionEsperada);
}

/** Los ratings, de mejor a peor (C: los mercados no prestan; D: impago). */
export const RATINGS = [...config.ratings.map(([nombre]) => nombre as string), 'C', 'D'] as const;
export type Rating = string;

/** El rating que corresponde a una prima (sin el impago, que es «D»). */
export function ratingDe(prima: number): Rating {
  for (const [nombre, maximo] of config.ratings) {
    if (prima <= (maximo as number)) return nombre as string;
  }
  return 'C';
}

/** Los fundamentos de un país con sus datos de 2010 (paises-2010.json, campo «datos»). */
export function fundamentosDe2010(
  id: string,
  datos: Record<string, number | null | undefined>,
): Fundamentos {
  const dato = (campo: string, respaldo: number): number => {
    const valor = datos[campo];
    return typeof valor === 'number' && Number.isFinite(valor) ? valor : respaldo;
  };
  const ingresos = dato('ingresosPublicosPib', 30);
  const gasto = dato('gastoPublicoPib', 33);
  const intereses = (gasto * dato('gastoIntereses', 5)) / 100;
  return {
    id,
    pibPerCapita: dato('pibPerCapita', 10000),
    estabilidad: dato('estabilidadPolitica', 0),
    inflacion: dato('inflacion', 3) / 100,
    crecimiento: dato('crecimientoPib', 3) / 100,
    deuda: dato('deudaPib', 50) / 100,
    deficit: -dato('saldoFiscalPib', -3) / 100,
    deficitExterior: -dato('cuentaCorrientePib', 0) / 100,
    carga: ingresos > 0 ? intereses / ingresos : 0,
  };
}
