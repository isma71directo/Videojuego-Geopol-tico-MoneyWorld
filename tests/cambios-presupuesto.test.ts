/** Los cambios del presupuesto de cada ministerio, cada uno con su plazo (ajuste f19-a1). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import config from '../src/sim/config/presupuesto.json';
import { sistemaMercado } from '../src/sim/deuda';
import { sistemaEconomia } from '../src/sim/economia';
import {
  desdeCuando,
  diaUnoSiguiente,
  fechaDeAplicacion,
  fechaDelMes,
  haciendaDelMes,
  sistemaHacienda,
} from '../src/sim/hacienda';
import { crearMotor } from '../src/sim/motor';
import { crearPartida } from '../src/sim/partida';
import { prever } from '../src/sim/prevision';
import {
  MINISTERIOS,
  sistemaPresupuesto,
  sueldoMedio,
  type CambioPresupuesto,
} from '../src/sim/presupuesto';
import { paisCompleto } from './ayudas/pais-completo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const h = config.hacienda;

/**
 * España del jugador, con `cambios` ordenados en enero de 2010: Hacienda los programa el 1 de
 * febrero (como en la partida) y cada uno vale cuando le toca.
 */
function espanaCon(cambios: CambioPresupuesto[]) {
  const espana = paisCompleto(paises, 'ESP', 1, { jugador: true });
  let ordenados = false;
  return {
    ...espana,
    avanzar(meses: number) {
      for (let k = 0; k < meses; k++) {
        espana.avanzar(1);
        if (ordenados) continue;
        // (El primer paso es el 1 de febrero: no hay enero que repetir.)
        haciendaDelMes(espana.presupuesto, espana.economia, espana.mercado, {
          esJugador: true,
          fecha: fechaDelMes(espana.economia.meses),
          cambios,
          estado: espana.estado,
        });
        ordenados = true;
      }
    },
  };
}

describe('los empleados públicos (ajuste f19-a1, estimados)', () => {
  it('cada ministerio tiene sus empleados y su sueldo medio; España, unos 3 millones', () => {
    const { presupuesto } = paisCompleto(paises, 'ESP');
    const total = MINISTERIOS.reduce((t, m) => t + presupuesto.empleados[m], 0);
    // Real (2010): unos 3,1 millones de empleados públicos.
    expect(total).toBeGreaterThan(2e6);
    expect(total).toBeLessThan(4.5e6);
    for (const m of MINISTERIOS) {
      expect(sueldoMedio(presupuesto, m)).toBeGreaterThan(20_000);
      expect(sueldoMedio(presupuesto, m)).toBeLessThan(80_000);
    }
  });
});

describe('cada cambio, cuando le toca (ajuste f19-a1)', () => {
  const nivel = 'alto' as const;
  it('anual, el 1 de enero; extraordinario, el mes siguiente; puestos, tras la oposición', () => {
    const anual: CambioPresupuesto = {
      tipo: 'partida',
      ministerio: 'sanidad',
      partida: 'programas',
      factor: 1.1,
      cuando: 'anio',
    };
    const extraordinario: CambioPresupuesto = { ...anual, cuando: 'mes' };
    const puestos: CambioPresupuesto = { tipo: 'puestos', ministerio: 'sanidad', cantidad: 5000 };
    const despidos: CambioPresupuesto = { ...puestos, cantidad: -5000 };
    expect(fechaDeAplicacion(anual, '2010-03-15', nivel)).toBe('2011-01-01');
    expect(fechaDeAplicacion(anual, '2010-12-20', nivel)).toBe('2011-01-01');
    expect(fechaDeAplicacion(extraordinario, '2010-03-15', nivel)).toBe('2010-04-01');
    // (Del 1 de abril, la oposición: 9 meses en un país rico.)
    expect(fechaDeAplicacion(puestos, '2010-03-15', nivel)).toBe('2011-01-01');
    expect(fechaDeAplicacion(despidos, '2010-03-15', nivel)).toBe('2010-04-01');
    expect(diaUnoSiguiente('2010-12-31')).toBe('2011-01-01');
    // (Una oposición que pasa del año.)
    expect(desdeCuando(puestos, '2010-11-01', nivel)).toBe('2011-08-01');
  });

  it('una subida extraordinaria vale el mes siguiente; una anual, en enero', () => {
    const extra = espanaCon([
      { tipo: 'sueldos', ministerio: 'educacion', subida: 0.05, cuando: 'mes' },
    ]);
    const anual = espanaCon([
      { tipo: 'sueldos', ministerio: 'educacion', subida: 0.05, cuando: 'anio' },
    ]);
    const personal = extra.presupuesto.ministerios.educacion.personal;
    extra.avanzar(1);
    anual.avanzar(1);
    expect(extra.presupuesto.ministerios.educacion.personal).toBeCloseTo(personal * 1.05, -3);
    expect(anual.presupuesto.ministerios.educacion.personal).toBeCloseTo(personal, -3);
    expect(anual.presupuesto.pendientes).toHaveLength(1);
    anual.avanzar(11);
    expect(fechaDelMes(anual.economia.meses)).toBe('2011-01-01');
    expect(anual.presupuesto.ministerios.educacion.personal).toBeCloseTo(personal * 1.05, -3);
    // Es el presupuesto de 2011: no se prorroga.
    expect(anual.presupuesto.aprobado).toEqual({ anio: 2011, prorrogado: false });
  });

  it('los puestos nuevos llegan tras la oposición, cuestan sus sueldos y sacan gente del paro', () => {
    const contratar = espanaCon([{ tipo: 'puestos', ministerio: 'sanidad', cantidad: 50_000 }]);
    const igual = paisCompleto(paises, 'ESP', 1, { jugador: true });
    const empleados = contratar.presupuesto.empleados.sanidad;
    contratar.avanzar(1);
    igual.avanzar(1);
    // Aún en la oposición: nada.
    expect(contratar.presupuesto.empleados.sanidad).toBe(empleados);
    contratar.avanzar(h.mesesOposicion.alto);
    igual.avanzar(h.mesesOposicion.alto);
    expect(contratar.presupuesto.empleados.sanidad).toBe(empleados + 50_000);
    expect(contratar.presupuesto.ministerios.sanidad.personal).toBeGreaterThan(
      igual.presupuesto.ministerios.sanidad.personal,
    );
    // La mitad los ocupan parados: unas 25.000 personas menos en el paro (y algo más por la
    // demanda de sus sueldos).
    const menos = (igual.economia.paro - contratar.economia.paro) * contratar.presupuesto.activos;
    expect(menos).toBeGreaterThan(20_000);
  });
});

