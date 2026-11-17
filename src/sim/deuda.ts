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
import { durezaDe, pibNominal, type EconomiaPais } from './economia';
import type { Sistema } from './motor';
import type { Partida } from './partida';
import { saldo, totalIngresos, type PresupuestoPais } from './presupuesto';

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
    Math.max(0, f.carga - r.cargaSegura) * r.carga * (sin ? 1 : r.cargaConMonedaPropia)
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

// ── El mercado de deuda cada mes (tarea f18-t2) ──

const m = config.mercado;
const c = config.contagio;

/** El mercado de la deuda de un país: su prima, su rating y lo que necesita para calcularlos. */
export interface MercadoDeuda {
  /** Prima de riesgo de ahora (puntos sobre el tipo base). */
  prima: number;
  /** Diferencia con la fórmula para empezar con el tipo real de 2010 (puntos); se apaga. */
  ajuste: number;
  /** Tipo al que presta hoy el mercado (%). */
  tipoMercado: number;
  /** Rating de ahora (se revisa cada trimestre). */
  rating: Rating;
  /** ¿Han dejado de prestarle los mercados? (Crisis de deuda: tarea f18-t3.) */
  cerrado: boolean;
  /** Lo que no cambia hasta otras fases: estabilidad política, déficit exterior y región. */
  estabilidad: number;
  deficitExterior: number;
  region: string;
  /** La renta por habitante y el PIB real de 2010 (para estimar la de ahora) y su crecimiento. */
  pibPerCapita2010: number;
  pib2010: number;
  crecimiento2010: number;
  /** Deuda del mes pasado (para saber cuánta se ha emitido este). */
  deudaVista: number;
  /** Prima de cada mes desde que empezó (para los gráficos). */
  serie: number[];
}

/** Los fundamentos de un país ahora, con su economía y su presupuesto. */
export function fundamentosAhora(
  id: string,
  mercado: MercadoDeuda,
  economia: EconomiaPais,
  presupuesto: PresupuestoPais,
): Fundamentos {
  const pib = pibNominal(economia);
  const serie = economia.serie;
  const crecimiento =
    serie.length >= 13 ? serie.at(-1)! / serie.at(-13)! - 1 : mercado.crecimiento2010;
  const ingresos = totalIngresos(presupuesto);
  return {
    id,
    pibPerCapita: mercado.pibPerCapita2010 * (economia.pib / mercado.pib2010),
    estabilidad: mercado.estabilidad,
    inflacion: economia.inflacion,
    crecimiento,
    deuda: pib > 0 ? presupuesto.deuda / pib : 0,
    deficit: pib > 0 ? -saldo(presupuesto) / pib : 0,
    deficitExterior: mercado.deficitExterior,
    carga: ingresos > 0 ? presupuesto.transversales.intereses / ingresos : 0,
  };
}

/**
 * El mercado de la deuda de un país al empezar (o al cargar una partida de antes de la Fase 18):
 * la prima de la fórmula; si tiene tipo real de 2010 (OCDE), ese, con la diferencia guardada
 * para que se apague poco a poco.
 */
export function mercadoInicial(
  id: string,
  datos: Record<string, number | null | undefined>,
  region: string | null | undefined,
  economia: EconomiaPais,
  presupuesto: PresupuestoPais,
): MercadoDeuda {
  const de2010 = fundamentosDe2010(id, datos);
  const mercado: MercadoDeuda = {
    prima: 0,
    ajuste: 0,
    tipoMercado: 0,
    rating: 'AAA',
    cerrado: false,
    estabilidad: de2010.estabilidad,
    deficitExterior: de2010.deficitExterior,
    region: region ?? '',
    pibPerCapita2010: de2010.pibPerCapita,
    pib2010: economia.pib,
    crecimiento2010: de2010.crecimiento,
    deudaVista: presupuesto.deuda,
    serie: [],
  };
  const formula = primaDeRiesgo(fundamentosAhora(id, mercado, economia, presupuesto));
  const real = datos.tipoBono10;
  mercado.ajuste =
    typeof real === 'number' && Number.isFinite(real)
      ? primaDeTipo(real, economia.inflacionEsperada) - formula
      : 0;
  mercado.prima = Math.max(0, formula + mercado.ajuste);
  mercado.tipoMercado = tipoDeMercado(mercado.prima, economia.inflacionEsperada);
  mercado.rating = ratingDe(mercado.prima);
  mercado.serie.push(redondearPrima(mercado.prima));
  // Lo que pesa en el crédito: la de 2010 es la referencia.
  economia.primaRiesgo = mercado.prima;
  economia.primaReferencia = mercado.prima;
  return mercado;
}

const redondearPrima = (prima: number): number => Math.round(prima * 1000) / 1000;

/** El rating revisado: hacia el que toca, como mucho «pasosRating» escalones de una vez. */
export function revisarRating(actual: Rating, objetivo: Rating): Rating {
  if (actual === 'D') return actual;
  const de = RATINGS.indexOf(actual);
  const a = RATINGS.indexOf(objetivo);
  if (de < 0 || a < 0) return objetivo;
  const paso = Math.max(-m.pasosRating, Math.min(m.pasosRating, a - de));
  return RATINGS[de + paso]!;
}

