/**
 * La Pantalla «Presupuesto» editable (tarea f19-t2; decisiones del jugador: el presupuesto en
 * dinero y fijo hasta que se decida; anual, con cambios a mitad de año que valen desde el mes
 * siguiente; cada ministerio con sus 4 partidas; la subida de las pensiones y la prestación por
 * parado también se deciden).
 *
 * Se prepara un presupuesto nuevo a partir del que está en vigor: un deslizador por ministerio y,
 * desplegado, uno por cada partida (en % de lo que gasta ahora, con su dinero), la subida de las
 * pensiones del próximo enero (o el IPC, como dice la ley) y la prestación de cada parado. El
 * resumen cambia al momento. «Aprobar» lo manda al motor, que lo aplica el día 1 del mes siguiente.
 */
import { icono } from '../av/iconos';
import { dineroConSigno, dolares, porcentaje } from '../compartido/formato';
import { formatearFechaLarga } from '../compartido/fechas';
import { t } from '../i18n';
import type { EconomiaPais } from '../sim/economia';
import { presupuestoEnVigor, type PresupuestoDecidido } from '../sim/hacienda';
import {
  MINISTERIOS,
  PARTIDAS,
  totalIngresos,
  type Ministerio,
  type PresupuestoPais,
} from '../sim/presupuesto';
import { crearDeslizador, type Deslizador } from './componentes/deslizador';
import { sonar } from './componentes/sonidos';
import { el } from './dom';
import { ICONO_MINISTERIO, ICONO_PARTIDA } from './presupuesto-en-vivo';
import './estilos/presupuesto.css';

/** Lo que necesita el editor: el presupuesto del jugador, su economía y la fecha. */
export type FuenteEditor = () => {
  presupuesto: PresupuestoPais | null;
  economia: EconomiaPais | null;
  fecha: string;
} | null;

export interface OpcionesEditor {
  fuente: FuenteEditor;
  /** Manda el presupuesto aprobado (al motor). */
  aprobar: (decidido: PresupuestoDecidido) => void;
}

export interface EditorPresupuesto {
  readonly elemento: HTMLElement;
  /** Cada mes: el presupuesto en vigor puede haber cambiado. */
  actualizar(): void;
}

/** Hasta dónde se puede subir o bajar cada gasto (en % del que está en vigor). */
export const LIMITES_PORCENTAJE = [0, 200] as const;
/** Lo que se puede decidir de la subida de las pensiones (en %). */
export const LIMITES_PENSIONES = [-5, 10] as const;

const sumaMinisterio = (d: PresupuestoDecidido, m: Ministerio): number =>
  PARTIDAS.reduce((total, p) => total + d.ministerios[m][p], 0);
const sumaMinisterios = (d: PresupuestoDecidido): number =>
  MINISTERIOS.reduce((total, m) => total + sumaMinisterio(d, m), 0);

/** «El 1 de mayo de 2011»: el día en que se aplica lo aprobado hoy. */
export function diaQueSeAplica(fecha: string): string {
  const [anio, mes] = fecha.split('-').map(Number) as [number, number];
  const siguiente =
    mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  return siguiente;
}

const editores = new Set<EditorPresupuesto>();

/** Pone al día los editores a la vista (cada mes de la partida). */
export function refrescarEditoresPresupuesto(): void {
  for (const editor of editores) {
    if (editor.elemento.isConnected) editor.actualizar();
    else editores.delete(editor);
  }
}

