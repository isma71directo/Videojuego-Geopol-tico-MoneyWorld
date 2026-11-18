/**
 * La pestaña «Presupuesto» de cada ministerio (ajuste f19-a3; decisiones del jugador: como en Power
 * & Revolution, en cifras y en porcentajes, y cada cambio vale cuando le toca).
 *
 * - El presupuesto del ministerio, sus empleados públicos (estimados) y su sueldo medio.
 * - Personal: puestos nuevos (empiezan cuando acaba la oposición) o despidos (el mes siguiente,
 *   con indemnización), y la subida de los sueldos.
 * - Inversión, compras y mantenimiento, y programas: en % y en dinero.
 * - Las subidas, para el año que viene (desde el 1 de enero) o extraordinarias (el mes siguiente).
 * - En Trabajo y Seguridad Social, además, la subida de las pensiones y la prestación por parado.
 * - Los cambios pendientes del ministerio, cada uno con su día.
 */
import { icono } from '../av/iconos';
import { dolares, enteros, porcentaje } from '../compartido/formato';
import { formatearFechaLarga } from '../compartido/fechas';
import { t } from '../i18n';
import config from '../sim/config/presupuesto.json';
import { fechaDeAplicacion } from '../sim/hacienda';
import {
  gastoMinisterio,
  sueldoMedio,
  totalGastos,
  type CambioPresupuesto,
  type Ministerio,
} from '../sim/presupuesto';
import { cambioEnPorcentaje, listaDePendientes, tocaA } from './cambios-presupuesto';
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
import { ICONO_PARTIDA } from './presupuesto-en-vivo';
import './estilos/presupuesto.css';

const h = config.hacienda;

/** Las partidas que se suben o bajan en % (el personal, con puestos y sueldos). */
const PARTIDAS_EN_PORCENTAJE = ['inversion', 'mantenimiento', 'programas'] as const;
/** Hasta dónde se suben o bajan (en %). */
export const LIMITES_PARTIDA = [-50, 50] as const;
export const LIMITES_SUELDOS = [-10, 10] as const;
export const LIMITES_PENSIONES = [-5, 10] as const;
/** De cuánto en cuánto se cambian los puestos con los botones. */
const PASO_PUESTOS = 1000;

export interface OpcionesPresupuestoMinisterio {
  ministerio: Ministerio;
  fuente: FuenteEditor;
  /** Manda cambios del presupuesto (al motor). */
  ordenar: (cambios: CambioPresupuesto[]) => void;
}

export interface PresupuestoMinisterio {
  readonly elemento: HTMLElement;
  actualizar(): void;
}

const vistas = new Set<PresupuestoMinisterio>();

/** Pone al día las pestañas a la vista (cada mes de la partida). */
export function refrescarPresupuestosMinisterio(): void {
  for (const vista of vistas) {
    if (vista.elemento.isConnected) vista.actualizar();
    else vistas.delete(vista);
  }
}

/** Lo que se prepara en la pestaña (se conserva al cambiar de mes). */
interface Borrador {
  puestos: number;
  sueldos: number;
  partidas: Record<(typeof PARTIDAS_EN_PORCENTAJE)[number], number>;
  cuando: 'anio' | 'mes';
  /** Trabajo y Seguridad Social: la subida de las pensiones (null: el IPC) y la prestación (%). */
  revalorizacion: number | null | undefined;
  prestacion: number;
}

const borradorVacio = (): Borrador => ({
  puestos: 0,
  sueldos: 0,
  partidas: { inversion: 0, mantenimiento: 0, programas: 0 },
  cuando: 'anio',
  revalorizacion: undefined,
  prestacion: 100,
});