describe('si se hace mal, empeora (ajuste f19-a1)', () => {
  it('despedir ahorra sueldos, pero sube el paro y cuesta la indemnización', () => {
    const despedir = espanaCon([{ tipo: 'puestos', ministerio: 'interior', cantidad: -40_000 }]);
    const igual = paisCompleto(paises, 'ESP', 1, { jugador: true });
    const sueldo = sueldoMedio(despedir.presupuesto, 'interior');
    despedir.avanzar(1);
    igual.avanzar(1);
    expect(despedir.presupuesto.ministerios.interior.personal).toBeLessThan(
      igual.presupuesto.ministerios.interior.personal,
    );
    const mas = (despedir.economia.paro - igual.economia.paro) * despedir.presupuesto.activos;
    expect(mas).toBeGreaterThan(35_000);
    // La indemnización: medio año de sueldo de cada despedido.
    const pagado = igual.estado.tesoreria - despedir.estado.tesoreria;
    expect(pagado).toBeGreaterThan(40_000 * sueldo * h.indemnizacion * 0.9);
  });

  it('lo que no tiene sentido no se aplica: factores negativos, subidas desorbitadas o despedir de más', () => {
    const raro = espanaCon([
      { tipo: 'partida', ministerio: 'defensa', partida: 'inversion', factor: -2, cuando: 'mes' },
      { tipo: 'sueldos', ministerio: 'defensa', subida: 5, cuando: 'mes' },
      { tipo: 'puestos', ministerio: 'cultura', cantidad: -1e9 },
    ]);
    const defensa = { ...raro.presupuesto.ministerios.defensa };
    raro.avanzar(1);
    // El factor se queda en 0 (no en negativo); la subida, en su límite; los despidos, en todos.
    expect(raro.presupuesto.ministerios.defensa.inversion).toBe(0);
    expect(raro.presupuesto.ministerios.defensa.personal).toBeCloseTo(
      defensa.personal * (1 + h.limiteSubidaSueldos),
      -3,
    );
    expect(raro.presupuesto.empleados.cultura).toBe(0);
  });
});

describe('en la partida y en la previsión (ajuste f19-a1)', () => {
  it('la orden del motor se programa el día 1 y vale cuando le toca', () => {
    const motor = crearMotor({
      sistemas: [sistemaEconomia, sistemaPresupuesto, sistemaMercado, sistemaHacienda],
    });
    const partida = crearPartida(
      { paisId: 'ESP', dificultad: 'realista', eventosHistoricos: true, semilla: 8 },
      paises.paises,
    );
    motor.atender({ tipo: 'empezar', partida, pausaAutomatica: false });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    while (motor.partida!.fecha < '2010-02-10') motor.avanzar(250);
    const espana = () => motor.partida!.paises.ESP!.presupuesto!;
    const programas = espana().ministerios.cultura.programas;
    motor.atender({
      tipo: 'cambiosPresupuesto',
      cambios: [
        { tipo: 'partida', ministerio: 'cultura', partida: 'programas', factor: 2, cuando: 'mes' },
        { tipo: 'pensiones', revalorizacion: 0 },
      ],
    });
    while (motor.partida!.fecha < '2010-03-02') motor.avanzar(250);
    expect(motor.partida!.cambiosPresupuesto).toBeUndefined();
    expect(espana().ministerios.cultura.programas).toBeCloseTo(programas * 2, -3);
    expect(espana().revalorizacion).toBe(0);
    expect(espana().pendientes).toHaveLength(0);
  });

  it('la previsión cuenta con los cambios ordenados hoy', () => {
    const espana = paisCompleto(paises, 'ESP', 1, { jugador: true });
    const datos = {
      economia: espana.economia,
      presupuesto: espana.presupuesto,
      mercado: espana.mercado,
      tesoreria: espana.estado.tesoreria,
    };
    const igual = prever('ESP', datos, { fecha: '2010-01-15' });
    const masGasto = prever('ESP', datos, {
      fecha: '2010-01-15',
      cambios: [
        { tipo: 'partida', ministerio: 'todos', partida: 'todas', factor: 1.1, cuando: 'mes' },
      ],
    });
    expect(masGasto.gastos).toBeGreaterThan(igual.gastos);
    expect(masGasto.deuda).toBeGreaterThan(igual.deuda);
  });
});
