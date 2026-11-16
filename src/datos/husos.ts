/**
 * Formato de /public/data/husos-2010.json (tarea f11-t2): huso horario de cada país y territorio
 * el 1 de enero de 2010. Lo genera scripts/datos/24-husos.ts con la base de datos IANA de husos
 * horarios (dominio público); aquí solo están los tipos.
 */
export interface ConjuntoHusos {
  fuente: string;
  fecha: string;
  versionTz: string;
  /** Código del país → [zona IANA, minutos al este de UTC]. */
  paises: Record<string, [string, number]>;
}
