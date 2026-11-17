/**
 * Ayuda de los tests: un país completo (economía, presupuesto y mercado de su deuda) que avanza
 * mes a mes como en la partida, sin contagio de los demás y, en una crisis de deuda, eligiendo su
 * salida como la IA (Fase 18).
 */
import type { ConjuntoPaises } from '../../src/datos/paises';
import {
  avanzarMercado,
  gestionarCrisis,
  mercadoInicial,
  type MercadoDeuda,
} from '../../src/sim/deuda';
import { avanzarMes, economiaInicial, nivelDe, type EconomiaPais } from '../../src/sim/economia';
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

export function paisCompleto(paises: ConjuntoPaises, id: string, dureza = 1): PaisCompleto {
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
