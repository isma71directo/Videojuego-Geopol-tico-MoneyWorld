/**
 * Ficha de un país en el mapa (tareas f4-t1 y f8-t2): el recuadro que sigue al ratón y el
 * panel lateral que se abre al seleccionarlo, con pestañas (Resumen, Economía, Sociedad y
 * Fuentes; decisión del jugador) hechas con los componentes de la Fase 7. Muestra los datos de
 * /public/data/paises-2010.json y el régimen y los cargos de gobiernos-2010.json; los valores
 * estimados se marcan con un asterisco y cada dato dice de dónde sale.
 */
import { urlBandera } from '../av/banderas';
import { dolares, dolaresPorPersona, enteros, personas, porcentaje } from '../compartido/formato';
import {
  jefeGobierno,
  type CargoOcupado,
  type ConjuntoGobiernos,
  type Persona,
} from '../datos/gobiernos';
import { esEstimado, type ConjuntoPaises, type PaisDatos } from '../datos/paises';
import { t } from '../i18n';
import type { CapaDatos } from '../map/capas';
import { el, type Hijo } from './dom';
import { barraDePartes } from './componentes/graficos';
import { conInformacion } from './componentes/info';
import { crearPestanas } from './componentes/pestanas';
import { nombreCapa, textoValorCapa } from './leyenda';

type Formato = (valor: number) => string;

/** Datos breves del recuadro que sigue al ratón. */
const CAMPOS_RECUADRO: readonly [string, Formato][] = [
  ['poblacion', personas],
  ['pibPerCapita', dolaresPorPersona],
];

function bandera(pais: PaisDatos, clase: string): HTMLImageElement {
  return el('img', { class: clase, src: urlBandera(pais.id), alt: '', width: 36, height: 27 });
}

/** «Territorio dependiente de Reino Unido», «Estatus especial: …» o nada. */
export function estatusPais(pais: PaisDatos, conjunto: ConjuntoPaises): string | null {
  if (pais.tipo === 'dependiente' && pais.soberano) {
    const soberano = conjunto.paises[pais.soberano]?.nombre ?? pais.soberano;
    return t('juego.mapa.pais.dependiente', { soberano });
  }
  if (pais.tipo === 'especial' && pais.estatus) {
    return t('juego.mapa.pais.especial', { estatus: pais.estatus });
  }
  return null;
}

/** Valor ya formateado y si es estimado (o null si no hay dato). */
export function valorCampo(
  pais: PaisDatos,
  campo: string,
  formato: Formato,
): { texto: string; estimado: boolean } | null {
  const valor = pais.datos[campo];
  if (valor === null || valor === undefined) return null;
  return { texto: formato(valor), estimado: esEstimado(pais.origen[campo]) };
}

function nombreCampo(campo: string, conjunto: ConjuntoPaises): string {
  const clave = `juego.mapa.pais.${campo}`;
  const texto = t(clave);
  return texto === clave ? (conjunto.campos[campo]?.nombre ?? campo) : texto;
}

/**
 * Contenido del recuadro que aparece al pasar el ratón. Con una capa de datos activa (Fase 6),
 * su dato va primero y destacado.
 */
export function contenidoRecuadro(
  pais: PaisDatos,
  conjunto: ConjuntoPaises,
  capa: CapaDatos | null = null,
): Hijo[] {
  const datoCapa = capa ? valorCampo(pais, capa.campo, (v) => textoValorCapa(capa, v)) : null;
  const lineaCapa = capa
    ? el(
        'span',
        { class: 'ficha__dato ficha__dato--capa' },
        `${nombreCapa(capa)}: ${
          datoCapa
            ? `${datoCapa.texto}${datoCapa.estimado ? '*' : ''}`
            : t('juego.mapa.pais.sinDato')
        }`,
      )
    : null;
  const campos = CAMPOS_RECUADRO.filter(([campo]) => campo !== capa?.campo);
  const lineas = campos.map(([campo, formato]) => {
    const valor = valorCampo(pais, campo, formato);
    return valor
      ? el(
          'span',
          { class: 'ficha__dato' },
          `${nombreCampo(campo, conjunto)}: ${valor.texto}${valor.estimado ? '*' : ''}`,
        )
      : null;
  });
  const estatus = estatusPais(pais, conjunto);
  return [
    el(
      'div',
      { class: 'ficha__cabecera' },
      bandera(pais, 'ficha__bandera'),
      el('strong', {}, pais.nombre),
    ),
    estatus ? el('span', { class: 'ficha__estatus' }, estatus) : null,
    lineaCapa,
    el('span', { class: 'ficha__dato' }, `${t('juego.mapa.pais.capital')}: ${pais.capital}`),
    ...lineas,
  ];
}

