/**
 * Economía de cada país: producción y demanda (tarea f15-t2, GDD sección 6.1). Motor puro.
 *
 * Decisiones del jugador (plan de la Fase 15):
 *  - Siete sectores, con los datos reales de 2010 de la ONU. Cada uno produce según
 *    productividad × capital^α × trabajo^(1 − α).
 *  - Sin azar: la economía cambia por las decisiones (inversión, gasto, impuestos, servicios…).
 *    Mientras no las haya (presupuesto y deuda, Fases 19 y 20; impuestos, Fases 21 y 22),
 *    evoluciona según el modelo.
 *  - Arranque: cada país crece en 2010 como creció de verdad, y esa diferencia con su crecimiento
 *    potencial se apaga poco a poco.
 *
 * Cada mes: crecen la productividad y el trabajo, la inversión se suma al capital (que se
 * desgasta), sale la producción potencial de cada sector y el PIB crece como el potencial más lo
 * que quede del impulso de 2010. Los valores van en dólares de 2010 (PIB real); la inflación, el
 * PIB nominal y el paro llegan en la Fase 16.
 *
 * Confianza y ahorro (tarea f15-t3): la confianza de consumidores y de empresas (índice, 100 =
 * normal) sube cuando el país crece por encima de su potencial y baja cuando crece por debajo,
 * poco a poco. Con más confianza se consume e invierte algo más: sube la demanda (y con ella el
 * PIB) y se acumula más capital. El ahorro nacional es lo que no se consume.
 *
 * Nada mejora solo (ajuste f15-a1, decisión del jugador): la productividad solo se acerca a la
 * de los países más avanzados si el país tiene base para ello, y los desequilibrios de 2010
 * (deuda, déficit, déficit exterior y paro) fuerzan un ajuste si nadie actúa: menos crédito e
 * inversión y recortes del gasto hasta cerrar el déficit, que hunden la demanda y la confianza.
 * Es provisional: lo sustituyen la deuda y la prima de riesgo de verdad (Fase 18). Su dureza
 * depende de la dificultad.
 *
 * Paro (tarea f16-t1; ley de Okun e histéresis, decisiones del jugador): cuando el PIB está por
 * debajo de su potencial, el paro sube por encima del estructural (el de 2010); si se queda alto
 * mucho tiempo, parte se vuelve estructural, ya no baja solo y esos parados dejan de producir. Los
 * parados consumen menos y el paro hunde la confianza de los consumidores.
 *
 * Inflación (tarea f16-t2; persistente, decisión del jugador): cada país arrastra la suya (las
 * expectativas); baja si el paro está por encima del estructural y sube si está por debajo (curva
 * de Phillips), sin un ancla que la arregle sola hasta el banco central (Fase 23). Una inflación
 * alta resta inversión y confianza de las empresas; la deflación frena el consumo.
 */
import config from './config/economia.json';
import type { Sistema } from './motor';
import type { TipoAlerta } from './alertas';
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

/**
 * El diagnóstico de los desequilibrios de 2010 (ajuste f15-a1). Desde la Fase 18 ya no fuerza
 * ningún ajuste: de eso se ocupa el mercado de la deuda (prima, crédito y crisis de deuda).
 */
export interface DesequilibrioEconomia {
  /** Intensidad (0 = ninguno; Grecia, en torno a 2). */
  intensidad: number;
  /** Déficit de 2010 por encima del seguro (tanto por uno del PIB; como mucho, la mitad del gasto). */
  ajustePendiente: number;
}

