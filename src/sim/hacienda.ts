/**
 * Hacienda (Fase 19; decisiones del jugador): el presupuesto se decide en dinero y no cambia hasta
 * que se decide otro.
 *
 * - Es anual, con cambios a mitad de año que valen desde el mes siguiente. Si llega enero sin
 *   presupuesto nuevo, se prorroga el anterior (preparado para cuando exista el parlamento).
 * - Se deciden el gasto de cada ministerio por partidas, la subida de las pensiones de cada enero
 *   (por defecto, el IPC) y la prestación de cada parado.
 * - Los gobiernos de la IA aprueban el suyo cada enero, según su situación.
 *
 * El jugador manda su presupuesto con la orden «presupuesto» del motor; este sistema lo aplica en
 * el paso del mes siguiente. Va después del presupuesto y del mercado de la deuda. Motor puro.
 */
import config from './config/presupuesto.json';
import { UMBRAL_CIERRE, type MercadoDeuda } from './deuda';
import { crecimientoPotencial, pibNominal, type EconomiaPais } from './economia';
import type { Sistema } from './motor';
import {
  MINISTERIOS,
  PARTIDAS,
  saldo,
  type Ministerio,
  type Partida,
  type PresupuestoPais,
} from './presupuesto';

/** Lo que se decide de un presupuesto (todo en dólares al año, salvo la subida de las pensiones). */
export interface PresupuestoDecidido {
  ministerios: Record<Ministerio, Record<Partida, number>>;
  /** Subida de las pensiones cada enero (tanto por uno); null: el IPC. */
  revalorizacion: number | null;
  /** Prestación media al año de cada parado. */
  prestacionParado: number;
}

const h = config.hacienda;

/** Límites de la subida de las pensiones que se puede decidir (tanto por uno). */
export const LIMITES_REVALORIZACION = [-0.2, 0.2] as const;

/** El presupuesto en vigor como decisión (para empezar a cambiarlo). */
export function presupuestoEnVigor(presupuesto: PresupuestoPais): PresupuestoDecidido {
  return {
    ministerios: structuredClone(presupuesto.ministerios),
    revalorizacion: presupuesto.revalorizacion,
    prestacionParado: presupuesto.prestacionParado,
  };
}

/** Un número de dinero válido (finito y no negativo), o el que había. */
const dinero = (valor: unknown, siNo: number): number =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : siNo;

/**
 * Aprueba un presupuesto (del jugador o de la IA) en \`anio\`. Lo que no sea válido se queda como
 * estaba; la subida de las pensiones, entre sus límites.
 */
export function aprobarPresupuesto(
  presupuesto: PresupuestoPais,
  decidido: PresupuestoDecidido,
  anio: number,
): void {
  for (const m of MINISTERIOS) {
    for (const p of PARTIDAS) {
      presupuesto.ministerios[m][p] = dinero(
        decidido.ministerios?.[m]?.[p],
        presupuesto.ministerios[m][p],
      );
    }
  }
  const subida = decidido.revalorizacion;
  presupuesto.revalorizacion =
    typeof subida === 'number' && Number.isFinite(subida)
      ? Math.min(LIMITES_REVALORIZACION[1], Math.max(LIMITES_REVALORIZACION[0], subida))
      : null;
  presupuesto.prestacionParado = dinero(decidido.prestacionParado, presupuesto.prestacionParado);
  presupuesto.aprobado = { anio, prorrogado: false };
}

/**
 * El presupuesto que aprueba la IA cada enero, según su situación:
 * - con la prima cerca del cierre de los mercados, recorta y congela las pensiones;
 * - con un déficit alto, congela el gasto;
 * - con un déficit moderado, lo sube con la inflación;
 * - con margen, lo sube con la economía (inflación y crecimiento: mantiene su peso);
 * - con superávit, con la economía y algo más.
 */
