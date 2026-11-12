/**
 * Formato de /public/data/paises-2010.json: los datos reales de partida de cada país
 * (GDD, secciones 3 y 4). Lo generan los scripts de /scripts/datos; aquí solo están
 * los tipos y unas pocas utilidades para leerlo.
 */

export type NivelRenta = 'bajo' | 'medio-bajo' | 'medio-alto' | 'alto';

export type GrupoCampo =
  'demografia' | 'economia' | 'estado' | 'sociedad' | 'energia' | 'emisiones' | 'recursos';

export interface DefinicionCampo {
  nombre: string;
  unidad: string;
  grupo: GrupoCampo;
}

export interface PaisDatos {
  /** ISO3 cuando existe; código propio en territorios sin ISO (p. ej. «SOL», Somalilandia). */
  id: string;
  iso2: string | null;
  nombre: string;
  tipo: 'pais' | 'especial' | 'dependiente';
  /** Si se puede elegir para jugar. */
  jugable: boolean;
  capital: string;
  region: string;
  regionNombre: string;
  nivelRenta: NivelRenta;
  /** Solo en territorios dependientes: país soberano. */
  soberano?: string;
  /** Solo en territorios de estatus especial o en disputa. */
  estatus?: string;
  reclamadoPor?: string | null;
  /** Valor de cada campo; null si no hay dato ni estimación. */
  datos: Record<string, number | null>;
  /**
   * De dónde sale cada valor:
   *  - «BM:2010», «FMI:2009», «OWID:2010», «WD:2010»: dato real, con su fuente y su año.
   *  - «OWID:ausente»: la fuente solo lista productores y el país no figura (valor 0).
   *  - «DER»: calculado a partir de otros campos reales.
   *  - «EST:<método>»: estimación (valor de respaldo), nunca un dato real.
   */
  origen: Record<string, string>;
  /** Campos cuyo valor es una estimación (GDD: `datosEstimados`). */
  datosEstimados: string[];
}

export interface ConjuntoPaises {
  version: number;
  fechaEscenario: string;
  fuentes: Record<string, string>;
  /** Métodos de estimación usados en «EST:<método>». */
  metodosEstimacion: Record<string, string>;
  campos: Record<string, DefinicionCampo>;
  paises: Record<string, PaisDatos>;
}

/** ¿El valor de este origen es una estimación y no un dato real? */
export function esEstimado(origen: string | undefined): boolean {
  return origen !== undefined && origen.startsWith('EST:');
}
