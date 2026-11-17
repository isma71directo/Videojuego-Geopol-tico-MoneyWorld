/** Punto de entrada del juego: pantalla de inicio, mapa libre, nueva partida y partida. */
import './ui/estilos/base.css';

import { abrirCanal, hayVersionNueva, vigilarRoadmap } from './compartido/sincronizacion';
import { VERSION, etiquetaVersion } from './compartido/version';
import { t } from './i18n';
import { el, reemplazar } from './ui/dom';
import { crearPantallaInicio } from './ui/inicio';
import { abrirPantallaMapa, type PantallaMapa } from './ui/pantalla-mapa';
import { abrirPantallaNuevaPartida, type PantallaNuevaPartida } from './ui/nueva-partida';
import type { Partida } from './sim/partida';
import { botonReportar } from './ui/reportar';
import { sonidosDeComponentes } from './ui/componentes/sonidos';
import { activarSonidoAlInteractuar, reproducir } from './ui/sonido';

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

// Navegación sencilla por el «#» de la dirección: «#mapa» abre el mapa libre, «#nueva-partida»
// la pantalla para elegir país y «#partida» la partida empezada. El botón «atrás» del navegador
// vuelve a la pantalla anterior.
let pantallaMapa: PantallaMapa | null = null;
let pantallaNueva: PantallaNuevaPartida | null = null;
/** Partida en curso; se guarda desde su menú (Fase 14). */
let partida: Partida | null = null;
/** Ranura de la que se cargó la partida en curso (Ctrl+S guarda en ella; tarea f14-t2). */
let ranuraDeLaPartida: number | null = null;
/** Si la pantalla se abrió desde el juego, «Volver» equivale al botón «atrás» del navegador. */
let abiertaDesdeElJuego = false;

function volverAlInicio(): void {
  if (abiertaDesdeElJuego) {
    history.back();
  } else {
    // Se entró directamente con la dirección: volver no debe sacar al jugador de la web.
    history.replaceState(null, '', location.pathname + location.search);
    mostrarSegunDireccion();
  }
}

/** Sale de la partida (ya confirmado, y guardada si el jugador ha querido). */
function terminarPartida(): void {
  partida = null;
  ranuraDeLaPartida = null;
  volverAlInicio();
}

/** Cambia a una partida cargada desde el menú de la partida (tarea f14-t2). */
function cambiarDePartida(cargada: Partida, ranura: number | null): void {
  partida = cargada;
  ranuraDeLaPartida = ranura;
  mostrarSegunDireccion();
}

function mostrarSegunDireccion(): void {
  const hash = location.hash;
  // Sin partida empezada (al recargar), «#partida» lleva a elegir país.
  if (hash === '#partida' && !partida) {
    history.replaceState(null, '', '#nueva-partida');
    mostrarSegunDireccion();
    return;
  }
  if (hash !== '#nueva-partida' && pantallaNueva) {
    pantallaNueva.cerrar();
    pantallaNueva = null;
  }
  const conMapa = hash === '#mapa' || hash === '#partida';
  if (
    pantallaMapa &&
    (!conMapa || pantallaMapa.partida !== (hash === '#partida' ? partida : null))
  ) {
    pantallaMapa.cerrar();
    pantallaMapa = null;
  }
  if (hash === '#mapa') pantallaMapa ??= abrirPantallaMapa(volverAlInicio);
  else if (hash === '#partida') {
    pantallaMapa ??= abrirPantallaMapa(terminarPartida, {
      partida,
      ranura: ranuraDeLaPartida,
      alCargar: cambiarDePartida,
    });
  } else if (hash === '#nueva-partida') {
    pantallaNueva ??= abrirPantallaNuevaPartida({
      alVolver: volverAlInicio,
      alEmpezar: (nueva) => {
        partida = nueva;
        ranuraDeLaPartida = null;
        // La partida sustituye a la elección en el historial: «atrás» vuelve al inicio.
        location.replace('#partida');
      },
    });
  }
}
window.addEventListener('hashchange', () => {
  // «Atrás» con una partida en marcha (tarea f10-t3): se vuelve a ella y se pregunta antes de
  // salir, como con el botón «Menú».
  if (partida && pantallaMapa?.partida === partida && location.hash !== '#partida') {
    history.pushState(null, '', '#partida');
    void pantallaMapa.pedirSalida().then((salir) => {
      if (salir) terminarPartida();
    });
    return;
  }
  // Al empezar, «#nueva-partida» se cambia por «#partida»: se conserva de dónde se vino.
  const deElegirAJugar = location.hash === '#partida' && pantallaNueva !== null;
  if (!deElegirAJugar) {
    abiertaDesdeElJuego = ['#mapa', '#nueva-partida', '#partida'].includes(location.hash);
  }
  mostrarSegunDireccion();
});
// Recargar o cerrar la pestaña con una partida en marcha la perdería: el navegador pregunta.
window.addEventListener('beforeunload', (evento) => {
  if (partida) evento.preventDefault();
});
mostrarSegunDireccion();

// La Hoja de ruta abierta en otra pestaña avisa al instante de una versión nueva.
const canal = abrirCanal((mensaje) => mostrarAvisoVersion(mensaje.version));

// El sonido se pone en marcha con el primer clic o la primera tecla (GDD 7.1).
activarSonidoAlInteractuar();
// Ventanas, paneles, pestañas y menús suenan con los ajustes de sonido del jugador.
sonidosDeComponentes(reproducir);

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