/** Lo vulnerable que es un país al contagio: mucha deuda y déficit (de 0 a 1). */
function vulnerabilidad(f: Fundamentos): number {
  return Math.min(
    1,
    Math.max(0, f.deuda - c.deudaVulnerable) + 5 * Math.max(0, f.deficit - c.deficitVulnerable),
  );
}

/** Lo que un país en apuros contagia a otro (de 0 a 1, antes de su vulnerabilidad). */
export function presionDeContagio(
  desde: { id: string; region: string; prima: number },
  hacia: { id: string; region: string },
): number {
  if (desde.id === hacia.id || desde.prima <= c.umbral) return 0;
  const presion = Math.min(1, (desde.prima - c.umbral) / c.escala);
  const vinculo =
    (!tieneMonedaPropia(desde.id) && !tieneMonedaPropia(hacia.id) ? c.mismaMoneda : 0) +
    (desde.region && desde.region === hacia.region ? c.mismaRegion : 0);
  return presion * vinculo;
}

/**
 * Un mes del mercado de un país (tarea f18-t2): la prima va hacia la que pide la fórmula (más el
 * contagio), la deuda que vence y la nueva se pagan al tipo de ahora, el rating se revisa cada
 * trimestre y, si la prima se dispara, los mercados dejan de prestar. `dureza`: cuánto pesa la
 * prima en el crédito de la economía (según la dificultad).
 */
export function avanzarMercado(
  id: string,
  mercado: MercadoDeuda,
  economia: EconomiaPais,
  presupuesto: PresupuestoPais,
  contagio: number,
  dureza = 1,
): void {
  const f = fundamentosAhora(id, mercado, economia, presupuesto);
  mercado.ajuste *= Math.pow(0.5, 1 / m.mesesAjuste);
  const extra = Math.min(c.maximo, contagio * vulnerabilidad(f));
  const objetivo = Math.min(config.primaMaxima, Math.exp(riesgoPais(f) + extra) + mercado.ajuste);
  mercado.prima = Math.max(0, mercado.prima + (objetivo - mercado.prima) * m.reaccionMensual);
  mercado.tipoMercado = tipoDeMercado(mercado.prima, economia.inflacionEsperada);
  // La deuda que vence este mes y la nueva se pagan al tipo de ahora: el tipo medio se acerca.
  const deuda = presupuesto.deuda;
  const nueva = Math.max(0, deuda - mercado.deudaVista);
  const vence = deuda / (12 * m.vidaMedia);
  if (deuda > 0) {
    const parte = Math.min(1, (nueva + vence) / deuda);
    presupuesto.tipoInteres += (mercado.tipoMercado / 100 - presupuesto.tipoInteres) * parte;
  }
  mercado.deudaVista = deuda;
  if (economia.meses % m.mesesRevision === 0) {
    mercado.rating = revisarRating(mercado.rating, ratingDe(mercado.prima));
  }
  mercado.cerrado = mercado.prima > m.umbralCierre;
  mercado.serie.push(redondearPrima(mercado.prima));
  // El crédito de la economía se encarece con la prima (según la dificultad).
  economia.primaRiesgo =
    economia.primaReferencia + (mercado.prima - economia.primaReferencia) * dureza;
}

/**
 * Sistema del mercado de deuda (tarea f18-t2): cada mes, después del presupuesto, en todos los
 * países; primero mira quién está en apuros (para el contagio) y luego avanza cada uno.
 */
export const sistemaMercado: Sistema = (pasos, partida) => {
  if (!pasos.some((paso) => paso.ritmo === 'mensual')) return;
  const dureza = durezaDe(partida.opciones.dificultad);
  const enApuros = Object.entries(partida.paises)
    .filter(([, e]) => e.mercado && e.mercado.prima > c.umbral)
    .map(([id, e]) => ({ id, region: e.mercado!.region, prima: e.mercado!.prima }));
  for (const [id, estado] of Object.entries(partida.paises)) {
    const { mercado, economia, presupuesto } = estado;
    if (!mercado || !economia || !presupuesto) continue;
    const contagio = enApuros.reduce(
      (total, desde) => total + presionDeContagio(desde, { id, region: mercado.region }),
      0,
    );
    avanzarMercado(id, mercado, economia, presupuesto, contagio, dureza);
  }
};

/** Lo que hace falta de cada país para completar el mercado de una partida guardada. */
export interface PaisParaMercado {
  datos: Record<string, number | null | undefined>;
  region?: string | null;
}

/** Da el mercado de su deuda a los países de una partida de antes de la Fase 18. */
export function completarMercado(
  partida: Partida,
  paises: Record<string, PaisParaMercado>,
): Partida {
  for (const [id, estado] of Object.entries(partida.paises)) {
    if (estado.mercado !== undefined) continue;
    const pais = paises[id];
    estado.mercado =
      pais && estado.economia && estado.presupuesto
        ? mercadoInicial(id, pais.datos, pais.region, estado.economia, estado.presupuesto)
        : null;
  }
  return partida;
}

/** ¿Le falta el mercado de su deuda a algún país? (Partidas de antes de la Fase 18.) */
export function faltaMercado(partida: Pick<Partida, 'paises'>): boolean {
  return Object.values(partida.paises).some((estado) => estado.mercado === undefined);
}
