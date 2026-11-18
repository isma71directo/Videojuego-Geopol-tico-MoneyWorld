/**
 * Presupuesto de cada país (Fase 17; decisiones del jugador: cada ministerio por dentro, datos del
 * Banco Mundial y el FMI, responde a la economía y el déficit se cubre con deuda).
 *
 * Los ingresos, por tipo (renta de las personas y de las sociedades, IVA y consumos, cotizaciones,
 * aranceles, otros impuestos y otros ingresos); los gastos, por ministerio (los 20 del juego), cada
 * uno con sus partidas internas (personal, inversión, mantenimiento y programas), más las
 * pensiones, las prestaciones por desempleo y los intereses de la deuda. Todo en dólares
 * corrientes al ritmo de un año. Los totales de 2010 son los del FMI; las partes, del Banco
 * Mundial; el reparto del resto de ministerios y sus partidas internas, estimado (config).
 *
 * Con la Fase 19 (decisiones del jugador), el gasto está en dinero y no cambia hasta que se decide
 * otro presupuesto (src/sim/hacienda.ts): con la inflación, compra menos. Lo que se decide llega a
 * la economía (consumo público, inversión y consumo de los hogares). Motor puro, sin interfaz.
 */
import config from './config/presupuesto.json';
import configDeuda from './config/deuda.json';
import configEconomia from './config/economia.json';
import {
  brechaProduccion,
  nivelDe,
  pibNominal,
  type DatosEconomia,
  type DemandaEconomia,
  type EconomiaPais,
  type NivelRenta,
} from './economia';
import type { MercadoDeuda } from './deuda';
import type { Sistema } from './motor';
import type { EstadoPais, Partida as PartidaJuego } from './partida';

/** Los ingresos, por tipo. */
export const INGRESOS = [
  'rentaPersonas',
  'rentaSociedades',
  'consumo',
  'cotizaciones',
  'aranceles',
  'otrosImpuestos',
  'otrosIngresos',
] as const;
export type Ingreso = (typeof INGRESOS)[number];

/** Los ministerios del juego (los mismos que en la barra de secciones). */
export const MINISTERIOS = [
  'presidencia',
  'economia',
  'exteriores',
  'defensa',
  'interior',
  'justicia',
  'sanidad',
  'educacion',
  'ciencia',
  'trabajo',
  'industria',
  'energia',
  'transportes',
  'telecomunicaciones',
  'agricultura',
  'medioambiente',
  'vivienda',
  'cultura',
  'igualdad',
  'territorial',
] as const;
export type Ministerio = (typeof MINISTERIOS)[number];

/** Las partidas internas de cada ministerio. */
export const PARTIDAS = ['personal', 'inversion', 'mantenimiento', 'programas'] as const;
export type Partida = (typeof PARTIDAS)[number];

/**
 * Un cambio del presupuesto que decide el jugador (ajuste f19-a1), con su plazo:
 * - una partida (o todas) de un ministerio (o de todos), por un factor: con la subida anual
 *   («anio», desde el 1 de enero) o extraordinaria («mes», desde el mes siguiente);
 * - la subida de los sueldos de un ministerio (o de todos), igual;
 * - puestos nuevos (tras la oposición) o despidos (desde el mes siguiente, con indemnización);
 * - la subida de las pensiones de cada enero (null: el IPC) y la prestación de cada parado.
 */
/** Los plazos de la deuda (tarea f20-t1): letras a 1 año y bonos a 5 y a 10 años. */
export const PLAZOS = ['letras', 'bonos5', 'bonos10'] as const;
export type Plazo = (typeof PLAZOS)[number];
/** Qué parte de lo que se emite va a cada plazo (suma 1). */
export type Reparto = Record<Plazo, number>;

/** El Tesoro de un país (tarea f20-t1). */
export interface TesoroPais {
  /** ¿Emite solo cuando falta dinero (y paga antes si sobra)? La IA, siempre. */
  automatico: boolean;
  /** Cómo reparte lo que emite entre los plazos. */
  reparto: Reparto;
  /** El tipo de cada plazo este mes (tanto por uno; lo pone el mercado de la deuda). */
  tipos: Record<Plazo, number>;
  /** ¿Se puede emitir este mes? (No con los mercados cerrados sin rescate.) */
  abierto: boolean;
  /** El precio de recompra de la deuda este mes (por dólar; lo pone el mercado). */
  precioRecompra: number;
  /** ¿Ya se ha avisado de que queda poca tesorería? (Para no avisar cada mes.) */
  bajo: boolean;
}

export type CambioPresupuesto =
  | {
      tipo: 'partida';
      ministerio: Ministerio | 'todos';
      partida: Partida | 'todas';
      factor: number;
      cuando: 'anio' | 'mes';
    }
  | { tipo: 'sueldos'; ministerio: Ministerio | 'todos'; subida: number; cuando: 'anio' | 'mes' }
  | { tipo: 'puestos'; ministerio: Ministerio; cantidad: number }
  | { tipo: 'pensiones'; revalorizacion: number | null }
  | { tipo: 'prestacion'; prestacionParado: number }
  /** Tesoro (tarea f20-t1): emitir a mano, recomprar deuda o cambiar el Tesoro automático. */
  // El Tesoro (tarea f20-t1). Sin reparto (null), el que tenga el Tesoro.
  | { tipo: 'emision'; importe: number; reparto: Reparto | null }
  | { tipo: 'recompra'; importe: number }
  | { tipo: 'tesoro'; automatico: boolean; reparto: Reparto | null };

