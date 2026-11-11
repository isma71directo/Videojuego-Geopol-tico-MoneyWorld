/**
 * Catálogo de campos del conjunto final: de qué fuente sale cada uno, cómo se combina
 * cuando un país de 2010 son hoy varios, qué valor de respaldo se usa si falta y entre
 * qué límites es creíble.
 */
import type { GrupoCampo } from '../../../src/datos/paises.ts';

/** Archivo intermedio de fuentes/datos/ del que sale un indicador. */
export type Archivo = 'bm' | 'fmi' | 'energia' | 'emisiones' | 'recursos';

/** Sigla de cada archivo en el campo «origen». */
export const SIGLA: Record<Archivo, string> = {
  bm: 'BM',
  fmi: 'FMI',
  energia: 'OWID',
  emisiones: 'OWID',
  recursos: 'OWID',
};

export type Agregacion = 'suma' | 'media-poblacion' | 'media-pib';

export type Respaldo =
  /** Sin estimación: el campo queda vacío. */
  | 'ninguno'
  /** Mediana de los países de su misma región y nivel de renta. */
  | 'mediana'
  /** Mediana por habitante de su grupo, multiplicada por su población. */
  | 'per-capita'
  /** Se supone 0 (p. ej. un microestado sin producción de carbón). */
  | 'cero';

export interface Campo {
  clave: string;
  nombre: string;
  unidad: string;
  grupo: GrupoCampo;
  /** Fuentes por orden de preferencia; `factor` convierte a la unidad del campo. */
  fuentes: { archivo: Archivo; indicador: string; factor?: number }[];
  /** Años por orden de preferencia (por defecto 2010, 2009, 2008). */
  anios?: number[];
  agregacion: Agregacion;
  respaldo: Respaldo;
  /** Límites imposibles de superar: fuera de ellos el dato es un error. */
  limites: [number, number];
  /** Rango habitual: fuera de él el valor se lista en el informe para revisarlo. */
  habitual?: [number, number];
  /** La fuente solo lista productores: no figurar equivale a 0 (dato, no estimación). */
  ausenteEsCero?: boolean;
  /** La fuente no tiene el año del escenario: cualquier valor suyo es una estimación. */
  soloOtroAnio?: boolean;
}

const ANIOS_AMPLIOS = [2010, 2009, 2011, 2008, 2012, 2007, 2006, 2005];
const PORCENTAJE: [number, number] = [0, 100];
const ENERGIA: [number, number] = [0, 6000];

const bm = (indicador: string) => ({ archivo: 'bm' as const, indicador });
const fmi = (indicador: string, factor?: number) => ({
  archivo: 'fmi' as const,
  indicador,
  factor,
});

function energia(clave: string, nombre: string, respaldo: Respaldo): Campo {
  return {
    clave,
    nombre,
    unidad: 'TWh',
    grupo: 'energia',
    fuentes: [{ archivo: 'energia', indicador: clave }],
    agregacion: 'suma',
    respaldo,
    // La energía primaria y la producción de combustibles superan con mucho a la electricidad.
    limites: /^(consumoEnergiaPrimaria|produccion)/.test(clave) ? [0, 40000] : ENERGIA,
  };
}

function produccionMineral(mineral: string, nombre: string): Campo {
  return {
    clave: `produccion${mineral}`,
    nombre: `Producción minera de ${nombre}`,
    unidad: 'toneladas',
    grupo: 'recursos',
    fuentes: [{ archivo: 'recursos', indicador: `produccion${mineral}` }],
    agregacion: 'suma',
    respaldo: 'ninguno',
    limites: [0, 1e9],
    ausenteEsCero: true,
  };
}

function reservasMineral(mineral: string, nombre: string): Campo {
  return {
    clave: `reservas${mineral}`,
    nombre: `Reservas de ${nombre}`,
    unidad: 'toneladas',
    grupo: 'recursos',
    fuentes: [{ archivo: 'recursos', indicador: `reservas${mineral}` }],
    anios: [2022, 2023, 2024, 2025],
    agregacion: 'suma',
    respaldo: 'ninguno',
    limites: [0, 1e12],
    soloOtroAnio: true,
  };
}

