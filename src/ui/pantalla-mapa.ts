/** Pantalla del mapa del mundo a pantalla completa (Fase 3). */
import { t } from '../i18n';
import { MapaMundo } from '../map/mapa';
import { ESTILO_MAPA } from '../map/estilo';
import { conectarGestos } from '../map/gestos';
import { guardarAjuste, leerAjuste, medidorFpsActivo } from './ajustes';
import { el } from './dom';
import './estilos/mapa.css';

function medidorActivo(): boolean {
  return medidorFpsActivo(location.search, import.meta.env.DEV, leerAjuste('medidorFps'));
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
  // El medidor siempre existe; se muestra u oculta (Ajustes, «?fps» o la tecla F).
  const medidor = el(
    'p',
    { class: 'mapa__fps', 'aria-hidden': 'true', hidden: !medidorActivo() },
    '— fps',
  );
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
  mapa.alDibujar = ({ fps, msUltimo, nivel }) => {
    if (!medidor.hidden) medidor.textContent = `${fps} fps · ${msUltimo.toFixed(1)} ms · ${nivel}`;
  };
  const alternarMedidor = (evento: KeyboardEvent): void => {
    if (evento.key !== 'f' && evento.key !== 'F') return;
    medidor.hidden = !medidor.hidden;
    guardarAjuste('medidorFps', !medidor.hidden);
    mapa.pedirDibujo();
  };
  lienzo.addEventListener('keydown', alternarMedidor);
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
    lienzo.removeEventListener('keydown', alternarMedidor);
    desconectar();
    mapa.destruir();
    elemento.remove();
  };
  volver.addEventListener('click', alCerrar);
  return { elemento, mapa, cerrar };
}