/** Un cambio decidido y el día (el 1 de un mes) en que empieza a valer. */
export interface CambioProgramado {
  cambio: CambioPresupuesto;
  desde: string;
}

/** Gastos que no son de un ministerio. */
export const TRANSVERSALES = ['pensiones', 'desempleo', 'intereses'] as const;
export type Transversal = (typeof TRANSVERSALES)[number];

export interface PresupuestoPais {
  /** Ingresos por tipo, en dólares corrientes al ritmo de un año. */
  ingresos: Record<Ingreso, number>;
  /** Gasto de cada ministerio por partidas, en dólares corrientes al ritmo de un año. */
  ministerios: Record<Ministerio, Record<Partida, number>>;
  /** Pensiones, prestaciones por desempleo e intereses de la deuda. */
  transversales: Record<Transversal, number>;
  /** Deuda pública, en dólares corrientes. */
  deuda: number;
  /** Tipo de interés medio de la deuda (tanto por uno al año): el implícito de 2010. */
  tipoInteres: number;
  /**
   * Tipo efectivo de cada ingreso sobre su base (tanto por uno): lo recaudado en 2010 entre su
   * base de 2010. Con él, la recaudación sigue a la economía (y son los impuestos que el jugador
   * podrá cambiar en las Fases 21 y 22).
   */
  tipos: Record<Ingreso, number>;
  /**
   * Población activa (personas; ESTIMADA con la tasa de actividad de su nivel de renta). Crece con
   * la población.
   */
  activos: number;
  /**
   * Empleados públicos de cada ministerio (personas; ESTIMADOS con el sueldo medio de su nivel de
   * renta: ajuste f19-a1). Su gasto de personal, entre ellos, es su sueldo medio.
   */
  empleados: Record<Ministerio, number>;
  /**
   * Calendario de vencimientos (tarea f20-t1): la deuda que vence en cada uno de los próximos meses
   * (el primero, el mes que viene). Suma la deuda.
   */
  vencimientos: number[];
  /** El Tesoro (tarea f20-t1): si emite solo, con qué reparto de plazos y a qué tipos. */
  tesoro: TesoroPais;
  /** Cambios decididos que aún no valen, con el día en que empiezan (ajuste f19-a1). */
  pendientes: CambioProgramado[];
  /** Prestación media al año de cada parado, en dólares (fija hasta que se decida; Fase 19). */
  prestacionParado: number;
  /** Subida de las pensiones cada enero (tanto por uno); null: el IPC, como dice la ley. */
  revalorizacion: number | null;
  /** El presupuesto en vigor: el año en que se aprobó y si está prorrogado (Fase 19). */
  aprobado: { anio: number; prorrogado: boolean };
  /** Cómo era al empezar, para llevar a la economía lo que se decide (Fase 19). */
  referencia: ReferenciaPresupuesto;
  /**
   * Ingresos, gastos y deuda de cada mes desde que empezó (en % del PIB nominal, para los
   * gráficos; tarea f17-t3).
   */
  serie: { ingresos: number[]; gastos: number[]; deuda: number[] };
}

/**
 * El presupuesto de referencia (el de 2010, o el del momento de cargar una partida antigua), en
 * tanto por uno del PIB potencial nominal, con la demanda de la economía de entonces. Con él, cada
 * mes se lleva a la economía lo que ha cambiado por las decisiones (Fase 19).
 */
export interface ReferenciaPresupuesto {
  /** PIB potencial nominal de entonces (dólares). */
  potencial: number;
  /** Personal y mantenimiento (el consumo público). */
  funcionamiento: number;
  inversion: number;
  /** Programas, pensiones y prestaciones por desempleo (con el paro de referencia). */
  transferencias: number;
  /** Paro de referencia (tanto por uno). */
  paro: number;
  /** Tipo efectivo de cada ingreso y lo que recaudaba. */
  tipos: Record<Ingreso, number>;
  ingresos: Record<Ingreso, number>;
  /** La demanda de la economía (sin la confianza); null sin economía. */
  demanda: Pick<DemandaEconomia, 'consumo' | 'inversion' | 'consumoPublico'> | null;
}

/** Lo que la economía aporta a las bases de los ingresos (null: sin economía, todo el PIB). */
type EconomiaParaBases = Pick<
  EconomiaPais,
  'pib' | 'pibPotencial' | 'nivelPrecios' | 'paro' | 'demanda' | 'demandaBase' | 'meses'
>;

const b = config.bases;

/** La base de cada ingreso con la economía de ahora (dólares corrientes al año). */
export function basesDeIngresos(economia: EconomiaParaBases): Record<Ingreso, number> {
  const pib = pibNominal(economia);
  const brecha = brechaProduccion(economia);
  return {
    rentaPersonas: pib * Math.max(0, 1 + b.sensibilidadPersonas * brecha),
    rentaSociedades: pib * Math.max(b.minimoSociedades, 1 + b.sensibilidadSociedades * brecha),
    consumo: pib * economia.demanda.consumo,
    cotizaciones: pib * (1 - economia.paro),
    aranceles: pib * economia.demanda.importaciones,
    otrosImpuestos: pib,
    otrosIngresos: pib,
  };
}

/** Los datos de 2010 que usa (paises-2010.json, campo «datos»). */
export type DatosPresupuesto = DatosEconomia;