export const CAMPOS: Campo[] = [
  // ── Demografía ──
  {
    clave: 'poblacion',
    nombre: 'Población',
    unidad: 'habitantes',
    grupo: 'demografia',
    fuentes: [
      bm('poblacion'),
      fmi('poblacion', 1e6),
      { archivo: 'energia', indicador: 'poblacion' },
    ],
    agregacion: 'suma',
    respaldo: 'ninguno',
    limites: [100, 2e9],
  },
  // ── Economía ──
  {
    clave: 'pib',
    nombre: 'PIB',
    unidad: 'US$ corrientes',
    grupo: 'economia',
    fuentes: [bm('pib'), fmi('pib', 1e9)],
    agregacion: 'suma',
    respaldo: 'per-capita',
    limites: [1e6, 3e13],
  },
  {
    clave: 'crecimientoPib',
    nombre: 'Crecimiento del PIB real',
    unidad: '% anual',
    grupo: 'economia',
    fuentes: [bm('crecimientoPib'), fmi('crecimientoPib')],
    agregacion: 'media-pib',
    respaldo: 'mediana',
    limites: [-60, 100],
    habitual: [-10, 15],
  },
  {
    clave: 'agriculturaPib',
    nombre: 'Agricultura, silvicultura y pesca',
    unidad: '% del PIB',
    grupo: 'economia',
    fuentes: [bm('agriculturaPib')],
    agregacion: 'media-pib',
    respaldo: 'mediana',
    limites: PORCENTAJE,
  },
  {
    clave: 'industriaPib',
    nombre: 'Industria y construcción',
    unidad: '% del PIB',
    grupo: 'economia',
    fuentes: [bm('industriaPib')],
    agregacion: 'media-pib',
    respaldo: 'mediana',
    limites: PORCENTAJE,
  },
  {
    clave: 'serviciosPib',
    nombre: 'Servicios',
    unidad: '% del PIB',
    grupo: 'economia',
    fuentes: [bm('serviciosPib')],
    agregacion: 'media-pib',
    respaldo: 'mediana',
    limites: PORCENTAJE,
  },
  {
    clave: 'paro',
    nombre: 'Paro',
    unidad: '% de la población activa',
    grupo: 'economia',
    fuentes: [bm('paro'), fmi('paro')],
    agregacion: 'media-poblacion',
    respaldo: 'mediana',
    limites: [0, 70],
    habitual: [0, 30],
  },
  {
    clave: 'inflacion',
    nombre: 'Inflación',
    unidad: '% anual',
    grupo: 'economia',
    fuentes: [bm('inflacion'), fmi('inflacion')],
    agregacion: 'media-pib',
    respaldo: 'mediana',
    limites: [-30, 1000],
    habitual: [-5, 30],
  },
  {
    clave: 'comercioPib',
    nombre: 'Comercio exterior (exportaciones más importaciones)',
    unidad: '% del PIB',
    grupo: 'economia',
    fuentes: [bm('comercioPib')],
    agregacion: 'media-pib',
    respaldo: 'mediana',
    limites: [0, 600],
  },
  {
    clave: 'cuentaCorrientePib',
    nombre: 'Balanza por cuenta corriente',
    unidad: '% del PIB',
    grupo: 'economia',
    fuentes: [fmi('cuentaCorrientePib')],
    agregacion: 'media-pib',
    respaldo: 'mediana',
    limites: [-300, 300],
    habitual: [-40, 40],
  },
  // ── Estado ──
  {
    clave: 'deudaPib',
    nombre: 'Deuda pública',
    unidad: '% del PIB',
    grupo: 'estado',
    // El FMI mide todas las administraciones; el Banco Mundial, solo el gobierno central.
    fuentes: [fmi('deudaPib'), bm('deudaPib')],
    agregacion: 'media-pib',
    respaldo: 'mediana',
    limites: [0, 400],
    habitual: [0, 150],
  },
  {
    clave: 'saldoFiscalPib',
    nombre: 'Saldo fiscal (superávit o déficit público)',
    unidad: '% del PIB',
    grupo: 'estado',
    fuentes: [fmi('saldoFiscalPib')],
    agregacion: 'media-pib',
    respaldo: 'mediana',
    limites: [-80, 80],
    habitual: [-15, 15],
  },
  {
    clave: 'gastoSanidadPib',
    nombre: 'Gasto en sanidad',
    unidad: '% del PIB',
    grupo: 'estado',
    fuentes: [bm('gastoSanidadPib')],
    agregacion: 'media-pib',
    respaldo: 'mediana',
    limites: [0, 40],
  },
  {
    clave: 'gastoEducacionPib',
    nombre: 'Gasto público en educación',
    unidad: '% del PIB',
    grupo: 'estado',
    fuentes: [bm('gastoEducacionPib')],
    anios: ANIOS_AMPLIOS,
    agregacion: 'media-pib',
    respaldo: 'mediana',
    limites: [0, 40],
  },
  {
    clave: 'gastoDefensaPib',
    nombre: 'Gasto militar',
    unidad: '% del PIB',
    grupo: 'estado',
    fuentes: [bm('gastoDefensaPib')],
    agregacion: 'media-pib',
    respaldo: 'mediana',
    limites: [0, 40],
    habitual: [0, 10],
  },
  {
    clave: 'efectivosMilitares',
    nombre: 'Personal de las fuerzas armadas',
    unidad: 'personas',
    grupo: 'estado',
    fuentes: [bm('efectivosMilitares')],
    agregacion: 'suma',
    respaldo: 'per-capita',
    limites: [0, 5e6],
  },
  // ── Sociedad ──
  {
    clave: 'esperanzaVida',
    nombre: 'Esperanza de vida al nacer',
    unidad: 'años',
    grupo: 'sociedad',
    fuentes: [bm('esperanzaVida')],
    agregacion: 'media-poblacion',
    respaldo: 'mediana',
    limites: [25, 90],
  },
  {
    clave: 'alfabetizacion',
    nombre: 'Alfabetización de adultos',
    unidad: '%',
    grupo: 'sociedad',
    fuentes: [bm('alfabetizacion')],
    anios: ANIOS_AMPLIOS,
    agregacion: 'media-poblacion',
    respaldo: 'mediana',
    limites: PORCENTAJE,
  },
  {
    clave: 'accesoElectricidad',
    nombre: 'Acceso a la electricidad',
    unidad: '% de la población',
    grupo: 'sociedad',
    fuentes: [bm('accesoElectricidad')],
    agregacion: 'media-poblacion',
    respaldo: 'mediana',
    limites: PORCENTAJE,
  },
  {
    clave: 'usuariosInternet',
    nombre: 'Usuarios de internet',
    unidad: '% de la población',
    grupo: 'sociedad',
    fuentes: [bm('usuariosInternet')],
    agregacion: 'media-poblacion',
    respaldo: 'mediana',
    limites: PORCENTAJE,
  },
  // ── Energía ──
  energia('generacionElectrica', 'Generación eléctrica', 'per-capita'),
  energia('demandaElectrica', 'Demanda eléctrica', 'per-capita'),
  {
    ...energia('importacionesNetasElectricidad', 'Importaciones netas de electricidad', 'cero'),
    limites: [-500, 500],
  },
  energia('elecCarbon', 'Electricidad de carbón', 'cero'),
  energia('elecGas', 'Electricidad de gas', 'cero'),
  energia('elecPetroleo', 'Electricidad de petróleo y fuel', 'cero'),
  energia('elecNuclear', 'Electricidad nuclear', 'cero'),
  energia('elecHidraulica', 'Electricidad hidráulica', 'cero'),
  energia('elecEolica', 'Electricidad eólica', 'cero'),
  energia('elecSolar', 'Electricidad solar', 'cero'),
  energia('elecBiomasa', 'Electricidad de biomasa', 'cero'),
  energia('elecOtrasRenovables', 'Electricidad de otras renovables', 'cero'),
  energia('consumoEnergiaPrimaria', 'Consumo de energía primaria', 'per-capita'),
  energia('produccionCarbon', 'Producción de carbón', 'cero'),
  energia('produccionPetroleo', 'Producción de petróleo', 'cero'),
  energia('produccionGas', 'Producción de gas natural', 'cero'),
  // ── Emisiones ──
  {
    clave: 'co2',
    nombre: 'Emisiones de CO₂',
    unidad: 'millones de toneladas',
    grupo: 'emisiones',
    fuentes: [{ archivo: 'emisiones', indicador: 'co2' }],
    agregacion: 'suma',
    respaldo: 'per-capita',
    limites: [0, 15000],
  },
  {
    clave: 'co2Acumulado',
    nombre: 'CO₂ acumulado desde 1750',
    unidad: 'millones de toneladas',
    grupo: 'emisiones',
    fuentes: [{ archivo: 'emisiones', indicador: 'co2Acumulado' }],
    agregacion: 'suma',
    respaldo: 'per-capita',
    limites: [0, 500000],
  },
  {
    clave: 'gasesInvernadero',
    nombre: 'Gases de efecto invernadero',
    unidad: 'millones de toneladas de CO₂ equivalente',
    grupo: 'emisiones',
    fuentes: [{ archivo: 'emisiones', indicador: 'gasesInvernadero' }],
    agregacion: 'suma',
    respaldo: 'per-capita',
    limites: [-500, 15000],
  },
  // ── Recursos ──
  {
    clave: 'reservasPetroleo',
    nombre: 'Reservas probadas de petróleo',
    unidad: 'millones de barriles',
    grupo: 'recursos',
    fuentes: [{ archivo: 'recursos', indicador: 'reservasPetroleo' }],
    agregacion: 'suma',
    respaldo: 'cero',
    limites: [0, 400000],
  },
  {
    clave: 'reservasGas',
    nombre: 'Reservas probadas de gas natural',
    unidad: 'miles de millones de m³',
    grupo: 'recursos',
    fuentes: [{ archivo: 'recursos', indicador: 'reservasGas' }],
    agregacion: 'suma',
    respaldo: 'cero',
    limites: [0, 80000],
  },
  {
    clave: 'reservasCarbon',
    nombre: 'Reservas probadas de carbón',
    unidad: 'millones de toneladas',
    grupo: 'recursos',
    fuentes: [{ archivo: 'recursos', indicador: 'reservasCarbon' }],
    agregacion: 'suma',
    respaldo: 'cero',
    limites: [0, 400000],
  },
  produccionMineral('Cobre', 'cobre'),
  produccionMineral('Bauxita', 'bauxita'),
  produccionMineral('Litio', 'litio'),
  produccionMineral('Cobalto', 'cobalto'),
  produccionMineral('Oro', 'oro'),
  produccionMineral('Plata', 'plata'),
  produccionMineral('Fosfatos', 'roca fosfática'),
  produccionMineral('Uranio', 'uranio'),
  reservasMineral('Hierro', 'mineral de hierro'),
  reservasMineral('Cobre', 'cobre'),
  reservasMineral('Bauxita', 'bauxita'),
  reservasMineral('Niquel', 'níquel'),
  reservasMineral('Litio', 'litio'),
  reservasMineral('Cobalto', 'cobalto'),
  reservasMineral('TierrasRaras', 'tierras raras'),
  reservasMineral('Oro', 'oro'),
  reservasMineral('Plata', 'plata'),
  reservasMineral('Fosfatos', 'roca fosfática'),
];

