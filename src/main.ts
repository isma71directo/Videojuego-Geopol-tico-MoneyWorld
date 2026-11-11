/** Punto de entrada del juego. De momento solo existe la pantalla de inicio. */
import './ui/estilos/base.css';

import { abrirCanal, hayVersionNueva, vigilarRoadmap } from './compartido/sincronizacion';
import { VERSION, etiquetaVersion } from './compartido/version';
import { t } from './i18n';
import { el, reemplazar } from './ui/dom';
import { crearPantallaInicio } from './ui/inicio';
import { botonReportar } from './ui/reportar';

/** Cada cuánto comprueba el juego si se ha publicado una versión nueva. */
const MINUTOS_REFRESCO = 5;

const app = document.querySelector<HTMLElement>('#app')!;
const avisoVersion = document.querySelector<HTMLElement>('#aviso-version')!;

const inicio = crearPantallaInicio();
inicio.acciones.appendChild(
  // Todavía no hay partidas: la fecha y el país se añadirán en la Fase 4.
  botonReportar(() => ({
    version: VERSION,
    fechaPartida: null,
    pais: null,
    dispositivo: navigator.userAgent,
  })),
);
reemplazar(app, inicio.elemento);

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

// La Hoja de ruta abierta en otra pestaña avisa al instante de una versión nueva.
const canal = abrirCanal((mensaje) => mostrarAvisoVersion(mensaje.version));

vigilarRoadmap({
  url: './roadmap.json',
  intervaloMs: MINUTOS_REFRESCO * 60 * 1000,
  alCargar(roadmap) {
    inicio.mostrarFaseActiva(roadmap);
    if (hayVersionNueva(VERSION, roadmap.versionActual)) {
      mostrarAvisoVersion(roadmap.versionActual);
      canal.enviar({ tipo: 'nueva-version', version: roadmap.versionActual });
    }
  },
  // Sin conexión el juego sigue funcionando; solo se pierde el aviso de versión.
  alFallar: () => {},
});
