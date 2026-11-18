/** Negociar con los acreedores y pedir ayuda (tarea f20-t3). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  avanzarAyuda,
  cerrarNegociacionDelMes,
  costeParaAcreedores,
  negociar,
  ofertasDeAyuda,
  pedirAyuda,
  proximaNegociacion,
  puedeNegociar,
  responder,
  RONDAS,
  sistemaAcreedores,
  toleranciaAcreedores,
  type Propuesta,
} from '../src/sim/acreedores';
import config from '../src/sim/config/deuda.json';
import { completarMercado, faltaMercado, sistemaMercado, UMBRAL_CIERRE } from '../src/sim/deuda';
import { pibNominal, sistemaEconomia } from '../src/sim/economia';
import { haciendaDelMes, sistemaHacienda } from '../src/sim/hacienda';
import { crearMotor } from '../src/sim/motor';
import { crearPartida } from '../src/sim/partida';
import { saldo, sistemaPresupuesto } from '../src/sim/presupuesto';
import { paisCompleto, type PaisCompleto } from './ayudas/pais-completo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const a = config.acreedores;

/** Un país del jugador con la prima en `prima` puntos (y el tipo de mercado que le toca). */
function enApuros(id: string, prima: number): PaisCompleto {
  const pais = paisCompleto(paises, id, 1, { jugador: true });
  pais.mercado.prima = prima;
  pais.mercado.tipoMercado = 2 + prima;
  return pais;
}
/** Aplica lo pendiente del mes siguiente (como Hacienda el día 1). */
const mesSiguiente = (pais: PaisCompleto, fecha: string): void => {
  haciendaDelMes(pais.presupuesto, pais.economia, pais.mercado, {
    esJugador: true,
    fecha,
    estado: pais.estado,
  });
};
const plazo = (anios: number): Propuesta => ({ tipo: 'plazo', anios });
const quita = (parte: number): Propuesta => ({ tipo: 'quita', parte });

describe('lo que aguantan los acreedores (tarea f20-t3)', () => {
  it('nada si no ven riesgo de impago; más cuanto más cerca está el cierre', () => {
    expect(toleranciaAcreedores({ prima: 1 })).toBe(0);
    expect(toleranciaAcreedores({ prima: 9 })).toBeGreaterThan(0);
    expect(toleranciaAcreedores({ prima: 12 })).toBeGreaterThan(toleranciaAcreedores({ prima: 9 }));
    expect(toleranciaAcreedores({ prima: 40 })).toBe(a.toleranciaMaxima);
  });

  it('cada propuesta tiene su coste: la quita, tal cual; el interés, por la vida media; el plazo, por lo que se deja de cobrar', () => {
    const { presupuesto, mercado } = enApuros('ESP', 8);
    expect(costeParaAcreedores(quita(0.2), presupuesto, mercado)).toBe(0.2);
    expect(costeParaAcreedores({ tipo: 'interes', puntos: 1 }, presupuesto, mercado)).toBeCloseTo(
      0.01 * 4.8,
      1,
    );
    const cinco = costeParaAcreedores(plazo(5), presupuesto, mercado);
    expect(cinco).toBeGreaterThan(0);
    expect(costeParaAcreedores(plazo(10), presupuesto, mercado)).toBeCloseTo(2 * cinco, 10);
  });
});