/** Formato de cada dato de la ficha. */
const decimal1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const FORMATOS: Record<string, Formato> = {
  poblacion: personas,
  pib: dolares,
  pibPerCapita: dolaresPorPersona,
  superficie: (v) => `${enteros(v)} km²`,
  densidad: (v) => t('juego.mapa.pais.unidades.densidad', { valor: decimal1.format(v) }),
  esperanzaVida: (v) => t('juego.mapa.pais.anos', { valor: Math.round(v) }),
  efectivosMilitares: (v) => personas(v),
  co2PerCapita: (v) => t('juego.mapa.pais.unidades.toneladas', { valor: decimal1.format(v) }),
};
const formatoDe = (campo: string): Formato => FORMATOS[campo] ?? porcentaje;

/** Datos de cada pestaña de la ficha, en este orden. */
const CAMPOS_RESUMEN = ['poblacion', 'pib', 'pibPerCapita'] as const;
const CAMPOS_ECONOMIA = [
  'pib',
  'pibPerCapita',
  'crecimientoPib',
  'paro',
  'inflacion',
  'deudaPib',
  'saldoFiscalPib',
  'cuentaCorrientePib',
  'comercioPib',
] as const;
const CAMPOS_SOCIEDAD = [
  'poblacion',
  'superficie',
  'densidad',
  'esperanzaVida',
  'alfabetizacion',
  'accesoElectricidad',
  'usuariosInternet',
  'gastoSanidadPib',
  'gastoEducacionPib',
  'gastoDefensaPib',
  'efectivosMilitares',
  'co2PerCapita',
] as const;
const SECTORES: readonly [string, string][] = [
  ['agriculturaPib', 'agricultura'],
  ['industriaPib', 'industria'],
  ['serviciosPib', 'servicios'],
];
/** Fuentes del mix eléctrico, siempre en este orden y con el mismo color. */
const FUENTES_ELECTRICAS: readonly [string[], string][] = [
  [['elecCarbon'], 'carbon'],
  [['elecGas'], 'gas'],
  [['elecPetroleo'], 'petroleo'],
  [['elecNuclear'], 'nuclear'],
  [['elecHidraulica'], 'hidraulica'],
  [['elecEolica'], 'eolica'],
  [['elecSolar'], 'solar'],
  [['elecBiomasa', 'elecOtrasRenovables'], 'otras'],
];
const twh = (valor: number): string => `${decimal1.format(valor)} TWh`;

export interface OpcionesFicha {
  gobiernos?: ConjuntoGobiernos | null;
  /** Pestaña que se abre (la última que miró el jugador). */
  pestana?: string;
  alCambiarPestana?: (id: string) => void;
}

/** Fila «nombre: valor» de un dato, con su explicación al pasar el ratón o con el foco. */
function filaDato(
  pais: PaisDatos,
  conjunto: ConjuntoPaises,
  campo: string,
  estimados: Set<string>,
): HTMLElement {
  const valor = valorCampo(pais, campo, formatoDe(campo));
  if (valor?.estimado) estimados.add(campo);
  const nombre = el('dt', { tabindex: 0 }, nombreCampo(campo, conjunto));
  const definicion = conjunto.campos[campo];
  conInformacion(nombre, () => [
    el('strong', {}, definicion?.nombre ?? nombreCampo(campo, conjunto)),
    el('br'),
    definicion?.unidad ? `${definicion.unidad} · ` : '',
    textoOrigen(pais.origen[campo], conjunto),
  ]);
  return el(
    'div',
    { class: 'panel-pais__fila' },
    nombre,
    el(
      'dd',
      { class: valor?.estimado ? 'es-estimado' : undefined },
      valor ? `${valor.texto}${valor.estimado ? '*' : ''}` : t('juego.mapa.pais.sinDato'),
    ),
  );
}

