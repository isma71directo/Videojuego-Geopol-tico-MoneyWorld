/** Pantalla de inicio del juego (GDD, sección 7, pantalla 1). */
import { numeroDeFase, type Roadmap } from '../compartido/roadmap';
import { VERSION, etiquetaVersion } from '../compartido/version';
import { t } from '../i18n';
import { guardarAjuste, leerAjuste } from './ajustes';
import { el } from './dom';
import { abrirHoja, type Hoja } from './hoja';
import { masReciente } from '../sim/guardado';
import type { Partida } from '../sim/partida';
import { almacenPartidas } from './almacen-partidas';
import {
  abrirCargarPartida,
  cargarGuardado,
  textoPartida,
  type OpcionesCambiarPartida,
} from './guardar-cargar';
import {
  cambiarVolumenEfectos,
  cambiarVolumenMusica,
  reproducir,
  silenciar,
  sonido,
} from './sonido';
import './estilos/inicio.css';

/** Dirección de la Hoja de ruta vista desde el juego. */
const URL_HOJA_DE_RUTA = './hoja-de-ruta/';

const SVG = 'http://www.w3.org/2000/svg';

/** Globo decorativo de fondo: meridianos y paralelos, sin datos reales. */
function globo(): SVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('class', 'inicio__globo');
  svg.setAttribute('aria-hidden', 'true');
  const trazo = (etiqueta: string, atributos: Record<string, number | string>): void => {
    const forma = document.createElementNS(SVG, etiqueta);
    for (const [nombre, valor] of Object.entries(atributos)) {
      forma.setAttribute(nombre, String(valor));
    }
    svg.appendChild(forma);
  };
  trazo('circle', { cx: 100, cy: 100, r: 96 });
  for (const rx of [24, 52, 78]) trazo('ellipse', { cx: 100, cy: 100, rx, ry: 96 });
  trazo('line', { x1: 100, y1: 4, x2: 100, y2: 196 });
  for (const [y, mitad] of [
    [100, 96],
    [64, 89],
    [136, 89],
    [30, 66],
    [170, 66],
  ] as const) {
    trazo('line', { x1: 100 - mitad, y1: y, x2: 100 + mitad, y2: y });
  }
  return svg;
}

function casillaMedidorFps(): HTMLElement {
  const casilla = el('input', { type: 'checkbox', checked: leerAjuste('medidorFps') });
  casilla.addEventListener('change', () => guardarAjuste('medidorFps', casilla.checked));
  return el(
    'label',
    { class: 'ajuste' },
    casilla,
    el(
      'span',
      {},
      el('strong', {}, t('juego.ajustes.medidorFps')),
      el('small', {}, t('juego.ajustes.medidorFpsAyuda')),
    ),
  );
}

function ajustesSonido(): HTMLElement[] {
  const casilla = el('input', { type: 'checkbox', checked: sonido.silenciado });
  casilla.addEventListener('change', () => silenciar(casilla.checked));
  const volumen = el('input', {
    type: 'range',
    min: 0,
    max: 100,
    step: 5,
    value: Math.round(sonido.volumenEfectos * 100),
    'aria-label': t('juego.ajustes.volumenEfectos'),
  });
  const valor = el('output', {}, `${volumen.value} %`);
  volumen.addEventListener('input', () => {
    valor.textContent = `${volumen.value} %`;
    cambiarVolumenEfectos(Number(volumen.value) / 100);
  });
  // Al soltar el control suena un efecto de prueba con el volumen elegido.
  volumen.addEventListener('change', () => reproducir('seleccionar'));
  // Volumen de la música (tarea f12-t3).
  const volumenMusica = el('input', {
    type: 'range',
    min: 0,
    max: 100,
    step: 5,
    value: Math.round(sonido.volumenMusica * 100),
    'aria-label': t('juego.ajustes.volumenMusica'),
  });
  const valorMusica = el('output', {}, `${volumenMusica.value} %`);
  volumenMusica.addEventListener('input', () => {
    valorMusica.textContent = `${volumenMusica.value} %`;
    cambiarVolumenMusica(Number(volumenMusica.value) / 100);
  });
  return [
    el(
      'label',
      { class: 'ajuste' },
      casilla,
      el(
        'span',
        {},
        el('strong', {}, t('juego.ajustes.silenciar')),
        el('small', {}, t('juego.ajustes.silenciarAyuda')),
      ),
    ),
    el(
      'label',
      { class: 'ajuste ajuste--deslizador' },
      el('strong', {}, t('juego.ajustes.volumenEfectos')),
      volumen,
      valor,
    ),
    el(
      'label',
      { class: 'ajuste ajuste--deslizador' },
      el('strong', {}, t('juego.ajustes.volumenMusica')),
      volumenMusica,
      valorMusica,
    ),
  ];
}

