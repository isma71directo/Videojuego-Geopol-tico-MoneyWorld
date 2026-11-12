/**
 * Galería audiovisual: muestra el contenido gráfico del juego para poder revisarlo en el
 * móvil al cerrar cada fase (GDD, sección 7.1): mapa de 2010, iconos y banderas.
 */
import '../src/ui/estilos/base.css';
import './estilos.css';

import { urlBandera } from '../src/av/banderas';
import { NOMBRES_ICONOS, icono } from '../src/av/iconos';
import type { ConjuntoPaises, PaisDatos } from '../src/datos/paises';
import { vistaPreviaMapa, type TopologiaMapa } from '../src/map/vista-previa';
import { t } from '../src/i18n';
import { el, reemplazar, type Hijo } from '../src/ui/dom';

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
    const [conjunto, topo] = await Promise.all([
      descargar<ConjuntoPaises>('data/paises-2010.json'),
      descargar<TopologiaMapa>('data/mapa-2010-mundo.json'),
    ]);
    reemplazar(raiz, cabecera(), mapa(topo, conjunto), iconos(), ...banderas(conjunto));
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