function filaTexto(nombre: string, valor: string): HTMLElement {
  return el('div', { class: 'panel-pais__fila' }, el('dt', {}, nombre), el('dd', {}, valor));
}

/** «Banco Mundial, World Development Indicators (2010)», «Estimación: …»… */
export function textoOrigen(origen: string | undefined, conjunto: ConjuntoPaises): string {
  if (!origen) return t('juego.mapa.pais.fuentes.sinDato');
  const [fuente, detalle] = origen.split(':') as [string, string | undefined];
  if (fuente === 'EST') {
    const metodo =
      conjunto.metodosEstimacion[detalle ?? ''] ??
      (detalle?.startsWith('anio-')
        ? conjunto.metodosEstimacion['anio-AAAA']?.replace('(el indicado)', detalle.slice(5))
        : undefined);
    return t('juego.mapa.pais.fuentes.estimacion', { metodo: metodo ?? detalle ?? '' });
  }
  if (fuente === 'DER') return conjunto.fuentes.DER ?? 'Derivado';
  const nombre = conjunto.fuentes[fuente] ?? fuente;
  if (detalle === 'ausente') return `${nombre}: ${t('juego.mapa.pais.fuentes.ausente')}`;
  return detalle ? `${nombre} (${detalle})` : nombre;
}

/** Medallón con las iniciales (lo sustituyen los retratos de la tarea f8-t3). */
function medallon(persona: Persona | undefined): HTMLElement {
  const iniciales = (persona?.nombre ?? '?')
    .split(/\s+/)
    .filter((parte) => /^\p{Lu}/u.test(parte))
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join('');
  return el('span', { class: 'ficha-cargo__retrato', 'aria-hidden': 'true' }, iniciales || '?');
}

function tarjetaCargo(
  rol: string,
  cargo: CargoOcupado,
  gobiernos: ConjuntoGobiernos,
  nota?: string,
): HTMLElement {
  const persona = gobiernos.personas[cargo.persona];
  return el(
    'section',
    { class: 'ficha-cargo' },
    medallon(persona),
    el(
      'div',
      { class: 'ficha-cargo__texto' },
      el('p', { class: 'ficha-cargo__rol' }, rol),
      el('strong', { class: 'ficha-cargo__nombre' }, persona?.nombre ?? cargo.persona),
      el(
        'span',
        { class: 'ficha-cargo__cargo' },
        t('juego.mapa.pais.cargos.desde', { cargo: cargo.cargo, anio: cargo.desde.slice(0, 4) }),
      ),
      nota ? el('span', { class: 'ficha-cargo__nota' }, nota) : null,
    ),
  );
}

/** Régimen y cargos de un país (o por qué no los tiene). */
function bloqueGobierno(
  pais: PaisDatos,
  conjunto: ConjuntoPaises,
  gobiernos: ConjuntoGobiernos | null | undefined,
): Hijo[] {
  if (!gobiernos) return [el('p', { class: 'panel-pais__pie' }, t('juego.mapa.pais.cargando'))];
  const gobierno = gobiernos.paises[pais.id];
  if (!gobierno?.estado) {
    return [el('p', { class: 'panel-pais__pie' }, t('juego.mapa.pais.cargos.sinEstado'))];
  }
  const soberano = pais.soberano ? conjunto.paises[pais.soberano]?.nombre : undefined;
  const regimen = gobierno.regimen
    ? filaTexto(t('juego.mapa.pais.regimen'), t(`juego.mapa.pais.regimenes.${gobierno.regimen}`))
    : null;
  const ambos = gobierno.gobierno === 'estado';
  const jefeGob = jefeGobierno(gobierno);
  return [
    regimen ? el('dl', { class: 'panel-pais__datos' }, regimen) : null,
    el(
      'div',
      { class: 'ficha-cargos' },
      tarjetaCargo(
        t(ambos ? 'juego.mapa.pais.cargos.ambos' : 'juego.mapa.pais.cargos.estado'),
        gobierno.estado,
        gobiernos,
        soberano ? t('juego.mapa.pais.cargos.comoTerritorio', { soberano }) : undefined,
      ),
      !ambos && jefeGob
        ? tarjetaCargo(t('juego.mapa.pais.cargos.gobierno'), jefeGob, gobiernos)
        : null,
    ),
  ];
}