export interface EconomiaPais {
  /** PIB real al ritmo de un año, en dólares de 2010. */
  pib: number;
  /** Confianza de los consumidores y de las empresas (índice, 100 = normal; tarea f15-t3). */
  confianzaConsumidores: number;
  confianzaEmpresas: number;
  /**
   * El reparto de la demanda sin la confianza: el de 2010 con lo que han cambiado los ajustes (y
   * cambiarán las decisiones). La confianza lo aparta en `demanda`.
   */
  demandaBase: DemandaEconomia;
  /**
   * La demanda a la que está adaptada la economía: el PIB se aparta de su camino por la diferencia
   * con ella y se va adaptando a la nueva poco a poco (ajuste f15-a1).
   */
  demandaReferencia: DemandaEconomia;
  /** Diagnóstico de los desequilibrios de 2010 (ajuste f15-a1). */
  desequilibrio: DesequilibrioEconomia;
  /** Cuánto se aparta el PIB del camino de su producción por la demanda (tanto por uno). */
  brechaDemanda: number;
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
  /** Paro, en tanto por uno de la población activa (tarea f16-t1). */
  paro: number;
  /**
   * Paro estructural: el que hay con la economía en su potencial. Empieza en el de 2010 y sube si
   * el paro se queda por encima mucho tiempo (histéresis); solo lo bajan las decisiones.
   */
  paroEstructural: number;
  /** Puntos que sube el paro por cada punto que el PIB está por debajo de su potencial (Okun). */
  sensibilidadParo: number;
  /**
   * La brecha de producción que el mercado de trabajo ya ha asumido (con salarios más bajos se
   * vuelve a contratar aunque el PIB no se recupere); el paro responde a lo que queda.
   */
  brechaAsumida: number;
  /** Paro de cada mes desde el 1 de enero de 2010 (tanto por uno, para los gráficos). */
  serieParo: number[];
  /** Inflación: subida anual de los precios al ritmo de este mes (tanto por uno; tarea f16-t2). */
  inflacion: number;
  /** La inflación que se espera (las expectativas), que sigue a la de verdad con retraso. */
  inflacionEsperada: number;
  /** Nivel de los precios (1 = enero de 2010): el PIB nominal es el real por él. */
  nivelPrecios: number;
  /** Inflación de cada mes desde el 1 de enero de 2010 (tanto por uno, para los gráficos). */
  serieInflacion: number[];
  /**
   * La prima de riesgo del país (puntos) tal como pesa en el crédito, y la de 2010 (tarea
   * f18-t2): si pasa de la de 2010, el crédito se encarece. La pone el mercado de deuda.
   */
  primaRiesgo: number;
  primaReferencia: number;
  /**
   * Alertas en que está ahora (tarea f16-t4; solo las del país del jugador). Sin ellas, aún no
   * se ha mirado: la primera vez se anotan sin avisar.
   */
  alertas?: TipoAlerta[];
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
export function productividadDelPais(pibPerCapita: number, baseParaCrecer = 1): number {
  const p = config.crecimientoProductividad;
  const distancia = Math.log(p.frontera / Math.max(100, pibPerCapita));
  const crecimiento =
    p.base +
    p.convergencia * Math.max(0, distancia) * baseParaCrecer -
    p.lastre * (1 - baseParaCrecer);
  return recortar(crecimiento, [p.minimo, p.maximo]);
}

/**
 * Base de un país para crecer, de 0 a 1 (ajuste f15-a1): alfabetización, acceso a la
 * electricidad, uso de internet y gasto en educación de 2010. Sin datos, 0,5.
 */
export function baseParaCrecer(datos: DatosEconomia): number {
  const p = config.crecimientoProductividad;
  const partes = [
    dato(datos, 'alfabetizacion'),
    dato(datos, 'accesoElectricidad'),
    ((v) => (v === null ? null : (v / p.internetPleno) * 100))(dato(datos, 'usuariosInternet')),
    ((v) => (v === null ? null : (v / p.educacionPlena) * 100))(dato(datos, 'gastoEducacionPib')),
  ]
    .filter((v): v is number => v !== null)
    .map((v) => recortar(v / 100, [0, 1]));
  return partes.length > 0 ? partes.reduce((a, b) => a + b, 0) / partes.length : 0.5;
}

const d = config.desequilibrio;

/** El desequilibrio de un país con sus datos de 2010 (ajuste f15-a1). */
export function desequilibrioInicial(
  datos: DatosEconomia,
  consumoPublico: number,
): DesequilibrioEconomia {
  const deuda = dato(datos, 'deudaPib') ?? 50;
  const deficit = -(dato(datos, 'saldoFiscalPib') ?? -3);
  const cuentaCorriente = dato(datos, 'cuentaCorrientePib') ?? 0;
  const paro = dato(datos, 'paro') ?? 8;
  const riesgoFiscal =
    Math.max(0, deuda - d.deudaSegura) / 100 + Math.max(0, deficit - d.deficitSeguro) / 10;
  const dependenciaExterior = Math.max(0, -cuentaCorriente) / 10;
  const intensidad = Math.min(
    d.intensidadMaxima,
    riesgoFiscal * (d.baseExterna + dependenciaExterior) +
      (Math.max(0, paro - d.paroSeguro) / 10) * d.pesoParo,
  );
  return {
    intensidad,
    // Como mucho, la mitad del gasto público.
    ajustePendiente: Math.min(Math.max(0, deficit - d.deficitSeguro) / 100, consumoPublico / 2),
  };
}

const p = config.paro;

/**
 * Sensibilidad del paro a la brecha de producción (ley de Okun; estimada): mayor en los países
 * ricos (con menos economía informal que absorba a los parados) y en los que ya tenían mucho paro
 * en 2010 (mercados laborales rígidos o con mucho empleo temporal).
 */
export function sensibilidadDelParo(nivel: NivelRenta, paro2010: number): number {
  const rigidez = 1 + p.porPuntoRigido * Math.max(0, paro2010 * 100 - p.paroRigido);
  return Math.min(p.sensibilidadMaxima, p.sensibilidad[nivel] * rigidez);
}

/** El paro de 2010 de un país (tanto por uno; 8 % si no hay dato). */
function paroDe(datos: DatosEconomia): number {
  return recortar((dato(datos, 'paro') ?? 8) / 100, [0, p.maximo]);
}

/** Lo que se redondea el paro en su serie mensual. */
const redondearParo = (paro: number): number => Math.round(paro * 1e5) / 1e5;

/** Brecha de producción: cuánto se aparta el PIB de lo que podría producir (tanto por uno). */
export function brechaProduccion(economia: Pick<EconomiaPais, 'pib' | 'pibPotencial'>): number {
  return economia.pibPotencial > 0 ? economia.pib / economia.pibPotencial - 1 : 0;
}

/** Paro por encima del estructural (tanto por uno; negativo si está por debajo). */
export function paroCiclico(economia: Pick<EconomiaPais, 'paro' | 'paroEstructural'>): number {
  return economia.paro - economia.paroEstructural;
}

/** Cuánto ha subido el paro en los últimos 12 meses (tanto por uno), o null si aún no hay un año. */
export function subidaDelParo(economia: Pick<EconomiaPais, 'serieParo'>): number | null {
  const { serieParo } = economia;
  if (serieParo.length < 13) return null;
  return serieParo[serieParo.length - 1]! - serieParo[serieParo.length - 13]!;
}

/** Puntos de confianza que quita el paro a los consumidores (por encima del estructural y si sube). */
function golpeDelParo(economia: EconomiaPais): number {
  const subida = Math.max(0, subidaDelParo(economia) ?? 0);
  return (
    p.confianzaPorPuntoCiclico * Math.max(0, paroCiclico(economia)) * 100 +
    p.confianzaPorPuntoSubida * subida * 100
  );
}

/**
 * Un mes del paro (tarea f16-t1): tiende al estructural menos la brecha de producción por su
 * sensibilidad (ley de Okun); si se queda por encima, parte se vuelve estructural (histéresis) y
 * esos parados dejan de contar como trabajo para producir.
 */
function avanzarParo(economia: EconomiaPais): void {
  const brecha = brechaProduccion(economia);
  economia.brechaAsumida +=
    (brecha - economia.brechaAsumida) * (1 - Math.pow(0.5, 1 / p.mesesAsumir));
  const objetivo =
    economia.paroEstructural - economia.sensibilidadParo * (brecha - economia.brechaAsumida);
  const minimo = Math.max(p.minimo, economia.paroEstructural * p.minimoRelativo);
  economia.paro = recortar(economia.paro + (objetivo - economia.paro) * p.ajusteMensual, [
    minimo,
    p.maximo,
  ]);
  const ciclico = paroCiclico(economia);
  if (ciclico > 0) {
    const antes = economia.paroEstructural;
    economia.paroEstructural = Math.min(p.maximo, antes + ciclico * p.histeresisMensual);
    const quedan = (1 - economia.paroEstructural) / (1 - antes);
    for (const s of SECTORES) economia.sectores[s].trabajo *= quedan;
  }
  economia.serieParo.push(redondearParo(economia.paro));
}

const inf = config.inflacion;

/** La inflación de 2010 de un país (tanto por uno; «sinDato» si no hay). */
function inflacionDe(datos: DatosEconomia): number {
  const valor = dato(datos, 'inflacion');
  return recortar(valor === null ? inf.sinDato : valor / 100, [inf.minimo, inf.maximo]);
}

/** Lo que se redondea la inflación en su serie mensual. */
const redondearInflacion = (inflacion: number): number => Math.round(inflacion * 1e5) / 1e5;

/** Lo que queda de la inversión con una inflación alta (1 = nada perdido). */
function inversionConInflacion(inflacion: number): number {
  const exceso = Math.max(0, inflacion - inf.umbralInversion) * 100;
  return 1 - Math.min(inf.inversionMaxima, inf.inversionPorPunto * exceso);
}

/** Lo que queda del consumo con deflación (1 = nada perdido). */
function consumoConDeflacion(inflacion: number): number {
  return 1 - inf.consumoPorPuntoDeflacion * Math.max(0, -inflacion) * 100;
}

/** Puntos de confianza que quita a las empresas una inflación alta. */
function golpeDeLaInflacion(inflacion: number): number {
  return inf.confianzaEmpresasPorPunto * Math.max(0, inflacion - inf.umbralInversion) * 100;
}

/** PIB nominal: el real a los precios de ahora (dólares corrientes; tarea f16-t2). */
export function pibNominal(economia: Pick<EconomiaPais, 'pib' | 'nivelPrecios'>): number {
  return economia.pib * economia.nivelPrecios;
}

/**
 * Un mes de la inflación (tarea f16-t2): la esperada menos la pendiente × el paro por encima del
 * estructural (curva de Phillips); la esperada la sigue con retraso, sin ancla.
 */
function avanzarInflacion(economia: EconomiaPais): void {
  economia.inflacion = recortar(
    economia.inflacionEsperada - inf.pendiente * paroCiclico(economia),
    [inf.minimo, inf.maximo],
  );
  const seguir = 1 - Math.pow(0.5, 1 / inf.mesesExpectativas);
  economia.inflacionEsperada += (economia.inflacion - economia.inflacionEsperada) * seguir;
  economia.nivelPrecios *= Math.pow(1 + economia.inflacion, 1 / 12);
  economia.serieInflacion.push(redondearInflacion(economia.inflacion));
}

/**
 * La demanda de 2010 ya trae el daño de la inflación de ese año: la de base es la que habría sin él
 * (con la inflación de 2010, la demanda es la de los datos; tarea f16-t2).
 */
function sinElDanoDeLaInflacion(base: DemandaEconomia, inflacion: number): DemandaEconomia {
  return {
    ...base,
    consumo: base.consumo / consumoConDeflacion(inflacion),
    inversion: base.inversion / inversionConInflacion(inflacion),
  };
}

/**
 * Cuánto pesa la deuda según la dificultad (Fase 18): la prima en el crédito y el programa de
 * ajuste del FMI.
 */
export function durezaDe(dificultad: string | undefined): number {
  return config.dureza[dificultad as keyof typeof config.dureza] ?? config.dureza.normal;
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
  // (La confianza y la demanda con ella se calculan al final, con el potencial ya conocido.)
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
  const paro = paroDe(datos);
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
    confianzaConsumidores: 100,
    confianzaEmpresas: 100,
    demandaBase: sinElDanoDeLaInflacion(demanda, inflacionDe(datos)),
    demandaReferencia: { ...demanda },
    desequilibrio: desequilibrioInicial(datos, demanda.consumoPublico),
    brechaDemanda: 0,
    pibPotencial: pib,
    sectores,
    demanda,
    nivelRenta: nivel,
    crecimientoProductividad: productividadDelPais(pib / poblacion, baseParaCrecer(datos)),
    impulsoInicial: 0,
    meses: 0,
    serie: [Math.round(pib)],
    primaRiesgo: 0,
    primaReferencia: 0,
    inflacion: inflacionDe(datos),
    inflacionEsperada: inflacionDe(datos),
    nivelPrecios: 1,
    serieInflacion: [redondearInflacion(inflacionDe(datos))],
    paro,
    paroEstructural: paro,
    sensibilidadParo: sensibilidadDelParo(nivel, paro),
    brechaAsumida: 0,
    serieParo: [redondearParo(paro)],
  };
  // Lo que creció de verdad en 2010 por encima (o por debajo) de su potencial.
  const crecimiento2010 = recortar((dato(datos, 'crecimientoPib') ?? 3) / 100, [
    config.crecimientoInicial.minimo,
    config.crecimientoInicial.maximo,
  ]);
  economia.impulsoInicial = crecimiento2010 - crecimientoPotencial(economia);
  // La confianza de partida (estimada: no hay datos de todos los países), la que corresponde a
  // lo que creció en 2010 frente a su potencial; y con ella, el consumo y la inversión.
  economia.confianzaConsumidores = objetivoConfianza(economia.impulsoInicial, 'consumidores');
  economia.confianzaEmpresas = Math.max(
    confianza.minimo,
    objetivoConfianza(economia.impulsoInicial, 'empresas') - golpeDeLaInflacion(economia.inflacion),
  );
  economia.demanda = demandaConConfianza(economia);
  // El PIB de 2010 ya es el de esa demanda: la brecha empieza ahí (sin salto el primer mes).
  economia.brechaDemanda = brechaDe(economia);
  // Y lo que podría producir es el PIB sin esa brecha: con más confianza que la normal, la
  // economía de 2010 iba por encima de su potencial (tarea f16-t1).
  const sinBrecha = 1 / (1 + economia.brechaDemanda);
  for (const s of SECTORES) economia.sectores[s].productividad *= sinBrecha;
  economia.pibPotencial = pib * sinBrecha;
  return economia;
}