describe('negociar por rondas (tarea f20-t3)', () => {
  it('lo que cabe, lo aceptan; un poco más, contraofertan; mucho más, lo rechazan', () => {
    const { presupuesto, mercado } = enApuros('GRC', 9);
    const tolerancia = toleranciaAcreedores(mercado);
    expect(responder(quita(tolerancia * 0.9), mercado, presupuesto).respuesta).toBe('acepta');
    const media = responder(quita(tolerancia * 1.5), mercado, presupuesto);
    expect(media.respuesta).toBe('contraoferta');
    expect((media.contraoferta as { parte: number }).parte).toBeLessThanOrEqual(tolerancia);
    expect(responder(quita(0.5), mercado, presupuesto).respuesta).toBe('rechaza');
  });

  it('oferta, contraoferta y acuerdo: vale desde el mes siguiente y alarga los vencimientos', () => {
    const grecia = enApuros('GRC', 11);
    const { presupuesto, mercado } = grecia;
    const tolerancia = toleranciaAcreedores(mercado);
    const unAnio = costeParaAcreedores(plazo(1), presupuesto, mercado);
    const anios = Math.min(10, Math.ceil((tolerancia * 1.5) / unAnio));
    const primera = negociar(
      mercado,
      presupuesto,
      { tipo: 'proponer', propuesta: plazo(anios) },
      '2010-06-10',
    )!;
    expect(primera.ronda).toBe(1);
    expect(primera.respuesta).toBe('contraoferta');
    const contraoferta = primera.contraoferta as { tipo: 'plazo'; anios: number };
    expect(contraoferta.anios).toBeLessThan(anios);
    const cerca = presupuesto.vencimientos.slice(0, 12).reduce((s, v) => s + v, 0);
    const final = negociar(mercado, presupuesto, { tipo: 'aceptar' }, '2010-06-12')!;
    expect(final.estado).toBe('acuerdo');
    expect(final.acuerdo).toEqual(contraoferta);
    // Hasta el día 1 no cambia nada; ese día, lo que vencía este año se va más lejos.
    expect(presupuesto.pendientes.at(-1)).toEqual({
      cambio: { tipo: 'acuerdo', propuesta: contraoferta },
      desde: '2010-07-01',
    });
    mesSiguiente(grecia, '2010-07-01');
    expect(presupuesto.vencimientos.slice(0, 12).reduce((s, v) => s + v, 0)).toBeLessThan(
      cerca * 0.1,
    );
    // Y no se puede volver a negociar hasta dentro de un año.
    expect(puedeNegociar(mercado, '2011-05-01')).toBe(false);
    expect(puedeNegociar(mercado, '2011-06-01')).toBe(true);
    expect(proximaNegociacion(mercado)).toBe('2011-06-01');
  });

  it('tres rondas sin acuerdo rompen la negociación; durante una crisis no se negocia', () => {
    const { presupuesto, mercado } = enApuros('GRC', 9);
    for (let ronda = 1; ronda <= RONDAS; ronda++) {
      negociar(mercado, presupuesto, { tipo: 'proponer', propuesta: quita(0.5) }, '2010-06-10');
    }
    expect(mercado.negociacion!.estado).toBe('ruptura');
    expect(mercado.negociacion!.ronda).toBe(RONDAS);
    const otra = enApuros('GRC', 11);
    otra.mercado.programa = { tipo: 'fmi', meses: 30 };
    expect(puedeNegociar(otra.mercado, '2010-06-10')).toBe(false);
  });

  it('si el mes acaba con la negociación abierta, los acreedores se cansan', () => {
    const { presupuesto, mercado } = enApuros('GRC', 11);
    negociar(mercado, presupuesto, { tipo: 'proponer', propuesta: quita(0.3) }, '2010-06-10');
    expect(mercado.negociacion!.estado).toBe('abierta');
    const recargo = mercado.recargo;
    expect(cerrarNegociacionDelMes(mercado)).toBe(true);
    expect(mercado.negociacion!.estado).toBe('ruptura');
    expect(mercado.recargo).toBe(recargo + a.recargoRuptura);
  });
});

describe('si se hace mal, empeora (tarea f20-t3)', () => {
  it('pedir una quita sin estar en apuros: la rechazan y la prima sube', () => {
    const alemania = paisCompleto(paises, 'DEU', 1, { jugador: true });
    const { presupuesto, mercado } = alemania;
    for (let ronda = 1; ronda <= RONDAS; ronda++) {
      const n = negociar(
        mercado,
        presupuesto,
        { tipo: 'proponer', propuesta: quita(0.05) },
        '2010-03-10',
      );
      expect(n!.respuesta).toBe('rechaza');
    }
    expect(mercado.recargo).toBeGreaterThan(0);
    const sola = paisCompleto(paises, 'DEU', 1, { jugador: true });
    alemania.avanzar(3);
    sola.avanzar(3);
    expect(alemania.mercado.prima).toBeGreaterThan(sola.mercado.prima);
  });

  it('una quita negociada baja la deuda, pero sube la prima de después', () => {
    const conQuita = enApuros('GRC', 11);
    const sin = enApuros('GRC', 11);
    const parte = Math.floor(toleranciaAcreedores(conQuita.mercado) * 100) / 100;
    const n = negociar(
      conQuita.mercado,
      conQuita.presupuesto,
      { tipo: 'proponer', propuesta: quita(parte) },
      '2010-03-10',
    );
    expect(n!.estado).toBe('acuerdo');
    for (const pais of [conQuita, sin]) {
      mesSiguiente(pais, '2010-04-01');
      pais.avanzar(6);
    }
    const deuda = (p: PaisCompleto) => p.presupuesto.deuda / pibNominal(p.economia);
    expect(deuda(conQuita)).toBeLessThan(deuda(sin) - 0.2);
    expect(conQuita.mercado.recargo).toBeGreaterThan(sin.mercado.recargo + 1);
    expect(conQuita.economia.confianzaEmpresas).toBeLessThan(sin.economia.confianzaEmpresas);
  });

  it('una ayuda que pide bajar el déficit y no se cumple: la retiran y la prima sube', () => {
    const portugal = enApuros('PRT', 9);
    const fmi = ofertasDeAyuda('PRT', { PRT: portugal }, '2010-03-01').find(
      (o) => o.fuente === 'fmi',
    )!;
    pedirAyuda(fmi, portugal.mercado, portugal.economia, portugal.presupuesto, '2010-03-01');
    // El déficit no baja: sube el gasto.
    for (const m of Object.values(portugal.presupuesto.ministerios)) m.programas *= 1.5;
    const recargo = portugal.mercado.recargo;
    let retirada = false;
    for (const fecha of ['2010-04-01', '2010-12-01', '2011-01-01']) {
      retirada = avanzarAyuda(
        portugal.mercado,
        portugal.economia,
        portugal.presupuesto,
        portugal.estado,
        fecha,
      );
    }
    expect(retirada).toBe(true);
    expect(portugal.mercado.ayuda!.retirada).toBe('2011-01-01');
    expect(portugal.mercado.recargo).toBe(recargo + config.ayudas.recargoRetirada);
    // Y el FMI no vuelve a prestar en dos años.
    const despues = ofertasDeAyuda('PRT', { PRT: portugal }, '2012-06-01');
    expect(despues.some((o) => o.fuente === 'fmi')).toBe(false);
    expect(
      ofertasDeAyuda('PRT', { PRT: portugal }, '2013-01-01').some((o) => o.fuente === 'fmi'),
    ).toBe(true);
  });
});

