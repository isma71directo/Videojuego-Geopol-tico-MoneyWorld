/** Pantalla del mapa del mundo a pantalla completa (Fase 3). */
import { t } from '../i18n';
import { MapaMundo } from '../map/mapa';
import { ESTILO_MAPA } from '../map/estilo';
import { conectarGestos } from '../map/gestos';
import { el } from './dom';
import './estilos/mapa.css';

/** El medidor de fps se ve en desarrollo o añadiendo «?fps» a la dirección. */
function medidorActivo(): boolean {
  return import.meta.env.DEV || new URLSearchParams(location.search).has('fps');
}

export interface PantallaMapa {
  elemento: HTMLElement;
  mapa: MapaMundo;
  cerrar(): void;
}

export function abrirPantallaMapa(alCerrar: () => void): PantallaMapa {
  const volver = el(
    'button',
    { class: 'boton mapa__volver', type: 'button', 'aria-label': t('juego.mapa.volver') },
    '← ',
    t('juego.mapa.volver'),
  );
  const estado = el('p', { class: 'mapa__estado', role: 'status' }, t('juego.mapa.cargando'));
  const lienzo = el('div', {
    class: 'mapa__contenedor',
    role: 'application',
    tabindex: 0,
    'aria-label': t('juego.mapa.etiqueta'),
  });
  const medidor = medidorActivo() ? el('p', { class: 'mapa__fps', 'aria-hidden': 'true' }) : null;
  const elemento = el('section', { class: 'mapa' }, lienzo, volver, estado, medidor);
  document.body.appendChild(elemento);

  const mapa = new MapaMundo(
    lienzo,
    {
      mundo: './data/mapa-2010-mundo.json',
      detalle: './data/mapa-2010-detalle.json',
      relieve: './av/relieve/',
      agua: './data/mapa-agua.json',
    },
    ESTILO_MAPA,
  );
  if (medidor) {
    mapa.alDibujar = ({ fps, msUltimo, nivel }) => {
      medidor.textContent = `${fps} fps · ${msUltimo.toFixed(1)} ms · ${nivel}`;
    };
  }
  mapa
    .iniciar()
    .then(() => estado.remove())
    .catch(() => {
      estado.textContent = t('juego.mapa.error');
    });

  const desconectar = conectarGestos(lienzo, mapa);
  // El mapa recibe el teclado nada más abrirse (flechas y +/−).
  lienzo.focus({ preventScroll: true });

  const cerrar = (): void => {
    desconectar();
    mapa.destruir();
    elemento.remove();
  };
  volver.addEventListener('click', alCerrar);
  return { elemento, mapa, cerrar };
}
