/**
 * El presupuesto en vivo (tarea f17-t4; decisión del jugador: en la pestaña Economía de la ficha
 * de cada país y, para el del jugador, en Gobierno › Presupuesto, en solo lectura hasta la
 * Pantalla de Presupuesto de la Fase 23). Ingresos, gastos, saldo, deuda, intereses y tesorería;
 * de qué se nutren los ingresos y en qué se va el gasto, con iconos; el gráfico de ingresos y
 * gastos desde enero de 2010; y, en la ventana, la deuda y los 20 ministerios por dentro. Con la
 * Fase 18, también el mercado de la deuda (tarea f18-t4): el rating con su distintivo animado, la
 * prima de riesgo, la crisis de deuda si la hay y, en la ventana, el gráfico de la prima.
 *
 * Como la economía en vivo, los bloques a la vista se ponen al día solos cada mes.
 */
import { icono, type NombreIcono } from '../av/iconos';
import { formatearFechaLarga } from '../compartido/fechas';
import { dolares, porcentaje, puntos } from '../compartido/formato';
import { t } from '../i18n';
import { UMBRAL_CIERRE, type MercadoDeuda, type Rating } from '../sim/deuda';
import { pibNominal, type EconomiaPais } from '../sim/economia';
import {
  gastoMinisterio,
  INGRESOS,
  MINISTERIOS,
  PARTIDAS,
  saldo,
  totalGastos,
  totalIngresos,
  type Ingreso,
  type Ministerio,
  type Partida,
  type PresupuestoPais,
} from '../sim/presupuesto';
import { barraDePartes, graficoLineas } from './componentes/graficos';
import { conInformacion } from './componentes/info';
import secciones from './config/secciones.json';
import { el } from './dom';
import { marcasMeses, textoMes } from './economia-en-vivo';
import { distintivoRating } from './rating';
import './estilos/presupuesto.css';

/** Lo que enseña un bloque: el presupuesto, la economía y la tesorería de un país, y la fecha. */
export type FuentePresupuesto = () => {
  presupuesto: PresupuestoPais | null;
  economia: EconomiaPais | null;
  tesoreria: number;
  fecha: string;
  /** El mercado de su deuda (Fase 18), si lo tiene. */
  mercado?: MercadoDeuda | null;
} | null;

export interface BloquePresupuesto {
  readonly elemento: HTMLElement;
  actualizar(): void;
}

/** Icono de cada ingreso. */
export const ICONO_INGRESO: Record<Ingreso, NombreIcono> = {
  rentaPersonas: 'renta',
  rentaSociedades: 'empresas',
  consumo: 'iva',
  cotizaciones: 'trabajo',
  aranceles: 'comercio',
  otrosImpuestos: 'impuestos',
  otrosIngresos: 'lingote',
};

/** Icono de cada partida interna de un ministerio. */
export const ICONO_PARTIDA: Record<Partida, NombreIcono> = {
  personal: 'personal',
  inversion: 'inversion',
  mantenimiento: 'mantenimiento',
  programas: 'programas',
};

/** Icono de cada ministerio (el de su ventana en la barra de secciones). */
export const ICONO_MINISTERIO = Object.fromEntries(
  MINISTERIOS.map((m) => [
    m,
    (secciones.ministerios as Record<string, { icono: string }>)[m]!.icono,
  ]),
) as Record<Ministerio, NombreIcono>;

/** Los ministerios con datos reales de 2010 (los demás, estimados). */
const CON_DATOS: ReadonlySet<Ministerio> = new Set(['sanidad', 'educacion', 'defensa']);

/** Los grandes bloques del gasto, para la barra (los demás ministerios, juntos). */
const GRUPOS_GASTO = [
  'pensiones',
  'desempleo',
  'intereses',
  'sanidad',
  'educacion',
  'defensa',
  'resto',
] as const;
const ICONO_GRUPO: Record<(typeof GRUPOS_GASTO)[number], NombreIcono> = {
  pensiones: 'pensiones',
  desempleo: 'paro',
  intereses: 'deuda',
  sanidad: 'sanidad',
  educacion: 'educacion',
  defensa: 'ejercito',
  resto: 'ministros',
};

const bloques = new Set<BloquePresupuesto>();

