/**
 * Muestrario de los componentes de interfaz en la galería (tarea f7-t3): cada pieza de la
 * Fase 7 para probarla con el ratón y con el teclado. Usa los datos reales de 2010 cuando los
 * hay (población, PIB, paro, mix eléctrico); lo que todavía no tiene datos (series de varios
 * años, impuestos) se marca como ejemplo inventado.
 */
import { dolares, dolaresPorPersona, personas, porcentaje } from '../src/compartido/formato';
import type { ConjuntoPaises, PaisDatos } from '../src/datos/paises';
import { t } from '../src/i18n';
import { crearDeslizador } from '../src/ui/componentes/deslizador';
import {
  barraDePartes,
  graficoBarras,
  graficoLineas,
  minigrafico,
} from '../src/ui/componentes/graficos';
import { conInformacion } from '../src/ui/componentes/info';
import { abrirMenuContextual, SEPARADOR } from '../src/ui/componentes/menu';
import { pedirConfirmacion } from '../src/ui/componentes/confirmacion';
import { transicionAPartida } from '../src/ui/transicion-partida';
import { abrirPanel } from '../src/ui/componentes/panel';
import { crearPestanas } from '../src/ui/componentes/pestanas';
import { crearTabla } from '../src/ui/componentes/tabla';
import { abrirVentana } from '../src/ui/componentes/ventana';
import { el, type Hijo } from '../src/ui/dom';

type Seccion = (titulo: string, nota: string, ...hijos: Hijo[]) => HTMLElement;

const tx = (clave: string, parametros: Record<string, string | number> = {}): string =>
  t(`galeria.componentes.${clave}`, parametros);

/** Mix eléctrico de 2010 de un país (TWh), solo las fuentes con algo de generación. */
function mixElectrico(pais: PaisDatos): { etiqueta: string; valor: number }[] {
  const fuentes: [string, string][] = [
    ['elecCarbon', 'carbon'],
    ['elecGas', 'gas'],
    ['elecPetroleo', 'petroleo'],
    ['elecNuclear', 'nuclear'],
    ['elecHidraulica', 'hidraulica'],
    ['elecEolica', 'eolica'],
    ['elecSolar', 'solar'],
    ['elecBiomasa', 'biomasa'],
    ['elecOtrasRenovables', 'otras'],
  ];
  return fuentes
    .map(([campo, nombre]) => ({ etiqueta: tx(`mix.${nombre}`), valor: pais.datos[campo] ?? 0 }))
    .filter((parte) => parte.valor > 0.5)
    .sort((a, b) => b.valor - a.valor);
}

const twh = (valor: number): string =>
  `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(valor)} TWh`;

/** Contenido de las pestañas de la ventana de ejemplo, con los datos de un país. */
function pestanasDePais(pais: PaisDatos, conjunto: ConjuntoPaises): HTMLElement {
  const fila = (nombre: string, valor: string): HTMLElement =>
    el('div', { class: 'muestrario__dato' }, el('span', {}, nombre), el('strong', {}, valor));
  const vecinosRicos = Object.values(conjunto.paises)
    .filter((p) => p.region === pais.region && p.tipo === 'pais' && p.datos.pib)
    .sort((a, b) => (b.datos.pib ?? 0) - (a.datos.pib ?? 0))
    .slice(0, 6);
  return crearPestanas(
    [
      {
        id: 'resumen',
        titulo: tx('pestanas.resumen'),
        icono: 'pib',
        contenido: () => [
          fila(t('juego.mapa.pais.poblacion'), personas(pais.datos.poblacion ?? 0)),
          fila(t('juego.mapa.pais.pib'), dolares(pais.datos.pib ?? 0)),
          fila(t('juego.mapa.pais.pibPerCapita'), dolaresPorPersona(pais.datos.pibPerCapita ?? 0)),
          fila(t('juego.mapa.pais.paro'), porcentaje(pais.datos.paro ?? 0)),
        ],
      },
      {
        id: 'region',
        titulo: tx('pestanas.region'),
        icono: 'crecimiento',
        contenido: () => [
          graficoBarras({
            titulo: tx('graficos.pibRegion', { region: pais.regionNombre }),
            barras: vecinosRicos.map((p) => ({
              etiqueta: p.nombre,
              valor: (p.datos.pib ?? 0) / 1e9,
            })),
            formato: (v) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v),
            ancho: 420,
          }),
        ],
      },
      {
        id: 'energia',
        titulo: tx('pestanas.energia'),
        icono: 'energia',
        contenido: () => [
          barraDePartes({
            titulo: tx('graficos.mix', { pais: pais.nombre }),
            partes: mixElectrico(pais),
            formato: twh,
          }),
        ],
      },
    ],
    { etiqueta: tx('pestanas.etiqueta', { pais: pais.nombre }) },
  ).elemento;
}

