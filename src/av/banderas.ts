/**
 * Banderas de los países y territorios tal como eran el 1 de enero de 2010.
 * Los archivos están en /public/av/banderas/ y su procedencia, en creditos.json.
 */

/**
 * Dirección de la bandera de un país. `raiz` es la ruta desde la página hasta la raíz del
 * juego: «./» en el juego y «../» en las webs que cuelgan de una subcarpeta.
 */
export function urlBandera(paisId: string, raiz = './'): string {
  return `${raiz}av/banderas/${paisId}.svg`;
}