/** Intensidad del terreno bajo los colores de los países (tarea f6-t3). */
function deslizadorTerreno(): HTMLElement {
  const intensidad = el('input', {
    type: 'range',
    min: 0,
    max: 100,
    step: 5,
    value: Math.round(leerAjuste('intensidadTerreno') * 100),
    'aria-label': t('juego.ajustes.intensidadTerreno'),
  });
  const valor = el('output', {}, `${intensidad.value} %`);
  intensidad.addEventListener('input', () => {
    valor.textContent = `${intensidad.value} %`;
    guardarAjuste('intensidadTerreno', Number(intensidad.value) / 100);
  });
  return el(
    'label',
    { class: 'ajuste ajuste--deslizador' },
    el(
      'span',
      {},
      el('strong', {}, t('juego.ajustes.intensidadTerreno')),
      el('small', {}, t('juego.ajustes.intensidadTerrenoAyuda')),
    ),
    intensidad,
    valor,
  );
}

/** Brillo animado del agua (tarea f6-t4). */
function casillaBrilloAgua(): HTMLElement {
  const casilla = el('input', { type: 'checkbox', checked: leerAjuste('brilloAgua') });
  casilla.addEventListener('change', () => guardarAjuste('brilloAgua', casilla.checked));
  return el(
    'label',
    { class: 'ajuste' },
    casilla,
    el(
      'span',
      {},
      el('strong', {}, t('juego.ajustes.brilloAgua')),
      el('small', {}, t('juego.ajustes.brilloAguaAyuda')),
    ),
  );
}

/** Noche y día sobre el mapa de la partida (tarea f11-t4). */
function casillaNocheMapa(): HTMLElement {
  const casilla = el('input', { type: 'checkbox', checked: leerAjuste('nocheMapa') });
  casilla.addEventListener('change', () => guardarAjuste('nocheMapa', casilla.checked));
  return el(
    'label',
    { class: 'ajuste' },
    casilla,
    el(
      'span',
      {},
      el('strong', {}, t('juego.ajustes.nocheMapa')),
      el('small', {}, t('juego.ajustes.nocheMapaAyuda')),
    ),
  );
}

/** Pausa automática ante sucesos importantes (tarea f13-t3). */
function casillaPausaSucesos(): HTMLElement {
  const casilla = el('input', { type: 'checkbox', checked: leerAjuste('pausaSucesos') });
  casilla.addEventListener('change', () => guardarAjuste('pausaSucesos', casilla.checked));
  return el(
    'label',
    { class: 'ajuste' },
    casilla,
    el(
      'span',
      {},
      el('strong', {}, t('juego.ajustes.pausaSucesos')),
      el('small', {}, t('juego.ajustes.pausaSucesosAyuda')),
    ),
  );
}

/** Abre Ajustes (en el inicio y, desde la tarea f14-t2, en el menú de la partida). */
export function abrirAjustes(): Hoja {
  return abrirHoja(
    t('juego.ajustes.titulo'),
    casillaMedidorFps(),
    casillaPausaSucesos(),
    ...ajustesSonido(),
    deslizadorTerreno(),
    casillaBrilloAgua(),
    casillaNocheMapa(),
    el('p', { class: 'hoja__nota' }, t('juego.ajustes.vacio')),
    el(
      'p',
      {},
      `${t('juego.ajustes.version')}: `,
      el('strong', {}, etiquetaVersion()),
      ` (${t('juego.inicio.nombreProvisional')})`,
    ),
  );
}

export interface PantallaInicio {
  elemento: HTMLElement;
  /** Zona del pie reservada para acciones (p. ej. reportar un fallo). */
  acciones: HTMLElement;
  /** Muestra en qué fase está el desarrollo, según roadmap.json. */
  mostrarFaseActiva(roadmap: Roadmap): void;
  /** Pone al día «Continuar» con la partida guardada más reciente (tarea f14-t4). */
  actualizarGuardados(): Promise<void>;
}

export interface OpcionesInicio {
  /** Seguir una partida guardada o importada (tarea f14-t4). */
  alCargarPartida?: (partida: Partida, ranura: number | null) => void;
}

/** Nombres de los países (de los datos de 2010), para contar cada guardado. */
let nombres: Promise<Map<string, string>> | null = null;
function nombresDePaises(): Promise<Map<string, string>> {
  nombres ??= fetch('./data/paises-2010.json')
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      return respuesta.json() as Promise<{ paises: Record<string, { nombre: string }> }>;
    })
    .then((datos) => new Map(Object.entries(datos.paises).map(([id, p]) => [id, p.nombre])))
    .catch(() => {
      // Sin los datos, los guardados se cuentan con el código del país (y se reintenta).
      nombres = null;
      return new Map<string, string>();
    });
  return nombres;
}

