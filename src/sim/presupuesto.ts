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
 * Motor puro, sin interfaz.
 */
import config from './config/presupuesto.json';
import {
  brechaProduccion,
  nivelDe,
  pibNominal,
  type DatosEconomia,
  type EconomiaPais,
  type NivelRenta,
} from './economia';
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
   * podrá cambiar en las Fases 24 y 25).
   */
  tipos: Record<Ingreso, number>;
  /** Prestación al año por cada punto de paro y dólar de PIB nominal (para que siga al paro). */
  porParado: number;
  /** PIB potencial nominal el último mes: los ministerios crecen con él (tarea f17-t3). */
  potencialVisto: number;
  /**
   * Ingresos, gastos y deuda de cada mes desde que empezó (en % del PIB nominal, para los
   * gráficos; tarea f17-t3).
   */
  serie: { ingresos: number[]; gastos: number[]; deuda: number[] };
}

/** Lo que la economía aporta a las bases de los ingresos (null: sin economía, todo el PIB). */
type EconomiaParaBases = Pick<
  EconomiaPais,
  'pib' | 'pibPotencial' | 'nivelPrecios' | 'paro' | 'demanda' | 'demandaBase'
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

  const presupuesto: PresupuestoPais = {
    ingresos,
    ministerios: ajustarPartidas(totales, objetivo),
    transversales,
    deuda,
    tipoInteres,
    tipos,
    porParado: paro > 0 ? transversales.desempleo / (paro * pib) : 0,
    potencialVisto: economia ? economia.pibPotencial * economia.nivelPrecios : pib,
    serie: { ingresos: [], gastos: [], deuda: [] },
  };
  anotarMes(presupuesto, pib);
  return presupuesto;
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

/**
 * Un mes del presupuesto (tarea f17-t3; responde a la economía, sin decisiones hasta la Fase 23):
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
  const precios = Math.pow(1 + economia.inflacion, 1 / 12);
  // Ingresos: el tipo efectivo por su base de ahora.
  const bases = basesDeIngresos(economia);
  for (const i of INGRESOS) presupuesto.ingresos[i] = presupuesto.tipos[i] * bases[i];
  // Ministerios: con el PIB potencial nominal (precios y capacidad), así que pesan lo mismo con la
  // economía en su potencial y más si cae por debajo (estabilizador automático). (Los recortes de
  // una crisis de deuda los hace el mercado de la deuda: src/sim/deuda.ts.)
  const potencial = economia.pibPotencial * economia.nivelPrecios;
  const crecer = presupuesto.potencialVisto > 0 ? potencial / presupuesto.potencialVisto : precios;
  presupuesto.potencialVisto = potencial;
  for (const m of MINISTERIOS) {
    for (const p of PARTIDAS) presupuesto.ministerios[m][p] *= crecer;
  }
  // Pensiones, con los precios y el envejecimiento; desempleo, con el paro; intereses, con la deuda.
  presupuesto.transversales.pensiones *=
    precios * Math.pow(1 + e.envejecimiento[economia.nivelRenta], 1 / 12);
  presupuesto.transversales.desempleo = presupuesto.porParado * economia.paro * pib;
  presupuesto.transversales.intereses = presupuesto.deuda * presupuesto.tipoInteres;
  // El saldo del mes pasa por la tesorería; el déficit se cubre con deuda y el superávit la paga.
  estado.tesoreria += saldo(presupuesto) / 12;
  const gastoMes = totalGastos(presupuesto) / 12;
  if (estado.tesoreria < e.colchonMeses * gastoMes) {
    const emitir = e.colchonMeses * gastoMes - estado.tesoreria;
    presupuesto.deuda += emitir;
    estado.tesoreria += emitir;
  } else if (estado.tesoreria > e.maximoMeses * gastoMes) {
    const amortizar = Math.min(presupuesto.deuda, estado.tesoreria - e.objetivoMeses * gastoMes);
    presupuesto.deuda -= amortizar;
    estado.tesoreria -= amortizar;
  }
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
    if (estado.presupuesto !== undefined) continue;
    const pais = paises[id];
    estado.presupuesto = pais
      ? presupuestoInicial(pais.datos, nivelDe(pais.nivelRenta), estado.economia)
      : null;
  }
  return partida;
}

/** ¿Le falta el presupuesto a algún país? (Partidas de antes de la Fase 17.) */
export function faltaPresupuesto(partida: Pick<PartidaJuego, 'paises'>): boolean {
  return Object.values(partida.paises).some((estado) => estado.presupuesto === undefined);
}
