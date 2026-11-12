/**
 * Ajustes del jugador que se recuerdan en este navegador (localStorage). Si el navegador no
 * deja guardar (modo privado, almacenamiento bloqueado), se usan los valores por defecto.
 */

const PREFIJO = 'geopolitica-2010.ajustes.';

export interface Ajustes {
  /** Mostrar el medidor de rendimiento (fps) en el mapa. */
  medidorFps: boolean;
  /** Sonido silenciado (botón del mapa, tecla M o Ajustes). */
  sonidoSilenciado: boolean;
  /** Volumen de los efectos, de 0 a 1. */
  volumenEfectos: number;
  /** Volumen de la música, de 0 a 1 (la música llegará más adelante). */
  volumenMusica: number;
}

const POR_DEFECTO: Ajustes = {
  medidorFps: false,
  sonidoSilenciado: false,
  volumenEfectos: 0.7,
  volumenMusica: 0.5,
};

export function leerAjuste<K extends keyof Ajustes>(clave: K): Ajustes[K] {
  try {
    const guardado = localStorage.getItem(PREFIJO + clave);
    if (guardado === null) return POR_DEFECTO[clave];
    const valor = JSON.parse(guardado) as unknown;
    // Un valor de otro tipo (guardado a mano o por una versión antigua) no se usa.
    return typeof valor === typeof POR_DEFECTO[clave] ? (valor as Ajustes[K]) : POR_DEFECTO[clave];
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
