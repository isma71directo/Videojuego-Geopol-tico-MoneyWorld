/**
 * Capas del mapa (tareas f6-t1 y f6-t2): cada capa da a cada país un color según un dato de
 * 2010, por tramos redondos. Los países sin dato van en gris neutro y los datos estimados se
 * marcan con un rayado. Las capas de riqueza y población colorean también las regiones al
 * acercarse. Lógica pura, con tests; los tramos y las rampas están en config/capas.json.
 */
import { geoArea } from 'd3-geo';
import type { Feature } from 'geojson';
import { esEstimado, type PaisDatos } from '../datos/paises';
import configuracion from './config/capas.json';
import { hexDeOklch, rampaDivergente, rampaSecuencial, type Brazo, type Oklch } from './rampas';

export type FormatoCapa = 'dolaresPorPersona' | 'personas' | 'porcentaje' | 'reservas' | 'densidad';

type RampaConfig =
  | { tipo: 'secuencial'; desde: Oklch; hasta: Oklch }
  | { tipo: 'divergente'; centro: Oklch; bajo: Brazo; alto: Brazo };

interface CapaConfig {
  id: string;
  grupo?: string;
  campo: string;
  formato: FormatoCapa;
  tramos: number[];
  /** Valor que separa los dos brazos de una rampa divergente (debe ser uno de los tramos). */
  centro?: number;
  /** Si el valor 0 tiene clase propia («sin reservas»). */
  cero?: boolean;
  /** La leyenda muestra los tramos divididos entre esto (p. ej. millones de habitantes). */
  escalaLeyenda?: number;
  /** Si al acercarse colorea también las regiones (riqueza y población). */
  porRegion?: boolean;
  rampa: RampaConfig;
}

export interface CapaDatos {
  id: string;
  /** Capas que se eligen juntas (p. ej. «recursos»: petróleo, gas y carbón). */
  grupo: string;
  campo: string;
  formato: FormatoCapa;
  tramos: readonly number[];
  cero: boolean;
  escalaLeyenda: number;
  porRegion: boolean;
  /** Un color por clase, de la más baja a la más alta (sin la clase del cero). */
  colores: readonly string[];
}

/** La capa política (la de siempre: un color por país) o una capa de datos. */
export type IdCapa = 'politica' | string;

export const COLOR_SIN_DATOS = hexDeOklch(configuracion.sinDatos as unknown as Oklch);
export const COLOR_SIN_RESERVAS = hexDeOklch(configuracion.sinReservas as unknown as Oklch);

function crearCapa(config: CapaConfig): CapaDatos {
  const clases = config.tramos.length + 1;
  const { rampa } = config;
  let colores: string[];
  if (rampa.tipo === 'secuencial') {
    colores = rampaSecuencial(clases, rampa.desde, rampa.hasta);
  } else {
    const indice = config.tramos.indexOf(config.centro ?? Number.NaN);
    if (indice < 0) throw new Error(`Capa ${config.id}: el centro debe ser uno de los tramos`);
    colores = rampaDivergente(
      indice + 1,
      clases - indice - 1,
      rampa.centro,
      rampa.bajo,
      rampa.alto,
    );
  }
  return {
    id: config.id,
    grupo: config.grupo ?? config.id,
    campo: config.campo,
    formato: config.formato,
    tramos: config.tramos,
    cero: config.cero ?? false,
    escalaLeyenda: config.escalaLeyenda ?? 1,
    porRegion: config.porRegion ?? false,
    colores,
  };
}

/** Capas de datos, en el orden en que se ofrecen. */
export const CAPAS: readonly CapaDatos[] = (configuracion.capas as unknown as CapaConfig[]).map(
  crearCapa,
);

export function capaPorId(id: string): CapaDatos | null {
  return CAPAS.find((capa) => capa.id === id) ?? null;
}

/**
 * Clase de un valor: 0 para lo que queda por debajo del primer tramo y tramos.length para lo
 * que llega al último. Un valor igual a un tramo va a la clase de arriba.
 */
export function claseDe(valor: number, tramos: readonly number[]): number {
  let clase = 0;
  while (clase < tramos.length && valor >= tramos[clase]!) clase++;
  return clase;
}

/** Color de un valor en una capa; las capas con «cero» dan su color propio al 0. */
export function colorDe(capa: CapaDatos, valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return COLOR_SIN_DATOS;
  if (capa.cero && valor <= 0) return COLOR_SIN_RESERVAS;
  return capa.colores[claseDe(valor, capa.tramos)]!;
}

/** Radio medio de la Tierra, en km (para pasar de estereorradianes a km²). */
export const RADIO_TIERRA_KM = 6371.0088;
/**
 * Por debajo de esta superficie, la medida en el mapa no sirve para calcular la densidad de una
 * región (las más pequeñas, como Ceuta, miden unos 19 km²).
 */
