/** La crisis de deuda: mercados cerrados, rescate del FMI o impago (tarea f18-t3). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import config from '../src/sim/config/deuda.json';
import {
  avanzarMercado,
  CLAVE_CRISIS,
  empezarSalida,
  gestionarCrisis,
  mercadoInicial,
  salidaDeLaIa,
  sistemaMercado,
  type SalidaCrisis,
} from '../src/sim/deuda';
import {
  avanzarMes,
  economiaInicial,
  nivelDe,
  pibNominal,
  sistemaEconomia,
} from '../src/sim/economia';
import { crearMotor, type MensajeMotor, type SucesoMotor } from '../src/sim/motor';
import { crearPartida } from '../src/sim/partida';
import {
  avanzarPresupuesto,
  gastoMinisterio,
  MINISTERIOS,
  presupuestoInicial,
  saldo,
  sistemaPresupuesto,
} from '../src/sim/presupuesto';
import { tesoreriaInicial } from '../src/sim/valores-iniciales';
import { paisCompleto } from './ayudas/pais-completo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const k = config.crisis;

const ministerios = (p: ReturnType<typeof paisCompleto>) =>
  MINISTERIOS.reduce((t, m) => t + gastoMinisterio(p.presupuesto, m), 0);
const deficit = (p: ReturnType<typeof paisCompleto>) =>
  -saldo(p.presupuesto) / pibNominal(p.economia);

/**
 * Un país que, al cerrarse los mercados, sigue lo que diga el jugador (`salida`): se le pregunta
 * y contesta en el mes siguiente, como en la partida.
 */
function paisDelJugador(id: string, salida: SalidaCrisis) {
  const pais = paises.paises[id]!;
  const economia = economiaInicial(pais.datos, pais.nivelRenta)!;
  const presupuesto = presupuestoInicial(pais.datos, nivelDe(pais.nivelRenta), economia)!;
  const mercado = mercadoInicial(id, pais.datos as never, pais.region, economia, presupuesto);
  const estado = { tesoreria: tesoreriaInicial(pais.datos as never) };
  let preguntado = false;
  return {
    economia,
    presupuesto,
    mercado,
    avanzar(meses: number) {
      for (let m = 0; m < meses; m++) {
        avanzarMes(economia);
        avanzarPresupuesto(presupuesto, economia, estado);
        avanzarMercado(id, mercado, economia, presupuesto, 0);
        preguntado = gestionarCrisis(mercado, economia, presupuesto, {
          esJugador: true,
          decision: preguntado ? salida : undefined,
        });
      }
    },
  };
}

describe('el rescate del FMI (tarea f18-t3)', () => {
  it('presta barato a cambio de un ajuste: recortes, subidas de impuestos y recesión', () => {
    const rescatada = paisCompleto(paises, 'GRC');
    const sola = paisCompleto(paises, 'GRC');
    const impuestos = rescatada.presupuesto.tipos.rentaPersonas;
    empezarSalida('fmi', rescatada.mercado, rescatada.economia, rescatada.presupuesto);
    expect(rescatada.mercado.programa).toEqual({ tipo: 'fmi', meses: k.mesesFmi });
    rescatada.avanzar(12);
    sola.avanzar(12);
    // Mientras dura, los mercados están cerrados, pero la deuda se renueva al tipo del FMI.
    expect(rescatada.mercado.cerrado).toBe(true);
    expect(rescatada.presupuesto.tipoInteres).toBeLessThan(sola.presupuesto.tipoInteres - 0.005);
    // Nada es gratis: menos gasto, más impuestos, menos déficit… y menos PIB.
    expect(ministerios(rescatada)).toBeLessThan(ministerios(sola) * 0.95);
    expect(rescatada.presupuesto.tipos.rentaPersonas).toBeGreaterThan(impuestos * 1.03);
    expect(deficit(rescatada)).toBeLessThan(deficit(sola) - 0.03);
    expect(rescatada.economia.pib).toBeLessThan(sola.economia.pib);
  });

  it('al acabar, si los mercados siguen cerrados, hay que volver a elegir', () => {
    const grecia = paisCompleto(paises, 'GRC');
    grecia.mercado.programa = { tipo: 'fmi', meses: 1 };
    grecia.mercado.prima = 30;
    const preguntar = gestionarCrisis(grecia.mercado, grecia.economia, grecia.presupuesto, {
      esJugador: true,
    });
    expect(preguntar).toBe(true);
    expect(grecia.mercado.programa).toEqual({ tipo: 'decidiendo', meses: 0 });
    // Con los mercados abiertos de nuevo, se acaba sin más.
    const portugal = paisCompleto(paises, 'PRT');
    portugal.mercado.programa = { tipo: 'fmi', meses: 1 };
    expect(
      gestionarCrisis(portugal.mercado, portugal.economia, portugal.presupuesto, {
        esJugador: true,
      }),
    ).toBe(false);
    expect(portugal.mercado.programa).toBeNull();
  });
});