/** Línea de estado donde el muestrario cuenta lo que se ha elegido. */
function estado(): { elemento: HTMLElement; decir(texto: string): void } {
  const elemento = el('p', { class: 'muestrario__estado', role: 'status' }, tx('estado.nada'));
  return { elemento, decir: (texto) => (elemento.textContent = texto) };
}

function ventanasYPaneles(conjunto: ConjuntoPaises, seccion: Seccion): HTMLElement {
  const espana = conjunto.paises.ESP!;
  const japon = conjunto.paises.JPN!;
  const boton = (texto: string, accion: () => void): HTMLButtonElement => {
    const b = el('button', { class: 'boton', type: 'button' }, texto);
    b.addEventListener('click', accion);
    return b;
  };
  return seccion(
    tx('ventanas.titulo'),
    tx('ventanas.nota'),
    el(
      'div',
      { class: 'muestrario__botones' },
      boton(tx('ventanas.abrir', { pais: espana.nombre }), () =>
        abrirVentana({
          id: 'muestrario-espana',
          titulo: espana.nombre,
          icono: 'politica',
          ancho: 460,
          contenido: [pestanasDePais(espana, conjunto)],
        }),
      ),
      boton(tx('ventanas.abrir', { pais: japon.nombre }), () =>
        abrirVentana({
          id: 'muestrario-japon',
          titulo: japon.nombre,
          icono: 'politica',
          ancho: 460,
          contenido: [pestanasDePais(japon, conjunto)],
        }),
      ),
      boton(tx('ventanas.panelIzquierda'), () =>
        abrirPanel({
          titulo: tx('ventanas.panelTitulo'),
          lado: 'izquierda',
          icono: 'capas',
          contenido: [el('p', {}, tx('ventanas.panelTexto'))],
        }),
      ),
      boton(tx('ventanas.panelDerecha'), () =>
        abrirPanel({
          titulo: espana.nombre,
          lado: 'derecha',
          icono: 'politica',
          contenido: [pestanasDePais(espana, conjunto)],
        }),
      ),
      // Transición al empezar una partida (tarea f10-t4).
      boton(tx('ventanas.transicion', { pais: japon.nombre }), () =>
        transicionAPartida({
          pais: { id: japon.id, nombre: japon.nombre },
          fecha: '2010-01-01',
          alCubrir: () => undefined,
        }),
      ),
    ),
  );
}

function tablasYDeslizadores(conjunto: ConjuntoPaises, seccion: Seccion): HTMLElement {
  const aviso = estado();
  const masPoblados = Object.values(conjunto.paises)
    .filter((p) => p.tipo === 'pais')
    .sort((a, b) => (b.datos.poblacion ?? 0) - (a.datos.poblacion ?? 0))
    .slice(0, 20);
  const tabla = crearTabla<PaisDatos>({
    etiqueta: tx('tabla.etiqueta'),
    columnas: [
      { id: 'pais', titulo: tx('tabla.pais'), valor: (p) => p.nombre },
      {
        id: 'poblacion',
        titulo: t('juego.mapa.pais.poblacion'),
        valor: (p) => p.datos.poblacion,
        formato: (v) => personas(Number(v)),
      },
      {
        id: 'pibPerCapita',
        titulo: t('juego.mapa.pais.pibPerCapita'),
        valor: (p) => p.datos.pibPerCapita,
        formato: (v) => dolaresPorPersona(Number(v)),
      },
      {
        id: 'paro',
        titulo: t('juego.mapa.pais.paro'),
        valor: (p) => p.datos.paro,
        formato: (v) => porcentaje(Number(v)),
      },
    ],
    filas: masPoblados,
    orden: { columna: 'poblacion', sentido: 'desc' },
    alElegir: (p) => aviso.decir(tx('estado.pais', { pais: p.nombre })),
  });
  tabla.elemento.classList.add('muestrario__tabla');
  const iva = crearDeslizador({
    etiqueta: tx('deslizador.iva'),
    ayuda: tx('deslizador.ayuda'),
    min: 0,
    max: 30,
    paso: 0.5,
    valor: 18,
    formato: (v) => `${new Intl.NumberFormat('es-ES').format(v)} %`,
    alSoltar: (v) =>
      aviso.decir(tx('estado.iva', { valor: new Intl.NumberFormat('es-ES').format(v) })),
  });
  return seccion(
    tx('tabla.titulo'),
    tx('tabla.nota'),
    tabla.elemento,
    iva.elemento,
    aviso.elemento,
  );
}

