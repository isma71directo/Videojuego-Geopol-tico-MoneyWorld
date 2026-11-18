/**
 * La pestaña «Deuda y Tesoro» del Ministerio de Economía y Hacienda (tarea f20-t2; decisiones del
 * jugador: en Economía y Hacienda, como en Power & Revolution, y Tesoro automático que se apaga).
 *
 * - La deuda, su tipo medio y su rating; la tesorería, en dinero y en meses de gasto.
 * - Lo que pide hoy el mercado por cada plazo (letras a 1 año y bonos a 5 y a 10 años).
 * - El calendario de vencimientos: lo que vence cada año de los próximos diez.
 * - El Tesoro automático: encendido o apagado, y cómo reparte entre los plazos.
 * - Emitir a mano (la subasta, el mes siguiente) y recomprar deuda con la tesorería.
 * - Los cambios pendientes del Tesoro, cada uno con su día.
 */
import { icono } from '../av/iconos';
import { dolares, porcentaje, puntos } from '../compartido/formato';
import { formatearFechaLarga } from '../compartido/fechas';
import { t } from '../i18n';
import config from '../sim/config/presupuesto.json';
import { UMBRAL_CIERRE } from '../sim/deuda';
import { fechaDeAplicacion } from '../sim/hacienda';
import {
  PLAZOS,
  repartoValido,
  totalGastos,
  vidaMediaRestante,
  type CambioPresupuesto,
  type Plazo,
  type PresupuestoPais,
  type Reparto,
} from '../sim/presupuesto';
import { listaDePendientes } from './cambios-presupuesto';
import { crearDeslizador } from './componentes/deslizador';
import { sonar } from './componentes/sonidos';
import { el } from './dom';
import {
  anotarOrdenados,
  pendientesDe,
  sellar,
  sonarAlSoltar,
  type FuenteEditor,
} from './presupuesto-editable';
import { distintivoRating } from './rating';
import './estilos/presupuesto.css';
import './estilos/deuda-tesoro.css';

const ts = config.tesoro;
/** De cuánto en cuánto se cambia lo que se emite o se recompra con los botones (dólares). */
export const PASO_IMPORTE = 1e9;
/** Los cambios que son del Tesoro. */
const DEL_TESORO: ReadonlySet<CambioPresupuesto['tipo']> = new Set([
  'emision',
  'recompra',
  'tesoro',
]);

export interface OpcionesDeudaTesoro {
  fuente: FuenteEditor;
  /** Manda los cambios del Tesoro (al motor). */
  ordenar: (cambios: CambioPresupuesto[]) => void;
}

export interface DeudaTesoro {
  readonly elemento: HTMLElement;
  actualizar(): void;
}

const vistas = new Set<DeudaTesoro>();

/** Pone al día las pestañas a la vista (cada mes de la partida). */
export function refrescarDeudaTesoro(): void {
  for (const vista of vistas) {
    if (vista.elemento.isConnected) vista.actualizar();
    else vistas.delete(vista);
  }
}

/** Lo que vence cada año (el 1 de cada mes se paga lo de su casilla), desde el mes que viene. */
export function vencimientosPorAnio(
  vencimientos: readonly number[],
  fecha: string,
): { anio: number; importe: number }[] {
  const primero = Number(fecha.slice(0, 4)) * 12 + Number(fecha.slice(5, 7));
  const porAnio = new Map<number, number>();
  vencimientos.forEach((importe, i) => {
    const anio = Math.floor((primero + i) / 12);
    porAnio.set(anio, (porAnio.get(anio) ?? 0) + importe);
  });
  return [...porAnio].map(([anio, importe]) => ({ anio, importe }));
}

/** El tipo medio y la vida media de lo que se emite con un reparto (a los tipos de hoy). */
export function emisionCon(
  presupuesto: Pick<PresupuestoPais, 'tesoro'>,
  reparto: Reparto,
): { tipo: number; vida: number } {
  let tipo = 0;
  let vida = 0;
  for (const p of PLAZOS) {
    tipo += reparto[p] * presupuesto.tesoro.tipos[p];
    vida += (reparto[p] * ts.plazos[p]) / 12;
  }
  return { tipo, vida };
}