/** Pone al día los bloques a la vista (cada mes de la partida); olvida los que ya no están. */
export function refrescarPresupuestoEnVivo(): void {
  for (const bloque of bloques) {
    if (bloque.elemento.isConnected) bloque.actualizar();
    else bloques.delete(bloque);
  }
}

/** Una fila «nombre: valor» con su icono y su explicación al pasar el ratón o con el foco. */
function fila(
  nombreIcono: NombreIcono,
  nombre: string,
  valor: string | Node,
  ayuda: string,
  clase?: string,
): HTMLElement {
  const termino = el('dt', { tabindex: 0, class: 'economia__termino' }, icono(nombreIcono), nombre);
  conInformacion(termino, () => [el('strong', {}, nombre), el('br'), ayuda]);
  return el('div', { class: 'panel-pais__fila' }, termino, el('dd', { class: clase }, valor));
}

/** «36,4 % del PIB». */
const delPib = (valor: number, pib: number): string =>
  t('juego.presupuesto.delPib', { valor: porcentaje(pib > 0 ? (valor / pib) * 100 : 0) });

/** Cómo se dibuja un bloque: entero (en la ventana) o resumido (en la ficha). */
export interface OpcionesPresupuesto {
  completo?: boolean;
  anchoGrafico?: number;
}

/** Lo que enseña cada bloque, con el rating del mes anterior (para animar si cambia). */
interface Vista {
  presupuesto: PresupuestoPais;
  economia: EconomiaPais | null;
  tesoreria: number;
  fecha: string;
  mercado: MercadoDeuda | null;
  ratingAntes: Rating | undefined;
}

/** Las filas del mercado de la deuda (tarea f18-t4): rating, prima y crisis, si la hay. */
function filasMercado(mercado: MercadoDeuda, antes: Rating | undefined): HTMLElement[] {
  const filas = [
    fila(
      'rating',
      t('juego.presupuesto.rating'),
      distintivoRating(mercado.rating, antes),
      t('juego.presupuesto.ratingAyuda'),
    ),
    fila(
      'prima',
      t('juego.presupuesto.prima'),
      t('juego.presupuesto.primaValor', {
        puntos: puntos(mercado.prima),
        tipo: porcentaje(mercado.tipoMercado),
      }),
      t('juego.presupuesto.primaAyuda', { umbral: puntos(UMBRAL_CIERRE) }),
      mercado.prima > UMBRAL_CIERRE ? 'economia__baja' : undefined,
    ),
  ];
  const programa = mercado.programa;
  if (programa) {
    filas.push(
      fila(
        'deuda',
        t('juego.presupuesto.crisis'),
        t(`juego.presupuesto.crisisEstado.${programa.tipo}`, { meses: programa.meses }),
        t('juego.presupuesto.crisisAyuda'),
        'economia__baja',
      ),
    );
  }
  return filas;
}