function pestanaResumen(
  pais: PaisDatos,
  conjunto: ConjuntoPaises,
  gobiernos: ConjuntoGobiernos | null | undefined,
  estimados: Set<string>,
): Hijo[] {
  return [
    ...bloqueGobierno(pais, conjunto, gobiernos),
    el(
      'dl',
      { class: 'panel-pais__datos' },
      filaTexto(t('juego.mapa.pais.capital'), pais.capital),
      filaTexto(t('juego.mapa.pais.region'), pais.regionNombre),
      filaTexto(t('juego.mapa.pais.nivelRenta'), t('juego.mapa.pais.renta.' + pais.nivelRenta)),
      ...CAMPOS_RESUMEN.map((campo) => filaDato(pais, conjunto, campo, estimados)),
    ),
  ];
}

function pestanaEconomia(
  pais: PaisDatos,
  conjunto: ConjuntoPaises,
  estimados: Set<string>,
): Hijo[] {
  const sectores = SECTORES.map(([campo, nombre], color) => ({
    etiqueta: t(`juego.mapa.pais.sectores.${nombre}`),
    valor: pais.datos[campo] ?? 0,
    color,
  }));
  const mix = FUENTES_ELECTRICAS.map(([campos, nombre], color) => ({
    etiqueta: t(`juego.mapa.pais.mix.${nombre}`),
    valor: campos.reduce((suma, campo) => suma + (pais.datos[campo] ?? 0), 0),
    color,
  }));
  for (const campo of [...SECTORES.map(([c]) => c), ...FUENTES_ELECTRICAS.flatMap(([c]) => c)]) {
    if (esEstimado(pais.origen[campo]) && (pais.datos[campo] ?? 0) > 0) estimados.add(campo);
  }
  return [
    el(
      'dl',
      { class: 'panel-pais__datos' },
      ...CAMPOS_ECONOMIA.map((campo) => filaDato(pais, conjunto, campo, estimados)),
    ),
    sectores.some((p) => p.valor > 0)
      ? barraDePartes({
          titulo: t('juego.mapa.pais.sectores.titulo'),
          partes: sectores,
          formato: (v) => porcentaje(v),
        })
      : null,
    mix.some((p) => p.valor > 0)
      ? barraDePartes({ titulo: t('juego.mapa.pais.mix.titulo'), partes: mix, formato: twh })
      : null,
  ];
}

function pestanaSociedad(
  pais: PaisDatos,
  conjunto: ConjuntoPaises,
  estimados: Set<string>,
): Hijo[] {
  return [
    el(
      'dl',
      { class: 'panel-pais__datos' },
      ...CAMPOS_SOCIEDAD.map((campo) => filaDato(pais, conjunto, campo, estimados)),
    ),
  ];
}

/** Explicación legible de dónde sale el régimen. */
function textoRegimen(fuente: string): string {
  const [tipo, ...resto] = fuente.split(': ');
  const detalle = resto.join(': ');
  if (tipo === 'manual') return t('juego.mapa.pais.fuentes.regimenManual', { motivo: detalle });
  if (tipo === 'wikidata') return t('juego.mapa.pais.fuentes.regimenWikidata', { forma: detalle });
  if (tipo === 'regla') return t('juego.mapa.pais.fuentes.regimenRegla', { regla: detalle });
  return fuente;
}

