/**
 * Comunicación entre el juego y la Hoja de ruta (GDD, sección 10).
 * Las dos webs leen roadmap.json cada pocos minutos y, si están abiertas en el
 * mismo navegador, se avisan al instante por BroadcastChannel.
 */
import { compararVersiones, type Roadmap } from './roadmap';

const NOMBRE_CANAL = 'geopolitica-2010';

export type Mensaje = { tipo: 'nueva-version'; version: string };

/** ¿La versión publicada es posterior a la que tiene abierta esta pestaña? */
export function hayVersionNueva(versionAbierta: string, versionPublicada: string): boolean {
  return compararVersiones(versionPublicada, versionAbierta) > 0;
}

function esMensaje(dato: unknown): dato is Mensaje {
  if (typeof dato !== 'object' || dato === null) return false;
  const mensaje = dato as Record<string, unknown>;
  return mensaje.tipo === 'nueva-version' && typeof mensaje.version === 'string';
}

export interface Canal {
  enviar(mensaje: Mensaje): void;
  cerrar(): void;
}

/** Abre el canal entre pestañas. Si el navegador no lo admite, no hace nada. */
export function abrirCanal(alRecibir: (mensaje: Mensaje) => void): Canal {
  if (typeof BroadcastChannel === 'undefined') {
    return { enviar: () => {}, cerrar: () => {} };
  }
  const canal = new BroadcastChannel(NOMBRE_CANAL);
  canal.addEventListener('message', (evento: MessageEvent<unknown>) => {
    if (esMensaje(evento.data)) alRecibir(evento.data);
  });
  return {
    enviar: (mensaje) => canal.postMessage(mensaje),
    cerrar: () => canal.close(),
  };
}

/** Comprobación mínima de que lo descargado tiene forma de hoja de ruta. */
export function pareceRoadmap(dato: unknown): dato is Roadmap {
  if (typeof dato !== 'object' || dato === null) return false;
  const r = dato as Record<string, unknown>;
  return (
    typeof r.versionActual === 'string' &&
    typeof r.faseActiva === 'string' &&
    typeof r.ultimaSesion === 'object' &&
    r.ultimaSesion !== null &&
    Array.isArray(r.etapas) &&
    Array.isArray(r.fases) &&
    Array.isArray(r.ideasPendientes) &&
    Array.isArray(r.historial)
  );
}

export interface Vigilancia {
  /** Fuerza una comprobación inmediata. */
  comprobarAhora(): Promise<void>;
  detener(): void;
}

export interface OpcionesVigilancia {
  /** Dirección de roadmap.json relativa a la página. */
  url: string;
  intervaloMs: number;
  /** Se llama tras cada lectura correcta; `cambiado` indica si el contenido es distinto al anterior. */
  alCargar(roadmap: Roadmap, cambiado: boolean): void;
  alFallar(error: unknown): void;
}

/**
 * Lee roadmap.json ahora, cada `intervaloMs` y cada vez que la pestaña vuelve
 * a estar visible. Evita la caché para ver siempre la última publicación.
 */
export function vigilarRoadmap(opciones: OpcionesVigilancia): Vigilancia {
  let textoAnterior: string | null = null;
  let enCurso: Promise<void> | null = null;

  async function leer(): Promise<void> {
    try {
      const respuesta = await fetch(opciones.url, { cache: 'no-store' });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const texto = await respuesta.text();
      const dato: unknown = JSON.parse(texto);
      if (!pareceRoadmap(dato)) throw new Error('El archivo no tiene el formato esperado');
      const cambiado = texto !== textoAnterior;
      textoAnterior = texto;
      opciones.alCargar(dato, cambiado);
    } catch (error) {
      opciones.alFallar(error);
    }
  }

  function comprobarAhora(): Promise<void> {
    enCurso ??= leer().finally(() => {
      enCurso = null;
    });
    return enCurso;
  }

  const temporizador = setInterval(() => {
    if (document.visibilityState === 'visible') void comprobarAhora();
  }, opciones.intervaloMs);
  const alVolver = (): void => {
    if (document.visibilityState === 'visible') void comprobarAhora();
  };
  document.addEventListener('visibilitychange', alVolver);
  void comprobarAhora();

  return {
    comprobarAhora,
    detener: () => {
      clearInterval(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
    },
  };
}