/** Campos calculados a partir de otros (no salen de ninguna fuente). */
export const DERIVADOS: (Omit<Campo, 'fuentes' | 'agregacion' | 'respaldo'> & {
  de: [string, string];
  calcular: (a: number, b: number) => number;
})[] = [
  {
    clave: 'pibPerCapita',
    nombre: 'PIB per cápita',
    unidad: 'US$ corrientes',
    grupo: 'economia',
    de: ['pib', 'poblacion'],
    calcular: (pib, poblacion) => pib / poblacion,
    limites: [50, 300000],
  },
  {
    clave: 'co2PerCapita',
    nombre: 'Emisiones de CO₂ por habitante',
    unidad: 'toneladas',
    grupo: 'emisiones',
    de: ['co2', 'poblacion'],
    calcular: (co2, poblacion) => (co2 * 1e6) / poblacion,
    limites: [0, 100],
  },
];

/** Los tres grandes sectores, que deben sumar el 100 % del PIB. */
export const SECTORES = ['agriculturaPib', 'industriaPib', 'serviciosPib'];

/** Fuentes del mix eléctrico, que deben sumar la generación total. */
export const MIX_ELECTRICO = [
  'elecCarbon',
  'elecGas',
  'elecPetroleo',
  'elecNuclear',
  'elecHidraulica',
  'elecEolica',
  'elecSolar',
  'elecBiomasa',
  'elecOtrasRenovables',
];

/**
 * Umbrales del Banco Mundial para clasificar los países por su RNB per cápita de 2010
 * (clasificación del ejercicio 2012): bajo ≤ 1.005 $; medio-bajo ≤ 3.975 $;
 * medio-alto ≤ 12.275 $; alto por encima.
 */
export const UMBRALES_RENTA: [number, 'bajo' | 'medio-bajo' | 'medio-alto'][] = [
  [1005, 'bajo'],
  [3975, 'medio-bajo'],
  [12275, 'medio-alto'],
];
