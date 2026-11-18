/**
 * Alertas económicas en la pantalla (tarea f16-t4; decisión del jugador: las del país del jugador,
 * con aviso y un sonido propio de cada una). Las graves, si la pausa automática para la partida,
 * salen en el aviso del centro; las demás, en una tarjeta discreta arriba a la derecha que se va
 * sola. El motor solo dice el tipo y el dato: el título y el texto se ponen aquí.
 */
import { icono, type NombreIcono } from '../av/iconos';
import type { Efecto } from '../av/sonido';
import { formatearFechaLarga } from '../compartido/fechas';
import { dineroConSigno, porcentaje, puntos } from '../compartido/formato';
import { t } from '../i18n';
import type { TipoAlerta } from '../sim/alertas';
import type { Suceso } from '../sim/sucesos';
import { animar, retirar } from './componentes/animacion';
import { el } from './dom';
import { textoRating } from './rating';
import './estilos/alerta-economica.css';

/** El icono de cada alerta. */
export const ICONO_ALERTA: Record<TipoAlerta, NombreIcono> = {
  recesion: 'recesion',
  paro: 'paro',
  inflacion: 'inflacion',
  inflacionGrave: 'inflacion',
  deflacion: 'deflacion',
  crisisDeuda: 'deuda',
  ratingBaja: 'rating',
  ratingSube: 'rating',
  sinTesoreria: 'tesoreria',
  tesoreriaBaja: 'tesoreria',
  ayudaRetirada: 'deuda',
};

/** El sonido propio de cada alerta. */
export const SONIDO_ALERTA: Record<TipoAlerta, Efecto> = {
  recesion: 'alertaRecesion',
  paro: 'alertaParo',
  inflacion: 'alertaInflacion',
  inflacionGrave: 'alertaInflacionGrave',
  deflacion: 'alertaDeflacion',
  crisisDeuda: 'alertaCrisisDeuda',
  ratingBaja: 'alertaRatingBaja',
  ratingSube: 'alertaRatingSube',
  sinTesoreria: 'alertaSinTesoreria',
  tesoreriaBaja: 'alertaTesoreriaBaja',
  ayudaRetirada: 'alertaAyudaRetirada',
};

/** Las alertas cuyo dato es la prima de riesgo (puntos), no un tanto por uno. */
const EN_PUNTOS: ReadonlySet<TipoAlerta> = new Set(['crisisDeuda', 'ratingBaja', 'ratingSube']);
/** Las alertas cuyo dato es la tesorería (dólares). */
const EN_DINERO: ReadonlySet<TipoAlerta> = new Set([
  'sinTesoreria',
  'tesoreriaBaja',
  'ayudaRetirada',
]);

/** El dato de una alerta, con su formato. */
function datoDe(tipo: TipoAlerta, valor: number): string {
  if (EN_PUNTOS.has(tipo)) return puntos(valor);
  if (EN_DINERO.has(tipo)) return dineroConSigno(valor);
  return porcentaje(valor * 100);
}

/** Cuánto se queda a la vista una tarjeta (ms). */
export const DURACION_ALERTA = 9000;
/** Como mucho, estas tarjetas a la vez (se va la más vieja). */
const MAXIMO_A_LA_VISTA = 3;

/** El suceso con el título y el texto de su alerta (los demás sucesos, tal cual). */
export function traducirSuceso(suceso: Suceso): Suceso {
  const { alerta } = suceso;
  if (!alerta) return suceso;
  return {
    ...suceso,
    titulo: t(`juego.alertas.${alerta.tipo}.titulo`),
    texto: t(`juego.alertas.${alerta.tipo}.texto`, {
      // (Las de la deuda traen la prima de riesgo, en puntos, y las del rating, la nota nueva.)
      // (La tesorería, en dinero.)
      valor: datoDe(alerta.tipo, alerta.valor),
      rating: alerta.rating ? textoRating(alerta.rating) : '',
    }),
  };
}

let pila: HTMLElement | null = null;

/** Quita las tarjetas que haya (al salir de la partida). */
export function cerrarAlertasEconomicas(): void {
  pila?.remove();
  pila = null;
}

/** Enseña una alerta en una tarjeta discreta que se va sola (o con su botón). */
export function mostrarAlertaEconomica(suceso: Suceso): HTMLElement {
  const traducido = traducirSuceso(suceso);
  const tipo = suceso.alerta?.tipo;
  if (!pila?.isConnected) {
    pila = el('div', { class: 'alertas-economicas', role: 'status', 'aria-live': 'polite' });
    document.body.append(pila);
  }
  const cerrar = el(
    'button',
    {
      class: 'alerta-economica__cerrar',
      type: 'button',
      'aria-label': t('juego.alertas.cerrar'),
      title: t('juego.alertas.cerrar'),
    },
    '×',
  );
  const tarjeta = el(
    'article',
    {
      class: 'alerta-economica',
      'data-alerta': tipo ?? '',
      'data-grave': String(suceso.importante),
    },
    el(
      'span',
      { class: 'alerta-economica__icono', 'aria-hidden': 'true' },
      icono(tipo ? ICONO_ALERTA[tipo] : 'informe'),
    ),
    el(
      'div',
      { class: 'alerta-economica__cuerpo' },
      el('p', { class: 'alerta-economica__etiqueta' }, t('juego.alertas.etiqueta')),
      el('h2', { class: 'alerta-economica__titulo' }, traducido.titulo),
      el('p', { class: 'alerta-economica__texto' }, traducido.texto),
      el(
        'p',
        { class: 'alerta-economica__cuando' },
        el('time', { datetime: suceso.fecha }, formatearFechaLarga(suceso.fecha)),
      ),
    ),
    cerrar,
  );
  let temporizador: number | null = null;
  const quitar = (): void => {
    if (temporizador !== null) clearTimeout(temporizador);
    temporizador = null;
    if (!tarjeta.isConnected) return;
    retirar(tarjeta, [{ opacity: 1 }, { opacity: 0, translate: '12px 0' }], 220);
  };
  cerrar.addEventListener('click', quitar);
  pila.prepend(tarjeta);
  while (pila.children.length > MAXIMO_A_LA_VISTA) pila.lastElementChild!.remove();
  void animar(
    tarjeta,
    [
      { opacity: 0, translate: '16px 0' },
      { opacity: 1, translate: '0 0' },
    ],
    240,
  );
  temporizador = window.setTimeout(quitar, DURACION_ALERTA);
  return tarjeta;
}
