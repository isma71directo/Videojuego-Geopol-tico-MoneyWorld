/**
 * Economía de cada país: producción y demanda (tarea f15-t2, GDD sección 6.1). Motor puro.
 *
 * Decisiones del jugador (plan de la Fase 15):
 *  - Siete sectores, con los datos reales de 2010 de la ONU. Cada uno produce según
 *    productividad × capital^α × trabajo^(1 − α).
 *  - Sin azar: la economía cambia por las decisiones (inversión, gasto, impuestos, servicios…).
 *    Mientras no las haya (presupuesto e impuestos, Fases 21 a 25), evoluciona según el modelo.
 *  - Arranque: cada país crece en 2010 como creció de verdad, y esa diferencia con su crecimiento
 *    potencial se apaga poco a poco.
 *
 * Cada mes: crecen la productividad y el trabajo, la inversión se suma al capital (que se
 * desgasta), sale la producción potencial de cada sector y el PIB crece como el potencial más lo
 * que quede del impulso de 2010. Los valores van en dólares de 2010 (PIB real); la inflación, el
 * PIB nominal y el paro llegan en la Fase 16.
 */
import config from './config/economia.json';
import type { Sistema } from './motor';
import type { Partida } from './partida';

export const SECTORES = [
  'agricultura',
  'mineriaEnergia',
  'manufactura',
  'construccion',
  'comercio',
  'transporte',
  'otrosServicios',
] as const;
export type Sector = (typeof SECTORES)[number];

/** Campo de paises-2010.json con el peso de cada sector en el valor añadido (tarea f15-t1). */
export const CAMPO_SECTOR: Record<Sector, string> = {
  agricultura: 'vabAgricultura',
  mineriaEnergia: 'vabMineriaEnergia',
  manufactura: 'vabManufactura',
  construccion: 'vabConstruccion',
  comercio: 'vabComercio',
  transporte: 'vabTransporte',
  otrosServicios: 'vabOtrosServicios',
};

export type NivelRenta = 'bajo' | 'medio-bajo' | 'medio-alto' | 'alto';

export interface SectorEconomia {
  /** Valor añadido real del sector, al ritmo de un año, en dólares de 2010. */
  valor: number;
  /** Capital del sector, en dólares de 2010. */
  capital: number;
  /** Personas que trabajan en el sector. */
  trabajo: number;
  /** Productividad (A en A · K^α · L^(1 − α)). */
  productividad: number;
}

/** Reparto de la demanda, en tanto por uno del PIB (datos de 2010; cambiarán las decisiones). */
export interface DemandaEconomia {
  consumo: number;
  consumoPublico: number;
  inversion: number;
  exportaciones: number;
  importaciones: number;
}

export interface EconomiaPais {
  /** PIB real al ritmo de un año, en dólares de 2010. */
  pib: number;
  /** PIB potencial: lo que producirían su capital, su trabajo y su productividad. */
  pibPotencial: number;
  sectores: Record<Sector, SectorEconomia>;
  demanda: DemandaEconomia;
  nivelRenta: NivelRenta;
  /**
   * Crecimiento anual de la productividad del país (con su convergencia hacia los más
   * avanzados, según su PIB por habitante de 2010); cada sector le suma el suyo.
   */
  crecimientoProductividad: number;
  /** Diferencia entre el crecimiento real de 2010 y el potencial, que se va apagando. */
  impulsoInicial: number;
  /** Meses desde el 1 de enero de 2010. */
  meses: number;
  /** PIB de cada mes desde el 1 de enero de 2010, en dólares de 2010 (para los gráficos). */
  serie: number[];
}

/** Lo que hace falta de los datos de un país (paises-2010.json, campo «datos»). */
export type DatosEconomia = Record<string, number | null | undefined>;

const NIVELES: readonly NivelRenta[] = ['bajo', 'medio-bajo', 'medio-alto', 'alto'];
const alfa = config.alfaCapital;
const recortar = (valor: number, [minimo, maximo]: readonly [number, number]): number =>
  Math.min(maximo, Math.max(minimo, valor));
const dato = (datos: DatosEconomia, campo: string): number | null => {
  const valor = datos[campo];
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
};
/** Una tasa anual llevada a un mes. */
const mensual = (anual: number): number => Math.pow(1 + anual, 1 / 12) - 1;

/** Producción potencial de un sector con su productividad, capital y trabajo. */
export function produccion(sector: SectorEconomia): number {
  if (sector.capital <= 0 || sector.trabajo <= 0) return 0;
  return sector.productividad * Math.pow(sector.capital, alfa) * Math.pow(sector.trabajo, 1 - alfa);
}

/**
 * Crecimiento anual de la productividad de un país: los que tienen menos renta por habitante se
 * acercan a los más avanzados (convergencia), dentro de unos límites.
 */
export function productividadDelPais(pibPerCapita: number): number {
  const p = config.crecimientoProductividad;
  const distancia = Math.log(p.frontera / Math.max(100, pibPerCapita));
  return recortar(p.base + p.convergencia * Math.max(0, distancia), [p.minimo, p.maximo]);
}

