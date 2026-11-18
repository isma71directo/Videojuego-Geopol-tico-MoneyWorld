/**
 * Gobierno › Presupuesto, la vista general (Fase 19; ajuste f19-a2, decisiones del jugador): se ve
 * el presupuesto y se ajusta solo en general. El de cada ministerio se decide en su ventana (pestaña
 * «Presupuesto», ajuste f19-a3), como en Power & Revolution.
 *
 * - El resumen y la previsión a 12 meses (tarea f19-t3): hace un año, ahora, sin cambios y con el
 *   ajuste que se prepara.
 * - Un único ajuste general: subir o bajar todo el gasto de los ministerios en un %, con la subida
 *   anual (desde el 1 de enero) o extraordinaria (desde el mes siguiente), y atajos.
 * - Los cambios pendientes, cada uno con el día en que vale.
 * - La lista de los ministerios con su presupuesto (solo para ver): cada uno abre su ventana.
 */
import { icono } from '../av/iconos';
import { dineroConSigno, dolares, enteros, porcentaje, puntos } from '../compartido/formato';
import { formatearFechaLarga } from '../compartido/fechas';
import { t } from '../i18n';
import type { MercadoDeuda } from '../sim/deuda';
import type { EconomiaPais } from '../sim/economia';
import { diaUnoSiguiente, fechaDeAplicacion } from '../sim/hacienda';
import { prever, type Prevision } from '../sim/prevision';
import {
  gastoMinisterio,
  MINISTERIOS,
  saldo as saldoDe,
  totalGastos,
  totalIngresos,
  type CambioPresupuesto,
  type CambioProgramado,
  type Ministerio,
  type PresupuestoPais,
} from '../sim/presupuesto';
import { cambioEnPorcentaje, listaDePendientes } from './cambios-presupuesto';
import { animar } from './componentes/animacion';
import { crearDeslizador } from './componentes/deslizador';
import { sonar } from './componentes/sonidos';
import { el } from './dom';
import { ICONO_MINISTERIO, pibNominalPorMes } from './presupuesto-en-vivo';
import { textoRating } from './rating';
import './estilos/presupuesto.css';

/** Lo que necesita la vista: el presupuesto del jugador, su economía, la fecha y más. */
export type FuenteEditor = () => {
  presupuesto: PresupuestoPais | null;
  economia: EconomiaPais | null;
  fecha: string;
  /**
   * Para la previsión a 12 meses (tarea f19-t3): el país (su moneda cuenta para la prima), el
   * mercado de su deuda, la tesorería y la dureza.
   */
  id?: string;
  mercado?: MercadoDeuda | null;
  tesoreria?: number;
  dureza?: number;
} | null;

export interface OpcionesEditor {
  fuente: FuenteEditor;
  /** Manda cambios del presupuesto (al motor; ajuste f19-a1). */
  ordenar: (cambios: CambioPresupuesto[]) => void;
  /** Abre la ventana de un ministerio (su pestaña «Presupuesto»). */
  abrirMinisterio?: (ministerio: Ministerio) => void;
}

export interface EditorPresupuesto {
  readonly elemento: HTMLElement;
  /** Cada mes: el presupuesto en vigor puede haber cambiado. */
  actualizar(): void;
}

/** Hasta dónde llega el ajuste general (en %). */
export const LIMITES_AJUSTE = [-20, 20] as const;

/** El día en que se aplica lo que se ordena hoy (el 1 del mes siguiente). */
export const diaQueSeAplica = diaUnoSiguiente;

/** Una columna de la previsión: ingresos, gastos, saldo y deuda (dinero) y la prima. */
interface Fila {
  ingresos: number;
  gastos: number;
  saldo: number;
  deuda: number;
  prima: number | null;
  rating: string | null;
}

const editores = new Set<EditorPresupuesto>();

/** Pone al día las vistas a la vista (cada mes de la partida). */
export function refrescarEditoresPresupuesto(): void {
  for (const editor of editores) {
    if (editor.elemento.isConnected) editor.actualizar();
    else editores.delete(editor);
  }
}

/**
 * Los cambios ordenados este mes que el motor aún no ha programado: la vista los recuerda hasta el
 * día 1 (entonces ya están en los pendientes del presupuesto o aplicados). Compartidos con las
 * pestañas de los ministerios.
 */
