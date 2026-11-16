/**
 * Galería audiovisual: muestra el contenido gráfico del juego para poder revisarlo en el
 * móvil al cerrar cada fase (GDD, sección 7.1): mapa de 2010, paleta, iconos, sonidos, componentes
 * de interfaz (Fase 7) y banderas.
 */
import '../src/ui/estilos/base.css';
import './estilos.css';

import { urlBandera } from '../src/av/banderas';
import { NOMBRES_ICONOS, icono } from '../src/av/iconos';
import { EFECTOS, MotorSonido, type Efecto } from '../src/av/sonido';
import { capaPorId, COLOR_SIN_RESERVAS } from '../src/map/capas';
import { etiquetaCapa, opcionesCapas, POLITICA } from '../src/ui/selector-capas';
import { preferenciasDeColor } from '../src/map/colores';
import tablaColores from '../src/map/config/colores-pais.json';
import type { ConjuntoPaises, PaisDatos } from '../src/datos/paises';
import { vistaPreviaMapa, type TopologiaMapa } from '../src/map/vista-previa';
import { t } from '../src/i18n';
import { el, reemplazar, type Hijo } from '../src/ui/dom';
import { sonidosDeComponentes } from '../src/ui/componentes/sonidos';
import { muestrario } from './muestrario';

/** Ruta desde /galeria/ hasta la raíz del juego. */
const RAIZ = '../';

const raiz = document.querySelector<HTMLElement>('#galeria')!;

function cabecera(): HTMLElement {
  return el(
    'header',
    { class: 'galeria__cabecera' },
    el('p', { class: 'galeria__juego' }, t('comun.titulo')),
    el('h1', {}, t('galeria.titulo')),
    el('p', { class: 'galeria__nota' }, t('galeria.subtitulo')),
    el(
      'nav',
      { class: 'galeria__enlaces' },
      el('a', { class: 'boton', href: RAIZ }, t('galeria.juego')),
      el('a', { class: 'boton', href: `${RAIZ}hoja-de-ruta/` }, t('galeria.hojaDeRuta')),
    ),
  );
}

function seccion(titulo: string, nota: string, ...hijos: Hijo[]): HTMLElement {
  return el(
    'section',
    { class: 'galeria__seccion' },
    el('h2', {}, titulo),
    el('p', { class: 'galeria__nota' }, nota),
    ...hijos,
  );
}

function iconos(): HTMLElement {
  return seccion(
    t('galeria.iconos.titulo'),
    t('galeria.iconos.nota'),
    el(
      'ul',
      { class: 'galeria__iconos' },
      ...NOMBRES_ICONOS.map((nombre) =>
        el('li', {}, icono(nombre), el('span', {}, t(`galeria.iconos.${nombre}`))),
      ),
    ),
  );
}

const sonido = new MotorSonido({ silenciado: false, volumenEfectos: 0.8, volumenMusica: 0.5 });
// Los componentes del muestrario suenan al usarlos (siempre son acciones del jugador).
sonidosDeComponentes((efecto) => {
  sonido.activar();
  sonido.reproducir(efecto);
});

function sonidos(): HTMLElement {
  return seccion(
    t('galeria.sonidos.titulo'),
    t('galeria.sonidos.nota'),
    el(
      'ul',
      { class: 'galeria__sonidos' },
      ...(Object.keys(EFECTOS) as Efecto[]).map((efecto) => {
        const nombre = t(`galeria.sonidos.${efecto}`);
        const boton = el(
          'button',
          {
            class: 'boton',
            type: 'button',
            'aria-label': t('galeria.sonidos.escuchar', { efecto: nombre }),
          },
          icono('sonido'),
          nombre,
        );
        boton.addEventListener('click', () => {
          // El clic es la interacción que el navegador pide para poder sonar.
          sonido.activar();
          sonido.reproducir(efecto);
        });
        return el('li', {}, boton);
      }),
    ),
  );
}

/** Colores de referencia de la tabla de colores representativos (ajuste f7-a3). */
function referencias(): HTMLElement {
  return seccion(
    t('galeria.paleta.titulo'),
    t('galeria.paleta.nota'),
    el(
      'ul',
      { class: 'galeria__paleta' },
      ...Object.entries(tablaColores.colores).map(([nombre, color]) => {
        const muestra = el('span', { class: 'galeria__color', 'aria-hidden': 'true' });
        muestra.style.background = color;
        return el('li', {}, muestra, el('span', {}, nombre));
      }),
    ),
  );
}

/**
 * Color de cada país en el mapa político (ajustes f7-a1 y f7-a3): para que el jugador revise si
 * cada uno lleva el que se le asocia. Son los mismos que usa el juego (data/colores-pais.json):
 * a la izquierda, el color pedido en la tabla (o el de la bandera); a la derecha, el del mapa.
 */
