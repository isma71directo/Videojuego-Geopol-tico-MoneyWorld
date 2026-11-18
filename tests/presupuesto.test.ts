/** El presupuesto de cada país: ingresos por tipo y gastos por ministerio (Fase 17). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { economiaInicial, nivelDe } from '../src/sim/economia';
import { desempaquetar, empaquetar, JUEGO } from '../src/sim/guardado';
import { crearPartida, FORMATO_PARTIDA } from '../src/sim/partida';
import {
  completarPresupuesto,
  faltaPresupuesto,
  gastoMinisterio,
  INGRESOS,
  MINISTERIOS,
  PARTIDAS,
  presupuestoInicial,
  saldo,
  totalGastos,
  totalIngresos,
  totalPorPartida,
  TRANSVERSALES,
  type PresupuestoPais,
} from '../src/sim/presupuesto';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const jugables = Object.values(paises.paises).filter((p) => p.jugable);
const presupuestoDe = (id: string): PresupuestoPais => {
  const pais = paises.paises[id]!;
  const economia = economiaInicial(pais.datos, pais.nivelRenta);
  return presupuestoInicial(pais.datos, nivelDe(pais.nivelRenta), economia)!;
};
/** En % del PIB de 2010. */
const pib = (id: string, valor: number) => (valor / paises.paises[id]!.datos.pib!) * 100;

describe('el presupuesto de 2010 (tarea f17-t2)', () => {
  it('todos los países jugables lo tienen, con partidas válidas', () => {
    for (const pais of jugables) {
      const economia = economiaInicial(pais.datos, pais.nivelRenta);
      const p = presupuestoInicial(pais.datos, nivelDe(pais.nivelRenta), economia);
      expect(p, pais.id).not.toBeNull();
      const valores = [
        ...Object.values(p!.ingresos),
        ...Object.values(p!.transversales),
        ...MINISTERIOS.flatMap((m) => Object.values(p!.ministerios[m])),
        p!.deuda,
      ];
      for (const v of valores) expect(Number.isFinite(v) && v >= 0, pais.id).toBe(true);
    }
  });

  it('cuadra con el FMI: los ingresos, el gasto y el saldo (el déficit) de 2010', () => {
    const descuadrados: string[] = [];
    for (const pais of jugables) {
      const p = presupuestoDe(pais.id);
      const { ingresosPublicosPib, gastoPublicoPib, saldoFiscalPib } = pais.datos;
      expect(pib(pais.id, totalIngresos(p)), pais.id).toBeCloseTo(ingresosPublicosPib!, 6);
      expect(pib(pais.id, totalGastos(p)), pais.id).toBeCloseTo(gastoPublicoPib!, 6);
      // El saldo del FMI es (casi siempre) sus ingresos menos sus gastos (con datos reales; los
      // estimados de microestados y territorios salen de medianas que no tienen por qué cuadrar).
      const reales = ['ingresosPublicosPib', 'gastoPublicoPib', 'saldoFiscalPib'].every(
        (campo) => !pais.datosEstimados.includes(campo),
      );
      if (reales && Math.abs(pib(pais.id, saldo(p)) - saldoFiscalPib!) > 1.5) {
        descuadrados.push(pais.id);
      }
    }
    // Unos pocos países (como Antigua y Barbuda) no cuadran en la propia fuente.
    expect(descuadrados.length, descuadrados.join(', ')).toBeLessThanOrEqual(5);
    // España, como en la realidad: un déficit del 9,5 % del PIB.
    expect(pib('ESP', saldo(presupuestoDe('ESP')))).toBeCloseTo(-9.5, 0);
  });

  it('la suma de las partidas es el total (prueba del GDD)', () => {
    const p = presupuestoDe('ESP');
    for (const m of MINISTERIOS) {
      const partidas = PARTIDAS.reduce((t, x) => t + p.ministerios[m][x], 0);
      expect(partidas).toBeCloseTo(gastoMinisterio(p, m), 3);
    }
    const porPartida = Object.values(totalPorPartida(p)).reduce((a, b) => a + b, 0);
    const transversal = TRANSVERSALES.reduce((t, x) => t + p.transversales[x], 0);
    expect(porPartida + transversal).toBeCloseTo(totalGastos(p), 0);
    expect(INGRESOS.reduce((t, x) => t + p.ingresos[x], 0)).toBeCloseTo(totalIngresos(p), 3);
  });

  it('sanidad, educación y defensa son las reales de 2010', () => {
    const espana = presupuestoDe('ESP');
    const datos = paises.paises.ESP!.datos;
    expect(pib('ESP', gastoMinisterio(espana, 'sanidad'))).toBeCloseTo(
      datos.gastoSanidadPublicoPib!,
      6,
    );
    expect(pib('ESP', gastoMinisterio(espana, 'educacion'))).toBeCloseTo(
      datos.gastoEducacionPib!,
      6,
    );
    expect(pib('ESP', gastoMinisterio(espana, 'defensa'))).toBeCloseTo(datos.gastoDefensaPib!, 6);
  });

  it('las partidas, entre todos los ministerios, cuadran con el consumo público y los sueldos reales', () => {
    const espana = presupuestoDe('ESP');
    const datos = paises.paises.ESP!.datos;
    const porPartida = totalPorPartida(espana);
    // Personal y mantenimiento: el consumo público de todas las administraciones (ONU)…
    expect(pib('ESP', porPartida.personal + porPartida.mantenimiento)).toBeCloseTo(
      datos.consumoPublicoPib!,
      1,
    );
    // … repartido como los sueldos y las compras del gobierno central (Banco Mundial).
    expect(porPartida.personal / (porPartida.personal + porPartida.mantenimiento)).toBeCloseTo(
      datos.gastoSueldos! / (datos.gastoSueldos! + datos.gastoCompras!),
      2,
    );
    // Educación es sobre todo personal; Transportes, inversión.
    const educacion = espana.ministerios.educacion;
    expect(educacion.personal).toBeGreaterThan(educacion.inversion + educacion.programas);
    const transportes = espana.ministerios.transportes;
    expect(transportes.inversion).toBeGreaterThan(transportes.personal);
  });

  it('España frente a Alemania (prueba del GDD): más paro y más déficit; Alemania, más pensiones', () => {
    const espana = presupuestoDe('ESP');
    const alemania = presupuestoDe('DEU');
    expect(pib('ESP', espana.transversales.desempleo)).toBeGreaterThan(
      pib('DEU', alemania.transversales.desempleo),
    );
    expect(pib('DEU', alemania.transversales.pensiones)).toBeGreaterThan(
      pib('ESP', espana.transversales.pensiones),
    );
    expect(pib('ESP', saldo(espana))).toBeLessThan(pib('DEU', saldo(alemania)));
  });

  it('la deuda es la real de 2010 y sus intereses, la deuda por su tipo', () => {
    const grecia = presupuestoDe('GRC');
    expect(pib('GRC', grecia.deuda)).toBeCloseTo(paises.paises.GRC!.datos.deudaPib!, 6);
    expect(grecia.transversales.intereses).toBeCloseTo(grecia.deuda * grecia.tipoInteres, 0);
    expect(grecia.tipoInteres).toBeGreaterThan(0.02);
    expect(grecia.tipoInteres).toBeLessThan(0.1);
  });
});

