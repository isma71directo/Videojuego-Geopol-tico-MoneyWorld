/**
 * Leyenda de la capa del mapa (tarea f6-t1), abajo a la izquierda: el nombre de la capa, su
 * unidad, un color por tramo (del más alto al más bajo) y las muestras de «dato estimado»
 * (rayado) y «sin datos». También da el texto del dato de la capa para la ficha del país.
 */
import { dolaresPorPersona, enteros, personas, porcentaje } from '../compartido/formato';
import { entradasLeyenda, type CapaDatos, type EntradaLeyenda } from '../map/capas';
import { t } from '../i18n';
import { el, type Hijo } from './dom';

const formatoNumero = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 1,
  useGrouping: 'always',
});
/** Cifra de la leyenda, con el signo menos tipográfico: «−5», «7,5», «40.000». */
const numero = { format: (valor: number): string => formatoNumero.format(valor).replace('-', '−') };

/** Lo que sigue a cada cifra de la leyenda: « $», « %» o nada (la unidad va en el título). */
function sufijo(capa: CapaDatos): string {
  if (capa.formato === 'dolaresPorPersona') return ' $';
  if (capa.formato === 'porcentaje') return ' %';
  return '';
}

/** «Menos de 1.000 $», «1.000 a 2.500 $», «40.000 $ o más» o «Sin reservas». */
export function textoEntrada(capa: CapaDatos, entrada: EntradaLeyenda): string {
  if (entrada.tipo === 'cero') return t('juego.mapa.capas.sinReservas');
  const fin = sufijo(capa);
  if (entrada.desde === null) {
    return t('juego.mapa.capas.menosDe', { valor: numero.format(entrada.hasta!) + fin });
  }
  if (entrada.hasta === null) {
    return t('juego.mapa.capas.oMas', { valor: numero.format(entrada.desde) + fin });
  }
  return t('juego.mapa.capas.entre', {
    desde: numero.format(entrada.desde),
    hasta: numero.format(entrada.hasta) + fin,
  });
}

/** Nombre de la capa: «Riqueza (PIB por habitante)», «Paro»… */
export function nombreCapa(capa: CapaDatos): string {
  return t(`juego.mapa.capas.${capa.id}.nombre`);
}

/** Dato de un país en la capa, ya escrito: «30.659 $», «19,9 %», «Sin reservas»… */
export function textoValorCapa(capa: CapaDatos, valor: number): string {
  switch (capa.formato) {
    case 'dolaresPorPersona':
      return dolaresPorPersona(valor);
    case 'personas':
      return personas(valor);
    case 'porcentaje':
      return porcentaje(valor);
    case 'reservas':
      return valor <= 0
        ? t('juego.mapa.capas.sinReservas')
        : t(`juego.mapa.capas.${capa.id}.valor`, { valor: enteros(valor) });
  }
}

function muestra(clase: string, color?: string): HTMLElement {
  const elemento = el('span', { class: `leyenda__muestra ${clase}`, 'aria-hidden': 'true' });
  if (color) elemento.style.background = color;
  return elemento;
}

/** Contenido de la leyenda; las muestras de estimado y sin datos solo si hacen falta. */
export function contenidoLeyenda(
  capa: CapaDatos,
  hayEstimados: boolean,
  haySinDatos: boolean,
  colorSinDatos: string,
): Hijo[] {
  const lineas = entradasLeyenda(capa).map((entrada) =>
    el('li', { class: 'leyenda__linea' }, muestra('', entrada.color), textoEntrada(capa, entrada)),
  );
  const extras = [
    hayEstimados
      ? el(
          'li',
          { class: 'leyenda__linea' },
          muestra('leyenda__muestra--rayada'),
          t('juego.mapa.capas.estimado'),
        )
      : null,
    haySinDatos
      ? el(
          'li',
          { class: 'leyenda__linea' },
          muestra('', colorSinDatos),
          t('juego.mapa.capas.sinDatos'),
        )
      : null,
  ].filter((linea) => linea !== null);
  return [
    el('h2', { class: 'leyenda__titulo', id: 'leyenda-titulo' }, nombreCapa(capa)),
    el('p', { class: 'leyenda__unidad' }, t(`juego.mapa.capas.${capa.id}.unidad`)),
    el('ul', { class: 'leyenda__lista' }, ...lineas),
    extras.length > 0 ? el('ul', { class: 'leyenda__lista leyenda__extras' }, ...extras) : null,
    el('p', { class: 'leyenda__pie' }, t('juego.mapa.capas.datos2010')),
  ];
}