/** Crecimiento anual de la productividad de un sector de un país. */
function crecimientoProductividad(
  economia: Pick<EconomiaPais, 'crecimientoProductividad'>,
  sector: Sector,
): number {
  return economia.crecimientoProductividad + config.productividadSector[sector];
}

/** Inversión que acumula capital, en tanto por uno del PIB. */
const tasaInversion = (demanda: DemandaEconomia): number =>
  recortar(demanda.inversion, [config.inversion.minimo, config.inversion.maximo]);

/**
 * Crecimiento potencial anual de una economía (el que tendría sin el impulso de 2010): el de la
 * productividad, el del capital (inversión menos desgaste) y el del trabajo, pesados por sector.
 */
export function crecimientoPotencial(economia: EconomiaPais): number {
  const capital = SECTORES.reduce((total, s) => total + economia.sectores[s].capital, 0);
  if (capital <= 0 || economia.pib <= 0) return 0;
  const crecimientoCapital =
    (tasaInversion(economia.demanda) * economia.pib) / capital - config.depreciacion;
  const crecimientoTrabajo = config.crecimientoPoblacion[economia.nivelRenta];
  const total = SECTORES.reduce((suma, s) => suma + economia.sectores[s].valor, 0);
  if (total <= 0) return 0;
  return SECTORES.reduce((suma, s) => {
    const peso = economia.sectores[s].valor / total;
    const crecimiento =
      crecimientoProductividad(economia, s) +
      alfa * crecimientoCapital +
      (1 - alfa) * crecimientoTrabajo;
    return suma + peso * crecimiento;
  }, 0);
}

/** Nivel de renta de un país (de paises-2010.json); sin él, medio-alto. */
export function nivelDe(texto: string | null | undefined): NivelRenta {
  return NIVELES.includes(texto as NivelRenta) ? (texto as NivelRenta) : 'medio-alto';
}

/**
 * La economía de un país el 1 de enero de 2010, con sus datos de 2010: el PIB, el peso de cada
 * sector (ONU), el reparto de la demanda (ONU), la población y el paro. Null si falta el PIB.
 */
export function economiaInicial(
  datos: DatosEconomia,
  nivelRenta: string | null | undefined,
): EconomiaPais | null {
  const pib = dato(datos, 'pib');
  if (pib === null || pib <= 0) return null;
  const nivel = nivelDe(nivelRenta);

  // Peso de cada sector (los estimados pueden no sumar 100: se reparten).
  const pesosBrutos = SECTORES.map((s) => Math.max(0, dato(datos, CAMPO_SECTOR[s]) ?? 0));
  const sumaPesos = pesosBrutos.reduce((a, b) => a + b, 0);
  const pesos = sumaPesos > 0 ? pesosBrutos.map((p) => p / sumaPesos) : SECTORES.map(() => 1 / 7);

  const porcentaje = (campo: string, respaldo: number): number =>
    (dato(datos, campo) ?? respaldo) / 100;
  const demanda: DemandaEconomia = {
    consumo: porcentaje('consumoHogaresPib', 60),
    consumoPublico: porcentaje('consumoPublicoPib', 15),
    inversion: porcentaje('inversionPib', 22),
    exportaciones: porcentaje('exportacionesPib', 30),
    importaciones: porcentaje('importacionesPib', 30),
  };

  // Capital de equilibrio con su inversión, repartido según lo intensivo de cada sector.
  const capitalPorProducto = recortar(
    tasaInversion(demanda) / (config.depreciacion + config.crecimientoReferencia[nivel]),
    [config.capitalPorProducto.minimo, config.capitalPorProducto.maximo],
  );
  const intensidadMedia = SECTORES.reduce(
    (suma, s, i) => suma + pesos[i]! * config.intensidadCapital[s],
    0,
  );
  // Trabajo: población activa sin parados, repartida según la productividad de cada sector.
  const poblacion = dato(datos, 'poblacion') ?? pib / 10_000;
  const paro = recortar((dato(datos, 'paro') ?? 8) / 100, [0, 0.6]);
  const ocupados = poblacion * config.tasaActividad * (1 - paro);
  const empleoRelativo = SECTORES.map((s, i) => pesos[i]! / config.productividadRelativa[s]);
  const sumaEmpleo = empleoRelativo.reduce((a, b) => a + b, 0);

  const sectores = Object.fromEntries(
    SECTORES.map((s, i) => {
      const valor = pib * pesos[i]!;
      const capital =
        valor > 0
          ? (valor * capitalPorProducto * config.intensidadCapital[s]) / intensidadMedia
          : 0;
      const trabajo =
        valor > 0 && sumaEmpleo > 0 ? (ocupados * empleoRelativo[i]!) / sumaEmpleo : 0;
      const base = Math.pow(capital, alfa) * Math.pow(trabajo, 1 - alfa);
      const productividad = base > 0 ? valor / base : 0;
      return [s, { valor, capital, trabajo, productividad }];
    }),
  ) as Record<Sector, SectorEconomia>;

  const economia: EconomiaPais = {
    pib,
    pibPotencial: pib,
    sectores,
    demanda,
    nivelRenta: nivel,
    crecimientoProductividad: productividadDelPais(pib / poblacion),
    impulsoInicial: 0,
    meses: 0,
    serie: [Math.round(pib)],
  };
  // Lo que creció de verdad en 2010 por encima (o por debajo) de su potencial.
  const crecimiento2010 = recortar((dato(datos, 'crecimientoPib') ?? 3) / 100, [
    config.crecimientoInicial.minimo,
    config.crecimientoInicial.maximo,
  ]);
  economia.impulsoInicial = crecimiento2010 - crecimientoPotencial(economia);
  return economia;
}