const ordenadosEsteMes: { mes: string; cambios: CambioProgramado[] } = { mes: '', cambios: [] };

/** Anota los cambios que se acaban de ordenar (para enseñarlos como pendientes). */
export function anotarOrdenados(
  fecha: string,
  nivel: Parameters<typeof fechaDeAplicacion>[2],
  cambios: readonly CambioPresupuesto[],
): void {
  if (ordenadosEsteMes.mes !== fecha.slice(0, 7)) {
    ordenadosEsteMes.mes = fecha.slice(0, 7);
    ordenadosEsteMes.cambios = [];
  }
  for (const cambio of cambios) {
    ordenadosEsteMes.cambios.push({ cambio, desde: fechaDeAplicacion(cambio, fecha, nivel) });
  }
}

/** Los cambios pendientes: los del presupuesto y los ordenados este mes. */
export function pendientesDe(presupuesto: PresupuestoPais, fecha: string): CambioProgramado[] {
  const deEsteMes = ordenadosEsteMes.mes === fecha.slice(0, 7) ? ordenadosEsteMes.cambios : [];
  return [...presupuesto.pendientes, ...deEsteMes];
}

/** El sello «Aprobado» y su sonido (tarea f19-t4) sobre un botón. */
export function sellar(boton: HTMLElement): void {
  sonar('presupuestoAprobado');
  const sello = el(
    'span',
    { class: 'presupuesto-editable__sello', 'aria-hidden': 'true' },
    t('juego.hacienda.sello'),
  );
  boton.parentElement?.append(sello);
  void animar(
    sello,
    [
      { opacity: 0, transform: 'scale(1.8) rotate(-14deg)' },
      { opacity: 1, transform: 'scale(1) rotate(-8deg)', offset: 0.3 },
      { opacity: 1, transform: 'scale(1) rotate(-8deg)', offset: 0.75 },
      { opacity: 0, transform: 'scale(1) rotate(-8deg)' },
    ],
    1400,
  ).then(() => sello.remove());
}

/**
 * Al soltar un deslizador (tarea f19-t4): un tono que sube o baja y un destello en lo que ha
 * cambiado. Se engancha a un elemento: vale para todos sus deslizadores.
 */
export function sonarAlSoltar(elemento: HTMLElement, destellos: () => (Element | null)[]): void {
  elemento.addEventListener('change', (evento) => {
    const control = evento.target;
    if (!(control instanceof HTMLInputElement) || control.type !== 'range') return;
    const antes = Number(control.dataset.antes ?? control.defaultValue);
    const ahora = Number(control.value);
    control.dataset.antes = control.value;
    if (ahora === antes) return;
    const sube = ahora > antes;
    sonar(sube ? 'deslizadorSube' : 'deslizadorBaja');
    for (const destello of [
      control.closest('.deslizador')?.querySelector('.deslizador__valor') ?? null,
      ...destellos(),
    ]) {
      if (!destello) continue;
      void animar(
        destello,
        [
          { color: sube ? 'var(--hecha)' : 'var(--peligro)', transform: 'scale(1.06)' },
          { color: 'inherit', transform: 'scale(1)' },
        ],
        500,
      );
    }
  });
}

/** La tabla de la previsión a 12 meses (tarea f19-t3). */
export function tablaPrevision(columnas: readonly (Fila | Prevision | null)[]): HTMLElement {
  const celda = (texto: string, clase?: string) => el('td', { class: clase }, texto);
  const filaDe = (
    nombre: string,
    valor: (f: Fila | Prevision) => string,
    clase?: (f: Fila | Prevision) => string,
  ) =>
    el(
      'tr',
      {},
      el('th', { scope: 'row' }, nombre),
      ...columnas.map((f) => (f ? celda(valor(f), clase?.(f)) : celda('—'))),
    );
  const primaDe = (f: Fila | Prevision) =>
    f.prima === null
      ? '—'
      : f.rating
        ? `${puntos(f.prima)} (${textoRating(f.rating)})`
        : puntos(f.prima);
  return el(
    'table',
    { class: 'presupuesto-editable__tabla' },
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        el('th', { scope: 'col' }, ''),
        ...['haceUnAnio', 'ahora', 'sinCambios', 'conEste'].map((c) =>
          el('th', { scope: 'col' }, t(`juego.hacienda.columnas.${c}`)),
        ),
      ),
    ),
    el(
      'tbody',
      {},
      filaDe(t('juego.presupuesto.ingresos'), (f) => dolares(f.ingresos)),
      filaDe(t('juego.presupuesto.gastos'), (f) => dolares(f.gastos)),
      filaDe(
        t('juego.hacienda.saldo'),
        (f) => dineroConSigno(f.saldo),
        (f) => (f.saldo < 0 ? 'economia__baja' : ''),
      ),
      filaDe(t('juego.presupuesto.deuda'), (f) => dolares(f.deuda)),
      filaDe(t('juego.presupuesto.prima'), primaDe),
    ),
  );
}

