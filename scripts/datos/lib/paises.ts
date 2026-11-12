import { leerJson } from './comun.ts';
import type { PaisBase, TablaPaises } from './tipos.ts';

/** Tabla de países del escenario (la genera 01-paises.ts). */
export function leerPaises(): PaisBase[] {
  return leerJson<TablaPaises>('fuentes/datos/paises.json').paises;
}

/** Códigos del Banco Mundial que hacen falta: los de cada país y los de sus componentes. */
export function codigosBM(paises: readonly PaisBase[]): Set<string> {
  const codigos = new Set<string>();
  for (const pais of paises) {
    if (pais.codigos.bm) codigos.add(pais.codigos.bm);
    for (const componente of pais.componentes ?? []) codigos.add(componente);
  }
  return codigos;
}

/**
 * Códigos que hay que descargar de una fuente: el de cada país y los de sus componentes
 * (p. ej. Sudán = Sudán + Sudán del Sur; Antillas Neerlandesas = Curazao + Sint Maarten).
 */
export function codigosFuente(
  paises: readonly PaisBase[],
  fuente: 'bm' | 'fmi' | 'owid',
): Set<string> {
  const codigos = new Set<string>();
  for (const pais of paises) {
    const propio = pais.codigos[fuente];
    if (propio) codigos.add(propio);
    for (const componente of pais.componentes ?? []) codigos.add(componente);
  }
  return codigos;
}

/** Fecha de hoy en formato AAAA-MM-DD. */
export function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}