const dato = (datos: DatosPresupuesto, campo: string): number | null => {
  const valor = datos[campo];
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
};
const recortar = (valor: number, [minimo, maximo]: readonly [number, number]): number =>
  Math.min(maximo, Math.max(minimo, valor));
const suma = (valores: Iterable<number>): number => {
  let total = 0;
  for (const valor of valores) total += valor;
  return total;
};

/** Total de los ingresos (dólares al año). */
export function totalIngresos(presupuesto: Pick<PresupuestoPais, 'ingresos'>): number {
  return suma(Object.values(presupuesto.ingresos));
}

/** Gasto de un ministerio (todas sus partidas). */
export function gastoMinisterio(
  presupuesto: Pick<PresupuestoPais, 'ministerios'>,
  ministerio: Ministerio,
): number {
  return suma(Object.values(presupuesto.ministerios[ministerio]));
}

/** Total de los gastos (ministerios, pensiones, desempleo e intereses). */
export function totalGastos(
  presupuesto: Pick<PresupuestoPais, 'ministerios' | 'transversales'>,
): number {
  return (
    suma(MINISTERIOS.map((m) => gastoMinisterio(presupuesto, m))) +
    suma(Object.values(presupuesto.transversales))
  );
}

/** Saldo: ingresos menos gastos (negativo, déficit). */
export function saldo(presupuesto: PresupuestoPais): number {
  return totalIngresos(presupuesto) - totalGastos(presupuesto);
}

/** Lo que suman, entre todos los ministerios, cada una de las partidas. */
export function totalPorPartida(
  presupuesto: Pick<PresupuestoPais, 'ministerios'>,
): Record<Partida, number> {
  return Object.fromEntries(
    PARTIDAS.map((p) => [p, suma(MINISTERIOS.map((m) => presupuesto.ministerios[m][p]))]),
  ) as Record<Partida, number>;
}

/** Reparte `total` según unos pesos (que se normalizan; si no suman nada, a partes iguales). */
function repartir<K extends string>(total: number, pesos: Record<K, number>): Record<K, number> {
  const claves = Object.keys(pesos) as K[];
  const sumaPesos = suma(claves.map((k) => Math.max(0, pesos[k])));
  return Object.fromEntries(
    claves.map((k) => [
      k,
      sumaPesos > 0 ? (total * Math.max(0, pesos[k])) / sumaPesos : total / claves.length,
    ]),
  ) as Record<K, number>;
}

/**
 * Reparte el gasto de cada ministerio entre sus partidas de forma que cada ministerio sume lo
 * suyo y, entre todos, cada partida sume lo que el país gastó de verdad en ella (ajuste
 * proporcional iterativo a partir de los perfiles estimados de cada ministerio).
 */
function ajustarPartidas(
  totales: Record<Ministerio, number>,
  objetivo: Record<Partida, number>,
): Record<Ministerio, Record<Partida, number>> {
  const perfiles = config.perfilPartidas as Record<Ministerio, number[]>;
  const filas = MINISTERIOS.length;
  const columnas = PARTIDAS.length;
  // Tabla ministerio × partida (en una matriz plana: así es rápido, se hace en cada país).
  const tabla = new Float64Array(filas * columnas);
  const fila = MINISTERIOS.map((m) => totales[m]);
  const columna = PARTIDAS.map((p) => objetivo[p]);
  MINISTERIOS.forEach((m, i) => {
    for (let j = 0; j < columnas; j++) tabla[i * columnas + j] = fila[i]! * (perfiles[m]![j] ?? 0);
  });
  for (let vuelta = 0; vuelta < config.vueltasAjuste; vuelta++) {
    // Columnas: cada partida, a su total del país (y se para en cuanto ya cuadran).
    let desajuste = 0;
    for (let j = 0; j < columnas; j++) {
      let actual = 0;
      for (let i = 0; i < filas; i++) actual += tabla[i * columnas + j]!;
      if (actual <= 0) continue;
      const factor = columna[j]! / actual;
      desajuste = Math.max(desajuste, Math.abs(factor - 1));
      for (let i = 0; i < filas; i++) tabla[i * columnas + j]! *= factor;
    }
    // Filas: cada ministerio, a su total.
    for (let i = 0; i < filas; i++) {
      let actual = 0;
      for (let j = 0; j < columnas; j++) actual += tabla[i * columnas + j]!;
      if (actual <= 0) continue;
      const factor = fila[i]! / actual;
      for (let j = 0; j < columnas; j++) tabla[i * columnas + j]! *= factor;
    }
    if (desajuste < 1e-6) break;
  }
  return Object.fromEntries(
    MINISTERIOS.map((m, i) => [
      m,
      Object.fromEntries(PARTIDAS.map((p, j) => [p, tabla[i * columnas + j]!])),
    ]),
  ) as Record<Ministerio, Record<Partida, number>>;
}

/**
 * El presupuesto de 2010 de un país con sus datos (o null si falta el PIB o los totales del FMI),
 * sobre su economía de ahora (la de 2010 al empezar, o la de una partida guardada antes de la
 * Fase 17 al cargarla). Sin economía, sobre el PIB de los datos.
 */
