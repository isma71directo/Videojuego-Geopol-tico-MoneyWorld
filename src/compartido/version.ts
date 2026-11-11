/**
 * Versión del juego. La única fuente es package.json: Vite la inyecta al
 * compilar, así que el juego y la Hoja de ruta siempre muestran la misma.
 */
export const VERSION: string = __VERSION__;

/** Devuelve la versión con el prefijo habitual, p. ej. «v0.1.0». */
export function etiquetaVersion(version: string = VERSION): string {
  return `v${version}`;
}
