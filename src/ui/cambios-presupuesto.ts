/**
 * Los cambios del presupuesto en palabras (ajustes f19-a2 y f19-a3): qué se ha decidido y desde
 * cuándo vale, para la vista general y para la pestaña «Presupuesto» de cada ministerio.
 */
import { dolares, enteros, porcentaje } from '../compartido/formato';
import { formatearFechaLarga } from '../compartido/fechas';
import { t } from '../i18n';
import type { CambioPresupuesto, CambioProgramado, Ministerio } from '../sim/presupuesto';
import { el } from './dom';

/** «+5,0 %» o «−3,0 %» (de un factor o de una subida en tanto por uno). */
export const cambioEnPorcentaje = (tantoPorUno: number): string =>
  `${tantoPorUno >= 0 ? '+' : '−'}${porcentaje(Math.abs(tantoPorUno) * 100)}`;

const nombreMinisterio = (ministerio: Ministerio | 'todos'): string =>
  ministerio === 'todos'
    ? t('juego.cambios.todos')
    : t(`juego.secciones.ministerios.${ministerio}.nombre`);

/** Un cambio en palabras: «Sanidad: programas +10,0 % (subida anual)». */
export function describirCambio(cambio: CambioPresupuesto): string {
  switch (cambio.tipo) {
    case 'partida':
      return t('juego.cambios.partida', {
        ministerio: nombreMinisterio(cambio.ministerio),
        partida:
          cambio.partida === 'todas'
            ? t('juego.cambios.todoElGasto')
            : t(`juego.presupuesto.partidas.${cambio.partida}`).toLowerCase(),
        cambio: cambioEnPorcentaje(cambio.factor - 1),
        cuando: t(`juego.cambios.cuando.${cambio.cuando}`),
      });
    case 'sueldos':
      return t('juego.cambios.sueldos', {
        ministerio: nombreMinisterio(cambio.ministerio),
        cambio: cambioEnPorcentaje(cambio.subida),
        cuando: t(`juego.cambios.cuando.${cambio.cuando}`),
      });
    case 'puestos':
      return t(cambio.cantidad > 0 ? 'juego.cambios.puestos' : 'juego.cambios.despidos', {
        ministerio: nombreMinisterio(cambio.ministerio),
        cantidad: enteros(Math.abs(cambio.cantidad)),
      });
    case 'pensiones':
      return cambio.revalorizacion === null
        ? t('juego.cambios.pensionesIpc')
        : t('juego.cambios.pensiones', { cambio: cambioEnPorcentaje(cambio.revalorizacion) });
    case 'prestacion':
      return t('juego.cambios.prestacion', { dinero: dolares(cambio.prestacionParado) });
    case 'emision':
      return t('juego.cambios.emision', { dinero: dolares(cambio.importe) });
    case 'recompra':
      return t('juego.cambios.recompra', { dinero: dolares(cambio.importe) });
    case 'tesoro':
      return t(cambio.automatico ? 'juego.cambios.tesoroAutomatico' : 'juego.cambios.tesoroManual');
  }
}

/** ¿Toca este cambio a `ministerio`? (Los de «todos», a todos.) */
export function tocaA(cambio: CambioPresupuesto, ministerio: Ministerio): boolean {
  if (cambio.tipo === 'partida' || cambio.tipo === 'sueldos') {
    return cambio.ministerio === 'todos' || cambio.ministerio === ministerio;
  }
  if (cambio.tipo === 'puestos') return cambio.ministerio === ministerio;
  // La deuda y el Tesoro son de Economía y Hacienda.
  if (cambio.tipo === 'emision' || cambio.tipo === 'recompra' || cambio.tipo === 'tesoro') {
    return ministerio === 'economia';
  }
  // Las pensiones y la prestación por parado son de Trabajo y Seguridad Social.
  return ministerio === 'trabajo';
}

/** La lista de cambios pendientes, cada uno con el día en que vale (o null si no hay). */
export function listaDePendientes(pendientes: readonly CambioProgramado[]): HTMLElement | null {
  if (pendientes.length === 0) return null;
  return el(
    'section',
    { class: 'cambios-pendientes', 'aria-label': t('juego.cambios.pendientes') },
    el('h3', { class: 'panel-pais__apartado' }, t('juego.cambios.pendientes')),
    el(
      'ul',
      { class: 'cambios-pendientes__lista' },
      ...[...pendientes]
        .sort((a, b) => a.desde.localeCompare(b.desde))
        .map(({ cambio, desde }) =>
          el(
            'li',
            {},
            el('span', {}, describirCambio(cambio)),
            el(
              'time',
              { datetime: desde },
              t('juego.cambios.desde', { fecha: formatearFechaLarga(desde) }),
            ),
          ),
        ),
    ),
  );
}