describe('pedir ayuda (tarea f20-t3)', () => {
  const mundo = () => {
    const ids = ['ESP', 'GBR', 'DEU', 'CHN', 'NOR', 'JPN', 'SAU'];
    return Object.fromEntries(ids.map((id) => [id, paisCompleto(paises, id)]));
  };

  it('el FMI a todos antes de la crisis; el fondo del euro, a sus miembros desde mayo de 2010; y los países con superávit', () => {
    const paisesMundo = mundo();
    const antes = ofertasDeAyuda('ESP', paisesMundo, '2010-03-01');
    expect(antes.map((o) => o.fuente)).toContain('fmi');
    expect(antes.map((o) => o.fuente)).not.toContain('eurozona');
    const despues = ofertasDeAyuda('ESP', paisesMundo, '2010-06-01');
    expect(despues.map((o) => o.fuente)).toContain('eurozona');
    // El Reino Unido no es del euro.
    expect(ofertasDeAyuda('GBR', paisesMundo, '2010-06-01').map((o) => o.fuente)).not.toContain(
      'eurozona',
    );
    // Los que prestan tienen superávit (y prestan más caro que el FMI).
    const deUnPais = despues.filter((o) => o.fuente === 'pais');
    for (const oferta of deUnPais) {
      expect(saldo(paisesMundo[oferta.prestamista!]!.presupuesto)).toBeGreaterThan(0);
      expect(oferta.tipoInteres).toBeGreaterThan(config.ayudas.fmi.tipo / 100 - 0.02);
      expect(oferta.recorteAnual).toBeNull();
    }
    // Durante una crisis, nada: ya manda el rescate (o el impago).
    paisesMundo.ESP!.mercado.programa = { tipo: 'fmi', meses: 36 };
    expect(ofertasDeAyuda('ESP', paisesMundo, '2010-06-01')).toEqual([]);
  });

  it('el dinero llega en tramos (deuda a su tipo) y, mientras llega, la prima baja', () => {
    const conAyuda = enApuros('PRT', 9);
    const sin = enApuros('PRT', 9);
    const eurozona = ofertasDeAyuda('PRT', { PRT: conAyuda }, '2010-06-01').find(
      (o) => o.fuente === 'eurozona',
    )!;
    expect(eurozona.importe).toBeCloseTo(pibNominal(conAyuda.economia) * 0.15, -3);
    pedirAyuda(eurozona, conAyuda.mercado, conAyuda.economia, conAyuda.presupuesto, '2010-06-01');
    conAyuda.avanzar(3);
    sin.avanzar(3);
    expect(conAyuda.mercado.ayuda!.tramosRestantes).toBe(eurozona.tramos - 3);
    expect(conAyuda.mercado.ayuda!.entregado).toBeCloseTo(
      (eurozona.importe / eurozona.tramos) * 3,
      -3,
    );
    expect(conAyuda.mercado.prima).toBeLessThan(sin.mercado.prima - 0.5);
  });

  it('pedida por el jugador, vale el mes siguiente con lo que ofrecen ese día', () => {
    const motor = crearMotor({
      sistemas: [
        sistemaEconomia,
        sistemaPresupuesto,
        sistemaMercado,
        sistemaAcreedores,
        sistemaHacienda,
      ],
    });
    const partida = crearPartida(
      { paisId: 'PRT', dificultad: 'realista', eventosHistoricos: true, semilla: 3 },
      paises.paises,
    );
    motor.atender({ tipo: 'empezar', partida, pausaAutomatica: false });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    while (motor.partida!.fecha < '2010-06-10') motor.avanzar(250);
    motor.atender({
      tipo: 'cambiosPresupuesto',
      cambios: [{ tipo: 'ayuda', fuente: 'eurozona', prestamista: null }],
    });
    while (motor.partida!.fecha < '2010-07-02') motor.avanzar(250);
    const ayuda = motor.partida!.paises.PRT!.mercado!.ayuda!;
    expect(ayuda.fuente).toBe('eurozona');
    expect(ayuda.desde).toBe('2010-07-01');
    expect(ayuda.tramosRestantes).toBe(config.ayudas.eurozona.tramos - 1);
  });
});

