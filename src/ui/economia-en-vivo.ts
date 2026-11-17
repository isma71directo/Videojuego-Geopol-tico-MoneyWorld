/**
 * La economía en vivo (tarea f15-t3, decisión del jugador: en la pestaña Economía de la ficha de
 * cada país y, para el del jugador, en la ventana Economía › Economía). El PIB real y su
 * crecimiento, la confianza de consumidores y empresas, el consumo, la inversión y el ahorro, la
 * producción de los siete sectores y el gráfico del PIB desde el 1 de enero de 2010.
 *
 * Los bloques a la vista se ponen al día solos cada mes (refrescarEconomiaEnVivo), sin rehacer
 * la ficha ni perder por dónde se está leyendo.
 */
import { icono, type NombreIcono } from '../av/iconos';
import { formatearFechaLarga } from '../compartido/fechas';
import { dolares, porcentaje, puntosConSigno } from '../compartido/formato';
import { t } from '../i18n';
import {
  ahorroNacional,
  crecimientoInteranual,
  crecimientoPotencial,
  SECTORES,
  type EconomiaPais,
  type Sector,
} from '../sim/economia';
import { barraDePartes, graficoLineas } from './componentes/graficos';
import { conInformacion } from './componentes/info';
import { el } from './dom';
import './estilos/economia.css';

/** Lo que enseña un bloque: la economía de un país y la fecha de la partida. */
export type FuenteEconomia = () => { economia: EconomiaPais | null; fecha: string } | null;

export interface BloqueEconomia {
  readonly elemento: HTMLElement;
  /** Vuelve a pintar el bloque con los datos de ahora. */
  actualizar(): void;
}

const bloques = new Set<BloqueEconomia>();

/** Pone al día los bloques a la vista (cada mes de la partida); olvida los que ya no están. */
export function refrescarEconomiaEnVivo(): void {
  for (const bloque of bloques) {
    if (bloque.elemento.isConnected) bloque.actualizar();
    else bloques.delete(bloque);
  }
}

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** «ene 2011» para el mes número `mes` desde enero de 2010 (en el eje del gráfico). */
export function textoMes(mes: number): string {
  const redondeado = Math.round(mes);
  return `${MESES_CORTOS[((redondeado % 12) + 12) % 12]} ${2010 + Math.floor(redondeado / 12)}`;
}

/**
 * Marcas del eje del gráfico del PIB: cada tres meses durante los dos primeros años y, después,
 * cada enero (cada dos o más eneros si la partida es muy larga), para que no se pisen.
 */
export function marcasMeses(meses: number): number[] {
  if (meses <= 24) {
    return Array.from({ length: Math.floor(meses / 3) + 1 }, (_, i) => i * 3);
  }
  const anios = Math.floor(meses / 12);
  const cada = Math.max(1, Math.ceil(anios / 6));
  return Array.from({ length: Math.floor(anios / cada) + 1 }, (_, i) => i * cada * 12);
}

/** Etiqueta de una marca: «ene 2010» con pocos meses y «2012» con varios años. */
const etiquetaMarca =
  (meses: number) =>
  (mes: number): string =>
    meses <= 24 ? textoMes(mes) : String(2010 + Math.round(mes / 12));

/**
 * Crecimiento que se enseña: el de los últimos 12 meses o, si aún no ha pasado un año, el que
 * lleva desde enero de 2010 al ritmo de un año. Null al empezar.
 */
export function crecimientoVisible(
  economia: Pick<EconomiaPais, 'serie' | 'meses'>,
): { valor: number; desdeInicio: boolean } | null {
  const interanual = crecimientoInteranual(economia);
  if (interanual !== null) return { valor: interanual, desdeInicio: false };
  const { serie, meses } = economia;
  if (meses < 1 || serie.length < 2) return null;
  const valor = Math.pow(serie.at(-1)! / serie[0]!, 12 / meses) - 1;
  return { valor, desdeInicio: true };
}

/** Icono de cada sector (tarea f15-t4). */
export const ICONO_SECTOR: Record<Sector, NombreIcono> = {
  agricultura: 'agricultura',
  mineriaEnergia: 'pico',
  manufactura: 'industria',
  construccion: 'construccion',
  comercio: 'comercio',
  transporte: 'transportes',
  otrosServicios: 'servicios',
};

/** Una fila «nombre: valor» con su icono y su explicación al pasar el ratón o con el foco. */
function fila(
  nombreIcono: NombreIcono,
  nombre: string,
  valor: string,
  ayuda: string,
  clase?: string,
): HTMLElement {
  const termino = el('dt', { tabindex: 0, class: 'economia__termino' }, icono(nombreIcono), nombre);
  conInformacion(termino, () => [el('strong', {}, nombre), el('br'), ayuda]);
  return el('div', { class: 'panel-pais__fila' }, termino, el('dd', { class: clase }, valor));
}

/** Índice de confianza con su comparación con lo normal: «104 (+4)». */
const textoConfianza = (valor: number): string =>
  `${Math.round(valor)} (${puntosConSigno(valor - 100)})*`;

/** Cómo se dibuja un bloque: el ancho del gráfico (más estrecho en la ficha). */
export interface OpcionesBloque {
  anchoGrafico?: number;
}

