/** Tesorería y popularidad iniciales provisionales, estimadas con fórmula (tarea f10-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ConjuntoGobiernos } from '../src/datos/gobiernos';
import type { ConjuntoPaises } from '../src/datos/paises';
import config from '../src/sim/config/inicio.json';
import { crearPartida, FECHA_INICIO, paisesJugables } from '../src/sim/partida';
import { economiaInicial, nivelDe } from '../src/sim/economia';
import { presupuestoInicial } from '../src/sim/presupuesto';
import {
  aniosEnElCargo,
  llegadaDelLider,
  popularidadInicial,
  tesoreriaInicial,
  valoresIniciales,
  type GobiernoParaInicio,
} from '../src/sim/valores-iniciales';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(resolve(ruta), 'utf8')) as T;
const paises = leer<ConjuntoPaises>('public/data/paises-2010.json');
const gobiernos = leer<ConjuntoGobiernos>('public/data/gobiernos-2010.json');

/** Datos «neutros»: cada factor económico en su referencia, así no suma ni resta. */
const neutros = { crecimientoPib: 2, paro: 7, inflacion: 3 };
const gobiernoDesde = (desde: string, regimen = 'parlamentario'): GobiernoParaInicio => ({
  regimen,
  estado: null,
  gobierno: { desde },
});
const puntos = (resultado: ReturnType<typeof popularidadInicial>, factor: string) =>
  resultado.desglose.find((a) => a.factor === factor)?.puntos;

describe('tesorería inicial (tarea f10-t2)', () => {
  it('son los ingresos públicos de un mes, redondeados al millón', () => {
    // 40 % de 1,2 billones al año = 480 000 M$; un mes, 40 000 M$.
    expect(tesoreriaInicial({ pib: 1.2e12, ingresosPublicosPib: 40 })).toBe(40_000_000_000);
    expect(tesoreriaInicial({ pib: 123_456_789, ingresosPublicosPib: 10 })).toBe(1_000_000);
    expect(config.tesoreria.mesesDeIngresos).toBe(1);
  });

  it('sin PIB o sin ingresos, 0', () => {
    expect(tesoreriaInicial({ pib: null, ingresosPublicosPib: 30 })).toBe(0);
    expect(tesoreriaInicial({ pib: 1e9 })).toBe(0);
  });

  it('España: unos 43 000 M$ (36,4 % de un PIB de 1,43 billones, entre 12)', () => {
    const espana = paises.paises.ESP!.datos;
    expect(espana.ingresosPublicosPib).toBeCloseTo(36.36, 1);
    expect(tesoreriaInicial(espana) / 1e9).toBeCloseTo(43.3, 0);
  });
});

describe('popularidad inicial (tarea f10-t2)', () => {
  it('sin nada que la mueva, la base (50)', () => {
    expect(popularidadInicial(neutros, null, FECHA_INICIO)).toEqual({
      valor: 50,
      desglose: [
        { factor: 'base', puntos: 50 },
        { factor: 'crecimiento', puntos: 0 },
        { factor: 'paro', puntos: 0 },
        { factor: 'inflacion', puntos: 0 },
      ],
    });
    // Sin datos económicos, solo la base.
    expect(popularidadInicial({}, null, FECHA_INICIO).desglose).toHaveLength(1);
  });

  it('la economía suma o resta, con un tope por factor', () => {
    const buena = popularidadInicial(
      { crecimientoPib: 5, paro: 4, inflacion: 2 },
      null,
      FECHA_INICIO,
    );
    expect(puntos(buena, 'crecimiento')).toBeCloseTo(6);
    expect(puntos(buena, 'paro')).toBeCloseTo(1.8);
    expect(puntos(buena, 'inflacion')).toBeCloseTo(0.5);
    expect(buena.valor).toBe(58);
    // Valores extremos: cada factor se queda en su tope.
    const crisis = popularidadInicial(
      { crecimientoPib: -20, paro: 50, inflacion: 500 },
      null,
      FECHA_INICIO,
    );
    expect(puntos(crisis, 'crecimiento')).toBe(-10);
    expect(puntos(crisis, 'paro')).toBe(-12);
    expect(puntos(crisis, 'inflacion')).toBe(-10);
    expect(crisis.valor).toBe(18);
  });

  it('desgaste por años en el cargo (con tope) y un empujón el primer año', () => {
    const cinco = popularidadInicial(neutros, gobiernoDesde('2005-01-01'), FECHA_INICIO);
    expect(puntos(cinco, 'desgaste')).toBeCloseTo(-6, 1);
    expect(puntos(cinco, 'lunaDeMiel')).toBeUndefined();
    const treinta = popularidadInicial(neutros, gobiernoDesde('1980-01-01'), FECHA_INICIO);
    expect(puntos(treinta, 'desgaste')).toBe(-12);
    const recien = popularidadInicial(neutros, gobiernoDesde('2009-09-16'), FECHA_INICIO);
    expect(puntos(recien, 'lunaDeMiel')).toBe(6);
    expect(recien.valor).toBe(56);
  });

  it('los regímenes sin elecciones libres suman; el jefe de Estado cuenta si gobierna', () => {
    const cerrado: GobiernoParaInicio = {
      regimen: 'partido-unico',
      estado: { desde: '2000-01-01' },
      gobierno: 'estado',
    };
    expect(llegadaDelLider(cerrado)).toBe('2000-01-01');
    const resultado = popularidadInicial(neutros, cerrado, FECHA_INICIO);
    expect(puntos(resultado, 'regimen')).toBe(5);
    expect(puntos(resultado, 'desgaste')).toBeCloseTo(-12);
    expect(resultado.valor).toBe(43);
    expect(llegadaDelLider({ regimen: null, estado: null, gobierno: null })).toBeNull();
  });

  it('nunca sale de los límites', () => {
    const peor = popularidadInicial(
      { crecimientoPib: -20, paro: 50, inflacion: 500 },
      gobiernoDesde('1970-01-01'),
      FECHA_INICIO,
    );
    expect(peor.valor).toBe(config.popularidad.limites[0]);
  });

  it('años en el cargo', () => {
    expect(aniosEnElCargo('2004-04-16', FECHA_INICIO)).toBeCloseTo(5.71, 2);
    expect(aniosEnElCargo('2010-06-01', FECHA_INICIO)).toBe(0);
    expect(aniosEnElCargo(null, FECHA_INICIO)).toBeNull();
    expect(aniosEnElCargo('no es una fecha', FECHA_INICIO)).toBeNull();
  });
});

