/**
 * Ajustes del jugador que se recuerdan en este navegador (localStorage). Si el navegador no
 * deja guardar (modo privado, almacenamiento bloqueado), se usan los valores por defecto.
 */

const PREFIJO = 'geopolitica-2010.ajustes.';

export interface Ajustes {
  /** Mostrar el medidor de rendimiento (fps) en el mapa. */
  medidorFps: boolean;
}

const POR_DEFECTO: Ajustes = { medidorFps: false };

export function leerAjuste<K extends keyof Ajustes>(clave: K): Ajustes[K] {
  try {
    const guardado = localStorage.getItem(PREFIJO + clave);
    return guardado === null ? POR_DEFECTO[clave] : (JSON.parse(guardado) as Ajustes[K]);
  } catch {
    return POR_DEFECTO[clave];
  }
}

export function guardarAjuste<K extends keyof Ajustes>(clave: K, valor: Ajustes[K]): void {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento disponible, el ajuste dura solo esta visita.
  }
}

/**
 * ¿Se muestra el medidor de fps? Sí en desarrollo, con «?fps» en la dirección o si el
 * jugador lo ha activado en Ajustes (o con la tecla F en el mapa).
 */
export function medidorFpsActivo(
  busqueda: string,
  desarrollo: boolean,
  guardado: boolean,
): boolean {
  return desarrollo || new URLSearchParams(busqueda).has('fps') || guardado;
}