function menusEInformacion(seccion: Seccion): HTMLElement {
  const aviso = estado();
  const opciones = (): Parameters<typeof abrirMenuContextual>[0]['opciones'] => [
    {
      etiqueta: t('juego.mapa.menu.verFicha'),
      icono: 'politica',
      accion: () => aviso.decir(tx('estado.accion', { accion: t('juego.mapa.menu.verFicha') })),
    },
    SEPARADOR,
    {
      etiqueta: t('juego.mapa.menu.centrar'),
      accion: () => aviso.decir(tx('estado.accion', { accion: t('juego.mapa.menu.centrar') })),
    },
    {
      etiqueta: t('juego.mapa.menu.acercar'),
      atajo: '+',
      accion: () => aviso.decir(tx('estado.accion', { accion: t('juego.mapa.menu.acercar') })),
    },
    { etiqueta: tx('menu.desactivada'), desactivada: true, accion: () => undefined },
  ];
  const zona = el('div', { class: 'muestrario__zona', tabindex: 0 }, tx('menu.zona'));
  zona.addEventListener('contextmenu', (evento) => {
    evento.preventDefault();
    abrirMenuContextual({
      etiqueta: tx('menu.etiqueta'),
      titulo: tx('menu.tituloMenu'),
      opciones: opciones(),
      x: evento.clientX,
      y: evento.clientY,
    });
  });
  zona.addEventListener('keydown', (evento) => {
    if (evento.key !== 'ContextMenu' && !(evento.key === 'F10' && evento.shiftKey)) return;
    evento.preventDefault();
    const caja = zona.getBoundingClientRect();
    abrirMenuContextual({
      etiqueta: tx('menu.etiqueta'),
      titulo: tx('menu.tituloMenu'),
      opciones: opciones(),
      x: caja.left + 16,
      y: caja.top + 16,
    });
  });
  const indicadores = ['pib', 'paro', 'inflacion', 'deuda'].map((id) => {
    const chip = el(
      'button',
      { class: 'muestrario__indicador', type: 'button' },
      tx(`info.${id}.nombre`),
    );
    conInformacion(chip, () => [
      el('strong', {}, tx(`info.${id}.nombre`)),
      el('br'),
      tx(`info.${id}.texto`),
    ]);
    return chip;
  });
  // Ventana de confirmación (tarea f10-t3).
  const confirmar = el('button', { class: 'boton', type: 'button' }, tx('menu.confirmar'));
  confirmar.addEventListener('click', () => {
    void pedirConfirmacion({
      titulo: tx('menu.confirmacion.titulo'),
      texto: tx('menu.confirmacion.texto'),
      aceptar: tx('menu.confirmacion.aceptar'),
      cancelar: tx('menu.confirmacion.cancelar'),
      peligro: true,
    }).then((si) => aviso.decir(tx(si ? 'menu.confirmacion.si' : 'menu.confirmacion.no')));
  });
  return seccion(
    tx('menu.titulo'),
    tx('menu.nota'),
    zona,
    el('div', { class: 'muestrario__botones' }, ...indicadores, confirmar),
    aviso.elemento,
  );
}

function graficos(conjunto: ConjuntoPaises, seccion: Seccion): HTMLElement {
  const grandes = Object.values(conjunto.paises)
    .filter((p) => p.tipo === 'pais' && p.datos.pib)
    .sort((a, b) => (b.datos.pib ?? 0) - (a.datos.pib ?? 0))
    .slice(0, 8);
  // Series de varios años: el juego aún no las tiene (llegan con el reloj y la simulación).
  const ejemplo = (nombre: string, valores: number[]) => ({
    nombre,
    puntos: valores.map((v, i) => [2005 + i, v] as [number, number]),
  });
  return seccion(
    tx('graficos.titulo'),
    tx('graficos.nota'),
    el(
      'div',
      { class: 'muestrario__graficos' },
      graficoBarras({
        titulo: tx('graficos.pib'),
        barras: grandes.map((p) => ({ etiqueta: p.nombre, valor: (p.datos.pib ?? 0) / 1e9 })),
        formato: (v) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v),
      }),
      barraDePartes({
        titulo: tx('graficos.mix', { pais: conjunto.paises.ESP!.nombre }),
        partes: mixElectrico(conjunto.paises.ESP!),
        formato: twh,
      }),
      graficoLineas({
        titulo: tx('graficos.lineas'),
        series: [
          ejemplo(tx('graficos.serieA'), [100, 104, 109, 107, 101, 103]),
          ejemplo(tx('graficos.serieB'), [100, 102, 103, 104, 99, 100]),
          ejemplo(tx('graficos.serieC'), [100, 106, 113, 121, 129, 137]),
        ],
      }),
      el(
        'div',
        { class: 'muestrario__mini' },
        el('span', {}, tx('graficos.mini')),
        minigrafico([3, 4, 3.5, 5, 6, 5.5, 7], { etiqueta: tx('graficos.mini') }),
      ),
    ),
  );
}

/** Secciones del muestrario de componentes (Fase 7). */
export function muestrario(conjunto: ConjuntoPaises, seccion: Seccion): HTMLElement[] {
  return [
    ventanasYPaneles(conjunto, seccion),
    tablasYDeslizadores(conjunto, seccion),
    menusEInformacion(seccion),
    graficos(conjunto, seccion),
  ];
}
