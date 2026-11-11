/**
 * Botón «Reportar fallo / sugerencia» (GDD, sección 10): prepara una issue de
 * GitHub ya rellenada con la versión, la fecha de la partida y el país.
 *
 * Los apartados coinciden con las plantillas de .github/ISSUE_TEMPLATE/
 * (un test lo comprueba), para que las issues tengan siempre la misma forma.
 */
import { etiquetaVersion } from './version';

export type TipoReporte = 'fallo' | 'idea' | 'datos';

export const TIPOS_REPORTE: readonly TipoReporte[] = ['fallo', 'idea', 'datos'];

export interface ContextoReporte {
  version: string;
  /** Fecha de la partida en curso (AAAA-MM-DD); null si no hay partida. */
  fechaPartida: string | null;
  /** País del jugador; null si no hay partida. */
  pais: string | null;
  /** Dispositivo y navegador; solo se incluye en los fallos. */
  dispositivo?: string;
}

const SIN_PARTIDA = 'sin partida en curso';

const PLANTILLAS: Record<TipoReporte, { prefijo: string; apartados: string[] }> = {
  fallo: {
    prefijo: '[Fallo] ',
    apartados: ['¿Qué ha pasado?', '¿Qué esperabas que pasara?', 'Pasos para repetirlo'],
  },
  idea: {
    prefijo: '[Idea] ',
    apartados: ['¿Qué te gustaría añadir o cambiar?', '¿Por qué mejoraría el juego?'],
  },
  datos: {
    prefijo: '[Datos] ',
    apartados: ['¿Qué dato es incorrecto o falta?', 'Valor correcto y fuente'],
  },
};

/** Texto de la issue: los apartados de la plantilla y los datos del juego ya rellenados. */
export function cuerpoReporte(tipo: TipoReporte, contexto: ContextoReporte): string {
  const lineas: string[] = [];
  for (const apartado of PLANTILLAS[tipo].apartados) {
    lineas.push(`**${apartado}**`, '', apartado === 'Pasos para repetirlo' ? '1. ' : '', '');
  }
  lineas.push(
    '---',
    '',
    '**Datos del juego**',
    '',
    `- Versión: ${etiquetaVersion(contexto.version)}`,
    `- Fecha de la partida: ${contexto.fechaPartida ?? SIN_PARTIDA}`,
    `- País: ${contexto.pais ?? SIN_PARTIDA}`,
  );
  if (tipo === 'fallo') {
    lineas.push(`- Dispositivo y navegador: ${contexto.dispositivo ?? 'desconocido'}`);
  }
  return `${lineas.join('\n')}\n`;
}

/** Dirección que abre en GitHub una issue nueva del tipo indicado, ya rellenada. */
export function urlReporte(
  repositorio: string,
  tipo: TipoReporte,
  contexto: ContextoReporte,
): string {
  const parametros = new URLSearchParams({
    template: `${tipo}.md`,
    labels: tipo,
    title: PLANTILLAS[tipo].prefijo,
    body: cuerpoReporte(tipo, contexto),
  });
  return `${repositorio}/issues/new?${parametros.toString()}`;
}
