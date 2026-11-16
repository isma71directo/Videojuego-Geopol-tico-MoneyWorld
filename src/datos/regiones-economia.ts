/**
 * Formato de /public/data/regiones-2010-economia.json (tarea f9-t1): superficie, capital,
 * ciudades principales, peso de cada sector y recursos de cada región en 2010. Lo genera
 * scripts/datos/21-regiones-economia.ts; aquí están los tipos y la lista de recursos.
 */

/** Recursos que puede tener una región (claves del script), agrupados por tipo. */
export const RECURSOS_POR_TIPO = {
  energia: ['petroleo', 'gas', 'carbon', 'uranio'],
  preciosos: ['oro', 'plata', 'platino', 'diamantes', 'piedras-preciosas'],
  metales: [
    'cobre',
    'hierro',
    'bauxita',
    'zinc',
    'plomo',
    'niquel',
    'estano',
    'cromo',
    'manganeso',
    'molibdeno',
    'titanio',
    'vanadio',
    'circonio',
    'mercurio',
    'antimonio',
    'bismuto',
  ],
  estrategicos: [
    'litio',
    'cobalto',
    'tierras-raras',
    'niobio-tantalio',
    'wolframio',
    'grafito',
    'berilio',
  ],
  industriales: [
    'fosfatos',
    'potasa',
    'sal',
    'azufre',
    'fluorita',
    'barita',
    'yeso',
    'magnesio',
    'boro',
    'carbonato-sodio',
    'sulfato-sodio',
    'yodo',
    'arcillas',
    'talco',
    'amianto',
    'estroncio',
    'caliza',
    'granate',
    'otros-minerales',
  ],
} as const;

export type TipoRecurso = keyof typeof RECURSOS_POR_TIPO;
export type Recurso = (typeof RECURSOS_POR_TIPO)[TipoRecurso][number];

export const RECURSOS: readonly Recurso[] = Object.values(RECURSOS_POR_TIPO).flat();

/** Tipo de un recurso (energía, metales preciosos…). */
export function tipoDeRecurso(recurso: Recurso): TipoRecurso {
  return (Object.keys(RECURSOS_POR_TIPO) as TipoRecurso[]).find((tipo) =>
    (RECURSOS_POR_TIPO[tipo] as readonly string[]).includes(recurso),
  )!;
}

/** Ciudad de la región: nombre, población y si es la capital del país o de la región. */
export type CiudadRegion = [
  nombre: string,
  poblacion: number | null,
  marca: '' | 'pais' | 'region',
];

/** Recurso de la región: clave, yacimientos registrados, ejemplos y fuente («USGS», «WD»…). */
export type RecursoRegion = [
  recurso: Recurso,
  yacimientos: number,
  ejemplos: string[],
  origen: string,
];

export interface EconomiaRegion {
  /** km². */
  superficie: number | null;
  /** «WD» (suma de sus unidades en Wikidata), «EST:mapa» o el origen del dato del país. */
  origenSuperficie: string | null;
  /** Solo cuando es segura. */
  capital: string | null;
  /** «NE» (Natural Earth), «WD» (Wikidata) o «pais» (la capital del país). */
  origenCapital: string | null;
  /** Las más pobladas primero. */
  ciudades: CiudadRegion[];
  /** Peso de la agricultura, la industria y los servicios (suman 1), o null sin dato de DOSE. */
  sectores: [agricultura: number, industria: number, servicios: number] | null;
  /** «DOSE:2010» o «DOSE:2010:conjunto» (dato de una región de DOSE que abarca varias). */
  origenSectores: string | null;
  /** De más a menos yacimientos. */
  recursos: RecursoRegion[];
}

export interface ConjuntoEconomiaRegiones {
  fuente: string;
  fecha: string;
  notas: Record<string, string>;
  regiones: Record<string, EconomiaRegion>;
}

export const SECTORES = ['agricultura', 'industria', 'servicios'] as const;
export type Sector = (typeof SECTORES)[number];

export interface Actividad {
  /** El sector que más pesa en la región. */
  principal: Sector;
  peso: number;
  /**
   * El sector en el que la región destaca respecto a su país (pesa al menos un 30 % más que en
   * la media del país y un 10 % de la economía de la región), si lo hay y no es el principal.
   */
  destaca: { sector: Sector; peso: number; mediaPais: number } | null;
}

/** Peso de cada sector en un país a partir de sus porcentajes del PIB (null si falta alguno). */
export function sectoresDePais(
  agricultura: number | null | undefined,
  industria: number | null | undefined,
  servicios: number | null | undefined,
): [number, number, number] | null {
  const valores = [agricultura, industria, servicios];
  if (valores.some((v) => v === null || v === undefined || v < 0)) return null;
  const suma = (valores as number[]).reduce((s, v) => s + v, 0);
  return suma > 0 ? ((valores as number[]).map((v) => v / suma) as [number, number, number]) : null;
}

/** Actividad económica principal de una región y en qué destaca frente a su país. */
export function actividadPrincipal(
  sectores: readonly [number, number, number],
  pais: readonly [number, number, number] | null,
): Actividad {
  const indice = sectores.indexOf(Math.max(...sectores));
  const principal = SECTORES[indice]!;
  let destaca: Actividad['destaca'] = null;
  if (pais) {
    let mejor = 1.3;
    SECTORES.forEach((sector, i) => {
      const razon = pais[i]! > 0 ? sectores[i]! / pais[i]! : 0;
      if (sector !== principal && sectores[i]! >= 0.1 && razon >= mejor) {
        mejor = razon;
        destaca = { sector, peso: sectores[i]!, mediaPais: pais[i]! };
      }
    });
  }
  return { principal, peso: sectores[indice]!, destaca };
}