export function presupuestoInicial(
  datos: DatosPresupuesto,
  nivel: NivelRenta,
  economia: EconomiaParaBases | null,
): PresupuestoPais | null {
  const ingresosPib = dato(datos, 'ingresosPublicosPib');
  const gastoPib = dato(datos, 'gastoPublicoPib');
  const pib = economia ? pibNominal(economia) : (dato(datos, 'pib') ?? 0);
  if (!(pib > 0) || ingresosPib === null || gastoPib === null) return null;
  const delPib = (porcentaje: number | null): number => ((porcentaje ?? 0) / 100) * pib;
  const totalIng = delPib(ingresosPib);
  const totalGas = delPib(gastoPib);

  // ── Ingresos: las partes del Banco Mundial sobre el total del FMI ──
  const renta = dato(datos, 'ingresosRenta') ?? 0;
  const personas = config.rentaPersonas[nivel];
  const ingresos = repartir(totalIng, {
    rentaPersonas: renta * personas,
    rentaSociedades: renta * (1 - personas),
    consumo: dato(datos, 'ingresosConsumo') ?? 0,
    cotizaciones: dato(datos, 'ingresosCotizaciones') ?? 0,
    aranceles: dato(datos, 'ingresosComercio') ?? 0,
    otrosImpuestos: dato(datos, 'ingresosOtrosImpuestos') ?? 0,
    otrosIngresos: dato(datos, 'ingresosOtros') ?? 0,
  } satisfies Record<Ingreso, number>);

  // ── Gastos que no son de un ministerio ──
  const deuda = delPib(dato(datos, 'deudaPib') ?? 0);
  const interesesDatos = (totalGas * (dato(datos, 'gastoIntereses') ?? 0)) / 100;
  const tipoInteres =
    deuda > 0
      ? recortar(interesesDatos / deuda, [config.tipoMinimo, config.tipoMaximo])
      : config.tipoMinimo;
  const transversales: Record<Transversal, number> = {
    pensiones: delPib((dato(datos, 'poblacionMayor65') ?? 0) * config.pensionesPorMayor[nivel]),
    desempleo: delPib((dato(datos, 'paro') ?? 0) * config.desempleoPorParado[nivel]),
    intereses: deuda * tipoInteres,
  };
  // No más de lo que cabe: el resto es para los ministerios.
  const maximoTransversal = totalGas * config.maximoTransversal;
  const sumaTransversal = suma(Object.values(transversales));
  if (sumaTransversal > maximoTransversal) {
    const factor = maximoTransversal / sumaTransversal;
    for (const t of TRANSVERSALES) transversales[t] *= factor;
  }
  const paraMinisterios = totalGas - suma(Object.values(transversales));

  // ── Ministerios: sanidad, educación y defensa reales; el resto, con los pesos estimados ──
  const conDatos = {
    sanidad: delPib(dato(datos, 'gastoSanidadPublicoPib')),
    educacion: delPib(dato(datos, 'gastoEducacionPib')),
    defensa: delPib(dato(datos, 'gastoDefensaPib')),
  };
  const maximoConDatos = paraMinisterios * config.maximoConDatos;
  const sumaConDatos = suma(Object.values(conDatos));
  const escala = sumaConDatos > maximoConDatos ? maximoConDatos / sumaConDatos : 1;
  const resto = paraMinisterios - sumaConDatos * escala;
  const pesos = config.pesoMinisterios as Record<string, number>;
  const totales = Object.fromEntries(
    MINISTERIOS.map((m) => [
      m,
      m in conDatos ? conDatos[m as keyof typeof conDatos] * escala : resto * (pesos[m] ?? 0),
    ]),
  ) as Record<Ministerio, number>;

  // ── Partidas: lo que el país gastó de verdad en personal, compras, inversión y el resto ──
  // El Banco Mundial da el gasto del gobierno central, que en los países descentralizados (España,
  // Alemania, EE. UU.) paga pocos sueldos: el personal y el mantenimiento suman el consumo público
  // de todas las administraciones (ONU), repartido como en el gobierno central; y la inversión
  // pública se corrige con lo mismo que le falta al gobierno central (entre 1 y «maximoDescentralizacion»).
  const sueldos = (totalGas * (dato(datos, 'gastoSueldos') ?? 0)) / 100;
  const compras = (totalGas * (dato(datos, 'gastoCompras') ?? 0)) / 100;
  const consumoPublico = delPib(dato(datos, 'consumoPublicoPib'));
  const funcionamiento = Math.min(
    consumoPublico > 0 ? consumoPublico : sueldos + compras,
    paraMinisterios * config.maximoFuncionamiento,
  );
  const parteSueldos = sueldos + compras > 0 ? sueldos / (sueldos + compras) : config.parteSueldos;
  const descentralizacion =
    sueldos + compras > 0
      ? recortar(funcionamiento / (sueldos + compras), [1, config.maximoDescentralizacion])
      : 1;
  const objetivoBruto = {
    personal: funcionamiento * parteSueldos,
    inversion: Math.max(0, delPib(dato(datos, 'inversionPublicaPib'))) * descentralizacion,
    mantenimiento: funcionamiento * (1 - parteSueldos),
    programas: 0,
  };
  objetivoBruto.programas = Math.max(
    paraMinisterios * config.minimoProgramas,
    paraMinisterios -
      objetivoBruto.personal -
      objetivoBruto.inversion -
      objetivoBruto.mantenimiento,
  );
  const objetivo = repartir(paraMinisterios, objetivoBruto);

  // Tipos efectivos sobre las bases de ahora (sin economía, todo sobre el PIB).
  const bases = economia
    ? basesDeIngresos(economia)
    : (Object.fromEntries(INGRESOS.map((i) => [i, pib])) as Record<Ingreso, number>);
  const tipos = Object.fromEntries(
    INGRESOS.map((i) => [i, bases[i] > 0 ? ingresos[i] / bases[i] : 0]),
  ) as Record<Ingreso, number>;
  const paro = economia?.paro ?? (dato(datos, 'paro') ?? 8) / 100;
  const activos = activosDe(datos, nivel, economia?.meses ?? 0);

  const ministerios = ajustarPartidas(totales, objetivo);
  const presupuesto: PresupuestoPais = {
    ingresos,
    ministerios,
    empleados: empleadosDe(ministerios, sueldoMedioDe(nivel, pib, activos)),
    pendientes: [],
    vencimientos: vencimientosIniciales(deuda),
    tesoro: tesoroInicial(tipoInteres),
    transversales,
    deuda,
    tipoInteres,
    tipos,
    activos,
    prestacionParado: paro > 0 && activos > 0 ? transversales.desempleo / (paro * activos) : 0,
    revalorizacion: null,
    aprobado: { anio: anioDe(economia?.meses ?? 0), prorrogado: false },
    referencia: null as unknown as ReferenciaPresupuesto,
    serie: { ingresos: [], gastos: [], deuda: [] },
  };
  presupuesto.referencia = referenciaDe(presupuesto, economia, pib);
  anotarMes(presupuesto, pib);
  return presupuesto;
}

