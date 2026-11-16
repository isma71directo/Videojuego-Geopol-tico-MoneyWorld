/**
 * Formato de /public/data/gobiernos-2010.json (tarea f8-t1): régimen político y jefes de Estado
 * y de Gobierno de cada país el 1 de enero de 2010. Lo genera scripts/datos/20-gobiernos.ts con
 * datos de Wikidata y correcciones a mano anotadas; aquí solo están los tipos y unas utilidades.
 */

/** Los 8 regímenes del GDD (sección 6.15). */
export const REGIMENES = [
  'parlamentario',
  'presidencial',
  'semipresidencial',
  'monarquia-parlamentaria',
  'monarquia-absoluta',
  'partido-unico',
  'junta',
  'teocracia',
] as const;

export type Regimen = (typeof REGIMENES)[number];

export interface CargoOcupado {
  /** Identificador de la persona en Wikidata («Q76»). */
  persona: string;
  /** Nombre del cargo, en español y ya en femenino si lo ocupa una mujer. */
  cargo: string;
  /** Desde cuándo lo ocupa («AAAA-MM-DD»). */
  desde: string;
}

export interface GobiernoPais {
  /** null en los territorios dependientes y en las zonas sin Estado. */
  regimen: Regimen | null;
  /** De dónde sale el régimen: «manual: …», «wikidata: …» o «regla: …». */
  regimenFuente: string;
  estado: CargoOcupado | null;
  /** «estado» si el jefe de Estado encabeza también el Gobierno. */
  gobierno: CargoOcupado | 'estado' | null;
  fuente: 'wikidata' | 'manual' | 'wikidata y manual';
}

export interface Persona {
  nombre: string;
  /** «h» hombre, «m» mujer o null si Wikidata no lo dice. */
  sexo: 'h' | 'm' | null;
  /** Año de nacimiento. */
  nacimiento: number | null;
}

export interface ConjuntoGobiernos {
  fuente: string;
  fecha: string;
  paises: Record<string, GobiernoPais>;
  personas: Record<string, Persona>;
}

/** Jefe de Gobierno de un país (el mismo que el de Estado si lo es). */
export function jefeGobierno(gobierno: GobiernoPais): CargoOcupado | null {
  return gobierno.gobierno === 'estado' ? gobierno.estado : gobierno.gobierno;
}

/** Edad de una persona el 1 de enero de 2010 (null si no se sabe). */
export function edadEn2010(persona: Persona | undefined): number | null {
  return persona?.nacimiento ? 2010 - persona.nacimiento : null;
}