export function crearPantallaInicio(opciones: OpcionesInicio = {}): PantallaInicio {
  const ajustes = el('button', { class: 'boton', type: 'button' }, t('juego.inicio.ajustes'));
  ajustes.addEventListener('click', abrirAjustes);

  const faseActiva = el('p', { class: 'inicio__fase', hidden: true });
  const acciones = el('div', { class: 'inicio__acciones' });

  // Guardar y cargar (tarea f14-t4, decisión del jugador): «Continuar» abre la partida guardada
  // más reciente y «Cargar partida», todas (y deja importar un archivo).
  const resumenContinuar = el('small', {});
  const continuar = el(
    'button',
    {
      class: 'boton boton--principal boton--menu inicio__continuar',
      type: 'button',
      hidden: true,
    },
    el('span', {}, t('juego.inicio.continuar')),
    resumenContinuar,
  );
  const nuevaPartida = el(
    'a',
    { class: 'boton boton--principal boton--menu', href: '#nueva-partida' },
    el('span', {}, t('juego.inicio.nuevaPartida')),
    el('small', {}, t('juego.inicio.nuevaPartidaAviso')),
  );
  const cargar = el(
    'button',
    { class: 'boton boton--menu inicio__cargar', type: 'button' },
    el('span', {}, t('juego.inicio.cargar')),
    el('small', {}, t('juego.inicio.cargarAviso')),
  );
  const opcionesCarga = async (): Promise<OpcionesCambiarPartida> => {
    const conNombres = await nombresDePaises();
    return {
      almacen: almacenPartidas(),
      nombreDe: (id) => conNombres.get(id) ?? id,
      // En el inicio no hay partida que perder.
      hayCambios: () => false,
      alCargar: (partida, ranura) => opciones.alCargarPartida?.(partida, ranura),
    };
  };
  let masNueva: Awaited<ReturnType<typeof masReciente>> = null;
  continuar.addEventListener('click', () => {
    if (!masNueva) return;
    const resumen = masNueva;
    void opcionesCarga().then((cargarCon) => cargarGuardado(resumen, cargarCon));
  });
  cargar.addEventListener('click', () => {
    void opcionesCarga().then((cargarCon) => abrirCargarPartida(cargarCon));
  });
  const actualizarGuardados = async (): Promise<void> => {
    try {
      masNueva = masReciente(await almacenPartidas().listar());
    } catch {
      masNueva = null;
    }
    if (masNueva) {
      const conNombres = await nombresDePaises();
      const partida = textoPartida(masNueva, (id) => conNombres.get(id) ?? id);
      resumenContinuar.textContent = masNueva.nombre ? `${masNueva.nombre} · ${partida}` : partida;
    }
    continuar.hidden = masNueva === null;
    // Con una partida que seguir, «Continuar» es el botón principal.
    nuevaPartida.classList.toggle('boton--principal', masNueva === null);
  };

  const elemento = el(
    'main',
    { class: 'inicio' },
    el('div', { class: 'inicio__fondo', 'aria-hidden': 'true' }, globo()),
    el(
      'header',
      { class: 'inicio__cabecera' },
      el('p', { class: 'inicio__sello' }, t('juego.inicio.sello')),
      el(
        'h1',
        { class: 'inicio__titulo' },
        'Geopolítica ',
        el('span', { class: 'inicio__anio' }, '2010'),
      ),
      el('p', { class: 'inicio__lema' }, t('juego.inicio.lema')),
    ),
    el(
      'nav',
      { class: 'inicio__menu', 'aria-label': t('juego.inicio.menu') },
      continuar,
      nuevaPartida,
      cargar,
      el(
        'a',
        { class: 'boton boton--menu', href: '#mapa' },
        el('span', {}, t('juego.inicio.mapa')),
        el('small', {}, t('juego.inicio.mapaAviso')),
      ),
      el(
        'a',
        { class: 'boton boton--menu', href: URL_HOJA_DE_RUTA },
        el('span', {}, t('juego.inicio.hojaDeRuta')),
        el('small', {}, t('juego.inicio.hojaDeRutaAviso')),
      ),
      ajustes,
    ),
    el(
      'footer',
      { class: 'inicio__pie' },
      acciones,
      el(
        'p',
        { class: 'inicio__version' },
        el('strong', {}, t('juego.inicio.version', { version: VERSION })),
        ` · ${t('juego.inicio.nombreProvisional')}`,
      ),
      faseActiva,
    ),
  );

  return {
    elemento,
    acciones,
    actualizarGuardados,
    mostrarFaseActiva(roadmap) {
      const fase = roadmap.fases.find((f) => f.id === roadmap.faseActiva);
      if (!fase) {
        faseActiva.hidden = true;
        return;
      }
      const numero = numeroDeFase(fase.id);
      const nombre =
        numero === null
          ? fase.nombre
          : `${t('hojaDeRuta.fases.fase', { numero })} · ${fase.nombre}`;
      faseActiva.textContent = t('juego.inicio.enDesarrollo', { fase: nombre });
      faseActiva.hidden = false;
    },
  };
}