/** Cómo estaba hace un año (con las series del presupuesto y del mercado), o null. */
export function haceUnAnio(
  presupuesto: PresupuestoPais,
  economia: EconomiaPais | null,
  mercado: MercadoDeuda | null,
): Fila | null {
  const n = presupuesto.serie.ingresos.length;
  if (n < 13 || !economia) return null;
  const i = n - 13;
  const pib = pibNominalPorMes(economia, n)[i]!;
  const enDinero = (serie: readonly number[]) => ((serie[i] ?? 0) / 100) * pib;
  const ingresos = enDinero(presupuesto.serie.ingresos);
  const gastos = enDinero(presupuesto.serie.gastos);
  return {
    ingresos,
    gastos,
    saldo: ingresos - gastos,
    deuda: enDinero(presupuesto.serie.deuda),
    prima: mercado ? (mercado.serie[mercado.serie.length - 13] ?? null) : null,
    rating: null,
  };
}

/** Cómo está ahora. */
export function ahoraDe(presupuesto: PresupuestoPais, mercado: MercadoDeuda | null): Fila {
  return {
    ingresos: totalIngresos(presupuesto),
    gastos: totalGastos(presupuesto),
    saldo: saldoDe(presupuesto),
    deuda: presupuesto.deuda,
    prima: mercado?.prima ?? null,
    rating: mercado?.rating ?? null,
  };
}