function pestanaFuentes(
  pais: PaisDatos,
  conjunto: ConjuntoPaises,
  gobiernos: ConjuntoGobiernos | null | undefined,
): Hijo[] {
  // Los datos de la ficha agrupados por su fuente.
  const campos = [...new Set([...CAMPOS_RESUMEN, ...CAMPOS_ECONOMIA, ...CAMPOS_SOCIEDAD])];
  const porFuente = new Map<string, string[]>();
  for (const campo of campos) {
    if (pais.datos[campo] === null || pais.datos[campo] === undefined) continue;
    const texto = textoOrigen(pais.origen[campo], conjunto);
    porFuente.set(texto, [...(porFuente.get(texto) ?? []), nombreCampo(campo, conjunto)]);
  }
  const gobierno = gobiernos?.paises[pais.id];
  return [
    el(
      'ul',
      { class: 'ficha-fuentes' },
      ...[...porFuente].map(([fuente, nombres]) =>
        el('li', {}, el('strong', {}, fuente), el('span', {}, nombres.join(', '))),
      ),
      gobierno
        ? el(
            'li',
            {},
            el('strong', {}, t('juego.mapa.pais.fuentes.gobierno')),
            el(
              'span',
              {},
              gobierno.fuente === 'wikidata'
                ? t('juego.mapa.pais.fuentes.cargosWikidata')
                : t('juego.mapa.pais.fuentes.cargosManual'),
            ),
          )
        : null,
      gobierno?.regimen
        ? el(
            'li',
            {},
            el('strong', {}, t('juego.mapa.pais.regimen')),
            el('span', {}, textoRegimen(gobierno.regimenFuente)),
          )
        : null,
    ),
  ];
}

/** Contenido del panel lateral del país seleccionado (tarea f8-t2): cabecera y pestañas. */
export function contenidoPanel(
  pais: PaisDatos,
  conjunto: ConjuntoPaises,
  alCerrar: () => void,
  opciones: OpcionesFicha = {},
): Hijo[] {
  const cerrar = el(
    'button',
    { class: 'panel-pais__cerrar', type: 'button', 'aria-label': t('juego.mapa.pais.cerrar') },
    '×',
  );
  cerrar.addEventListener('click', alCerrar);
  const estimados = new Set<string>();
  const nota = el('p', { class: 'panel-pais__pie', hidden: true }, t('juego.mapa.pais.estimado'));
  // Cada pestaña se crea al abrirla: la nota de estimados se enseña si alguna los tiene.
  const conNota = (contenido: Hijo[]): Hijo[] => {
    nota.hidden = estimados.size === 0;
    return contenido;
  };
  const pestanas = crearPestanas(
    [
      {
        id: 'resumen',
        titulo: t('juego.mapa.pais.pestanas.resumen'),
        contenido: () => conNota(pestanaResumen(pais, conjunto, opciones.gobiernos, estimados)),
      },
      {
        id: 'economia',
        titulo: t('juego.mapa.pais.pestanas.economia'),
        contenido: () => conNota(pestanaEconomia(pais, conjunto, estimados)),
      },
      {
        id: 'sociedad',
        titulo: t('juego.mapa.pais.pestanas.sociedad'),
        contenido: () => conNota(pestanaSociedad(pais, conjunto, estimados)),
      },
      {
        id: 'fuentes',
        titulo: t('juego.mapa.pais.pestanas.fuentes'),
        contenido: () => pestanaFuentes(pais, conjunto, opciones.gobiernos),
      },
    ],
    {
      etiqueta: t('juego.mapa.pais.pestanas.etiqueta', { pais: pais.nombre }),
      ...(opciones.pestana ? { inicial: opciones.pestana } : {}),
      ...(opciones.alCambiarPestana ? { alCambiar: opciones.alCambiarPestana } : {}),
    },
  );
  const estatus = estatusPais(pais, conjunto);
  return [
    el(
      'header',
      { class: 'panel-pais__cabecera' },
      bandera(pais, 'panel-pais__bandera'),
      el('h2', { class: 'panel-pais__nombre', id: 'panel-pais-titulo' }, pais.nombre),
      cerrar,
    ),
    estatus ? el('p', { class: 'panel-pais__estatus' }, estatus) : null,
    pais.jugable ? null : el('p', { class: 'panel-pais__estatus' }, t('juego.mapa.pais.noJugable')),
    pestanas.elemento,
    el('p', { class: 'panel-pais__pie' }, t('juego.mapa.pais.datos2010')),
    nota,
  ];
}