function contenido(vista: Vista, opciones: OpcionesPresupuesto, primera: boolean): HTMLElement[] {
  const { presupuesto, economia, tesoreria, fecha, mercado } = vista;
  const pib = economia ? pibNominal(economia) : totalGastos(presupuesto);
  const resultado = saldo(presupuesto);
  const ancho = opciones.anchoGrafico ?? 520;
  const alto = ancho < 400 ? 200 : 180;
  const meses = presupuesto.serie.ingresos.length - 1;
  const ejeX = {
    formatoX: (mes: number) => (meses <= 24 ? textoMes(mes) : String(2010 + Math.round(mes / 12))),
    marcasX: marcasMeses(meses),
    nombreX: t('juego.economia.mes'),
  };
  const datos = el(
    'dl',
    { class: 'panel-pais__datos economia__datos' },
    fila(
      'hacienda',
      t('juego.presupuesto.ingresos'),
      delPib(totalIngresos(presupuesto), pib),
      t('juego.presupuesto.ingresosAyuda', { dinero: dolares(totalIngresos(presupuesto)) }),
    ),
    fila(
      'presupuesto',
      t('juego.presupuesto.gastos'),
      delPib(totalGastos(presupuesto), pib),
      t('juego.presupuesto.gastosAyuda', { dinero: dolares(totalGastos(presupuesto)) }),
    ),
    fila(
      'crecimiento',
      resultado < 0 ? t('juego.presupuesto.deficit') : t('juego.presupuesto.superavit'),
      delPib(resultado, pib),
      t('juego.presupuesto.saldoAyuda'),
      resultado < 0 ? 'economia__baja' : undefined,
    ),
    fila(
      'deuda',
      t('juego.presupuesto.deuda'),
      delPib(presupuesto.deuda, pib),
      t('juego.presupuesto.deudaAyuda', {
        dinero: dolares(presupuesto.deuda),
        tipo: porcentaje(presupuesto.tipoInteres * 100),
      }),
    ),
    fila(
      'deuda',
      t('juego.presupuesto.intereses'),
      delPib(presupuesto.transversales.intereses, pib),
      t('juego.presupuesto.interesesAyuda'),
    ),
    fila(
      'lingote',
      t('juego.presupuesto.tesoreria'),
      dolares(Math.max(0, tesoreria)),
      t('juego.presupuesto.tesoreriaAyuda'),
    ),
    ...(mercado ? filasMercado(mercado, vista.ratingAntes) : []),
  );
  const ingresos = barraDePartes({
    titulo: t('juego.presupuesto.ingresosTitulo'),
    partes: INGRESOS.map((i, color) => ({
      etiqueta: t(`juego.presupuesto.tipos.${i}`),
      valor: (presupuesto.ingresos[i] / pib) * 100,
      color,
      icono: ICONO_INGRESO[i],
    })),
    formato: (v) => porcentaje(v),
  });
  const restoMinisterios = MINISTERIOS.filter((m) => !CON_DATOS.has(m)).reduce(
    (total, m) => total + gastoMinisterio(presupuesto, m),
    0,
  );
  const valorGrupo: Record<(typeof GRUPOS_GASTO)[number], number> = {
    pensiones: presupuesto.transversales.pensiones,
    desempleo: presupuesto.transversales.desempleo,
    intereses: presupuesto.transversales.intereses,
    sanidad: gastoMinisterio(presupuesto, 'sanidad'),
    educacion: gastoMinisterio(presupuesto, 'educacion'),
    defensa: gastoMinisterio(presupuesto, 'defensa'),
    resto: restoMinisterios,
  };
  const gastos = barraDePartes({
    titulo: t('juego.presupuesto.gastosTitulo'),
    partes: GRUPOS_GASTO.map((g, color) => ({
      etiqueta: t(`juego.presupuesto.grupos.${g}`),
      valor: (valorGrupo[g] / pib) * 100,
      color,
      icono: ICONO_GRUPO[g],
    })),
    formato: (v) => porcentaje(v),
  });
  const grafico = graficoLineas({
    titulo: t('juego.presupuesto.graficoTitulo'),
    series: [
      {
        nombre: t('juego.presupuesto.ingresos'),
        puntos: presupuesto.serie.ingresos.map((v, mes) => [mes, v] as const),
      },
      {
        nombre: t('juego.presupuesto.gastos'),
        puntos: presupuesto.serie.gastos.map((v, mes) => [mes, v] as const),
      },
    ],
    ancho,
    alto,
    animado: primera,
    latido: !primera,
    formatoY: (v) => porcentaje(v),
    ...ejeX,
  });
  const partes: HTMLElement[] = [
    el(
      'p',
      { class: 'economia__cabecera' },
      el('strong', {}, t('juego.presupuesto.titulo')),
      ' · ',
      el('time', { datetime: fecha }, formatearFechaLarga(fecha)),
    ),
    datos,
    ingresos,
    gastos,
    grafico,
  ];
  if (opciones.completo) {
    partes.push(
      graficoLineas({
        titulo: t('juego.presupuesto.graficoDeudaTitulo'),
        series: [
          {
            nombre: t('juego.presupuesto.deuda'),
            puntos: presupuesto.serie.deuda.map((v, mes) => [mes, v] as const),
          },
        ],
        ancho,
        alto,
        animado: primera,
        latido: !primera,
        formatoY: (v) => porcentaje(v),
        ...ejeX,
      }),
    );
    if (mercado && mercado.serie.length > 1) {
      // La prima desde 2010, con la línea a la que se cierran los mercados (tarea f18-t4).
      partes.push(
        graficoLineas({
          titulo: t('juego.presupuesto.graficoPrimaTitulo'),
          series: [
            {
              nombre: t('juego.presupuesto.primaCorta'),
              puntos: mercado.serie.map((v, mes) => [mes, v] as const),
            },
          ],
          ancho,
          alto,
          animado: primera,
          latido: !primera,
          formatoY: (v) => puntos(v),
          referencias: [{ valor: UMBRAL_CIERRE, etiqueta: t('juego.presupuesto.cierreMercados') }],
          ...ejeX,
        }),
      );
    }
    partes.push(tablaMinisterios(presupuesto, pib));
  }
  partes.push(el('p', { class: 'panel-pais__pie economia__nota' }, t('juego.presupuesto.nota')));
  return partes;
}

