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

/** Fecha de hoy en formato AAAA-MM-DD. */
export function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}
