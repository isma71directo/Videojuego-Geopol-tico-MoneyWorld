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