const h = config.hacienda;

/** El año de la partida tras `meses` meses desde enero de 2010. */
const anioDe = (meses: number): number => 2010 + Math.floor(meses / 12);

/**
 * La población activa ESTIMADA (no hay datos abiertos en el conjunto de 2010): la población por la
 * tasa de actividad de su nivel de renta, crecida con la población los meses ya jugados.
 */
function activosDe(datos: DatosPresupuesto, nivel: NivelRenta, meses: number): number {
  const poblacion = dato(datos, 'poblacion') ?? 0;
  const crecimiento = configEconomia.crecimientoPoblacion[nivel];
  return poblacion * h.tasaActividad[nivel] * Math.pow(1 + crecimiento, meses / 12);
}

/**
 * El sueldo medio público ESTIMADO (ajuste f19-a1): «sueldoRelativo» de su nivel de renta por el
 * PIB nominal por activo.
 */
function sueldoMedioDe(nivel: NivelRenta, pib: number, activos: number): number {
  return activos > 0 ? (h.sueldoRelativo[nivel] * pib) / activos : 0;
}

/** Los empleados de cada ministerio: su gasto de personal entre el sueldo medio. */
function empleadosDe(
  ministerios: Record<Ministerio, Record<Partida, number>>,
  sueldo: number,
): Record<Ministerio, number> {
  return Object.fromEntries(
    MINISTERIOS.map((m) => [m, sueldo > 0 ? Math.round(ministerios[m].personal / sueldo) : 0]),
  ) as Record<Ministerio, number>;
}

/** El sueldo medio de los empleados de un ministerio (su gasto de personal entre ellos). */
export function sueldoMedio(presupuesto: PresupuestoPais, ministerio: Ministerio): number {
  const empleados = presupuesto.empleados[ministerio];
  return empleados > 0 ? presupuesto.ministerios[ministerio].personal / empleados : 0;
}

/** Personal y mantenimiento, inversión y programas de todos los ministerios. */
function porPartidas(presupuesto: PresupuestoPais): Record<Partida, number> {
  return totalPorPartida(presupuesto);
}

/** Las transferencias a los hogares por decisión (la prestación, con el paro de referencia). */
function transferencias(presupuesto: PresupuestoPais, paroReferencia: number): number {
  return (
    porPartidas(presupuesto).programas +
    presupuesto.transversales.pensiones +
    presupuesto.prestacionParado * paroReferencia * presupuesto.activos
  );
}

/** El presupuesto de ahora como referencia (en tanto por uno del PIB potencial nominal). */
function referenciaDe(
  presupuesto: PresupuestoPais,
  economia: EconomiaParaBases | null,
  pib: number,
): ReferenciaPresupuesto {
  const potencial = economia ? economia.pibPotencial * economia.nivelPrecios : pib;
  const partes = porPartidas(presupuesto);
  const paro = economia?.paro ?? 0;
  const delPotencial = (valor: number): number => (potencial > 0 ? valor / potencial : 0);
  return {
    potencial,
    funcionamiento: delPotencial(partes.personal + partes.mantenimiento),
    inversion: delPotencial(partes.inversion),
    transferencias: delPotencial(transferencias(presupuesto, paro)),
    paro,
    tipos: { ...presupuesto.tipos },
    ingresos: Object.fromEntries(
      INGRESOS.map((i) => [i, delPotencial(presupuesto.ingresos[i])]),
    ) as Record<Ingreso, number>,
    demanda: economia
      ? {
          consumo: economia.demandaBase.consumo,
          inversion: economia.demandaBase.inversion,
          consumoPublico: economia.demandaBase.consumoPublico,
        }
      : null,
  };
}

/**
 * Lleva a la economía lo que ha cambiado el presupuesto por las decisiones (Fase 19), frente a la
 * referencia y en tanto por uno del PIB potencial nominal: el personal y el mantenimiento son el
 * consumo público (en proporción); la inversión, inversión; y las transferencias a los hogares y
 * los impuestos que pagan, consumo (por la propensión a consumir). Así, un gasto congelado pesa
 * menos con la inflación y el crecimiento, y un recorte o una subida de impuestos frenan la demanda.
 */
