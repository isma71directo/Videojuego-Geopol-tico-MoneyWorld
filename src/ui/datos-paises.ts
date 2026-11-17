/**
 * Los datos de 2010 de los países (public/data/paises-2010.json), descargados una sola vez por
 * visita y compartidos: el inicio los usa para los nombres de «Continuar» y la carga de partidas,
 * para crear la economía de las guardadas antes de la Fase 15 (tarea f15-t2).
 */
import type { ConjuntoPaises } from '../datos/paises';

let datos: Promise<ConjuntoPaises> | null = null;

/** Los datos de los países (si la descarga falla, se reintenta la próxima vez). */
export function cargarDatosPaises(): Promise<ConjuntoPaises> {
  datos ??= fetch('./data/paises-2010.json')
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      return respuesta.json() as Promise<ConjuntoPaises>;
    })
    .catch((error: unknown) => {
      datos = null;
      throw error;
    });
  return datos;
}