describe('el impago (tarea f18-t3)', () => {
  it('borra la mitad de la deuda y deja de pagar intereses, pero el rating cae a D y la confianza se hunde', () => {
    const grecia = paisCompleto(paises, 'GRC');
    const deuda = grecia.presupuesto.deuda;
    const tipo = grecia.presupuesto.tipoInteres;
    const empresas = grecia.economia.confianzaEmpresas;
    empezarSalida('impago', grecia.mercado, grecia.economia, grecia.presupuesto);
    expect(grecia.presupuesto.deuda).toBeCloseTo(deuda * (1 - k.quita), 0);
    expect(grecia.mercado.rating).toBe('D');
    expect(grecia.presupuesto.transversales.intereses).toBe(0);
    expect(grecia.economia.confianzaEmpresas).toBeCloseTo(empresas - k.confianzaImpagoEmpresas, 6);
    // Solo se puede gastar lo que se recauda: el déficit se cierra en pocos meses, con recortes
    // en los ministerios y en las pensiones.
    const pensiones = grecia.presupuesto.transversales.pensiones;
    const gasto = ministerios(grecia);
    grecia.avanzar(18);
    expect(grecia.mercado.rating).toBe('D');
    expect(grecia.mercado.cerrado).toBe(true);
    expect(deficit(grecia)).toBeLessThan(0.02);
    expect(ministerios(grecia)).toBeLessThan(gasto * 0.9);
    expect(grecia.presupuesto.transversales.pensiones).toBeLessThan(pensiones);
    // Al acabar, la deuda que queda vuelve a pagar intereses (al tipo de antes) y los mercados
    // abren, con un recargo en la prima que se va apagando.
    grecia.avanzar(k.mesesImpago - 18);
    expect(grecia.mercado.programa).toBeNull();
    expect(grecia.mercado.rating).not.toBe('D');
    expect(grecia.presupuesto.tipoInteres).toBeCloseTo(tipo, 6);
    expect(grecia.mercado.recargo).toBeGreaterThan(k.recargoImpago * 0.9);
  });

  it('la IA deja de pagar solo si su deuda es impagable; si no, pide el rescate', () => {
    const grecia = paisCompleto(paises, 'GRC');
    // En 2010, con su deuda del 148 % del PIB, aún pediría el rescate…
    expect(salidaDeLaIa(grecia.economia, grecia.presupuesto)).toBe('fmi');
    // … pero sin hacer nada su deuda se dispara y, cuando se cierran los mercados, deja de pagar.
    grecia.avanzar(24);
    expect(grecia.mercado.programa?.tipo).toBe('impago');
    // Con poca deuda, el rescate (Pakistán).
    const pakistan = paisCompleto(paises, 'PAK');
    expect(salidaDeLaIa(pakistan.economia, pakistan.presupuesto)).toBe('fmi');
  });
});

