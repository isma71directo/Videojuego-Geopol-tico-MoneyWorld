/** Tipos compartidos por los scripts de datos y sus tests. */

export type TipoPais = 'pais' | 'especial';

/** Fila de la tabla de países y territorios del escenario de 2010 (fuentes/datos/paises.json). */
export interface PaisBase {
  /** Identificador del juego: ISO3 cuando existe; código propio en los territorios sin ISO. */
  id: string;
  /** ISO 3166-1 alfa-2, para banderas y nombres; null si no tiene. */
  iso2: string | null;
  nombre: string;
  tipo: TipoPais;
  /** Si se puede elegir para jugar (tiene datos suficientes). */
  jugable: boolean;
  capital: string;
  /** De dónde sale la capital: «wikidata», «manual» o «banco-mundial». */
  capitalFuente: string;
  /** Código de región del Banco Mundial (EAS, ECS…). */
  region: string;
  regionNombre: string;
  /** Solo en territorios especiales. */
  estatus?: string;
  reclamadoPor?: string | null;
  /** Códigos de este país en cada fuente; null si la fuente no lo cubre. */
  codigos: { bm: string | null; fmi: string | null; owid: string | null; wikidata: string | null };
  /** Códigos del Banco Mundial que hay que sumar (p. ej. Sudán = SDN + SSD). */
  componentes?: string[];
  nota?: string;
}

/** Serie descargada de una fuente: país (código de la fuente) → año → valor. */
export type SeriePorPais = Record<string, Record<string, number>>;

/** Archivo intermedio de una fuente de indicadores (fuentes/datos/*.json). */
export interface ArchivoFuente {
  fuente: string;
  url: string;
  /** Fecha de la descarga (AAAA-MM-DD). */
  descargado: string;
  indicadores: Record<
    string,
    {
      codigo: string;
      descripcion: string;
      unidad: string;
      /** Fecha de la última actualización según la propia fuente, si la da. */
      actualizadoFuente?: string;
      valores: SeriePorPais;
    }
  >;
}

export interface TablaPaises {
  fuente: string;
  fechaEscenario: string;
  paises: PaisBase[];
}
