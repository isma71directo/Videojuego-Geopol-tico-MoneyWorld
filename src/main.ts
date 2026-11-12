/** Punto de entrada del juego. De momento solo existe la pantalla de inicio. */
import './ui/estilos/base.css';

import { abrirCanal, hayVersionNueva, vigilarRoadmap } from './compartido/sincronizacion';
import { VERSION, etiquetaVersion } from './compartido/version';
import { t } from './i18n';
import { el, reemplazar } from './ui/dom';
import { crearPantallaInicio } from './ui/inicio';
import { abrirPantallaMapa, type PantallaMapa } from './ui/pantalla-mapa';
import { botonReportar } from './ui/reportar';
import { activarSonidoAlInteractuar } from './ui/sonido';

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

// Navegación sencilla por el «#» de la dirección: «#mapa» abre el mapa a pantalla completa
// y el botón «atrás» del navegador vuelve a la pantalla de inicio.
let pantallaMapa: PantallaMapa | null = null;
/** Si el mapa se abrió desde el juego, «Volver» equivale al botón «atrás» del navegador. */
let mapaAbiertoDesdeElJuego = false;

function volverAlInicio(): void {
  if (mapaAbiertoDesdeElJuego) {
    history.back();
  } else {
    // Se entró directamente con «#mapa»: volver no debe sacar al jugador de la web.
    history.replaceState(null, '', location.pathname + location.search);
    mostrarSegunDireccion();
  }
}

function mostrarSegunDireccion(): void {
  if (location.hash === '#mapa') {
    pantallaMapa ??= abrirPantallaMapa(volverAlInicio);
  } else if (pantallaMapa) {
    pantallaMapa.cerrar();
    pantallaMapa = null;
  }
}
window.addEventListener('hashchange', () => {
  mapaAbiertoDesdeElJuego = location.hash === '#mapa';
  mostrarSegunDireccion();
});
mostrarSegunDireccion();

// La Hoja de ruta abierta en otra pestaña avisa al instante de una versión nueva.
const canal = abrirCanal((mensaje) => mostrarAvisoVersion(mensaje.version));

// El sonido se pone en marcha con el primer clic o la primera tecla (GDD 7.1).
activarSonidoAlInteractuar();

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