/** Lo que se prepara en la pestaña (se conserva al cambiar de mes). */
interface Borrador {
  automatico: boolean | null;
  /** El reparto en % (sin normalizar), o null si no se ha tocado. */
  reparto: Record<Plazo, number> | null;
  emitir: number;
  recomprar: number;
}

const borradorVacio = (): Borrador => ({
  automatico: null,
  reparto: null,
  emitir: 0,
  recomprar: 0,
});

/** Un campo de dinero (en millones de $) con sus botones de ± 1.000 M$. */
function campoDeDinero(opciones: {
  etiqueta: string;
  valor: number;
  maximo: number;
  alCambiar: (valor: number) => void;
}): { elemento: HTMLElement; campo: HTMLInputElement } {
  const campo = el('input', {
    type: 'number',
    class: 'deuda-tesoro__importe',
    step: PASO_IMPORTE / 1e6,
    min: 0,
    value: Math.round(opciones.valor / 1e6),
    'aria-label': opciones.etiqueta,
  });
  const poner = (dolaresNuevos: number): void => {
    const valor = Math.min(
      opciones.maximo,
      Math.max(0, Number.isFinite(dolaresNuevos) ? dolaresNuevos : 0),
    );
    campo.value = String(Math.round(valor / 1e6));
    opciones.alCambiar(valor);
  };
  campo.addEventListener('input', () => poner(Number(campo.value) * 1e6));
  const boton = (texto: string, paso: number): HTMLButtonElement => {
    const b = el(
      'button',
      { class: 'boton boton--pequeno', type: 'button', 'aria-label': texto },
      texto,
    );
    b.addEventListener('click', () => {
      sonar(paso > 0 ? 'deslizadorSube' : 'deslizadorBaja');
      poner(Number(campo.value) * 1e6 + paso);
    });
    return b;
  };
  return {
    campo,
    elemento: el(
      'div',
      { class: 'deuda-tesoro__fila' },
      el('span', { class: 'deuda-tesoro__etiqueta' }, opciones.etiqueta),
      boton(`−${dolares(PASO_IMPORTE)}`, -PASO_IMPORTE),
      campo,
      el('span', { class: 'deuda-tesoro__unidad' }, 'M$'),
      boton(`+${dolares(PASO_IMPORTE)}`, PASO_IMPORTE),
    ),
  };
}

