/** Pantalla del mapa del mundo a pantalla completa (Fases 3 y 4). */
import type { ConjuntoPaises } from '../datos/paises';
import { t } from '../i18n';
import { MapaMundo } from '../map/mapa';
import { ESTILO_MAPA } from '../map/estilo';
import { conectarGestos } from '../map/gestos';
import { guardarAjuste, leerAjuste, medidorFpsActivo } from './ajustes';
import { el, reemplazar } from './dom';
import { contenidoPanel, contenidoRecuadro } from './ficha-pais';
import { icono } from '../av/iconos';
import { reproducir, silenciar, sonido } from './sonido';
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
  // Botón de silencio, siempre a mano (GDD 7.1); también con la tecla M.
  const botonSonido = el('button', { class: 'boton mapa__sonido', type: 'button' });
  const pintarBotonSonido = (): void => {
    const texto = t(sonido.silenciado ? 'juego.mapa.activarSonido' : 'juego.mapa.silenciar');
    botonSonido.replaceChildren(icono(sonido.silenciado ? 'silencio' : 'sonido'));
    botonSonido.setAttribute('aria-label', texto);
    botonSonido.setAttribute('aria-pressed', String(sonido.silenciado));
    botonSonido.title = texto;
  };
  const alternarSonido = (): void => {
    silenciar(!sonido.silenciado);
    pintarBotonSonido();
    reproducir('boton');
  };
  pintarBotonSonido();
  botonSonido.addEventListener('click', alternarSonido);
  const barra = el('div', { class: 'mapa__barra' }, volver, botonSonido);
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
  // Recuadro que sigue al ratón y panel del país seleccionado (tarea f4-t1).
  const recuadro = el('div', { class: 'ficha', 'aria-hidden': 'true', hidden: true });
  const panel = el('aside', {
    class: 'panel-pais',
    'aria-labelledby': 'panel-pais-titulo',
    'aria-live': 'polite',
    hidden: true,
  });
  const elemento = el(
    'section',
    { class: 'mapa' },
    lienzo,
    barra,
    estado,
    medidor,
    recuadro,
    panel,
  );
  document.body.appendChild(elemento);

  const mapa = new MapaMundo(
    lienzo,
    {
      mundo: './data/mapa-2010-mundo.json',
      detalle: './data/mapa-2010-detalle.json',
      relieve: './av/relieve/',
      agua: './data/mapa-agua.json',
      ciudades: './data/ciudades-2010.json',
    },
    ESTILO_MAPA,
  );
  mapa.alDibujar = ({ fps, msUltimo, nivel }) => {
    if (!medidor.hidden) medidor.textContent = `${fps} fps · ${msUltimo.toFixed(1)} ms · ${nivel}`;
  };
  const alternarMedidor = (evento: KeyboardEvent): void => {
    if (evento.key === 'm' || evento.key === 'M') {
      alternarSonido();
      return;
    }
    if (evento.key !== 'f' && evento.key !== 'F') return;
    medidor.hidden = !medidor.hidden;
    guardarAjuste('medidorFps', !medidor.hidden);
    mapa.pedirDibujo();
  };
  lienzo.addEventListener('keydown', alternarMedidor);

  let conjunto: ConjuntoPaises | null = null;
  let recuadroDe: string | null = null;
  mapa.alSenalar = (id, x, y) => {
    const pais = id && conjunto ? conjunto.paises[id] : undefined;
    if (!pais || !conjunto) {
      recuadro.hidden = true;
      recuadroDe = null;
      return;
    }
    if (recuadroDe !== id) {
      reemplazar(recuadro, ...contenidoRecuadro(pais, conjunto));
      recuadroDe = id;
    }
    recuadro.hidden = false;
    // Al lado del ratón, sin salirse de la pantalla.
    const margen = 16;
    const ancho = recuadro.offsetWidth;
    const alto = recuadro.offsetHeight;
    const izquierda = x + margen + ancho > elemento.clientWidth ? x - margen - ancho : x + margen;
    const arriba = Math.min(y + margen, elemento.clientHeight - alto - 8);
    recuadro.style.transform = `translate(${Math.max(8, izquierda)}px, ${Math.max(8, arriba)}px)`;
  };
  mapa.alSeleccionar = (id) => {
    const pais = id && conjunto ? conjunto.paises[id] : undefined;
    if (!pais || !conjunto) {
      if (!panel.hidden) reproducir('deseleccionar');
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }
    if (panel.hidden) reproducir('abrirPanel');
    reproducir('seleccionar');
    reemplazar(panel, ...contenidoPanel(pais, conjunto, () => mapa.seleccionar(null)));
    panel.hidden = false;
  };
  const alPulsarEscape = (evento: KeyboardEvent): void => {
    if (evento.key === 'Escape' && mapa.paisSeleccionado) {
      evento.preventDefault();
      mapa.seleccionar(null);
      lienzo.focus({ preventScroll: true });
    }
  };
  document.addEventListener('keydown', alPulsarEscape);
  fetch('./data/paises-2010.json')
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      return respuesta.json() as Promise<ConjuntoPaises>;
    })
    .then((datos) => {
      conjunto = datos;
      mapa.nombres = new Map(Object.values(datos.paises).map((pais) => [pais.id, pais.nombre]));
      mapa.nombresAbreviados = new Map(
        Object.keys(datos.paises).flatMap((id) => {
          const clave = `juego.mapa.nombresCortos.${id}`;
          const corto = t(clave);
          return corto === clave ? [] : [[id, corto] as [string, string]];
        }),
      );
    })
    .catch(() => {
      // Sin datos el mapa sigue funcionando; solo faltan las fichas.
    });
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
    document.removeEventListener('keydown', alPulsarEscape);
    desconectar();
    mapa.destruir();
    elemento.remove();
  };
  volver.addEventListener('click', () => {
    reproducir('boton');
    alCerrar();
  });
  return { elemento, mapa, cerrar };
}