export function editorPresupuesto(opciones: OpcionesEditor): EditorPresupuesto {
  const elemento = el('section', {
    class: 'presupuesto-editable',
    'aria-label': t('juego.hacienda.titulo'),
  });
  let enVigor: PresupuestoDecidido | null = null;
  let borrador: PresupuestoDecidido | null = null;
  /** ¿Ha tocado algo el jugador desde el presupuesto en vigor? */
  let cambiado = false;
  /** El día en que se aplicará lo aprobado (hasta que se aplica). */
  let pendiente: string | null = null;

  const resumen = el('dl', { class: 'panel-pais__datos presupuesto-editable__resumen' });
  const aviso = el('p', { class: 'presupuesto-editable__aviso', role: 'status' });

  /** El resumen del borrador frente a lo que está en vigor. */
  const pintarResumen = (presupuesto: PresupuestoPais): void => {
    if (!borrador || !enVigor) return;
    const ministerios = sumaMinisterios(borrador);
    const antes = sumaMinisterios(enVigor);
    const desempleo =
      enVigor.prestacionParado > 0
        ? (presupuesto.transversales.desempleo * borrador.prestacionParado) /
          enVigor.prestacionParado
        : presupuesto.transversales.desempleo;
    const gastos =
      ministerios +
      presupuesto.transversales.pensiones +
      desempleo +
      presupuesto.transversales.intereses;
    const ingresos = totalIngresos(presupuesto);
    const saldo = ingresos - gastos;
    const cambio = antes > 0 ? (ministerios / antes - 1) * 100 : 0;
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
        t('juego.hacienda.conCambio', {
          dinero: dolares(ministerios),
          cambio: `${cambio >= 0 ? '+' : '−'}${porcentaje(Math.abs(cambio))}`,
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

  const pintar = (): void => {
    const actual = opciones.fuente();
    const presupuesto = actual?.presupuesto ?? null;
    if (!actual || !presupuesto || !borrador || !enVigor) {
      elemento.replaceChildren(
        el('p', { class: 'economia__vacio' }, t('juego.presupuesto.sinDatos')),
      );
      return;
    }
    const decidido = borrador;
    const vigente = enVigor;
    const deslizadoresMinisterio = new Map<Ministerio, Deslizador>();
    const tocar = (): void => {
      cambiado = true;
      pintarResumen(presupuesto);
    };
    const enPorcentaje = (ahora: number, antes: number): number =>
      antes > 0 ? Math.round((ahora / antes) * 100) : 100;

    // ── Los ministerios, cada uno con sus partidas ──
    const ministerios = MINISTERIOS.map((m) => {
      const nombre = t(`juego.secciones.ministerios.${m}.nombre`);
      const valor = el('span', { class: 'presupuesto__valor' });
      const pintarValor = (): void => {
        valor.textContent = dolares(sumaMinisterio(decidido, m));
      };
      const partidas = PARTIDAS.map((p) => {
        const antes = vigente.ministerios[m][p];
        const deslizador = crearDeslizador({
          etiqueta: t(`juego.presupuesto.partidas.${p}`),
          min: LIMITES_PORCENTAJE[0],
          max: LIMITES_PORCENTAJE[1],
          valor: enPorcentaje(decidido.ministerios[m][p], antes),
          formato: (v) =>
            t('juego.hacienda.partidaValor', {
              dinero: dolares((antes * v) / 100),
              porcentaje: v,
            }),
          alCambiar: (v) => {
            decidido.ministerios[m][p] = (antes * v) / 100;
            deslizadoresMinisterio
              .get(m)
              ?.ponerValor(enPorcentaje(sumaMinisterio(decidido, m), sumaMinisterio(vigente, m)));
            pintarValor();
            tocar();
          },
        });
        deslizador.elemento.prepend(icono(ICONO_PARTIDA[p]));
        return { p, deslizador };
      });
      const total = crearDeslizador({
        etiqueta: t('juego.hacienda.todoElMinisterio'),
        min: LIMITES_PORCENTAJE[0],
        max: LIMITES_PORCENTAJE[1],
        valor: enPorcentaje(sumaMinisterio(decidido, m), sumaMinisterio(vigente, m)),
        formato: (v) => `${v} %`,
        alCambiar: (v) => {
          // Todo el ministerio: sus partidas, en la misma proporción de lo que había.
          for (const { p, deslizador } of partidas) {
            decidido.ministerios[m][p] = (vigente.ministerios[m][p] * v) / 100;
            deslizador.ponerValor(v);
          }
          pintarValor();
          tocar();
        },
      });
      deslizadoresMinisterio.set(m, total);
      pintarValor();
      return el(
        'details',
        { class: 'presupuesto__ministerio presupuesto-editable__ministerio', 'data-ministerio': m },
        el(
          'summary',
          { class: 'presupuesto__resumen' },
          icono(ICONO_MINISTERIO[m]),
          el('span', { class: 'presupuesto__nombre' }, nombre),
          valor,
        ),
        total.elemento,
        el(
          'div',
          { class: 'presupuesto-editable__partidas' },
          ...partidas.map((x) => x.deslizador.elemento),
        ),
      );
    });

    // ── Pensiones y paro ──
    const conIpc = el('input', { type: 'checkbox', class: 'presupuesto-editable__ipc' });
    conIpc.checked = decidido.revalorizacion === null;
    const pensiones = crearDeslizador({
      etiqueta: t('juego.hacienda.pensiones'),
      ayuda: t('juego.hacienda.pensionesAyuda'),
      min: LIMITES_PENSIONES[0],
      max: LIMITES_PENSIONES[1],
      paso: 0.5,
      valor: (decidido.revalorizacion ?? Math.max(0, actual.economia?.inflacion ?? 0)) * 100,
      formato: (v) => `${v >= 0 ? '+' : '−'}${porcentaje(Math.abs(v))}`,
      alCambiar: (v) => {
        decidido.revalorizacion = v / 100;
        conIpc.checked = false;
        tocar();
      },
    });
    conIpc.addEventListener('change', () => {
      decidido.revalorizacion = conIpc.checked ? null : pensiones.valor / 100;
      tocar();
    });
    const prestacion = crearDeslizador({
      etiqueta: t('juego.hacienda.prestacion'),
      ayuda: t('juego.hacienda.prestacionAyuda'),
      min: LIMITES_PORCENTAJE[0],
      max: LIMITES_PORCENTAJE[1],
      valor: enPorcentaje(decidido.prestacionParado, vigente.prestacionParado),
      formato: (v) =>
        t('juego.hacienda.prestacionValor', {
          dinero: dolares((vigente.prestacionParado * v) / 100),
        }),
      alCambiar: (v) => {
        decidido.prestacionParado = (vigente.prestacionParado * v) / 100;
        tocar();
      },
    });

    // ── Atajos ──
    const atajo = (texto: string, hacer: () => void): HTMLButtonElement => {
      const boton = el('button', { class: 'boton', type: 'button' }, texto);
      boton.addEventListener('click', () => {
        sonar('boton');
        hacer();
      });
      return boton;
    };
    const ipc = Math.max(0, actual.economia?.inflacion ?? 0);
    const conFactor = (factor: number): void => {
      borrador = presupuestoEnVigor(presupuesto);
      for (const m of MINISTERIOS) for (const p of PARTIDAS) borrador.ministerios[m][p] *= factor;
      borrador.prestacionParado *= factor;
      cambiado = factor !== 1;
      pintar();
    };

    const aprobar = el(
      'button',
      { class: 'boton boton--principal presupuesto-editable__aprobar', type: 'button' },
      t('juego.hacienda.aprobar'),
    );
    aprobar.addEventListener('click', () => {
      opciones.aprobar(structuredClone(decidido));
      pendiente = diaQueSeAplica(actual.fecha);
      sonar('boton');
      pintarAviso();
    });

    elemento.replaceChildren(
      el(
        'p',
        { class: 'economia__cabecera' },
        el('strong', {}, t('juego.hacienda.titulo')),
        ' · ',
        t(
          presupuesto.aprobado.prorrogado ? 'juego.hacienda.prorrogado' : 'juego.hacienda.enVigor',
          {
            anio: presupuesto.aprobado.anio,
          },
        ),
      ),
      el('p', { class: 'presupuesto-editable__explicacion' }, t('juego.hacienda.explicacion')),
      resumen,
      el(
        'div',
        { class: 'presupuesto-editable__atajos' },
        atajo(t('juego.hacienda.conIpc', { ipc: porcentaje(ipc * 100) }), () => conFactor(1 + ipc)),
        atajo(t('juego.hacienda.congelar'), () => conFactor(1)),
        atajo(t('juego.hacienda.recortar'), () => conFactor(0.95)),
      ),
      el('h3', { class: 'panel-pais__apartado' }, t('juego.hacienda.pensionesYParo')),
      pensiones.elemento,
      el(
        'label',
        { class: 'presupuesto-editable__casilla' },
        conIpc,
        t('juego.hacienda.pensionesConIpc'),
      ),
      prestacion.elemento,
      el('h3', { class: 'panel-pais__apartado' }, t('juego.hacienda.ministeriosTitulo')),
      el('div', { class: 'presupuesto__ministerios' }, ...ministerios),
      el('div', { class: 'presupuesto-editable__pie' }, aprobar, aviso),
    );
    pintarResumen(presupuesto);
    pintarAviso();
  };

  /** El aviso de lo aprobado y pendiente, o de cuándo se aplicaría. */
  const pintarAviso = (): void => {
    const actual = opciones.fuente();
    if (!actual) return;
    aviso.textContent = pendiente
      ? t('juego.hacienda.pendiente', { fecha: formatearFechaLarga(pendiente) })
      : t('juego.hacienda.seAplica', {
          fecha: formatearFechaLarga(diaQueSeAplica(actual.fecha)),
        });
    aviso.dataset.pendiente = String(Boolean(pendiente));
  };

  const editor: EditorPresupuesto = {
    elemento,
    actualizar() {
      const actual = opciones.fuente();
      const presupuesto = actual?.presupuesto ?? null;
      if (!presupuesto) {
        enVigor = null;
        borrador = null;
        pintar();
        return;
      }
      // Lo aprobado ya se ha aplicado: se empieza de nuevo desde ahí.
      if (pendiente && actual && actual.fecha >= pendiente) {
        pendiente = null;
        cambiado = false;
      }
      // A mitad de cambios, solo el resumen y el aviso (sin cerrar nada ni perder lo tocado).
      if (cambiado && borrador && enVigor) {
        pintarResumen(presupuesto);
        pintarAviso();
        return;
      }
      enVigor = presupuestoEnVigor(presupuesto);
      borrador = presupuestoEnVigor(presupuesto);
      pintar();
    },
  };
  editor.actualizar();
  editores.add(editor);
  return editor;
}
