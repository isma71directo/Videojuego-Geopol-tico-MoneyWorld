/**
 * Ayuda de los tests: un país completo (economía, presupuesto y mercado de su deuda) que avanza
 * mes a mes como en la partida, sin contagio de los demás y como la IA: elige su salida en una
 * crisis de deuda (Fase 18) y aprueba su presupuesto cada enero (Fase 19).
 */
import type { ConjuntoPaises } from '../../src/datos/paises';
import {
  avanzarMercado,
  gestionarCrisis,
  mercadoInicial,
  type MercadoDeuda,
} from '../../src/sim/deuda';
import { avanzarMes, economiaInicial, nivelDe, type EconomiaPais } from '../../src/sim/economia';
import { fechaDelMes, haciendaDelMes } from '../../src/sim/hacienda';
import {
  avanzarPresupuesto,
  presupuestoInicial,
  type PresupuestoPais,
} from '../../src/sim/presupuesto';
import { tesoreriaInicial } from '../../src/sim/valores-iniciales';

export interface PaisCompleto {
  economia: EconomiaPais;
  presupuesto: PresupuestoPais;
  mercado: MercadoDeuda;
  estado: { tesoreria: number };
  /** Avanza unos meses (con la dureza de la dificultad: 1 en «realista»). */
  avanzar(meses: number): void;
  /** Avanza unos años y devuelve el crecimiento del PIB real de cada uno. */
  anios(cuantos: number): number[];
}

/**
 * Con `jugador`, Hacienda funciona como la del jugador: no aprueba presupuesto por su cuenta (se
 * prorroga) y solo cambia lo que se decida con aprobarPresupuesto.
 */
export function paisCompleto(
  paises: ConjuntoPaises,
  id: string,
  dureza = 1,
  opciones: { jugador?: boolean } = {},
): PaisCompleto {
  const pais = paises.paises[id]!;
  const economia = economiaInicial(pais.datos, pais.nivelRenta)!;
  const presupuesto = presupuestoInicial(pais.datos, nivelDe(pais.nivelRenta), economia)!;
  const mercado = mercadoInicial(id, pais.datos as never, pais.region, economia, presupuesto);
  const estado = { tesoreria: tesoreriaInicial(pais.datos as never) };
  const avanzar = (meses: number): void => {
    for (let m = 0; m < meses; m++) {
      avanzarMes(economia);
      avanzarPresupuesto(presupuesto, economia, estado);
      avanzarMercado(id, mercado, economia, presupuesto, 0, dureza);
      gestionarCrisis(mercado, economia, presupuesto, { esJugador: false, dureza });
      haciendaDelMes(presupuesto, economia, mercado, {
        esJugador: opciones.jugador ?? false,
        fecha: fechaDelMes(economia.meses),
        estado,
      });
    }
  };
  return {
    economia,
    presupuesto,
    mercado,
    estado,
    avanzar,
    anios(cuantos) {
      const crecimientos: number[] = [];
      for (let a = 0; a < cuantos; a++) {
        const antes = economia.pib;
        avanzar(12);
        crecimientos.push(economia.pib / antes - 1);
      }
      return crecimientos;
    },
  };
}
