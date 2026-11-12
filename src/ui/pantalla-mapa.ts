/** Pantalla del mapa del mundo a pantalla completa (Fases 3 y 4). */
import type { ConjuntoPaises } from '../datos/paises';
import { t } from '../i18n';
import { capaPorId, colorearCapa, type CapaDatos } from '../map/capas';
import { MapaMundo, type Objetivo, type RegionSenalada } from '../map/mapa';
import { ESTILO_MAPA } from '../map/estilo';
import { conectarGestos } from '../map/gestos';
import { guardarAjuste, leerAjuste, medidorFpsActivo } from './ajustes';
import { el, reemplazar } from './dom';
import { contenidoPanelCiudad, contenidoRecuadroCiudad } from './ficha-ciudad';
import {
  contenidoPanelRegion,
  contenidoRecuadroRegion,
  type ConjuntoRegiones,
  type DatosRegion,
} from './ficha-region';
import { contenidoPanel, contenidoRecuadro } from './ficha-pais';
import { contenidoLeyenda } from './leyenda';
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
  // Leyenda de la capa de datos activa (Fase 6); la capa política no la necesita.
  const leyenda = el('aside', {
    class: 'leyenda',
    'aria-labelledby': 'leyenda-titulo',
    hidden: true,
  });
  const elemento = el(
    'section',
    { class: 'mapa' },
    lienzo,
    barra,
    estado,
    medidor,
    leyenda,
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
      regiones: './data/regiones-2010.json',
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
  let recuadroDe: unknown = null;
  /** Capa de datos activa; null es la capa política. «?capa=paro» la elige al abrir. */
  const capa: CapaDatos | null = capaPorId(new URLSearchParams(location.search).get('capa') ?? '');
  const pintarCapa = (): void => {
    if (!capa || !conjunto) {
      mapa.capa = null;
      leyenda.hidden = true;
      leyenda.replaceChildren();
      return;
    }
    const coloreado = colorearCapa(capa, conjunto.paises);
    mapa.capa = coloreado;
    reemplazar(
      leyenda,
      ...contenidoLeyenda(
        capa,
        coloreado.rayados.size > 0,
        mapa.hayPaisesSinDatos(coloreado),
        coloreado.sinDatos,
      ),
    );
    leyenda.hidden = false;
    // La ficha que está a la vista cambia de dato.
    recuadroDe = null;
    if (senalado) mostrarRecuadro(senalado.objetivo, senalado.x, senalado.y);
  };

  // Datos de las regiones (Fase 5): se descargan la primera vez que se señala una región.
  let datosRegiones: ConjuntoRegiones | null = null;
  let cargandoDatosRegiones = false;
  let senalado: { objetivo: Objetivo; x: number; y: number } | null = null;
  let seleccion: Objetivo | null = null;
  const datosDe = (region: RegionSenalada): DatosRegion | null =>
    datosRegiones?.regiones[region.id] ?? null;
  const cargarDatosRegiones = (): void => {
    if (datosRegiones || cargandoDatosRegiones) return;
    cargandoDatosRegiones = true;
    fetch('./data/regiones-2010-datos.json')
      .then((r) => (r.ok ? (r.json() as Promise<ConjuntoRegiones>) : Promise.reject(new Error())))
      .then((datos) => {
        datosRegiones = datos;
        // Se repintan la ficha y el panel que esperaban los datos.
        recuadroDe = null;
        if (senalado?.objetivo.tipo === 'region') {
          mostrarRecuadro(senalado.objetivo, senalado.x, senalado.y);
        }
        if (seleccion?.tipo === 'region') pintarPanel(seleccion);
      })
      .catch(() => {
        cargandoDatosRegiones = false;
      });
  };

  /** Recuadro al lado del ratón con la ficha breve de lo señalado (país, región o ciudad). */
  const mostrarRecuadro = (objetivo: Objetivo | null, x: number, y: number): void => {
    // Lo que se señala: el código del país, la región o la propia ciudad.
    const clave =
      objetivo?.tipo === 'ciudad'
        ? objetivo.ciudad
        : objetivo?.tipo === 'region'
          ? objetivo.region.id
          : (objetivo?.id ?? null);
    const pais = objetivo?.tipo === 'pais' && conjunto ? conjunto.paises[objetivo.id] : undefined;
    if (objetivo === null || (objetivo.tipo === 'pais' && (!pais || !conjunto))) {
      recuadro.hidden = true;
      recuadroDe = null;
      return;
    }
    if (objetivo.tipo === 'region') cargarDatosRegiones();
    if (recuadroDe !== clave) {
      reemplazar(
        recuadro,
        ...(objetivo.tipo === 'ciudad'
          ? contenidoRecuadroCiudad(objetivo.ciudad, conjunto)
          : objetivo.tipo === 'region'
            ? contenidoRecuadroRegion(objetivo.region, conjunto, datosDe(objetivo.region))
            : contenidoRecuadro(pais!, conjunto!, capa)),
      );
      recuadroDe = clave;
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
  mapa.alSenalar = (objetivo, x, y) => {
    senalado = objetivo ? { objetivo, x, y } : null;
    mostrarRecuadro(objetivo, x, y);
  };

  /** Panel de la derecha con la ficha de lo seleccionado; devuelve si hay algo que mostrar. */
  const pintarPanel = (objetivo: Objetivo): boolean => {
    const pais = objetivo.tipo === 'pais' && conjunto ? conjunto.paises[objetivo.id] : undefined;
    if (objetivo.tipo === 'pais' && (!pais || !conjunto)) return false;
    const quitar = (): void => mapa.seleccionar(null);
    if (objetivo.tipo === 'region') cargarDatosRegiones();
    reemplazar(
      panel,
      ...(objetivo.tipo === 'ciudad'
        ? contenidoPanelCiudad(objetivo.ciudad, conjunto, quitar, () =>
            mapa.seleccionar(objetivo.ciudad.pais),
          )
        : objetivo.tipo === 'region'
          ? contenidoPanelRegion(objetivo.region, conjunto, datosDe(objetivo.region), quitar, () =>
              mapa.seleccionar(objetivo.region.pais),
            )
          : contenidoPanel(pais!, conjunto!, quitar)),
    );
    return true;
  };
  mapa.alSeleccionar = (objetivo) => {
    seleccion = objetivo;
    if (objetivo === null || !pintarPanel(objetivo)) {
      if (!panel.hidden) reproducir('deseleccionar');
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }
    if (panel.hidden) reproducir('abrirPanel');
    reproducir('seleccionar');
    panel.hidden = false;
  };
  const alPulsarEscape = (evento: KeyboardEvent): void => {
    if (evento.key === 'Escape' && mapa.haySeleccion) {
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
      pintarCapa();
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