export function deudaTesoro(opciones: OpcionesDeudaTesoro): DeudaTesoro {
  const elemento = el('section', {
    class: 'deuda-tesoro',
    'aria-label': t('juego.tesoro.titulo'),
  });
  let borrador = borradorVacio();
  const aviso = el('p', { class: 'presupuesto-editable__aviso', role: 'status' });

  const pintar = (): void => {
    const actual = opciones.fuente();
    const presupuesto = actual?.presupuesto ?? null;
    const economia = actual?.economia ?? null;
    if (!actual || !presupuesto || !economia) {
      elemento.replaceChildren(
        el('p', { class: 'economia__vacio' }, t('juego.presupuesto.sinDatos')),
      );
      return;
    }
    const { tesoro } = presupuesto;
    const mercado = actual.mercado ?? null;
    const tesoreria = actual.tesoreria ?? 0;
    const gastoMes = totalGastos(presupuesto) / 12;
    const nivel = economia.nivelRenta;
    const fechaDe = (cambio: CambioPresupuesto): string =>
      formatearFechaLarga(fechaDeAplicacion(cambio, actual.fecha, nivel));
    const repartoEnPorcentaje = (): Record<Plazo, number> =>
      borrador.reparto ??
      (Object.fromEntries(PLAZOS.map((p) => [p, Math.round(tesoro.reparto[p] * 100)])) as Record<
        Plazo,
        number
      >);
    const reparto = (): Reparto => repartoValido(repartoEnPorcentaje());

    // ── Cabecera: la deuda y la tesorería ──
    const cabecera = el(
      'dl',
      { class: 'presupuesto-editable__resumen' },
      fila(t('juego.tesoro.deuda'), dolares(presupuesto.deuda)),
      fila(
        t('juego.tesoro.tipoMedio'),
        t('juego.tesoro.tipoMedioValor', {
          tipo: porcentaje(presupuesto.tipoInteres * 100),
          intereses: dolares(presupuesto.deuda * presupuesto.tipoInteres),
        }),
      ),
      fila(t('juego.tesoro.vidaMedia'), anios(vidaMediaRestante(presupuesto))),
      fila(
        t('juego.tesoro.tesoreria'),
        t('juego.tesoro.tesoreriaValor', {
          dinero: dolares(Math.max(0, tesoreria)),
          meses: decimal(gastoMes > 0 ? Math.max(0, tesoreria) / gastoMes : 0),
        }),
      ),
    );
    const rating = mercado
      ? el(
          'p',
          { class: 'deuda-tesoro__rating' },
          distintivoRating(mercado.rating),
          t('juego.tesoro.mercado', { prima: puntos(mercado.prima) }),
        )
      : null;

    // ── Lo que pide hoy el mercado por cada plazo ──
    const tipos = el(
      'table',
      { class: 'presupuesto-editable__tabla deuda-tesoro__tipos' },
      el(
        'thead',
        {},
        el(
          'tr',
          {},
          el('th', { scope: 'col' }, t('juego.tesoro.plazo')),
          el('th', { scope: 'col' }, t('juego.tesoro.tipoHoy')),
          el('th', { scope: 'col' }, t('juego.tesoro.vence')),
        ),
      ),
      el(
        'tbody',
        {},
        ...PLAZOS.map((p) =>
          el(
            'tr',
            { 'data-plazo': p },
            el('th', { scope: 'row' }, t(`juego.tesoro.plazos.${p}`)),
            el('td', {}, porcentaje(tesoro.tipos[p] * 100)),
            el('td', {}, anios(ts.plazos[p] / 12)),
          ),
        ),
      ),
    );
    const abierto = tesoro.abierto;
    const estadoMercados = el(
      'p',
      {
        class: 'presupuesto-ministerio__nota deuda-tesoro__mercados',
        'data-abierto': String(abierto),
      },
      abierto
        ? t('juego.tesoro.abierto')
        : t('juego.tesoro.cerrado', { umbral: puntos(UMBRAL_CIERRE) }),
    );

    // ── El calendario de vencimientos ──
    const porAnio = vencimientosPorAnio(presupuesto.vencimientos, actual.fecha).filter(
      (a) => a.importe > 0.5,
    );
    const mayor = Math.max(1, ...porAnio.map((a) => a.importe));
    const calendario = el(
      'ol',
      { class: 'deuda-tesoro__calendario', 'aria-label': t('juego.tesoro.calendario') },
      ...porAnio.map(({ anio, importe }) => {
        const relleno = el('span', { class: 'deuda-tesoro__relleno' });
        relleno.style.width = `${((importe / mayor) * 100).toFixed(1)}%`;
        return el(
          'li',
          { title: `${anio}: ${dolares(importe)}` },
          el('span', { class: 'deuda-tesoro__anio' }, String(anio)),
          el('span', { class: 'deuda-tesoro__barra' }, relleno),
          el('span', { class: 'deuda-tesoro__cifra' }, dolares(importe)),
        );
      }),
    );
    const doceMeses = presupuesto.vencimientos.slice(0, 12).reduce((a, b) => a + b, 0);

    // ── El Tesoro automático y su reparto ──
    const automatico = el('input', { type: 'checkbox', class: 'deuda-tesoro__automatico' });
    automatico.checked = borrador.automatico ?? tesoro.automatico;
    const avisoApagado = el(
      'p',
      { class: 'deuda-tesoro__peligro', role: 'note' },
      t('juego.tesoro.apagadoAviso'),
    );
    avisoApagado.hidden = automatico.checked;
    automatico.addEventListener('change', () => {
      borrador.automatico = automatico.checked;
      avisoApagado.hidden = automatico.checked;
    });
    const resumenReparto = el('p', { class: 'presupuesto-ministerio__total' });
    const textoEmitir = el('p', { class: 'presupuesto-ministerio__nota' });
    const pintarReparto = (): void => {
      const r = reparto();
      const { tipo, vida } = emisionCon(presupuesto, r);
      resumenReparto.textContent = t('juego.tesoro.repartoResumen', {
        letras: porcentaje(r.letras * 100),
        bonos5: porcentaje(r.bonos5 * 100),
        bonos10: porcentaje(r.bonos10 * 100),
        tipo: porcentaje(tipo * 100),
        vida: anios(vida),
      });
      pintarEmitir();
    };
    const deslizadoresReparto = PLAZOS.map((p) =>
      crearDeslizador({
        etiqueta: t(`juego.tesoro.plazos.${p}`),
        min: 0,
        max: 100,
        paso: 5,
        valor: repartoEnPorcentaje()[p],
        formato: (v) => t('juego.tesoro.parte', { n: v }),
        alCambiar: (v) => {
          borrador.reparto = { ...repartoEnPorcentaje(), [p]: v };
          pintarReparto();
        },
      }),
    );
    const guardarTesoro = el(
      'button',
      { class: 'boton boton--principal', type: 'button' },
      t('juego.tesoro.guardar'),
    );
    guardarTesoro.addEventListener('click', () => {
      const cambio: CambioPresupuesto = {
        tipo: 'tesoro',
        automatico: automatico.checked,
        reparto: borrador.reparto ? reparto() : null,
      };
      if (automatico.checked === tesoro.automatico && !borrador.reparto) return;
      ordenar([cambio], guardarTesoro);
    });

    // ── Emitir a mano ──
    function pintarEmitir(): void {
      const r = reparto();
      const { tipo } = emisionCon(presupuesto!, r);
      const importe = borrador.emitir;
      const cambio: CambioPresupuesto = { tipo: 'emision', importe, reparto: r };
      textoEmitir.textContent =
        importe > 0
          ? t('juego.tesoro.emitirTexto', {
              intereses: dolares(importe * tipo),
              tipo: porcentaje(tipo * 100),
              fecha: fechaDe(cambio),
            })
          : t('juego.tesoro.emitirVacio');
    }
    const emitir = campoDeDinero({
      etiqueta: t('juego.tesoro.emitir'),
      valor: borrador.emitir,
      maximo: Number.MAX_SAFE_INTEGER,
      alCambiar: (v) => {
        borrador.emitir = v;
        pintarEmitir();
      },
    });
    const botonEmitir = el(
      'button',
      { class: 'boton boton--principal', type: 'button', disabled: !abierto },
      t('juego.tesoro.botonEmitir'),
    );
    botonEmitir.addEventListener('click', () => {
      if (!(borrador.emitir > 0) || !abierto) return;
      ordenar([{ tipo: 'emision', importe: borrador.emitir, reparto: reparto() }], botonEmitir);
    });

    // ── Recomprar ──
    const textoRecomprar = el('p', { class: 'presupuesto-ministerio__nota' });
    const precio = tesoro.precioRecompra;
    const pintarRecomprar = (): void => {
      const importe = borrador.recomprar;
      const retirada = precio > 0 ? importe / precio : 0;
      textoRecomprar.textContent =
        importe > 0
          ? t(precio > 1 ? 'juego.tesoro.recomprarCaro' : 'juego.tesoro.recomprarTexto', {
              retirada: dolares(retirada),
              ahorro: dolares(retirada * presupuesto.tipoInteres),
              fecha: fechaDe({ tipo: 'recompra', importe }),
            })
          : t('juego.tesoro.recomprarVacio');
    };
    const recomprar = campoDeDinero({
      etiqueta: t('juego.tesoro.recomprar'),
      valor: borrador.recomprar,
      maximo: Math.max(0, tesoreria),
      alCambiar: (v) => {
        borrador.recomprar = v;
        pintarRecomprar();
      },
    });
    const botonRecomprar = el(
      'button',
      { class: 'boton boton--principal', type: 'button', disabled: !(tesoreria > 0) },
      t('juego.tesoro.botonRecomprar'),
    );
    botonRecomprar.addEventListener('click', () => {
      if (!(borrador.recomprar > 0)) return;
      ordenar([{ tipo: 'recompra', importe: borrador.recomprar }], botonRecomprar);
    });

    /** Manda los cambios, los anota como pendientes y vuelve a empezar. */
    function ordenar(cambios: CambioPresupuesto[], boton: HTMLElement): void {
      opciones.ordenar(cambios);
      anotarOrdenados(actual!.fecha, nivel, cambios);
      sellar(boton);
      borrador = borradorVacio();
      pintar();
      aviso.textContent = t('juego.tesoro.ordenado');
    }

    const lista = listaDePendientes(
      pendientesDe(presupuesto, actual.fecha).filter(({ cambio }) => DEL_TESORO.has(cambio.tipo)),
    );
    elemento.replaceChildren(
      el(
        'p',
        { class: 'economia__cabecera' },
        icono('tesoreria'),
        el('strong', {}, t('juego.tesoro.titulo')),
      ),
      cabecera,
      ...(rating ? [rating] : []),
      el('h3', { class: 'panel-pais__apartado' }, t('juego.tesoro.tiposTitulo')),
      tipos,
      estadoMercados,
      el('h3', { class: 'panel-pais__apartado' }, t('juego.tesoro.calendario')),
      el(
        'p',
        { class: 'presupuesto-ministerio__nota' },
        t('juego.tesoro.calendarioNota', { dinero: dolares(doceMeses) }),
      ),
      calendario,
      el('h3', { class: 'panel-pais__apartado' }, t('juego.tesoro.automaticoTitulo')),
      el(
        'label',
        { class: 'presupuesto-editable__casilla' },
        automatico,
        t('juego.tesoro.automatico'),
      ),
      el('p', { class: 'presupuesto-ministerio__nota' }, t('juego.tesoro.automaticoAyuda')),
      avisoApagado,
      ...deslizadoresReparto.map((d) => d.elemento),
      resumenReparto,
      el('div', { class: 'deuda-tesoro__acciones' }, guardarTesoro),
      el('h3', { class: 'panel-pais__apartado' }, t('juego.tesoro.emitirTitulo')),
      emitir.elemento,
      textoEmitir,
      el('div', { class: 'deuda-tesoro__acciones' }, botonEmitir),
      el('h3', { class: 'panel-pais__apartado' }, t('juego.tesoro.recomprarTitulo')),
      el(
        'p',
        { class: 'presupuesto-ministerio__nota' },
        t('juego.tesoro.precio', { precio: porcentaje(precio * 100) }),
      ),
      recomprar.elemento,
      textoRecomprar,
      el('div', { class: 'deuda-tesoro__acciones' }, botonRecomprar),
      aviso,
      ...(lista ? [lista] : []),
    );
    pintarReparto();
    pintarRecomprar();
  };

  sonarAlSoltar(elemento, () => []);
  const vista: DeudaTesoro = { elemento, actualizar: pintar };
  pintar();
  vistas.add(vista);
  return vista;
}

const unDecimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const decimal = (valor: number): string => unDecimal.format(valor);
/** «1 año», «4,8 años». */
const anios = (valor: number): string =>
  t(valor === 1 ? 'juego.tesoro.anio' : 'juego.tesoro.anios', { n: decimal(valor) });

function fila(nombre: string, valor: string): HTMLElement {
  return el('div', { class: 'panel-pais__fila' }, el('dt', {}, nombre), el('dd', {}, valor));
}