export function llevarALaEconomia(presupuesto: PresupuestoPais, economia: EconomiaPais): void {
  const ref = presupuesto.referencia;
  if (!ref.demanda) return;
  const potencial = economia.pibPotencial * economia.nivelPrecios;
  if (!(potencial > 0)) return;
  const partes = porPartidas(presupuesto);
  const delPotencial = (valor: number): number => valor / potencial;
  const demanda = economia.demandaBase;
  if (ref.funcionamiento > 0) {
    demanda.consumoPublico =
      (ref.demanda.consumoPublico * delPotencial(partes.personal + partes.mantenimiento)) /
      ref.funcionamiento;
  }
  demanda.inversion = Math.max(
    0,
    ref.demanda.inversion + delPotencial(partes.inversion) - ref.inversion,
  );
  // Los impuestos de los hogares que han subido (o bajado) desde la referencia.
  const impuestos = (h.impuestosHogares as Ingreso[]).reduce(
    (total, i) =>
      total + (ref.tipos[i] > 0 ? ref.ingresos[i] * (presupuesto.tipos[i] / ref.tipos[i] - 1) : 0),
    0,
  );
  const masTransferencias =
    delPotencial(transferencias(presupuesto, ref.paro)) - ref.transferencias;
  demanda.consumo = Math.max(
    0,
    ref.demanda.consumo + h.propensionConsumo * (masTransferencias - impuestos),
  );
}

/** Lo que se redondea cada dato de las series (en % del PIB). */
const redondear = (valor: number): number => Math.round(valor * 1e3) / 1e3;

/** Anota en las series los ingresos, los gastos y la deuda de este mes, en % del PIB. */
function anotarMes(presupuesto: PresupuestoPais, pib: number): void {
  const enPib = (valor: number) => redondear(pib > 0 ? (valor / pib) * 100 : 0);
  presupuesto.serie.ingresos.push(enPib(totalIngresos(presupuesto)));
  presupuesto.serie.gastos.push(enPib(totalGastos(presupuesto)));
  presupuesto.serie.deuda.push(enPib(presupuesto.deuda));
}

const e = config.evolucion;
const ts = config.tesoro;

/** Lo que vence de la deuda de 2010 cada mes: unas letras el primer año y el resto en 10 años. */
export function vencimientosIniciales(deuda: number): number[] {
  const meses = ts.meses;
  const letras = deuda * ts.perfilInicial.letras;
  const resto = deuda - letras;
  const plazoLetras = ts.plazos.letras;
  return Array.from(
    { length: meses },
    (_, i) => (i < plazoLetras ? letras / plazoLetras : 0) + resto / meses,
  );
}

/** El Tesoro al empezar: automático, con el reparto de partida y el tipo medio de 2010. */
export function tesoroInicial(tipoInteres: number): TesoroPais {
  return {
    automatico: true,
    reparto: { ...ts.repartoInicial },
    tipos: { letras: tipoInteres, bonos5: tipoInteres, bonos10: tipoInteres },
    abierto: true,
    precioRecompra: 1,
    bajo: false,
  };
}

/** Un reparto válido: cada parte entre 0 y 1, y que sumen 1 (si no, el de partida). */
export function repartoValido(reparto: Partial<Reparto> | null | undefined): Reparto {
  const partes = PLAZOS.map((p) => {
    const v = reparto?.[p];
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
  });
  const total = partes.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return { ...ts.repartoInicial };
  return Object.fromEntries(PLAZOS.map((p, i) => [p, partes[i]! / total])) as Reparto;
}

/**
 * Emite deuda por `importe` (dólares) con un reparto de plazos (tarea f20-t1): cada parte, al tipo
 * de su plazo y con su vencimiento. El tipo medio de la deuda se mueve con lo nuevo.
 */
export function emitirDeuda(
  presupuesto: PresupuestoPais,
  estado: { tesoreria: number },
  importe: number,
  reparto: Reparto = presupuesto.tesoro.reparto,
): void {
  if (!(importe > 0)) return;
  const partes = repartoValido(reparto);
  let intereses = presupuesto.deuda * presupuesto.tipoInteres;
  for (const p of PLAZOS) {
    const monto = importe * partes[p];
    if (monto <= 0) continue;
    const indice = Math.min(presupuesto.vencimientos.length, ts.plazos[p]) - 1;
    presupuesto.vencimientos[indice] = (presupuesto.vencimientos[indice] ?? 0) + monto;
    intereses += monto * presupuesto.tesoro.tipos[p];
  }
  presupuesto.deuda += importe;
  presupuesto.tipoInteres = presupuesto.deuda > 0 ? intereses / presupuesto.deuda : 0;
  estado.tesoreria += importe;
}

/** Paga antes `importe` de los vencimientos más cercanos, a la par (el Tesoro, cuando sobra). */
export function amortizarDeuda(
  presupuesto: PresupuestoPais,
  estado: { tesoreria: number },
  importe: number,
): void {
  let queda = Math.min(importe, presupuesto.deuda);
  for (let i = 0; i < presupuesto.vencimientos.length && queda > 0; i++) {
    const pago = Math.min(queda, presupuesto.vencimientos[i]!);
    presupuesto.vencimientos[i]! -= pago;
    queda -= pago;
  }
  const pagado = Math.min(importe, presupuesto.deuda) - queda;
  presupuesto.deuda -= pagado;
  estado.tesoreria -= pagado;
}