export function presupuestoDeLaIa(
  presupuesto: PresupuestoPais,
  economia: EconomiaPais,
  mercado: MercadoDeuda | null,
): PresupuestoDecidido {
  const pib = pibNominal(economia);
  const deficit = pib > 0 ? -saldo(presupuesto) / pib : 0;
  const inflacion = Math.max(0, economia.inflacion);
  const conLaEconomia = (1 + inflacion) * (1 + Math.max(0, crecimientoPotencial(economia)));
  let factor = conLaEconomia;
  let revalorizacion: number | null = null;
  if (mercado && mercado.prima >= h.ia.cercaDelCierre * UMBRAL_CIERRE) {
    factor = 1 - h.ia.recorte;
    revalorizacion = 0;
  } else if (deficit >= h.ia.deficitAlto) {
    factor = 1;
  } else if (deficit >= h.ia.deficitMargen) {
    factor = 1 + inflacion;
  } else if (deficit < 0) {
    factor = conLaEconomia + h.ia.extraSuperavit;
  }
  const decidido = presupuestoEnVigor(presupuesto);
  for (const m of MINISTERIOS) {
    for (const p of PARTIDAS) decidido.ministerios[m][p] *= factor;
  }
  decidido.revalorizacion = revalorizacion;
  // La prestación por parado no baja: si sube el gasto, sube con él.
  decidido.prestacionParado *= Math.max(1, factor);
  return decidido;
}

/** Cada enero, las pensiones suben lo decidido; por defecto, el IPC (y no bajan por ley). */
export function revalorizarPensiones(presupuesto: PresupuestoPais, economia: EconomiaPais): void {
  const subida = presupuesto.revalorizacion ?? Math.max(0, economia.inflacion);
  presupuesto.transversales.pensiones *= 1 + subida;
}

/**
 * Un mes de Hacienda de un país (el día 1, con su \`fecha\`): aplica lo que haya decidido el
 * jugador y, en enero, el presupuesto del año (la IA aprueba el suyo; el del jugador se prorroga
 * si no ha aprobado otro este año) y la subida de las pensiones. En una crisis de deuda, la IA no
 * aprueba presupuesto (manda el rescate o el impago) y las pensiones se congelan.
 */
export function haciendaDelMes(
  presupuesto: PresupuestoPais,
  economia: EconomiaPais,
  mercado: MercadoDeuda | null,
  opciones: { esJugador: boolean; fecha: string; decidido?: PresupuestoDecidido },
): void {
  const anio = Number(opciones.fecha.slice(0, 4));
  if (opciones.decidido) aprobarPresupuesto(presupuesto, opciones.decidido, anio);
  if (opciones.fecha.slice(5, 7) !== '01') return;
  const enCrisis = Boolean(mercado?.programa);
  if (!opciones.esJugador && !enCrisis) {
    aprobarPresupuesto(presupuesto, presupuestoDeLaIa(presupuesto, economia, mercado), anio);
  } else if (presupuesto.aprobado.anio < anio) {
    presupuesto.aprobado.prorrogado = true;
  }
  if (!enCrisis) revalorizarPensiones(presupuesto, economia);
}

/** La fecha del paso mensual de una economía que lleva \`meses\` meses desde enero de 2010. */
export function fechaDelMes(meses: number): string {
  const anio = 2010 + Math.floor(meses / 12);
  const mes = (meses % 12) + 1;
  return `${anio}-${String(mes).padStart(2, '0')}-01`;
}

/**
 * Sistema de Hacienda (Fase 19): cada mes, después del presupuesto y del mercado de la deuda, en
 * todos los países. El presupuesto que ha mandado el jugador se aplica a su país y se quita.
 */
export const sistemaHacienda: Sistema = (pasos, partida) => {
  for (const paso of pasos) {
    if (paso.ritmo !== 'mensual') continue;
    const decidido = partida.presupuestoDecidido;
    if (decidido) delete partida.presupuestoDecidido;
    for (const [id, estado] of Object.entries(partida.paises)) {
      const { presupuesto, economia } = estado;
      if (!presupuesto || !economia) continue;
      const esJugador = id === partida.jugador.paisId;
      haciendaDelMes(presupuesto, economia, estado.mercado ?? null, {
        esJugador,
        fecha: paso.fecha,
        decidido: esJugador ? decidido : undefined,
      });
    }
  }
};
