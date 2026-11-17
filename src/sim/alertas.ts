/**
 * Alertas económicas (tarea f16-t4; decisión del jugador: solo las del país del jugador, con
 * aviso y un sonido propio de cada una; las graves paran la partida si la pausa automática está
 * activada). Cada mes se mira la economía del país del jugador y, si entra en una situación de
 * alerta, se programa un suceso una hora después: el motor lo avisa a la pantalla y, si es grave,
 * para el tiempo. Cada alerta tiene un margen para salir de ella, así que no se repite cada mes.
 * Motor puro, sin interfaz: el título y el texto los pone la pantalla según el tipo.
 */
import config from './config/economia.json';
import { subidaDelParo, type EconomiaPais } from './economia';
import type { Sistema } from './motor';
import { horaAbsoluta, momentoDe } from './reloj';
import { programar } from './sucesos';

export type TipoAlerta =
  | 'recesion'
  | 'paro'
  | 'inflacion'
  | 'inflacionGrave'
  | 'deflacion'
  | 'crisisDeuda'
  | 'ratingBaja'
  | 'ratingSube';

/** Todas, en el orden en que se avisan si llegan a la vez. */
export const TIPOS_ALERTA: readonly TipoAlerta[] = [
  // (La de la crisis de deuda y las del rating las avisa el mercado de la deuda, Fase 18.)
  'crisisDeuda',
  'ratingBaja',
  'ratingSube',
  'recesion',
  'inflacionGrave',
  'inflacion',
  'deflacion',
  'paro',
];

/** Las graves paran la partida (si la pausa automática está activada). */
export const ALERTAS_GRAVES: ReadonlySet<TipoAlerta> = new Set([
  'recesion',
  'inflacionGrave',
  'crisisDeuda',
]);

/**
 * Una alerta con su dato: la caída del PIB, el paro o la inflación (tanto por uno), o la prima de
 * riesgo (puntos) en la crisis de deuda y en las del rating, que llevan también la nota nueva.
 */
export interface AlertaEconomica {
  tipo: TipoAlerta;
  valor: number;
  rating?: string;
}

const umbrales = config.alertas;

/** Media del PIB de un trimestre (los tres meses que acaban `atras` meses antes del último). */
function trimestre(serie: readonly number[], atras: number): number | null {
  const fin = serie.length - atras;
  if (fin < 3) return null;
  return (serie[fin - 1]! + serie[fin - 2]! + serie[fin - 3]!) / 3;
}

/**
 * Las situaciones de alerta en que está una economía, con su dato. Para salir de una alerta en
 * la que ya estaba hace falta pasar el margen (`activas`): así no entra y sale cada mes.
 */
export function situacionesDeAlerta(
  economia: Pick<EconomiaPais, 'serie' | 'paro' | 'serieParo' | 'inflacion'>,
  activas: readonly TipoAlerta[] = [],
): AlertaEconomica[] {
  const estaba = (tipo: TipoAlerta) => activas.includes(tipo);
  const resultado: AlertaEconomica[] = [];
  // Recesión: dos trimestres seguidos cayendo; sale cuando el último trimestre ya crece.
  const t0 = trimestre(economia.serie, 0);
  const t1 = trimestre(economia.serie, 3);
  const t2 = trimestre(economia.serie, 6);
  if (t0 !== null && t1 !== null && t2 !== null) {
    const cae = estaba('recesion') ? t0 <= t1 : t0 < t1 && t1 < t2;
    if (cae) resultado.push({ tipo: 'recesion', valor: t0 / t2 - 1 });
  }
  const { inflacion } = economia;
  const grave = estaba('inflacionGrave')
    ? inflacion > umbrales.inflacionGraveSalida
    : inflacion > umbrales.inflacionGrave;
  if (grave) resultado.push({ tipo: 'inflacionGrave', valor: inflacion });
  const alta = estaba('inflacion')
    ? inflacion > umbrales.inflacionSalida
    : inflacion > umbrales.inflacion;
  if (alta) resultado.push({ tipo: 'inflacion', valor: inflacion });
  const deflacion = estaba('deflacion')
    ? inflacion < umbrales.deflacionSalida
    : inflacion < umbrales.deflacion;
  if (deflacion) resultado.push({ tipo: 'deflacion', valor: inflacion });
  // Paro que se dispara: sube mucho en un año; sale cuando ya apenas sube.
  const subida = subidaDelParo(economia);
  if (subida !== null) {
    const disparado = estaba('paro')
      ? subida > umbrales.subidaParoSalida
      : subida >= umbrales.subidaParo;
    if (disparado) resultado.push({ tipo: 'paro', valor: economia.paro });
  }
  return resultado;
}

/**
 * Pone al día las alertas de una economía y devuelve las nuevas (las que acaban de empezar). La
 * primera vez solo anota en qué situación está, sin avisar: lo que ya pasaba al empezar la
 * partida (o al cargarla) se ve en la ficha, no salta como alerta.
 */
export function alertasNuevas(economia: EconomiaPais): AlertaEconomica[] {
  const antes = economia.alertas;
  const ahora = situacionesDeAlerta(economia, antes ?? []);
  economia.alertas = ahora.map((alerta) => alerta.tipo);
  if (antes === undefined) return [];
  const nuevas = ahora.filter((alerta) => !antes.includes(alerta.tipo));
  // Si la inflación se desboca de golpe, basta con la alerta grave.
  const desbocada = nuevas.some((alerta) => alerta.tipo === 'inflacionGrave');
  return nuevas
    .filter((alerta) => !(desbocada && alerta.tipo === 'inflacion'))
    .sort((a, b) => TIPOS_ALERTA.indexOf(a.tipo) - TIPOS_ALERTA.indexOf(b.tipo));
}

/**
 * Sistema de las alertas (tarea f16-t4): cada mes, después de la economía, mira la del país del
 * jugador y programa un suceso por cada alerta nueva, una hora después.
 */
export const sistemaAlertas: Sistema = (pasos, partida) => {
  if (!pasos.some((paso) => paso.ritmo === 'mensual')) return;
  const economia = partida.paises[partida.jugador.paisId]?.economia;
  if (!economia) return;
  const nuevas = alertasNuevas(economia);
  if (nuevas.length === 0) return;
  const { fecha, hora } = momentoDe(horaAbsoluta(partida) + 1);
  for (const alerta of nuevas) {
    partida.agenda = programar(partida.agenda, {
      id: `a${partida.fecha}-${alerta.tipo}`,
      // El título y el texto los pone la pantalla, según el tipo (textos en src/i18n).
      titulo: '',
      texto: '',
      fecha,
      hora,
      importante: ALERTAS_GRAVES.has(alerta.tipo),
      origen: 'economia',
      alerta,
    });
  }
};