describe('si se hace mal, empeora (tarea f18-t3)', () => {
  it('con una deuda impagable, el rescate no basta: más deuda y más paro que con el impago (Grecia)', () => {
    const conFmi = paisDelJugador('GRC', 'fmi');
    const conImpago = paisDelJugador('GRC', 'impago');
    conFmi.avanzar(60);
    conImpago.avanzar(60);
    const deuda = (p: typeof conFmi) => p.presupuesto.deuda / pibNominal(p.economia);
    expect(deuda(conFmi)).toBeGreaterThan(deuda(conImpago) * 2);
    expect(conFmi.economia.paro).toBeGreaterThan(conImpago.economia.paro);
    expect(conFmi.mercado.cerrado).toBe(true);
  });

  it('un rescate hace de cortafuegos; un impago contagia a los que se le parecen', () => {
    const primaDePortugal = (salida: SalidaCrisis) => {
      const partida = crearPartida(
        { paisId: 'ESP', dificultad: 'realista', eventosHistoricos: true, semilla: 1 },
        paises.paises,
      );
      const grecia = partida.paises.GRC!;
      empezarSalida(salida, grecia.mercado!, grecia.economia!, grecia.presupuesto!);
      for (let mes = 0; mes < 12; mes++) {
        sistemaMercado([{ ritmo: 'mensual', fecha: partida.fecha }], partida, null as never);
      }
      return partida.paises.PRT!.mercado!.prima;
    };
    expect(primaDePortugal('impago')).toBeGreaterThan(primaDePortugal('fmi') * 1.1);
  });
});

describe('el jugador elige (tarea f18-t3)', () => {
  const motorDeGrecia = () => {
    const motor = crearMotor({
      sistemas: [sistemaEconomia, sistemaPresupuesto, sistemaMercado],
    });
    const partida = crearPartida(
      { paisId: 'GRC', dificultad: 'realista', eventosHistoricos: true, semilla: 5 },
      paises.paises,
    );
    // Sin la pausa automática: la decisión para la partida igualmente.
    motor.atender({ tipo: 'empezar', partida, pausaAutomatica: false });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    return motor;
  };
  /** Avanza hasta que llegue la pregunta de la crisis (la partida se para). */
  const hastaLaPregunta = (motor: ReturnType<typeof crearMotor>): SucesoMotor => {
    for (let i = 0; i < 20_000; i++) {
      const mensajes: MensajeMotor[] = motor.avanzar(250);
      const suceso = mensajes.find((m): m is SucesoMotor => m.tipo === 'suceso');
      if (suceso?.suceso.decision) return suceso;
    }
    throw new Error('no llega la crisis');
  };

  it('al cerrarse los mercados, la partida se para y pregunta; lo elegido se aplica', () => {
    const motor = motorDeGrecia();
    const { suceso, pausado } = hastaLaPregunta(motor);
    expect(pausado).toBe(true);
    expect(motor.velocidad).toBe(0);
    expect(suceso.importante).toBe(true);
    expect(suceso.alerta?.tipo).toBe('crisisDeuda');
    expect(suceso.alerta?.valor).toBeGreaterThan(15);
    expect(suceso.decision).toEqual({ clave: CLAVE_CRISIS, opciones: ['fmi', 'impago'] });
    expect(motor.partida!.paises.GRC!.mercado!.programa?.tipo).toBe('decidiendo');
    // Elige el rescate: se aplica al mes siguiente.
    motor.atender({ tipo: 'decidir', clave: CLAVE_CRISIS, opcion: 'fmi' });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    const fecha = motor.partida!.fecha;
    while (motor.partida!.fecha.slice(0, 7) === fecha.slice(0, 7)) motor.avanzar(250);
    motor.avanzar(250);
    expect(motor.partida!.paises.GRC!.mercado!.programa?.tipo).toBe('fmi');
    expect(motor.partida!.decisiones?.[CLAVE_CRISIS]).toBeUndefined();
  });

  it('si no elige (o elige algo que no existe), se le vuelve a preguntar el mes siguiente', () => {
    const motor = motorDeGrecia();
    const primera = hastaLaPregunta(motor);
    motor.atender({ tipo: 'decidir', clave: CLAVE_CRISIS, opcion: 'huir' });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    const segunda = hastaLaPregunta(motor);
    expect(segunda.suceso.fecha > primera.suceso.fecha).toBe(true);
    expect(motor.partida!.paises.GRC!.mercado!.programa?.tipo).toBe('decidiendo');
  });
});
