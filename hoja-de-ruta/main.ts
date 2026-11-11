/** Web independiente de la Hoja de ruta (GDD, sección 10). */
import '../src/ui/estilos/base.css';
import './estilos.css';

import { formatearHora } from '../src/compartido/fechas';
import type { Roadmap } from '../src/compartido/roadmap';
import { abrirCanal, hayVersionNueva, vigilarRoadmap } from '../src/compartido/sincronizacion';
import { VERSION, etiquetaVersion } from '../src/compartido/version';
import { t } from '../src/i18n';
import { el, reemplazar } from '../src/ui/dom';
import { abiertosIniciales, textoDatos, vistaHojaDeRuta, type Abiertos } from './vista';

/** Cada cuánto se vuelve a leer roadmap.json. */
const MINUTOS_REFRESCO = 2;

const raiz = document.querySelector<HTMLElement>('#hoja-de-ruta')!;
const avisoVersion = document.querySelector<HTMLElement>('#aviso-version')!;

let abiertos: Abiertos | null = null;
let hayContenido = false;

// Barra de estado: se conserva entre refrescos para no perder el foco del botón.
const textoEstado = el('p', { class: 'estado__texto', role: 'status' });
const botonActualizar = el(
  'button',
  { class: 'boton boton--discreto', type: 'button' },
  t('hojaDeRuta.actualizar'),
);
const barraEstado = el('div', { class: 'estado' }, textoEstado, botonActualizar);

function mostrarAvisoVersion(version: string): void {
  if (!hayVersionNueva(VERSION, version)) return;
  const boton = el('button', { class: 'boton', type: 'button' }, t('comun.recargar'));
  boton.addEventListener('click', () => location.reload());
  reemplazar(
    avisoVersion,
    el('span', {}, t('comun.nuevaVersion', { version: etiquetaVersion(version) })),
    boton,
  );
  avisoVersion.hidden = false;
}

const canal = abrirCanal((mensaje) => mostrarAvisoVersion(mensaje.version));

function alCargar(roadmap: Roadmap, cambiado: boolean): void {
  abiertos ??= abiertosIniciales(roadmap);
  if (cambiado) {
    reemplazar(raiz, ...vistaHojaDeRuta(roadmap, abiertos, barraEstado));
    hayContenido = true;
  }
  textoEstado.classList.remove('estado__texto--error');
  textoEstado.textContent = [
    textoDatos(roadmap),
    t('hojaDeRuta.comprobado', { hora: formatearHora(new Date()) }),
    t('hojaDeRuta.refrescoAutomatico', { minutos: MINUTOS_REFRESCO }),
  ].join(' · ');

  if (hayVersionNueva(VERSION, roadmap.versionActual)) {
    mostrarAvisoVersion(roadmap.versionActual);
    canal.enviar({ tipo: 'nueva-version', version: roadmap.versionActual });
  }
}

function alFallar(): void {
  if (hayContenido) {
    textoEstado.classList.add('estado__texto--error');
    textoEstado.textContent = t('hojaDeRuta.errorRefresco');
    return;
  }
  const reintentar = el('button', { class: 'boton', type: 'button' }, t('hojaDeRuta.reintentar'));
  reintentar.addEventListener('click', () => void vigilancia.comprobarAhora());
  reemplazar(
    raiz,
    el(
      'div',
      { class: 'tarjeta aviso-carga', role: 'alert' },
      el('p', {}, t('hojaDeRuta.errorCarga')),
      reintentar,
    ),
  );
}

reemplazar(raiz, el('p', { class: 'vacio aviso-carga' }, t('hojaDeRuta.cargando')));

const vigilancia = vigilarRoadmap({
  url: '../roadmap.json',
  intervaloMs: MINUTOS_REFRESCO * 60 * 1000,
  alCargar,
  alFallar,
});

botonActualizar.addEventListener('click', () => {
  botonActualizar.disabled = true;
  void vigilancia.comprobarAhora().finally(() => {
    botonActualizar.disabled = false;
  });
});