describe('el motor y la IA (tarea f20-t3)', () => {
  it('la orden «negociar» da en el motor la misma respuesta que ve la pantalla', () => {
    const motor = crearMotor({
      sistemas: [
        sistemaEconomia,
        sistemaPresupuesto,
        sistemaMercado,
        sistemaAcreedores,
        sistemaHacienda,
      ],
    });
    const partida = crearPartida(
      { paisId: 'GRC', dificultad: 'realista', eventosHistoricos: true, semilla: 3 },
      paises.paises,
    );
    motor.atender({ tipo: 'empezar', partida, pausaAutomatica: false });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    while (motor.partida!.fecha < '2010-03-10') motor.avanzar(250);
    const copia = structuredClone(motor.partida!.paises.GRC!);
    const accion = { tipo: 'proponer' as const, propuesta: plazo(4) };
    const enPantalla = negociar(copia.mercado!, copia.presupuesto!, accion, motor.partida!.fecha);
    motor.atender({ tipo: 'negociar', accion });
    expect(motor.partida!.paises.GRC!.mercado!.negociacion).toEqual(enPantalla);
  });

  it('la IA pide ayuda y negocia más plazo cuando la prima se acerca al cierre', () => {
    const motor = crearMotor({
      sistemas: [
        sistemaEconomia,
        sistemaPresupuesto,
        sistemaMercado,
        sistemaAcreedores,
        sistemaHacienda,
      ],
    });
    const partida = crearPartida(
      { paisId: 'DEU', dificultad: 'realista', eventosHistoricos: true, semilla: 3 },
      paises.paises,
    );
    motor.atender({ tipo: 'empezar', partida, pausaAutomatica: false });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    const ayudados = new Set<string>();
    const negociados = new Set<string>();
    while (motor.partida!.fecha < '2012-06-01') {
      motor.avanzar(1000);
      for (const [id, e] of Object.entries(motor.partida!.paises)) {
        if (e.mercado?.ayuda) ayudados.add(`${id}:${e.mercado.ayuda.fuente}`);
        if (e.mercado?.negociacion?.estado === 'acuerdo') negociados.add(id);
      }
    }
    // Grecia, del euro, pide el fondo de rescate; y unos cuantos negocian.
    expect(ayudados.has('GRC:eurozona')).toBe(true);
    expect(negociados.size).toBeGreaterThan(2);
    // Alemania (el jugador) no hace nada sola.
    expect(motor.partida!.paises.DEU!.mercado!.ayuda).toBeNull();
    // Nadie en apuros sin intentar nada... salvo los que ya están en crisis.
    for (const e of Object.values(motor.partida!.paises)) {
      if (!e.mercado || e.mercado.programa) continue;
      if (e.mercado.prima >= config.iaAcreedores.primaAyuda * UMBRAL_CIERRE + 3) {
        expect(e.mercado.ayuda).not.toBeNull();
      }
    }
  });

  it('una partida de la v0.20 recibe la negociación y la ayuda vacías', () => {
    const partida = crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 9 },
      paises.paises,
    );
    const antigua = structuredClone(partida);
    for (const estado of Object.values(antigua.paises)) {
      if (!estado.mercado) continue;
      delete (estado.mercado as Partial<typeof estado.mercado>).ayuda;
      delete (estado.mercado as Partial<typeof estado.mercado>).negociacion;
    }
    expect(faltaMercado(antigua)).toBe(true);
    completarMercado(antigua, paises.paises);
    expect(faltaMercado(antigua)).toBe(false);
    expect(antigua).toEqual(partida);
  });
});
