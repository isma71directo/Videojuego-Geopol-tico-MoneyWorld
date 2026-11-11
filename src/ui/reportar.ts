/** Botón «Reportar fallo / sugerencia» y hoja para elegir el tipo de aviso. */
import { REPOSITORIO } from '../compartido/proyecto';
import {
  TIPOS_REPORTE,
  datosDelJuego,
  urlReporte,
  type ContextoReporte,
} from '../compartido/reportar';
import { t } from '../i18n';
import { el } from './dom';
import { abrirHoja } from './hoja';
import './estilos/reportar.css';

/**
 * Datos del juego que acompañan al aviso, con un botón para copiarlos por si
 * GitHub (sobre todo su app del móvil) abre el formulario sin rellenarlos.
 */
function bloqueDatos(contexto: ContextoReporte): HTMLElement {
  // Versión, fecha de la partida y país: lo común a los tres tipos de aviso.
  const datos = datosDelJuego('idea', contexto);
  const texto = ['**Datos del juego**', '', ...datos].join('\n');
  const copiar = el(
    'button',
    { class: 'boton boton--discreto', type: 'button' },
    t('juego.reportar.copiar'),
  );
  const estado = el('span', { class: 'reportar__copiado', role: 'status' });
  copiar.addEventListener('click', () => {
    navigator.clipboard.writeText(texto).then(
      () => (estado.textContent = t('juego.reportar.copiado')),
      () => (estado.textContent = t('juego.reportar.noCopiado')),
    );
  });
  return el(
    'div',
    { class: 'reportar__datos' },
    el('p', { class: 'reportar__datos-titulo' }, t('juego.reportar.datosTitulo')),
    el(
      'ul',
      { class: 'reportar__datos-lista' },
      ...datos.map((linea) => el('li', {}, linea.replace(/^- /, ''))),
    ),
    el('p', { class: 'hoja__nota reportar__cuenta' }, t('juego.reportar.datosAyuda')),
    el('div', { class: 'reportar__copiar' }, copiar, estado),
  );
}

function abrirReporte(contexto: ContextoReporte): void {
  const hoja = abrirHoja(
    t('juego.reportar.titulo'),
    el('p', { class: 'hoja__nota' }, t('juego.reportar.explicacion')),
    el(
      'ul',
      { class: 'reportar__opciones' },
      ...TIPOS_REPORTE.map((tipo) => {
        const enlace = el(
          'a',
          {
            class: `reportar__opcion reportar__opcion--${tipo}`,
            href: urlReporte(REPOSITORIO, tipo, contexto),
            target: '_blank',
            rel: 'noopener',
          },
          el('strong', {}, t(`juego.reportar.${tipo}.titulo`)),
          el('span', {}, t(`juego.reportar.${tipo}.descripcion`)),
        );
        enlace.addEventListener('click', () => hoja.cerrar());
        return el('li', {}, enlace);
      }),
    ),
    bloqueDatos(contexto),
    el('p', { class: 'hoja__nota reportar__cuenta' }, t('juego.reportar.cuenta')),
  );
}

/**
 * Crea el botón. `obtenerContexto` se consulta al pulsarlo, para enviar la
 * fecha y el país de la partida que haya en ese momento.
 */
export function botonReportar(obtenerContexto: () => ContextoReporte): HTMLButtonElement {
  const boton = el(
    'button',
    { class: 'boton boton--discreto', type: 'button' },
    t('juego.reportar.boton'),
  );
  boton.addEventListener('click', () => abrirReporte(obtenerContexto()));
  return boton;
}
