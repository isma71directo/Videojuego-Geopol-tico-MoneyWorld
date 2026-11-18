/**
 * Previsión del presupuesto (tarea f19-t3): qué pasaría en los próximos meses con un presupuesto
 * (o sin cambiar nada), si no cambia nada más. Usa las mismas reglas que la partida (economía,
 * presupuesto, mercado de la deuda y Hacienda, por ese orden) sobre una copia del país, sin el
 * contagio de los demás. Motor puro.
 */
import { avanzarMercado, gestionarCrisis, type MercadoDeuda, type Rating } from './deuda';
import { avanzarMes, pibNominal, type EconomiaPais } from './economia';
import { haciendaDelMes, type PresupuestoDecidido } from './hacienda';
import {
  avanzarPresupuesto,
  saldo,
  totalGastos,
  totalIngresos,
  type CambioPresupuesto,
  type PresupuestoPais,
} from './presupuesto';

/** Lo que se necesita del país para prever. */
export interface PaisParaPrever {
  economia: EconomiaPais;
  presupuesto: PresupuestoPais;
  mercado: MercadoDeuda | null;
  tesoreria: number;
}

/** Cómo acaba la previsión (dinero al año, deuda en dinero, prima en puntos). */
export interface Prevision {
  ingresos: number;
  gastos: number;
  saldo: number;
  deuda: number;
  pibNominal: number;
  prima: number | null;
  rating: Rating | null;
  /** ¿Se cerrarían los mercados por el camino? */
  cerrado: boolean;
}

/** Los meses que se prevén. */
export const MESES_PREVISION = 12;

/** El día 1 de los `meses` meses siguientes a `fecha` («AAAA-MM-DD»). */
export function diasUnoSiguientes(fecha: string, meses: number): string[] {
  let anio = Number(fecha.slice(0, 4));
  let mes = Number(fecha.slice(5, 7));
  const dias: string[] = [];
  for (let k = 0; k < meses; k++) {
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
    dias.push(`${anio}-${String(mes).padStart(2, '0')}-01`);
  }
  return dias;
}

/**
 * Prevé `meses` meses de un país (el del jugador) desde `fecha`: con `decidido`, como si se
 * aprobara hoy (vale desde el día 1 del mes siguiente); sin él, sin cambiar nada.
 */
export function prever(
  id: string,
  pais: PaisParaPrever,
  opciones: {
    fecha: string;
    decidido?: PresupuestoDecidido;
    /** Cambios de los ministerios ordenados hoy (ajuste f19-a1), cada uno cuando le toca. */
    cambios?: readonly CambioPresupuesto[];
    meses?: number;
    dureza?: number;
  },
): Prevision {
  const economia = structuredClone(pais.economia);
  const presupuesto = structuredClone(pais.presupuesto);
  const mercado = pais.mercado ? structuredClone(pais.mercado) : null;
  const estado = { tesoreria: pais.tesoreria };
  let cerrado = mercado?.cerrado ?? false;
  const dias = diasUnoSiguientes(opciones.fecha, opciones.meses ?? MESES_PREVISION);
  dias.forEach((dia, k) => {
    avanzarMes(economia);
    avanzarPresupuesto(presupuesto, economia, estado);
    if (mercado) {
      avanzarMercado(id, mercado, economia, presupuesto, 0, opciones.dureza ?? 1);
      gestionarCrisis(mercado, economia, presupuesto, {
        esJugador: true,
        dureza: opciones.dureza,
      });
      cerrado ||= mercado.cerrado;
    }
    haciendaDelMes(presupuesto, economia, mercado, {
      esJugador: true,
      fecha: dia,
      decidido: k === 0 ? opciones.decidido : undefined,
      cambios: k === 0 ? opciones.cambios : undefined,
      estado,
    });
  });
  return {
    ingresos: totalIngresos(presupuesto),
    gastos: totalGastos(presupuesto),
    saldo: saldo(presupuesto),
    deuda: presupuesto.deuda,
    pibNominal: pibNominal(economia),
    prima: mercado?.prima ?? null,
    rating: mercado?.rating ?? null,
    cerrado,
  };
}
