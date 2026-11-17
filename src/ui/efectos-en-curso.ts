/**
 * Efectos en curso (tarea f13-t2, decisión del jugador: en la explicación de cada dato y en una
 * ventana de Informes). Qué está cambiando los datos del país del jugador, cuánto, desde cuándo
 * y hasta cuándo.
 */
import { formatearFechaLarga } from '../compartido/fechas';
import { dolares } from '../compartido/formato';
import { t } from '../i18n';
import { activo, efectosDe, type CampoEstado, type Efecto } from '../sim/efectos';
import type { Partida } from '../sim/partida';
import { el, type Hijo } from './dom';
import './estilos/efectos.css';

const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

/** Lo que hace un efecto a su dato, en pocas palabras: «+3 puntos», «×1,1», «= 1.000 M$». */
export function textoCambio(efecto: Efecto): string {
  const { operacion, valor } = efecto;
  const enDato = (n: number): string =>
    efecto.variable.campo === 'tesoreria'
      ? dolares(Math.abs(n))
      : t('juego.efectos.puntos', { valor: decimal.format(Math.abs(n)) });
  if (operacion === 'multiplicar') return `×${decimal.format(valor)}`;
  if (operacion === 'fijar') return `= ${enDato(valor)}`;
  return `${valor < 0 ? '−' : '+'}${enDato(valor)}`;
}

/** «Del 3 de enero de 2010 al 13 de enero de 2010» o «Desde el …, sin fecha de fin». */
export function textoFechas(efecto: Efecto): string {
  const desde = formatearFechaLarga(efecto.desde);
  return efecto.hasta
    ? t('juego.efectos.desdeHasta', { desde, hasta: formatearFechaLarga(efecto.hasta) })
    : t('juego.efectos.desdePermanente', { desde });
}

/** Efectos del país del jugador: los que actúan ya y los que aún no han empezado. */
export function efectosDelJugador(partida: Partida): Efecto[] {
  return partida.efectos
    .filter((e) => e.variable.pais === partida.jugador.paisId)
    .sort((a, b) => a.desde.localeCompare(b.desde));
}

/**
 * Líneas para la explicación de un dato (barra superior): los efectos que lo están cambiando y
 * hasta cuándo; nada si no hay ninguno.
 */
export function lineasEfectosDato(partida: Partida, campo: CampoEstado): Hijo[] {
  const efectos = efectosDe(partida.efectos, partida.jugador.paisId, campo, partida.fecha);
  if (efectos.length === 0) return [];
  return [
    el('strong', { class: 'info__apartado' }, t('juego.efectos.enDato')),
    el(
      'ul',
      { class: 'info__lista' },
      ...efectos.map((efecto) =>
        el(
          'li',
          {},
          `${textoCambio(efecto)} · ${efecto.nombre} (${
            efecto.hasta
              ? t('juego.efectos.hasta', { fecha: formatearFechaLarga(efecto.hasta) })
              : t('juego.efectos.permanente')
          })`,
        ),
      ),
    ),
  ];
}

/** Contenido de la ventana «Efectos en curso» de Informes. */
export function contenidoEfectosEnCurso(partida: Partida | null): HTMLElement {
  if (!partida) {
    return el(
      'div',
      { class: 'efectos' },
      el('p', { class: 'efectos__vacio' }, t('juego.efectos.sinPartida')),
    );
  }
  const efectos = efectosDelJugador(partida);
  return el(
    'div',
    { class: 'efectos' },
    el('p', { class: 'seccion__texto' }, t('juego.efectos.intro')),
    efectos.length === 0
      ? el('p', { class: 'efectos__vacio' }, t('juego.efectos.ninguno'))
      : el(
          'ul',
          { class: 'efectos__lista' },
          ...efectos.map((efecto) => {
            const ya = activo(efecto, partida.fecha);
            return el(
              'li',
              {
                class: `efectos__efecto${ya ? '' : ' efectos__efecto--pendiente'}`,
                'data-id': efecto.id,
              },
              el(
                'div',
                { class: 'efectos__cabecera' },
                el('strong', {}, efecto.nombre),
                efecto.origen === 'prueba'
                  ? el('span', { class: 'efectos__prueba' }, t('juego.efectos.prueba'))
                  : null,
                el('span', { class: 'efectos__cambio' }, textoCambio(efecto)),
              ),
              el(
                'p',
                { class: 'efectos__detalle' },
                `${t(`juego.efectos.campos.${efecto.variable.campo}`)} · ${t(
                  `juego.efectos.origenes.${efecto.origen}`,
                )} · ${textoFechas(efecto)}`,
              ),
              el(
                'p',
                { class: 'efectos__estado' },
                ya
                  ? t('juego.efectos.enCurso')
                  : t('juego.efectos.empieza', { fecha: formatearFechaLarga(efecto.desde) }),
              ),
            );
          }),
        ),
  );
}