/** Lo que queda del impulso de 2010 al cabo de unos meses (se apaga a la mitad cada «mesesMitad»). */
export function impulsoEnMes(
  economia: Pick<EconomiaPais, 'impulsoInicial'>,
  meses: number,
): number {
  return economia.impulsoInicial * Math.pow(0.5, meses / config.mesesMitad);
}

/** Avanza un mes la economía de un país (sin azar: siempre igual con lo mismo). */
export function avanzarMes(economia: EconomiaPais): void {
  const { sectores, nivelRenta } = economia;
  const potencialAntes = SECTORES.reduce((suma, s) => suma + produccion(sectores[s]), 0);
  const capitalTotal = SECTORES.reduce((suma, s) => suma + sectores[s].capital, 0);
  // La inversión del mes se reparte entre los sectores según su capital.
  const inversionMes = (tasaInversion(economia.demanda) * economia.pib) / 12;
  // Lo que queda del capital al cabo de un mes tras su desgaste.
  const desgaste = Math.pow(1 - config.depreciacion, 1 / 12);
  const crecimientoTrabajo = 1 + mensual(config.crecimientoPoblacion[nivelRenta]);
  for (const s of SECTORES) {
    const sector = sectores[s];
    if (sector.capital <= 0 || sector.trabajo <= 0) continue;
    sector.productividad *= 1 + mensual(crecimientoProductividad(economia, s));
    sector.trabajo *= crecimientoTrabajo;
    sector.capital = sector.capital * desgaste + (inversionMes * sector.capital) / capitalTotal;
  }
  const potencial = SECTORES.map((s) => produccion(sectores[s]));
  const potencialAhora = potencial.reduce((a, b) => a + b, 0);
  if (potencialAntes <= 0 || potencialAhora <= 0) return;
  // El PIB crece como el potencial más lo que queda del impulso de 2010.
  const impulso = mensual(impulsoEnMes(economia, economia.meses));
  economia.pib *= (potencialAhora / potencialAntes) * (1 + impulso);
  economia.pibPotencial = potencialAhora;
  // Cada sector produce su parte del PIB según su producción potencial.
  SECTORES.forEach((s, i) => {
    sectores[s].valor = (economia.pib * potencial[i]!) / potencialAhora;
  });
  economia.meses += 1;
  economia.serie.push(Math.round(economia.pib));
}

/** Crecimiento del PIB en los últimos 12 meses (tanto por uno), o null si aún no hay un año. */
export function crecimientoInteranual(economia: Pick<EconomiaPais, 'serie'>): number | null {
  const { serie } = economia;
  if (serie.length < 13) return null;
  const antes = serie[serie.length - 13]!;
  return antes > 0 ? serie[serie.length - 1]! / antes - 1 : null;
}

/** Sistema de la economía (tarea f15-t2): avanza un mes cada país en cada paso mensual. */
export const sistemaEconomia: Sistema = (pasos, partida) => {
  for (const paso of pasos) {
    if (paso.ritmo !== 'mensual') continue;
    for (const estado of Object.values(partida.paises)) {
      if (estado.economia) avanzarMes(estado.economia);
    }
  }
};

/** Lo que hace falta de cada país para crear su economía. */
export interface PaisParaEconomia {
  datos: DatosEconomia;
  nivelRenta?: string | null;
}

/**
 * Pone la economía de 2010 a los países que no la tienen (partidas guardadas antes de la Fase 15,
 * formato 2): empiezan con sus datos de 2010 aunque la partida vaya más adelantada.
 */
export function completarEconomia(
  partida: Partida,
  paises: Record<string, PaisParaEconomia>,
): Partida {
  for (const [id, estado] of Object.entries(partida.paises)) {
    if (estado.economia) continue;
    const pais = paises[id];
    estado.economia = pais ? economiaInicial(pais.datos, pais.nivelRenta) : null;
  }
  return partida;
}

/** ¿Le falta la economía a algún país? (partidas de antes de la Fase 15) */
export function faltaEconomia(partida: Pick<Partida, 'paises'>): boolean {
  return Object.values(partida.paises).some((estado) => estado.economia === undefined);
}