function contenido(
  economia: EconomiaPais,
  fecha: string,
  opciones: OpcionesBloque,
  primera: boolean,
): HTMLElement[] {
  const crecimiento = crecimientoVisible(economia);
  const datos = el(
    'dl',
    { class: 'panel-pais__datos economia__datos' },
    fila('pib', t('juego.economia.pib'), dolares(economia.pib), t('juego.economia.pibAyuda')),
    fila(
      'crecimiento',
      crecimiento?.desdeInicio
        ? t('juego.economia.crecimientoDesde')
        : t('juego.economia.crecimiento'),
      crecimiento ? porcentaje(crecimiento.valor * 100) : '—',
      t('juego.economia.crecimientoAyuda'),
      crecimiento && crecimiento.valor < 0 ? 'economia__baja' : undefined,
    ),
    fila(
      'potencial',
      t('juego.economia.potencial'),
      porcentaje(crecimientoPotencial(economia) * 100),
      t('juego.economia.potencialAyuda'),
    ),
    fila(
      'confianza',
      t('juego.economia.confianzaConsumidores'),
      textoConfianza(economia.confianzaConsumidores),
      t('juego.economia.confianzaAyuda'),
      'es-estimado',
    ),
    fila(
      'empresas',
      t('juego.economia.confianzaEmpresas'),
      textoConfianza(economia.confianzaEmpresas),
      t('juego.economia.confianzaAyuda'),
      'es-estimado',
    ),
    fila(
      'consumo',
      t('juego.economia.consumo'),
      porcentaje(economia.demanda.consumo * 100),
      t('juego.economia.consumoAyuda'),
    ),
    fila(
      'inversion',
      t('juego.economia.inversion'),
      porcentaje(economia.demanda.inversion * 100),
      t('juego.economia.inversionAyuda'),
    ),
    fila(
      'ahorro',
      t('juego.economia.ahorro'),
      porcentaje(ahorroNacional(economia) * 100),
      t('juego.economia.ahorroAyuda'),
    ),
  );
  // El ajuste forzoso por los desequilibrios de 2010, mientras dure (ajuste f15-a1).
  const { desequilibrio } = economia;
  if (desequilibrio.intensidad > 0 && desequilibrio.ajustePendiente > 0) {
    datos.append(
      fila(
        'deuda',
        t('juego.economia.ajuste'),
        t('juego.economia.ajusteValor', {
          cantidad: porcentaje(desequilibrio.ajustePendiente * 100),
        }),
        t('juego.economia.ajusteAyuda'),
        'economia__baja',
      ),
    );
  }
  const sectores = barraDePartes({
    titulo: t('juego.economia.sectoresTitulo'),
    partes: SECTORES.map((sector, color) => ({
      etiqueta: t(`juego.economia.sectores.${sector}`),
      valor: (economia.sectores[sector].valor / economia.pib) * 100,
      color,
      icono: ICONO_SECTOR[sector],
    })),
    formato: (v) => porcentaje(v),
  });
  const grafico = graficoLineas({
    titulo: t('juego.economia.graficoTitulo'),
    series: [
      {
        nombre: t('juego.economia.pib'),
        puntos: economia.serie.map((pib, mes) => [mes, pib / 1e9] as const),
      },
    ],
    ancho: opciones.anchoGrafico ?? 520,
    alto: opciones.anchoGrafico && opciones.anchoGrafico < 400 ? 200 : 180,
    desdeCero: false,
    // La primera vez se dibuja; después, con cada mes nuevo, late el último punto.
    animado: primera,
    latido: !primera,
    formatoX: etiquetaMarca(economia.meses),
    marcasX: marcasMeses(economia.meses),
    formatoY: (v) =>
      t('juego.economia.milesDeMillones', { valor: Math.round(v).toLocaleString('es-ES') }),
    nombreX: t('juego.economia.mes'),
  });
  return [
    el(
      'p',
      { class: 'economia__cabecera' },
      el('strong', {}, t('juego.economia.enLaPartida')),
      ' · ',
      el('time', { datetime: fecha }, formatearFechaLarga(fecha)),
    ),
    datos,
    sectores,
    grafico,
    el('p', { class: 'panel-pais__pie economia__nota' }, t('juego.economia.nota')),
  ];
}

/** Un bloque con la economía de un país, que se pone al día cada mes. */
export function bloqueEconomia(
  fuente: FuenteEconomia,
  opciones: OpcionesBloque = {},
): BloqueEconomia {
  const elemento = el('section', {
    class: 'economia',
    'aria-label': t('juego.economia.enLaPartida'),
  });
  let primera = true;
  const bloque: BloqueEconomia = {
    elemento,
    actualizar() {
      const actual = fuente();
      if (!actual) {
        elemento.replaceChildren();
        return;
      }
      elemento.replaceChildren(
        ...(actual.economia
          ? contenido(actual.economia, actual.fecha, opciones, primera)
          : [el('p', { class: 'economia__vacio' }, t('juego.economia.sinDatos'))]),
      );
      primera = false;
    },
  };
  bloque.actualizar();
  bloques.add(bloque);
  return bloque;
}

/** Contenido de la ventana Economía › Economía: la del país del jugador. */
export function contenidoVentanaEconomia(fuente: FuenteEconomia, nombrePais: string): HTMLElement {
  return el(
    'div',
    { class: 'economia-ventana' },
    el('h3', { class: 'economia-ventana__titulo' }, nombrePais),
    bloqueEconomia(fuente).elemento,
    el('p', { class: 'panel-pais__pie' }, t('juego.economia.ventanaNota')),
  );
}