export function presupuestoMinisterio(
  opciones: OpcionesPresupuestoMinisterio,
): PresupuestoMinisterio {
  const m = opciones.ministerio;
  const elemento = el('section', {
    class: 'presupuesto-ministerio',
    'aria-label': t('juego.ministerioPresupuesto.titulo'),
  });
  let borrador = borradorVacio();
  const total = el('p', { class: 'presupuesto-ministerio__total' });
  const aviso = el('p', { class: 'presupuesto-editable__aviso', role: 'status' });
  const pendientes = el('div');

  /** Los cambios del borrador (solo los que cambian algo). */
  const cambiosDe = (b: Borrador, prestacionActual: number): CambioPresupuesto[] => {
    const cambios: CambioPresupuesto[] = [];
    if (b.puestos !== 0) cambios.push({ tipo: 'puestos', ministerio: m, cantidad: b.puestos });
    if (b.sueldos !== 0) {
      cambios.push({ tipo: 'sueldos', ministerio: m, subida: b.sueldos / 100, cuando: b.cuando });
    }
    for (const p of PARTIDAS_EN_PORCENTAJE) {
      if (b.partidas[p] !== 0) {
        cambios.push({
          tipo: 'partida',
          ministerio: m,
          partida: p,
          factor: 1 + b.partidas[p] / 100,
          cuando: b.cuando,
        });
      }
    }
    if (b.revalorizacion !== undefined) {
      cambios.push({ tipo: 'pensiones', revalorizacion: b.revalorizacion });
    }
    if (b.prestacion !== 100) {
      cambios.push({
        tipo: 'prestacion',
        prestacionParado: (prestacionActual * b.prestacion) / 100,
      });
    }
    return cambios;
  };

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
    const nivel = economia.nivelRenta;
    const gasto = gastoMinisterio(presupuesto, m);
    const partidas = presupuesto.ministerios[m];
    const empleados = presupuesto.empleados[m] ?? 0;
    const sueldo = sueldoMedio(presupuesto, m);
    const fechaDe = (cambio: CambioPresupuesto) =>
      formatearFechaLarga(fechaDeAplicacion(cambio, actual.fecha, nivel));

    /** Lo que gastaría el ministerio con el borrador (al año). */
    const conBorrador = (): number =>
      partidas.personal * (1 + borrador.sueldos / 100) +
      borrador.puestos * sueldo +
      PARTIDAS_EN_PORCENTAJE.reduce(
        (suma, p) => suma + partidas[p] * (1 + borrador.partidas[p] / 100),
        0,
      );
    const pintarTotal = (): void => {
      const nuevo = conBorrador();
      total.textContent = t('juego.ministerioPresupuesto.total', {
        dinero: dolares(nuevo),
        cambio: cambioEnPorcentaje(gasto > 0 ? nuevo / gasto - 1 : 0),
      });
    };

    // ── Personal: puestos nuevos o despidos, en cifras ──
    const textoPuestos = el('p', { class: 'presupuesto-ministerio__nota' });
    const pintarPuestos = (): void => {
      const n = borrador.puestos;
      const cambio: CambioPresupuesto = { tipo: 'puestos', ministerio: m, cantidad: n };
      textoPuestos.textContent =
        n > 0
          ? t('juego.ministerioPresupuesto.puestosNuevos', {
              dinero: dolares(n * sueldo),
              fecha: fechaDe(cambio),
            })
          : n < 0
            ? t('juego.ministerioPresupuesto.despidos', {
                dinero: dolares(-n * sueldo),
                indemnizacion: dolares(-n * sueldo * h.indemnizacion),
                fecha: fechaDe(cambio),
              })
            : t('juego.ministerioPresupuesto.sinPuestos');
    };
    const campoPuestos = el('input', {
      type: 'number',
      class: 'presupuesto-ministerio__puestos',
      step: PASO_PUESTOS,
      min: -empleados,
      value: borrador.puestos,
      'aria-label': t('juego.ministerioPresupuesto.puestos'),
    });
    const ponerPuestos = (n: number): void => {
      borrador.puestos = Math.max(-empleados, Math.round(Number.isFinite(n) ? n : 0));
      campoPuestos.value = String(borrador.puestos);
      pintarPuestos();
      pintarTotal();
    };
    campoPuestos.addEventListener('input', () => ponerPuestos(Number(campoPuestos.value)));
    const botonPuestos = (texto: string, paso: number): HTMLButtonElement => {
      const boton = el(
        'button',
        { class: 'boton boton--pequeno', type: 'button', 'aria-label': texto },
        texto,
      );
      boton.addEventListener('click', () => {
        sonar(paso > 0 ? 'deslizadorSube' : 'deslizadorBaja');
        ponerPuestos(borrador.puestos + paso);
      });
      return boton;
    };

    const sueldos = crearDeslizador({
      etiqueta: t('juego.ministerioPresupuesto.sueldos'),
      ayuda: t('juego.ministerioPresupuesto.sueldosAyuda'),
      min: LIMITES_SUELDOS[0],
      max: LIMITES_SUELDOS[1],
      paso: 0.5,
      valor: borrador.sueldos,
      formato: (v) =>
        t('juego.ministerioPresupuesto.valorCambio', {
          dinero: dolares(sueldo * (1 + v / 100)),
          cambio: cambioEnPorcentaje(v / 100),
        }),
      alCambiar: (v) => {
        borrador.sueldos = v;
        pintarTotal();
      },
    });

    // ── Inversión, compras y mantenimiento, y programas: en % y en dinero ──
    const enPorcentaje = PARTIDAS_EN_PORCENTAJE.map((p) => {
      const deslizador = crearDeslizador({
        etiqueta: t(`juego.ministerioPresupuesto.partidas.${p}`),
        ayuda: t(`juego.ministerioPresupuesto.partidas.${p}Ayuda`),
        min: LIMITES_PARTIDA[0],
        max: LIMITES_PARTIDA[1],
        valor: borrador.partidas[p],
        formato: (v) =>
          t('juego.ministerioPresupuesto.valorCambio', {
            dinero: dolares(partidas[p] * (1 + v / 100)),
            cambio: cambioEnPorcentaje(v / 100),
          }),
        alCambiar: (v) => {
          borrador.partidas[p] = v;
          pintarTotal();
        },
      });
      deslizador.elemento.prepend(icono(ICONO_PARTIDA[p]));
      return deslizador.elemento;
    });

    // ── Cuándo valen las subidas ──
    const opcionCuando = (valor: 'anio' | 'mes') => {
      const radio = el('input', {
        type: 'radio',
        name: `cuando-${m}`,
        value: valor,
        class: 'presupuesto-ministerio__cuando',
      });
      radio.checked = borrador.cuando === valor;
      radio.addEventListener('change', () => {
        borrador.cuando = valor;
      });
      return el(
        'label',
        { class: 'presupuesto-editable__casilla' },
        radio,
        t(`juego.hacienda.cuando.${valor}`, {
          fecha: fechaDe({
            tipo: 'partida',
            ministerio: m,
            partida: 'programas',
            factor: 1,
            cuando: valor,
          }),
        }),
      );
    };

    // ── Trabajo y Seguridad Social: pensiones y paro ──
    const pensionesYParo: HTMLElement[] = [];
    if (m === 'trabajo') {
      const conIpc = el('input', { type: 'checkbox', class: 'presupuesto-ministerio__ipc' });
      const vigente =
        borrador.revalorizacion === undefined
          ? presupuesto.revalorizacion
          : borrador.revalorizacion;
      conIpc.checked = vigente === null;
      const pensiones = crearDeslizador({
        etiqueta: t('juego.hacienda.pensiones'),
        ayuda: t('juego.hacienda.pensionesAyuda'),
        min: LIMITES_PENSIONES[0],
        max: LIMITES_PENSIONES[1],
        paso: 0.5,
        valor: (vigente ?? Math.max(0, economia.inflacion)) * 100,
        formato: (v) => cambioEnPorcentaje(v / 100),
        alCambiar: (v) => {
          borrador.revalorizacion = v / 100;
          conIpc.checked = false;
        },
      });
      conIpc.addEventListener('change', () => {
        borrador.revalorizacion = conIpc.checked ? null : pensiones.valor / 100;
      });
      const prestacion = crearDeslizador({
        etiqueta: t('juego.hacienda.prestacion'),
        ayuda: t('juego.hacienda.prestacionAyuda'),
        min: LIMITES_PARTIDA[0] + 100,
        max: LIMITES_PARTIDA[1] + 100,
        valor: borrador.prestacion,
        formato: (v) =>
          t('juego.hacienda.prestacionValor', {
            dinero: dolares((presupuesto.prestacionParado * v) / 100),
          }),
        alCambiar: (v) => {
          borrador.prestacion = v;
        },
      });
      pensionesYParo.push(
        el('h3', { class: 'panel-pais__apartado' }, t('juego.hacienda.pensionesYParo')),
        pensiones.elemento,
        el(
          'label',
          { class: 'presupuesto-editable__casilla' },
          conIpc,
          t('juego.hacienda.pensionesConIpc'),
        ),
        prestacion.elemento,
      );
    }

    const aplicar = el(
      'button',
      { class: 'boton boton--principal presupuesto-editable__aprobar', type: 'button' },
      t('juego.ministerioPresupuesto.aplicar'),
    );
    aplicar.addEventListener('click', () => {
      const cambios = cambiosDe(borrador, presupuesto.prestacionParado);
      if (cambios.length === 0) return;
      opciones.ordenar(cambios);
      anotarOrdenados(actual.fecha, nivel, cambios);
      sellar(aplicar);
      borrador = borradorVacio();
      pintar();
      aviso.textContent = t('juego.ministerioPresupuesto.ordenado', { n: cambios.length });
    });

    const lista = listaDePendientes(
      pendientesDe(presupuesto, actual.fecha).filter(({ cambio }) => tocaA(cambio, m)),
    );
    pendientes.replaceChildren(...(lista ? [lista] : []));
    const gastado = totalGastos(presupuesto);
    elemento.replaceChildren(
      el(
        'p',
        { class: 'economia__cabecera' },
        el('strong', {}, t('juego.ministerioPresupuesto.titulo')),
        ' · ',
        t('juego.ministerioPresupuesto.cabecera', {
          dinero: dolares(gasto),
          parte: porcentaje(gastado > 0 ? (gasto / gastado) * 100 : 0),
        }),
      ),
      el(
        'p',
        { class: 'presupuesto-ministerio__empleados' },
        t('juego.ministerioPresupuesto.empleados', {
          empleados: enteros(empleados),
          sueldo: dolares(sueldo),
        }),
      ),
      el('h3', { class: 'panel-pais__apartado' }, t('juego.ministerioPresupuesto.personal')),
      el(
        'div',
        { class: 'presupuesto-ministerio__fila-puestos' },
        el('span', {}, t('juego.ministerioPresupuesto.puestos')),
        botonPuestos(`−${enteros(PASO_PUESTOS)}`, -PASO_PUESTOS),
        campoPuestos,
        botonPuestos(`+${enteros(PASO_PUESTOS)}`, PASO_PUESTOS),
      ),
      textoPuestos,
      sueldos.elemento,
      el('h3', { class: 'panel-pais__apartado' }, t('juego.ministerioPresupuesto.restoTitulo')),
      ...enPorcentaje,
      el('p', { class: 'presupuesto-ministerio__nota' }, t('juego.ministerioPresupuesto.obras')),
      el(
        'div',
        { class: 'presupuesto-editable__opciones', role: 'radiogroup' },
        opcionCuando('anio'),
        opcionCuando('mes'),
      ),
      ...pensionesYParo,
      total,
      el('div', { class: 'presupuesto-editable__pie' }, aplicar, aviso),
      pendientes,
      el('p', { class: 'presupuesto-ministerio__nota' }, t('juego.ministerioPresupuesto.nota')),
    );
    pintarPuestos();
    pintarTotal();
  };

  sonarAlSoltar(elemento, () => [total]);
  const vista: PresupuestoMinisterio = {
    elemento,
    actualizar: pintar,
  };
  pintar();
  vistas.add(vista);
  return vista;
}
