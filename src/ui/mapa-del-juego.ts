/**
 * El mapa de juego con todos sus datos (relieve, terreno, agua, ciudades, regiones y colores):
 * lo crean igual el mapa libre, la pantalla «Nueva partida» y la partida (tarea f10-t1).
 */
import { MapaMundo } from '../map/mapa';
import { ESTILO_MAPA } from '../map/estilo';
import { leerAjuste } from './ajustes';

export function crearMapaDelJuego(contenedor: HTMLElement): MapaMundo {
  const mapa = new MapaMundo(
    contenedor,
    {
      mundo: './data/mapa-2010-mundo.json',
      detalle: './data/mapa-2010-detalle.json',
      relieve: './av/relieve/',
      terreno: './av/terreno/',
      agua: './data/mapa-agua.json',
      ciudades: './data/ciudades-2010.json',
      regiones: './data/regiones-2010.json',
      colores: './data/colores-pais.json',
    },
    ESTILO_MAPA,
  );
  // Cuánto se ve el terreno bajo los países (Ajustes, tarea f6-t3).
  mapa.terrenoVisible = leerAjuste('intensidadTerreno');
  return mapa;
}
