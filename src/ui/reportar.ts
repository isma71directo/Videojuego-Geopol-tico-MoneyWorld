/** Botón «Reportar fallo / sugerencia» y hoja para elegir el tipo de aviso. */
import { REPOSITORIO } from '../compartido/proyecto';
import { TIPOS_REPORTE, urlReporte, type ContextoReporte } from '../compartido/reportar';
import { t } from '../i18n';
import { el } from './dom';
import { abrirHoja } from './hoja';
import './estilos/reportar.css';

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