/**
 * Recompra deuda gastando `importe` de la tesorería, al precio de mercado de este mes: cada dólar
 * retira 1 / precio de deuda, de todos los vencimientos por igual.
 */
export function recomprarDeuda(
  presupuesto: PresupuestoPais,
  estado: { tesoreria: number },
  importe: number,
): void {
  const gasto = Math.min(importe, Math.max(0, estado.tesoreria));
  const precio = presupuesto.tesoro.precioRecompra;
  if (!(gasto > 0) || !(precio > 0) || !(presupuesto.deuda > 0)) return;
  const retirada = Math.min(presupuesto.deuda, gasto / precio);
  const parte = retirada / presupuesto.deuda;
  presupuesto.vencimientos = presupuesto.vencimientos.map((v) => v * (1 - parte));
  presupuesto.deuda -= retirada;
  estado.tesoreria -= retirada * precio;
}

/** La curva de tipos del Tesoro (en src/sim/config/deuda.json). */
const cv = configDeuda.curva;

/** El tipo de cada plazo (%): el del mercado más su diferencial, nunca por debajo del mínimo. */
export function tipoDelPlazo(tipoMercado: number, plazo: Plazo): number {
  return Math.max(cv.minimo, tipoMercado + cv.diferencial[plazo]);
}

/**
 * Pone al Tesoro de un país los tipos de cada plazo, si puede emitir y el precio de recompra de su
 * deuda (tarea f20-t1). Con los mercados cerrados solo emite con un rescate, mientras decide o en
 * un impago (lo que debe a proveedores).
 */
export function ponerTiposDelTesoro(mercado: MercadoDeuda, presupuesto: PresupuestoPais): void {
  const programa = mercado.programa?.tipo;
  for (const p of PLAZOS) {
    presupuesto.tesoro.tipos[p] =
      programa === 'impago'
        ? 0
        : (programa === 'fmi' ? configDeuda.crisis.tipoFmi : tipoDelPlazo(mercado.tipoMercado, p)) /
          100;
  }
  presupuesto.tesoro.abierto =
    mercado.prima <= configDeuda.mercado.umbralCierre || programa !== undefined;
  // Recomprar: la deuda vale menos si el mercado pide más de lo que paga (y más si pide menos).
  const precio =
    1 + (presupuesto.tipoInteres - mercado.tipoMercado / 100) * vidaMediaRestante(presupuesto);
  presupuesto.tesoro.precioRecompra = Math.min(cv.precioMaximo, Math.max(cv.precioMinimo, precio));
}

/** La vida media que le queda a la deuda (años), con el calendario de vencimientos. */
export function vidaMediaRestante(presupuesto: Pick<PresupuestoPais, 'vencimientos'>): number {
  let total = 0;
  let ponderado = 0;
  presupuesto.vencimientos.forEach((v, i) => {
    total += v;
    ponderado += v * (i + 1);
  });
  return total > 0 ? ponderado / total / 12 : 0;
}

/**
 * Un mes del presupuesto (tarea f17-t3; responde a la economía, sin decisiones hasta la Fase 19):
 * la recaudación sigue a sus bases, los ministerios crecen con los precios y el potencial (y
 * pierden los recortes del ajuste forzoso), las pensiones suben con los precios y el
 * envejecimiento, el desempleo sigue al paro y los intereses, a la deuda. El saldo pasa por la
 * tesorería (`estado`), y el déficit se cubre con deuda.
 */
export function avanzarPresupuesto(
  presupuesto: PresupuestoPais,
  economia: EconomiaPais,
  estado: Pick<EstadoPais, 'tesoreria'>,
): void {
  const pib = pibNominal(economia);
  // Ingresos: el tipo efectivo por su base de ahora.
  const bases = basesDeIngresos(economia);
  for (const i of INGRESOS) presupuesto.ingresos[i] = presupuesto.tipos[i] * bases[i];
  // Los ministerios no cambian hasta que se decida otro presupuesto (Fase 19; los recortes de una
  // crisis de deuda los hace el mercado de la deuda). Las pensiones crecen con el envejecimiento
  // (más pensionistas; su subida de cada enero, en src/sim/hacienda.ts); el desempleo es la
  // prestación de cada parado por los parados; los intereses, la deuda por su tipo.
  presupuesto.activos *= Math.pow(
    1 + configEconomia.crecimientoPoblacion[economia.nivelRenta],
    1 / 12,
  );
  presupuesto.transversales.pensiones *= Math.pow(
    1 + e.envejecimiento[economia.nivelRenta],
    1 / 12,
  );
  presupuesto.transversales.desempleo =
    presupuesto.prestacionParado * economia.paro * presupuesto.activos;
  presupuesto.transversales.intereses = presupuesto.deuda * presupuesto.tipoInteres;
  // El saldo del mes pasa por la tesorería, y se paga la deuda que vence (tarea f20-t1).
  estado.tesoreria += saldo(presupuesto) / 12;
  const vence = Math.min(presupuesto.deuda, presupuesto.vencimientos.shift() ?? 0);
  presupuesto.vencimientos.push(0);
  presupuesto.deuda -= vence;
  estado.tesoreria -= vence;
  // El Tesoro automático emite lo que falta para el colchón (si se puede) y, si sobra, paga antes.
  const gastoMes = totalGastos(presupuesto) / 12;
  if (presupuesto.tesoro.automatico) {
    if (estado.tesoreria < e.colchonMeses * gastoMes) {
      if (presupuesto.tesoro.abierto) {
        emitirDeuda(presupuesto, estado, e.colchonMeses * gastoMes - estado.tesoreria);
      }
    } else if (estado.tesoreria > e.maximoMeses * gastoMes) {
      amortizarDeuda(presupuesto, estado, estado.tesoreria - e.objetivoMeses * gastoMes);
    }
  }
  // Lo decidido llega a la economía (para el mes que viene).
  llevarALaEconomia(presupuesto, economia);
  anotarMes(presupuesto, pib);
}