export const SUPERFICIE_MINIMA_KM2 = 5;

/** Superficie de una forma del mapa (longitud y latitud), en km². */
export function superficieKm2(forma: Feature): number {
  return geoArea(forma) * RADIO_TIERRA_KM ** 2;
}

/** Valor de un país o una región en una capa y si es una estimación. */
export interface ValorCapa {
  valor: number;
  estimado: boolean;
}

/** Valor de un país en la capa (null si no hay dato). */
export function valorPais(capa: CapaDatos, pais: PaisDatos): ValorCapa | null {
  const valor = pais.datos[capa.campo];
  if (valor === null || valor === undefined) return null;
  return { valor, estimado: esEstimado(pais.origen[capa.campo]) };
}

/** Datos de una región (public/data/regiones-2010-datos.json). */
export interface DatosRegionCapa {
  poblacion: number | null;
  origenPoblacion: string | null;
  pib: number | null;
  origenPib: string | null;
}

const estimadoRegion = (origen: string | null): boolean => esEstimado(origen ?? undefined);

/**
 * Valor de una región en la capa; null si la capa no se ve por regiones o falta el dato. La
 * densidad de una región usa la superficie medida en el mapa (no hay dato oficial por región).
 */
export function valorRegion(
  capa: CapaDatos,
  datos: DatosRegionCapa | null | undefined,
  superficie?: number,
): ValorCapa | null {
  if (!capa.porRegion || !datos || !datos.poblacion) return null;
  const poblacionEstimada = estimadoRegion(datos.origenPoblacion);
  switch (capa.campo) {
    case 'pibPerCapita':
      return datos.pib
        ? {
            valor: datos.pib / datos.poblacion,
            estimado: poblacionEstimada || estimadoRegion(datos.origenPib),
          }
        : null;
    case 'poblacion':
      return { valor: datos.poblacion, estimado: poblacionEstimada };
    case 'densidad':
      return superficie !== undefined && superficie >= SUPERFICIE_MINIMA_KM2
        ? { valor: datos.poblacion / superficie, estimado: poblacionEstimada }
        : null;
    default:
      return null;
  }
}

/** Color de una región y si va rayada. */
export interface ColorRegion {
  color: string;
  rayado: boolean;
}

/** Lo que el mapa necesita para pintar una capa de datos. */
export interface Coloreado {
  /** Color de cada país con dato. */
  colores: Map<string, string>;
  /** Países cuyo dato es una estimación (se dibujan con rayado). */
  rayados: Set<string>;
  /** Color de los países que no tienen dato. */
  sinDatos: string;
  /**
   * Color de una región cuando su país se ve con regiones (solo en las capas por región); null
   * si no tiene dato, y entonces se ve el color de su país.
   */
  region?: (id: string, forma: Feature) => ColorRegion | null;
}

export function colorearCapa(capa: CapaDatos, paises: Record<string, PaisDatos>): Coloreado {
  const colores = new Map<string, string>();
  const rayados = new Set<string>();
  for (const pais of Object.values(paises)) {
    const dato = valorPais(capa, pais);
    if (!dato) continue;
    colores.set(pais.id, colorDe(capa, dato.valor));
    if (dato.estimado) rayados.add(pais.id);
  }
  return { colores, rayados, sinDatos: COLOR_SIN_DATOS };
}

/** Función que da el color de cada región en una capa por regiones (o undefined si no lo es). */
export function colorearRegiones(
  capa: CapaDatos,
  datos: Readonly<Record<string, DatosRegionCapa>>,
): Coloreado['region'] {
  if (!capa.porRegion) return undefined;
  return (id, forma) => {
    const dato = valorRegion(
      capa,
      datos[id],
      capa.campo === 'densidad' ? superficieKm2(forma) : undefined,
    );
    return dato ? { color: colorDe(capa, dato.valor), rayado: dato.estimado } : null;
  };
}

/** Una línea de la leyenda: su color y sus límites (null en el extremo abierto). */
export interface EntradaLeyenda {
  color: string;
  /** «cero»: la clase del valor 0 («sin reservas»). */
  tipo: 'tramo' | 'cero';
  desde: number | null;
  hasta: number | null;
}

/** Entradas de la leyenda, de la clase más alta a la más baja (como se leen de arriba abajo). */
export function entradasLeyenda(capa: CapaDatos): EntradaLeyenda[] {
  const escala = capa.escalaLeyenda;
  const entradas: EntradaLeyenda[] = capa.colores.map((color, clase) => ({
    color,
    tipo: 'tramo',
    desde: clase === 0 ? null : capa.tramos[clase - 1]! / escala,
    hasta: clase === capa.tramos.length ? null : capa.tramos[clase]! / escala,
  }));
  if (capa.cero) entradas.unshift({ color: COLOR_SIN_RESERVAS, tipo: 'cero', desde: 0, hasta: 0 });
  return entradas.reverse();
}