function coloresPaises(colores: Record<string, string>, conjunto: ConjuntoPaises): HTMLElement {
  const preferencias = preferenciasDeColor();
  const tabla = tablaColores.paises as Record<string, readonly string[]>;
  const paises = Object.keys(colores)
    .map((id) => ({ id, nombre: conjunto.paises[id]?.nombre ?? id }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return seccion(
    t('galeria.coloresPais.titulo'),
    t('galeria.coloresPais.nota'),
    el(
      'ul',
      { class: 'galeria__colores-pais' },
      ...paises.map(({ id, nombre }) => {
        const pedido = el('span', { class: 'galeria__color-pedido', 'aria-hidden': 'true' });
        pedido.style.background = preferencias.get(id)?.colores[0] ?? 'transparent';
        const muestra = el('span', { class: 'galeria__color-pais', 'aria-hidden': 'true' });
        muestra.style.background = colores[id]!;
        const deseado = tabla[id]?.join(', ') ?? t('galeria.coloresPais.bandera');
        return el(
          'li',
          { title: `${deseado} → ${colores[id]!}` },
          el('img', {
            src: urlBandera(id, RAIZ),
            alt: '',
            width: 32,
            height: 24,
            loading: 'lazy',
            decoding: 'async',
          }),
          pedido,
          muestra,
          el(
            'span',
            { class: 'galeria__color-nombre' },
            el('span', {}, nombre),
            el('small', {}, deseado),
          ),
        );
      }),
    ),
  );
}

/** Rampas de color de las capas del mapa (tarea f6-t4). */
function capas(): HTMLElement {
  return seccion(
    t('galeria.capas.titulo'),
    t('galeria.capas.nota'),
    el(
      'ul',
      { class: 'galeria__capas' },
      ...opcionesCapas()
        .filter((opcion) => opcion.id !== POLITICA)
        .map((opcion) => {
          const capa = capaPorId(opcion.id)!;
          const colores = capa.cero ? [COLOR_SIN_RESERVAS, ...capa.colores] : [...capa.colores];
          return el(
            'li',
            {},
            el(
              'span',
              { class: 'galeria__capa-nombre' },
              icono(opcion.icono),
              etiquetaCapa(opcion.id),
            ),
            el(
              'span',
              { class: 'galeria__rampa', 'aria-hidden': 'true' },
              ...colores.map((color) => {
                const muestra = el('span', {});
                muestra.style.background = color;
                return muestra;
              }),
            ),
          );
        }),
    ),
  );
}

function bandera(pais: PaisDatos): HTMLElement {
  return el(
    'li',
    { class: 'galeria__bandera' },
    el('img', {
      src: urlBandera(pais.id, RAIZ),
      alt: t('galeria.banderas.alt', { pais: pais.nombre }),
      width: 96,
      height: 72,
      loading: 'lazy',
      decoding: 'async',
    }),
    el('span', {}, pais.nombre),
  );
}

function banderas(conjunto: ConjuntoPaises): HTMLElement[] {
  const orden = Object.values(conjunto.paises).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es'),
  );
  const estados = orden.filter((pais) => pais.tipo === 'pais');
  const especiales = orden.filter((pais) => pais.tipo === 'especial');
  const dependientes = orden.filter((pais) => pais.tipo === 'dependiente');
  return [
    seccion(
      t('galeria.banderas.titulo', { n: estados.length }),
      t('galeria.banderas.nota'),
      el('ul', { class: 'galeria__banderas' }, ...estados.map(bandera)),
    ),
    seccion(
      t('galeria.banderas.especiales', { n: especiales.length }),
      t('galeria.banderas.notaEspeciales'),
      el('ul', { class: 'galeria__banderas' }, ...especiales.map(bandera)),
    ),
    seccion(
      t('galeria.banderas.dependientes', { n: dependientes.length }),
      t('galeria.banderas.notaDependientes'),
      el('ul', { class: 'galeria__banderas' }, ...dependientes.map(bandera)),
    ),
  ];
}

function leyenda(): HTMLElement {
  const elemento = (clase: string, texto: string): HTMLElement =>
    el('li', {}, el('span', { class: `galeria__muestra ${clase}`, 'aria-hidden': 'true' }), texto);
  return el(
    'ul',
    { class: 'galeria__leyenda' },
    elemento('mapa-previo__pais--pais', t('galeria.mapa.estados')),
    elemento('mapa-previo__pais--especial', t('galeria.mapa.especiales')),
    elemento('mapa-previo__pais--dependiente', t('galeria.mapa.dependientes')),
    elemento('mapa-previo__zona', t('galeria.mapa.zonas')),
  );
}

function mapa(topo: TopologiaMapa, conjunto: ConjuntoPaises): HTMLElement {
  return seccion(
    t('galeria.mapa.titulo'),
    t('galeria.mapa.nota'),
    el(
      'figure',
      { class: 'galeria__mapa' },
      vistaPreviaMapa(topo, conjunto, t('galeria.mapa.alt')),
      leyenda(),
    ),
  );
}

async function descargar<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(`${RAIZ}${ruta}`);
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return (await respuesta.json()) as T;
}

async function iniciar(): Promise<void> {
  reemplazar(
    raiz,
    cabecera(),
    iconos(),
    el('p', { class: 'galeria__nota' }, t('galeria.cargando')),
  );
  try {
    const [conjunto, topo, coloresPais] = await Promise.all([
      descargar<ConjuntoPaises>('data/paises-2010.json'),
      descargar<TopologiaMapa>('data/mapa-2010-mundo.json'),
      descargar<{ colores: Record<string, string> }>('data/colores-pais.json'),
    ]);
    reemplazar(
      raiz,
      cabecera(),
      mapa(topo, conjunto),
      coloresPaises(coloresPais.colores, conjunto),
      referencias(),
      capas(),
      iconos(),
      sonidos(),
      ...muestrario(conjunto, seccion),
      ...banderas(conjunto),
    );
  } catch {
    reemplazar(
      raiz,
      cabecera(),
      iconos(),
      el('p', { class: 'galeria__nota', role: 'alert' }, t('galeria.error')),
    );
  }
}

void iniciar();