/** Sistema del presupuesto (tarea f17-t3): cada mes, después de la economía, en todos los países. */
export const sistemaPresupuesto: Sistema = (pasos, partida) => {
  for (const paso of pasos) {
    if (paso.ritmo !== 'mensual') continue;
    for (const estado of Object.values(partida.paises)) {
      if (estado.presupuesto && estado.economia) {
        avanzarPresupuesto(estado.presupuesto, estado.economia, estado);
      }
    }
  }
};

/** Lo que hace falta de cada país para completar el presupuesto de una partida guardada. */
export interface PaisParaPresupuesto {
  datos: DatosPresupuesto;
  nivelRenta?: string | null;
}

/**
 * Da el presupuesto a los países de una partida guardada antes de la Fase 17 (formato 5 o
 * anterior): el de 2010 en % del PIB, sobre el PIB nominal de ahora.
 */
export function completarPresupuesto(
  partida: PartidaJuego,
  paises: Record<string, PaisParaPresupuesto>,
): PartidaJuego {
  for (const [id, estado] of Object.entries(partida.paises)) {
    const pais = paises[id];
    if (estado.presupuesto === undefined) {
      estado.presupuesto = pais
        ? presupuestoInicial(pais.datos, nivelDe(pais.nivelRenta), estado.economia)
        : null;
    } else if (estado.presupuesto && !estado.presupuesto.referencia && pais) {
      completarHacienda(estado.presupuesto, estado.economia, pais);
    } else if (estado.presupuesto && !estado.presupuesto.empleados && pais) {
      completarEmpleo(estado.presupuesto, estado.economia, pais);
    } else if (estado.presupuesto && !estado.presupuesto.vencimientos) {
      completarTesoro(estado.presupuesto);
    } else {
      continue;
    }
    // Lo nuevo del Tesoro, con los tipos que pide hoy el mercado (si ya lo tiene).
    if (estado.presupuesto && estado.mercado) {
      ponerTiposDelTesoro(estado.mercado, estado.presupuesto);
    }
  }
  return partida;
}

/**
 * Lo que la Fase 19 añadió al presupuesto de las partidas de la v0.19.0 (formato 7): la población
 * activa y la prestación de cada parado, la subida de las pensiones por el IPC, el presupuesto en
 * vigor y la referencia (el de ahora: sin saltos al cargar).
 */
function completarHacienda(
  presupuesto: PresupuestoPais,
  economia: EconomiaPais | null | undefined,
  pais: PaisParaPresupuesto,
): void {
  const antiguo = presupuesto as PresupuestoPais & { porParado?: number; potencialVisto?: number };
  const meses = economia?.meses ?? 0;
  presupuesto.activos = activosDe(pais.datos, nivelDe(pais.nivelRenta), meses);
  const paro = economia?.paro ?? 0;
  presupuesto.prestacionParado =
    paro > 0 && presupuesto.activos > 0
      ? presupuesto.transversales.desempleo / (paro * presupuesto.activos)
      : 0;
  presupuesto.revalorizacion = null;
  presupuesto.aprobado = { anio: anioDe(meses), prorrogado: false };
  completarEmpleo(presupuesto, economia, pais);
  presupuesto.referencia = referenciaDe(
    presupuesto,
    economia ?? null,
    economia ? pibNominal(economia) : totalGastos(presupuesto),
  );
  delete antiguo.porParado;
  delete antiguo.potencialVisto;
}

/** Lo que el ajuste f19-a1 añadió: los empleados de cada ministerio y los cambios pendientes. */
function completarEmpleo(
  presupuesto: PresupuestoPais,
  economia: EconomiaPais | null | undefined,
  pais: PaisParaPresupuesto,
): void {
  const pib = economia ? pibNominal(economia) : totalGastos(presupuesto);
  presupuesto.empleados = empleadosDe(
    presupuesto.ministerios,
    sueldoMedioDe(nivelDe(pais.nivelRenta), pib, presupuesto.activos),
  );
  presupuesto.pendientes = [];
  completarTesoro(presupuesto);
}

/** Lo que la tarea f20-t1 añadió: el calendario de vencimientos y el Tesoro. */
function completarTesoro(presupuesto: PresupuestoPais): void {
  presupuesto.vencimientos = vencimientosIniciales(presupuesto.deuda);
  presupuesto.tesoro = tesoroInicial(presupuesto.tipoInteres);
}

/**
 * ¿Le falta el presupuesto (o lo de la Fase 19) a algún país? (Partidas de antes de la Fase 17 o
 * de la v0.19.0.)
 */
export function faltaPresupuesto(partida: Pick<PartidaJuego, 'paises'>): boolean {
  return Object.values(partida.paises).some(
    (estado) =>
      estado.presupuesto === undefined ||
      (estado.presupuesto !== null &&
        (!estado.presupuesto.referencia ||
          !estado.presupuesto.empleados ||
          !estado.presupuesto.vencimientos)),
  );
}