describe('valores iniciales con los datos reales (tarea f10-t2)', () => {
  const jugables = paisesJugables(paises.paises);

  it('todos los países jugables tienen ingresos y gasto públicos, y el FMI da la mayoría', () => {
    const conDatoReal = jugables.filter((id) =>
      paises.paises[id]!.origen.ingresosPublicosPib?.startsWith('FMI:'),
    );
    expect(conDatoReal.length).toBeGreaterThan(180);
    for (const id of jugables) {
      const datos = paises.paises[id]!.datos;
      expect(datos.ingresosPublicosPib, id).toBeGreaterThan(0);
      expect(datos.gastoPublicoPib, id).toBeGreaterThan(0);
    }
    // Ingresos menos gasto es, más o menos, el saldo fiscal que ya da el FMI.
    const espana = paises.paises.ESP!.datos;
    expect(espana.ingresosPublicosPib! - espana.gastoPublicoPib!).toBeCloseTo(
      espana.saldoFiscalPib!,
      0,
    );
  });

  it('cada país jugable empieza con tesorería y una popularidad entera dentro de los límites', () => {
    const [minimo, maximo] = config.popularidad.limites as [number, number];
    for (const id of jugables) {
      const { tesoreria, popularidad } = valoresIniciales(
        paises.paises[id]!.datos,
        gobiernos.paises[id],
        FECHA_INICIO,
      );
      expect(tesoreria, id).toBeGreaterThan(0);
      expect(Number.isInteger(popularidad), id).toBe(true);
      expect(popularidad, id).toBeGreaterThanOrEqual(minimo);
      expect(popularidad, id).toBeLessThanOrEqual(maximo);
    }
  });

  it('España: Zapatero lleva casi seis años, con casi un 20 % de paro y sin crecimiento', () => {
    const espana = popularidadInicial(paises.paises.ESP!.datos, gobiernos.paises.ESP, FECHA_INICIO);
    expect(puntos(espana, 'desgaste')).toBeCloseTo(-6.9, 1);
    expect(espana.valor).toBeGreaterThan(25);
    expect(espana.valor).toBeLessThan(40);
  });

  it('la partida guarda los valores iniciales de todos los países jugables', () => {
    const partida = crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 1 },
      paises.paises,
      gobiernos.paises,
    );
    expect(Object.keys(partida.paises)).toEqual(jugables);
    expect(partida.paises.ESP).toEqual({
      ...valoresIniciales(paises.paises.ESP!.datos, gobiernos.paises.ESP, FECHA_INICIO),
      // Y su economía de 2010 (tarea f15-t2) y su presupuesto (Fase 17).
      economia: economiaInicial(paises.paises.ESP!.datos, paises.paises.ESP!.nivelRenta),
      presupuesto: presupuestoInicial(
        paises.paises.ESP!.datos,
        nivelDe(paises.paises.ESP!.nivelRenta),
        economiaInicial(paises.paises.ESP!.datos, paises.paises.ESP!.nivelRenta),
      ),
    });
    // Sin los gobiernos (si no se han podido cargar): sin desgaste ni régimen.
    const sinGobiernos = crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 1 },
      paises.paises,
    );
    expect(sinGobiernos.paises.ESP!.popularidad).toBe(
      popularidadInicial(paises.paises.ESP!.datos, null, FECHA_INICIO).valor,
    );
  });

  it('las fórmulas están documentadas en el GDD', () => {
    const gdd = readFileSync(resolve('docs/GDD.md'), 'utf8');
    expect(gdd).toContain('src/sim/config/inicio.json');
    expect(gdd).toContain('Popularidad inicial (provisional)');
  });
});
