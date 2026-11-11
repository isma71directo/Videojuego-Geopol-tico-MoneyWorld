/**
 * Panel que se abre por encima de la pantalla: hoja deslizable desde abajo en
 * móvil y cuadro centrado en pantallas anchas (GDD, sección 7).
 */
import { t } from '../i18n';
import { el, type Hijo } from './dom';
import './estilos/hoja.css';

let contador = 0;

export interface Hoja {
  cerrar(): void;
}

/** Abre una hoja con título y contenido. Se cierra con el botón, con Escape o tocando fuera. */
export function abrirHoja(titulo: string, ...contenido: Hijo[]): Hoja {
  contador += 1;
  const idTitulo = `hoja-titulo-${contador}`;
  const botonCerrar = el(
    'button',
    { class: 'hoja__cerrar', type: 'button', 'aria-label': t('juego.hoja.cerrar') },
    '✕',
  );
  const dialogo = el(
    'dialog',
    { class: 'hoja', 'aria-labelledby': idTitulo },
    el(
      'div',
      { class: 'hoja__contenido' },
      el(
        'header',
        { class: 'hoja__cabecera' },
        el('h2', { id: idTitulo, class: 'hoja__titulo' }, titulo),
        botonCerrar,
      ),
      el('div', { class: 'hoja__cuerpo' }, ...contenido),
    ),
  );

  const cerrar = (): void => dialogo.close();
  botonCerrar.addEventListener('click', cerrar);
  // El contenido ocupa todo el diálogo: un clic directo en <dialog> es un toque fuera.
  dialogo.addEventListener('click', (evento) => {
    if (evento.target === dialogo) cerrar();
  });
  dialogo.addEventListener('close', () => dialogo.remove());

  document.body.appendChild(dialogo);
  dialogo.showModal();
  return { cerrar };
}