export function editorPresupuesto(opciones: OpcionesEditor): EditorPresupuesto {
  const elemento = el('section', {
    class: 'presupuesto-editable',
    'aria-label': t('juego.hacienda.titulo'),
  });
  /** El ajuste general que se prepara (en %) y cuándo valdría. */
  let ajuste = 0;
  let cuando: 'anio' | 'mes' = 'anio';
  /** La previsión sin cambios (se calcula al pintar y cada mes). */
  let sinCambios: Prevision | null = null;

  const resumen = el('dl', { class: 'panel-pais__datos presupuesto-editable__resumen' });
  const prevision = el('section', {
    class: 'presupuesto-editable__prevision',
    'aria-label': t('juego.hacienda.previsionTitulo'),
  });
  const pendientes = el('div', { class: 'presupuesto-editable__pendientes' });
  const aviso = el('p', { class: 'presupuesto-editable__aviso', role: 'status' });

  /** El ajuste general como cambio (o ninguno si es 0). */
  const cambiosDelAjuste = (): CambioPresupuesto[] =>
    ajuste === 0
      ? []
      : [
          {
            tipo: 'partida',
            ministerio: 'todos',
            partida: 'todas',
            factor: 1 + ajuste / 100,
            cuando,
          },
        ];

  const pintarResumen = (presupuesto: PresupuestoPais): void => {
    const ministerios = MINISTERIOS.reduce((t, m) => t + gastoMinisterio(presupuesto, m), 0);
    const ingresos = totalIngresos(presupuesto);
    const gastos = totalGastos(presupuesto);
    const saldo = ingresos - gastos;
    const fila = (nombre: string, valor: string, clase?: string) =>
      el(
        'div',
        { class: 'panel-pais__fila' },
        el('dt', {}, nombre),
        el('dd', { class: clase }, valor),
      );
    resumen.replaceChildren(
      fila(
        t('juego.hacienda.ministerios'),
        ajuste === 0
          ? dolares(ministerios)
          : t('juego.hacienda.conAjuste', {
              dinero: dolares(ministerios * (1 + ajuste / 100)),
              cambio: cambioEnPorcentaje(ajuste / 100),
            }),
      ),
      fila(t('juego.hacienda.gastoTotal'), dolares(gastos)),
      fila(t('juego.hacienda.ingresos'), dolares(ingresos)),
      fila(
        saldo < 0 ? t('juego.presupuesto.deficit') : t('juego.presupuesto.superavit'),
        t('juego.presupuesto.saldoValor', {
          dinero: dineroConSigno(saldo),
          parte: porcentaje(ingresos > 0 ? (Math.abs(saldo) / ingresos) * 100 : 0),
        }),
        saldo < 0 ? 'economia__baja' : undefined,
      ),
    );
  };

  /** La previsión a 12 meses (tarea f19-t3) con el ajuste general que se prepara. */
  const pintarPrevision = (): void => {
    const actual = opciones.fuente();
    const presupuesto = actual?.presupuesto;
    if (!actual || !presupuesto || !actual.economia) {
      prevision.replaceChildren();
      return;
    }
    const pais = {
      economia: actual.economia,
      presupuesto,
      mercado: actual.mercado ?? null,
      tesoreria: actual.tesoreria ?? 0,
    };
    const id = actual.id ?? '';
    sinCambios ??= prever(id, pais, { fecha: actual.fecha, dureza: actual.dureza });
    const conEste = prever(id, pais, {
      fecha: actual.fecha,
      cambios: cambiosDelAjuste(),
      dureza: actual.dureza,
    });
    prevision.replaceChildren(
      el('h3', { class: 'panel-pais__apartado' }, t('juego.hacienda.previsionTitulo')),
      tablaPrevision([
        haceUnAnio(presupuesto, actual.economia, pais.mercado),
        ahoraDe(presupuesto, pais.mercado),
        sinCambios,
        conEste,
      ]),
      el(
        'p',
        { class: 'presupuesto-editable__explicacion' },
        conEste.cerrado && !(pais.mercado?.cerrado ?? false)
          ? t('juego.hacienda.avisoCierre')
          : t('juego.hacienda.previsionNota'),
      ),
    );
  };

  const pintarPendientes = (presupuesto: PresupuestoPais, fecha: string): void => {
    const lista = listaDePendientes(pendientesDe(presupuesto, fecha));
    pendientes.replaceChildren(...(lista ? [lista] : []));
  };

  const pintar = (): void => {
    const actual = opciones.fuente();
    const presupuesto = actual?.presupuesto ?? null;
    if (!actual || !presupuesto || !actual.economia) {
      elemento.replaceChildren(
        el('p', { class: 'economia__vacio' }, t('juego.presupuesto.sinDatos')),
      );
      return;
    }
    const nivel = actual.economia.nivelRenta;
    const ipc = Math.max(0, actual.economia.inflacion);
    const fechaCuando = (c: 'anio' | 'mes') =>
      formatearFechaLarga(
        fechaDeAplicacion(
          { tipo: 'partida', ministerio: 'todos', partida: 'todas', factor: 1, cuando: c },
          actual.fecha,
          nivel,
        ),
      );

    // ── El ajuste general ──
    const deslizador = crearDeslizador({
      etiqueta: t('juego.hacienda.ajusteGeneral'),
      ayuda: t('juego.hacienda.ajusteGeneralAyuda'),
      min: LIMITES_AJUSTE[0],
      max: LIMITES_AJUSTE[1],
      paso: 0.5,
      valor: ajuste,
      formato: (v) => cambioEnPorcentaje(v / 100),
      alCambiar: (v) => {
        ajuste = v;
        pintarResumen(presupuesto);
      },
    });
    const opcionCuando = (valor: 'anio' | 'mes') => {
      const radio = el('input', {
        type: 'radio',
        name: 'cuando-general',
        value: valor,
        class: 'presupuesto-editable__cuando',
      });
      radio.checked = cuando === valor;
      radio.addEventListener('change', () => {
        cuando = valor;
        pintarPrevision();
      });
      return el(
        'label',
        { class: 'presupuesto-editable__casilla' },
        radio,
        t(`juego.hacienda.cuando.${valor}`, { fecha: fechaCuando(valor) }),
      );
    };
    const atajo = (texto: string, valor: number): HTMLButtonElement => {
      const boton = el('button', { class: 'boton', type: 'button' }, texto);
      boton.addEventListener('click', () => {
        sonar('boton');
        ajuste = Math.round(valor * 2) / 2;
        deslizador.ponerValor(ajuste);
        pintarResumen(presupuesto);
        pintarPrevision();
      });
      return boton;
    };
    const aplicar = el(
      'button',
      { class: 'boton boton--principal presupuesto-editable__aprobar', type: 'button' },
      t('juego.hacienda.aplicar'),
    );
    aplicar.addEventListener('click', () => {
      const cambios = cambiosDelAjuste();
      if (cambios.length === 0) return;
      opciones.ordenar(cambios);
      anotarOrdenados(actual.fecha, nivel, cambios);
      aviso.textContent = t('juego.hacienda.ordenado', { fecha: fechaCuando(cuando) });
      sellar(aplicar);
      ajuste = 0;
      deslizador.ponerValor(0);
      pintarResumen(presupuesto);
      pintarPrevision();
      pintarPendientes(presupuesto, actual.fecha);
    });

    // ── Los ministerios, solo para ver: cada uno abre su ventana ──
    const gastado = totalGastos(presupuesto);
    const ministerios = MINISTERIOS.map((m) => {
      const gasto = gastoMinisterio(presupuesto, m);
      const boton = el(
        'button',
        { type: 'button', class: 'presupuesto-editable__ministerio-fila', 'data-ministerio': m },
        icono(ICONO_MINISTERIO[m]),
        el('span', { class: 'presupuesto__nombre' }, t(`juego.secciones.ministerios.${m}.nombre`)),
        el(
          'span',
          { class: 'presupuesto__valor' },
          t('juego.hacienda.ministerioFila', {
            dinero: dolares(gasto),
            parte: porcentaje(gastado > 0 ? (gasto / gastado) * 100 : 0),
            empleados: enteros(presupuesto.empleados[m] ?? 0),
          }),
        ),
      );
      boton.title = t('juego.hacienda.abrirMinisterio');
      boton.addEventListener('click', () => opciones.abrirMinisterio?.(m));
      return el('li', {}, boton);
    });

    elemento.replaceChildren(
      el(
        'p',
        { class: 'economia__cabecera' },
        el('strong', {}, t('juego.hacienda.titulo')),
        ' · ',
        t(
          presupuesto.aprobado.prorrogado ? 'juego.hacienda.prorrogado' : 'juego.hacienda.enVigor',
          { anio: presupuesto.aprobado.anio },
        ),
      ),
      el('p', { class: 'presupuesto-editable__explicacion' }, t('juego.hacienda.explicacion')),
      resumen,
      prevision,
      el('h3', { class: 'panel-pais__apartado' }, t('juego.hacienda.ajusteTitulo')),
      deslizador.elemento,
      el(
        'div',
        { class: 'presupuesto-editable__opciones', role: 'radiogroup' },
        opcionCuando('anio'),
        opcionCuando('mes'),
      ),
      el(
        'div',
        { class: 'presupuesto-editable__atajos' },
        atajo(t('juego.hacienda.conIpc', { ipc: porcentaje(ipc * 100) }), ipc * 100),
        atajo(t('juego.hacienda.recortar'), -5),
        atajo(t('juego.hacienda.sinCambios'), 0),
      ),
      el('div', { class: 'presupuesto-editable__pie' }, aplicar, aviso),
      pendientes,
      el('h3', { class: 'panel-pais__apartado' }, t('juego.hacienda.ministeriosTitulo')),
      el('p', { class: 'presupuesto-editable__explicacion' }, t('juego.hacienda.ministeriosNota')),
      el('ul', { class: 'presupuesto-editable__ministerios' }, ...ministerios),
    );
    pintarResumen(presupuesto);
    pintarPrevision();
    pintarPendientes(presupuesto, actual.fecha);
  };

  // Al soltar el deslizador, la previsión con el ajuste; y su tono y su destello (tarea f19-t4).
  elemento.addEventListener('change', (evento) => {
    if (evento.target instanceof HTMLInputElement && evento.target.type === 'range') {
      pintarPrevision();
    }
  });
  sonarAlSoltar(elemento, () => [resumen.querySelector('dd')]);

  const editor: EditorPresupuesto = {
    elemento,
    actualizar() {
      // Un mes más: la previsión sin cambios es otra.
      sinCambios = null;
      pintar();
    },
  };
  editor.actualizar();
  editores.add(editor);
  return editor;
}
