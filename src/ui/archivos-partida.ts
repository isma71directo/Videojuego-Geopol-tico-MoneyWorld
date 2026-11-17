/**
 * Exportar e importar la partida como archivo .json (tarea f14-t3, GDD sección 2: «exportar e
 * importar partida como archivo .json»). El archivo lleva el juego, el formato y la versión que
 * lo guardó; al importarlo se comprueba y se migra igual que un guardado (src/sim/guardado.ts).
 */
import {
  aTexto,
  deTexto,
  ErrorGuardado,
  nombreArchivo,
  TAMANO_MAXIMO_ARCHIVO,
  type ArchivoPartida,
} from '../sim/guardado';

/** Descarga la partida como archivo .json; devuelve el nombre del archivo. */
export function descargarArchivo(archivo: ArchivoPartida): string {
  const nombre = nombreArchivo(archivo.partida);
  const url = URL.createObjectURL(new Blob([aTexto(archivo)], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.hidden = true;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Un momento después, cuando el navegador ya ha empezado la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return nombre;
}

/** Abre el selector de archivos del sistema; null si se cancela. */
export function elegirArchivo(): Promise<File | null> {
  return new Promise((resolver) => {
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = '.json,application/json';
    entrada.addEventListener('change', () => resolver(entrada.files?.[0] ?? null), {
      once: true,
    });
    entrada.addEventListener('cancel', () => resolver(null), { once: true });
    entrada.click();
  });
}

/** Lee un archivo .json de partida (lanza ErrorGuardado si no se puede cargar). */
export async function leerArchivo(archivo: Blob): Promise<ArchivoPartida> {
  if (archivo.size > TAMANO_MAXIMO_ARCHIVO) {
    throw new ErrorGuardado('noEsPartida', 'Archivo demasiado grande');
  }
  return deTexto(await archivo.text());
}