/** Los 20 ministerios, cada uno desplegable con sus partidas, y los gastos fuera de ellos. */
function tablaMinisterios(presupuesto: PresupuestoPais, pib: number): HTMLElement {
  const lista = el('div', { class: 'presupuesto__ministerios' });
  for (const m of MINISTERIOS) {
    const nombre = t(`juego.secciones.ministerios.${m}.nombre`);
    const estimado = !CON_DATOS.has(m);
    lista.append(
      el(
        'details',
        { class: 'presupuesto__ministerio', 'data-ministerio': m },
        el(
          'summary',
          { class: 'presupuesto__resumen' },
          icono(ICONO_MINISTERIO[m]),
          el('span', { class: 'presupuesto__nombre' }, nombre),
          el(
            'span',
            { class: estimado ? 'presupuesto__valor es-estimado' : 'presupuesto__valor' },
            `${delPib(gastoMinisterio(presupuesto, m), pib)}${estimado ? '*' : ''}`,
          ),
        ),
        el(
          'dl',
          { class: 'panel-pais__datos presupuesto__partidas' },
          ...PARTIDAS.map((p) =>
            fila(
              ICONO_PARTIDA[p],
              t(`juego.presupuesto.partidas.${p}`),
              delPib(presupuesto.ministerios[m][p], pib),
              t(`juego.presupuesto.partidas.${p}Ayuda`),
              'es-estimado',
            ),
          ),
        ),
      ),
    );
  }
  return el(
    'section',
    { class: 'presupuesto__tabla', 'aria-label': t('juego.presupuesto.ministeriosTitulo') },
    el('h3', { class: 'panel-pais__apartado' }, t('juego.presupuesto.ministeriosTitulo')),
    lista,
  );
}

/** Un bloque con el presupuesto de un país, que se pone al día cada mes. */
export function bloquePresupuesto(
  fuente: FuentePresupuesto,
  opciones: OpcionesPresupuesto = {},
): BloquePresupuesto {
  const elemento = el('section', {
    class: 'economia presupuesto',
    'aria-label': t('juego.presupuesto.titulo'),
  });
  let primera = true;
  // El rating que se vio la última vez: si cambia, el distintivo salta (tarea f18-t4).
  let ratingVisto: Rating | undefined;
  const bloque: BloquePresupuesto = {
    elemento,
    actualizar() {
      const actual = fuente();
      if (!actual) {
        elemento.replaceChildren();
        return;
      }
      const mercado = actual.mercado ?? null;
      elemento.replaceChildren(
        ...(actual.presupuesto
          ? contenido(
              {
                presupuesto: actual.presupuesto,
                economia: actual.economia,
                tesoreria: actual.tesoreria,
                fecha: actual.fecha,
                mercado,
                ratingAntes: ratingVisto,
              },
              opciones,
              primera,
            )
          : [el('p', { class: 'economia__vacio' }, t('juego.presupuesto.sinDatos'))]),
      );
      ratingVisto = mercado?.rating;
      primera = false;
    },
  };
  bloque.actualizar();
  bloques.add(bloque);
  return bloque;
}

/** Contenido de la ventana Gobierno › Presupuesto: el del país del jugador, entero. */
export function contenidoVentanaPresupuesto(
  fuente: FuentePresupuesto,
  nombrePais: string,
): HTMLElement {
  return el(
    'div',
    { class: 'economia-ventana' },
    el('h3', { class: 'economia-ventana__titulo' }, nombrePais),
    bloquePresupuesto(fuente, { completo: true }).elemento,
    el('p', { class: 'panel-pais__pie' }, t('juego.presupuesto.ventanaNota')),
  );
}