/**
 * Cuánto aparta la demanda (consumo, inversión y gasto público frente a la demanda a la que está
 * adaptada la economía) al PIB de su camino.
 */
function brechaDe(economia: Pick<EconomiaPais, 'demanda' | 'demandaReferencia'>): number {
  const { demanda, demandaReferencia: ref } = economia;
  return (
    config.confianza.multiplicador *
    (demanda.consumo -
      ref.consumo +
      (demanda.inversion - ref.inversion) +
      (demanda.consumoPublico - ref.consumoPublico))
  );
}

const confianza = config.confianza;
const credito = config.credito;

/** La confianza a la que tiende un país que crece `diferencia` por encima de su potencial. */
export function objetivoConfianza(diferencia: number, quien: 'consumidores' | 'empresas'): number {
  const puntos =
    quien === 'consumidores'
      ? confianza.puntosPorPuntoConsumidores
      : confianza.puntosPorPuntoEmpresas;
  return recortar(100 + puntos * diferencia * 100, [confianza.minimo, confianza.maximo]);
}

/** El reparto de la demanda con la confianza de ahora: más confianza, más consumo e inversión. */
/** Puntos que la prima de riesgo pasa de la de 2010 (lo que se encarece el crédito). */
function primaDeMas(economia: Pick<EconomiaPais, 'primaRiesgo' | 'primaReferencia'>): number {
  return Math.max(0, (economia.primaRiesgo ?? 0) - (economia.primaReferencia ?? 0));
}