describe('en la partida (tarea f17-t2)', () => {
  const nueva = () =>
    crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 9 },
      paises.paises,
    );

  it('cada país empieza con su presupuesto y se guarda con la partida', () => {
    const partida = nueva();
    // (El Tesoro, con los tipos que pide el mercado de la deuda al empezar: tarea f20-t1.)
    const { tesoro, ...presupuesto } = partida.paises.ESP!.presupuesto!;
    const { tesoro: tesoroDe2010, ...de2010 } = presupuestoDe('ESP');
    expect(presupuesto).toEqual(de2010);
    expect({ ...tesoro, tipos: tesoroDe2010.tipos, precioRecompra: 1 }).toEqual(tesoroDe2010);
    expect(tesoro.tipos.letras).toBeLessThan(tesoro.tipos.bonos5);
    expect(tesoro.tipos.bonos5).toBeLessThan(tesoro.tipos.bonos10);
    const { archivo } = empaquetar(partida, { tipo: 'anual' }, '0.18.0', new Date());
    expect(desempaquetar(JSON.parse(JSON.stringify(archivo))).partida).toEqual(partida);
  });

  it('una partida de la v0.17.0 (formato 5) se migra y recibe el presupuesto de 2010', () => {
    const partida = nueva();
    const antigua = structuredClone(partida) as unknown as {
      formato: number;
      paises: Record<string, Record<string, unknown>>;
    };
    antigua.formato = 5;
    for (const estado of Object.values(antigua.paises)) delete estado.presupuesto;
    const cargada = desempaquetar({
      juego: JUEGO,
      formato: 5,
      version: '0.17.0',
      partida: antigua,
    }).partida;
    expect(cargada.formato).toBe(FORMATO_PARTIDA);
    expect(faltaPresupuesto(cargada)).toBe(true);
    completarPresupuesto(cargada, paises.paises);
    expect(faltaPresupuesto(cargada)).toBe(false);
    expect(cargada).toEqual(partida);
  });
});