/** Lo que queda de la inversión con el crédito más caro (tarea f18-t2). */
function inversionConCredito(
  economia: Pick<EconomiaPais, 'primaRiesgo' | 'primaReferencia'>,
): number {
  const diferencia = (economia.primaRiesgo ?? 0) - (economia.primaReferencia ?? 0);
  return recortar(1 - credito.inversionPorPunto * diferencia, [
    credito.inversionMinima,
    credito.inversionMaxima,
  ]);
}

export function demandaConConfianza(economia: EconomiaPais): DemandaEconomia {
  const base = economia.demandaBase;
  // Con la prima de riesgo más alta que en 2010, el crédito se encarece (tarea f18-t2).
  const inversionBase = base.inversion * inversionConCredito(economia);
  // Los parados (por encima del estructural) gastan menos (tarea f16-t1); con deflación se
  // espera a que bajen los precios, y con mucha inflación se invierte menos (tarea f16-t2).
  const conParo = 1 - (p.consumoPorPunto * paroCiclico(economia) * 100) / 100;
  return {
    ...base,
    consumo:
      base.consumo *
      conParo *
      consumoConDeflacion(economia.inflacion) *
      (1 + (confianza.efectoConsumo * (economia.confianzaConsumidores - 100)) / 100),
    inversion:
      inversionBase *
      inversionConInflacion(economia.inflacion) *
      (1 + (confianza.efectoInversion * (economia.confianzaEmpresas - 100)) / 100),
  };
}

/** Ahorro nacional en tanto por uno del PIB: lo que no consumen los hogares ni el Estado. */
export function ahorroNacional(economia: Pick<EconomiaPais, 'demanda'>): number {
  return 1 - economia.demanda.consumo - economia.demanda.consumoPublico;
}

/** Lo que queda del impulso de 2010 al cabo de unos meses (se apaga a la mitad cada «mesesMitad»). */
export function impulsoEnMes(
  economia: Pick<EconomiaPais, 'impulsoInicial'>,
  meses: number,
): number {
  return economia.impulsoInicial * Math.pow(0.5, meses / config.mesesMitad);
}

/**
 * Avanza un mes la economía de un país (sin azar: siempre igual con lo mismo). La dificultad
 * pesa a través del mercado de la deuda (el crédito y la crisis de deuda, Fase 18).
 */
export function avanzarMes(economia: EconomiaPais): void {
  const { sectores, nivelRenta } = economia;
  const potencialAntes = SECTORES.reduce((suma, s) => suma + produccion(sectores[s]), 0);
  const capitalTotal = SECTORES.reduce((suma, s) => suma + sectores[s].capital, 0);
  // La inversión del mes se reparte entre los sectores según su capital.
  const inversionMes = (tasaInversion(economia.demanda) * economia.pib) / 12;
  // Lo que queda del capital al cabo de un mes tras su desgaste.
  const desgaste = Math.pow(1 - config.depreciacion, 1 / 12);
  const crecimientoTrabajo = 1 + mensual(config.crecimientoPoblacion[nivelRenta]);
  // Lo que queda del impulso de 2010. Si crecía por encima de su potencial (rebote tras 2009 o
  // auge), se toma como capacidad nueva; si crecía por debajo, estaba en recesión: el PIB se queda
  // por debajo de lo que podría producir (brecha de producción, con más paro; tarea f16-t1).
  const impulso = mensual(impulsoEnMes(economia, economia.meses));
  for (const s of SECTORES) {
    const sector = sectores[s];
    if (sector.capital <= 0 || sector.trabajo <= 0) continue;
    sector.productividad *=
      (1 + mensual(crecimientoProductividad(economia, s))) * (1 + Math.max(0, impulso));
    sector.trabajo *= crecimientoTrabajo;
    sector.capital = sector.capital * desgaste + (inversionMes * sector.capital) / capitalTotal;
  }
  const potencial = SECTORES.map((s) => produccion(sectores[s]));
  const potencialAhora = potencial.reduce((a, b) => a + b, 0);
  if (potencialAntes <= 0 || potencialAhora <= 0) return;
  // El PIB crece como el potencial más lo que queda del impulso de 2010…
  const pibAntes = economia.pib;
  economia.pib *= (potencialAhora / potencialAntes) * (1 + Math.min(0, impulso));
  economia.pibPotencial = potencialAhora;
  // … y la confianza se mueve hacia la que corresponde a ese crecimiento frente al potencial,
  // más baja con la prima de riesgo alta (Fase 18), con el paro (la de los consumidores) y con la
  // inflación (la de las empresas).
  const crecimientoMes = Math.pow(economia.pib / pibAntes, 12) - 1;
  const diferencia = crecimientoMes - crecimientoPotencial(economia);
  const acercar = (actual: number, objetivo: number): number =>
    actual + (objetivo - actual) * confianza.ajusteMensual;
  economia.confianzaConsumidores = acercar(
    economia.confianzaConsumidores,
    Math.max(
      confianza.minimo,
      objetivoConfianza(diferencia, 'consumidores') -
        credito.confianzaConsumidoresPorPunto * primaDeMas(economia) -
        golpeDelParo(economia),
    ),
  );
  economia.confianzaEmpresas = acercar(
    economia.confianzaEmpresas,
    Math.max(
      confianza.minimo,
      objetivoConfianza(diferencia, 'empresas') -
        credito.confianzaEmpresasPorPunto * primaDeMas(economia) -
        golpeDeLaInflacion(economia.inflacion),
    ),
  );
  // Con la confianza cambian el consumo y la inversión; la demanda mueve el PIB.
  economia.demanda = demandaConConfianza(economia);
  const brecha = brechaDe(economia);
  economia.pib *= (1 + brecha) / (1 + economia.brechaDemanda);
  // La economía se adapta poco a poco a la demanda nueva (la brecha se va cerrando).
  const adaptar = 1 - Math.pow(0.5, 1 / d.mesesAdaptacion);
  const ref = economia.demandaReferencia;
  for (const clave of ['consumo', 'inversion', 'consumoPublico'] as const) {
    ref[clave] += (economia.demanda[clave] - ref[clave]) * adaptar;
  }
  economia.brechaDemanda = brechaDe(economia);
  // (El PIB ya está en el nivel de la brecha de antes de adaptarse: no salta.)
  economia.pib *= (1 + economia.brechaDemanda) / (1 + brecha);
  // Cada sector produce su parte del PIB según su producción potencial.
  SECTORES.forEach((s, i) => {
    sectores[s].valor = (economia.pib * potencial[i]!) / potencialAhora;
  });
  economia.meses += 1;
  economia.serie.push(Math.round(economia.pib));
  avanzarParo(economia);
  avanzarInflacion(economia);
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
    const pais = paises[id];
    if (estado.economia === undefined) {
      estado.economia = pais ? economiaInicial(pais.datos, pais.nivelRenta) : null;
      continue;
    }
    if (!estado.economia || !pais) continue;
    // (En orden: los desequilibrios toman la demanda de base de los datos, antes de que la
    // inflación le quite su daño.)
    // Guardada con la v0.16.0 (formato 3): le faltan los desequilibrios (ajuste f15-a1).
    if (!estado.economia.desequilibrio) completarAjuste(estado.economia, pais.datos);
    // Guardada con la v0.16.1 o antes (formato 4): le falta el paro (tarea f16-t1)…
    if (estado.economia.paro === undefined) completarParo(estado.economia, pais.datos);
    // … y la inflación (tarea f16-t2).
    if (estado.economia.inflacion === undefined) completarInflacion(estado.economia, pais.datos);
    // Guardada con la v0.18.0 o antes: sin prima (la pone el mercado al completarlo, Fase 18).
    if (estado.economia.primaRiesgo === undefined) {
      estado.economia.primaRiesgo = 0;
      estado.economia.primaReferencia = 0;
    }
  }
  return partida;
}

/** Lo que la tarea f16-t1 añadió a la economía: el paro, desde el de 2010. */
function completarParo(economia: EconomiaPais, datos: DatosEconomia): void {
  const paro = paroDe(datos);
  economia.paro = paro;
  economia.paroEstructural = paro;
  economia.sensibilidadParo = sensibilidadDelParo(economia.nivelRenta, paro);
  // Sin salto: la brecha de ahora se toma como asumida.
  economia.brechaAsumida = brechaProduccion(economia);
  // (No se sabe cómo fue antes: los meses ya jugados se rellenan con el de 2010.)
  economia.serieParo = economia.serie.map(() => redondearParo(paro));
}

/** Lo que la tarea f16-t2 añadió a la economía: la inflación, desde la de 2010. */
function completarInflacion(economia: EconomiaPais, datos: DatosEconomia): void {
  const inflacion = inflacionDe(datos);
  economia.inflacion = inflacion;
  economia.inflacionEsperada = inflacion;
  // (Los meses ya jugados, con la de 2010.)
  economia.nivelPrecios = Math.pow(1 + inflacion, economia.meses / 12);
  economia.serieInflacion = economia.serie.map(() => redondearInflacion(inflacion));
  economia.demandaBase = sinElDanoDeLaInflacion(economia.demandaBase, inflacion);
}

/** Lo que el ajuste f15-a1 añadió a la economía de las partidas de la v0.16.0. */
function completarAjuste(economia: EconomiaPais, datos: DatosEconomia): void {
  economia.demandaReferencia = { ...economia.demandaBase };
  economia.desequilibrio = desequilibrioInicial(datos, economia.demandaBase.consumoPublico);
  const poblacion = dato(datos, 'poblacion');
  const pib = dato(datos, 'pib');
  if (poblacion && pib) {
    economia.crecimientoProductividad = productividadDelPais(
      pib / poblacion,
      baseParaCrecer(datos),
    );
  }
  economia.brechaDemanda = brechaDe(economia);
}

/**
 * ¿Le falta algo de la economía a algún país? (Partidas de antes de la Fase 15, sin economía; de
 * la v0.16.0, sin los desequilibrios del ajuste f15-a1; o de la v0.16.1, sin el paro.)
 */
export function faltaEconomia(partida: Pick<Partida, 'paises'>): boolean {
  return Object.values(partida.paises).some(
    (estado) =>
      estado.economia === undefined ||
      (estado.economia !== null &&
        (!estado.economia.desequilibrio ||
          estado.economia.paro === undefined ||
          estado.economia.inflacion === undefined)),
  );
}
