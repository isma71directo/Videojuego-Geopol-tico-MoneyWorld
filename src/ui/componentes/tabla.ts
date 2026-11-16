/**
 * Tablas ordenables (tarea f7-t2). Un clic (o Intro) en el título de una columna ordena por
 * ella; otro, al revés. Las cifras van alineadas a la derecha con números de ancho fijo.
 * Si la tabla tiene acción por fila, las flechas arriba y abajo recorren las filas e Intro
 * la elige.
 */
import { t } from '../../i18n';
import { el, reemplazar } from '../dom';
import { indiceConTecla } from './geometria';
import { ordenarFilas, type Sentido } from './escalas';
import '../estilos/componentes.css';

export interface Columna<T> {
  id: string;
  titulo: string;
  valor: (fila: T) => number | string | null | undefined;
  /** Texto de la celda (por defecto, el valor tal cual; «—» si no hay). */
  formato?: (valor: number | string, fila: T) => string;
  /** Las cifras se alinean a la derecha (por defecto, si el valor es un número). */
  numerica?: boolean;
  ordenable?: boolean;
}

export interface OpcionesTabla<T> {
  etiqueta: string;
  columnas: readonly Columna<T>[];
  filas: readonly T[];
  orden?: { columna: string; sentido: Sentido };
  /** Acción al elegir una fila (clic o Intro). */
  alElegir?: (fila: T) => void;
}

export interface Tabla<T> {
  readonly elemento: HTMLElement;
  /** Filas en el orden en que se ven. */
  readonly filasVisibles: readonly T[];
  ordenar(columna: string, sentido?: Sentido): void;
  ponerFilas(filas: readonly T[]): void;
}

export function crearTabla<T>(opciones: OpcionesTabla<T>): Tabla<T> {
  const { columnas } = opciones;
  let filas = [...opciones.filas];
  let orden = opciones.orden ?? null;
  let visibles: T[] = filas;
  const cuerpo = el('tbody');
  const cabeceras = columnas.map((columna) => {
    const numerica =
      columna.numerica ?? (filas.length > 0 && typeof columna.valor(filas[0]!) === 'number');
    const contenido =
      columna.ordenable === false
        ? columna.titulo
        : el(
            'button',
            { class: 'tabla__ordenar', type: 'button' },
            columna.titulo,
            el('span', { class: 'tabla__flecha', 'aria-hidden': 'true' }),
          );
    const th = el('th', { scope: 'col', class: numerica ? 'tabla__numero' : undefined }, contenido);
    if (contenido instanceof HTMLButtonElement) {
      contenido.addEventListener('click', () => {
        const sentido: Sentido =
          orden?.columna === columna.id && orden.sentido === 'desc' ? 'asc' : 'desc';
        // Las columnas de texto empiezan de la A a la Z; las de cifras, de mayor a menor.
        tabla.ordenar(
          columna.id,
          orden?.columna === columna.id ? sentido : numerica ? 'desc' : 'asc',
        );
      });
    }
    return { th, numerica };
  });
  const elemento = el(
    'div',
    { class: 'tabla' },
    el(
      'table',
      { 'aria-label': opciones.etiqueta },
      el('thead', {}, el('tr', {}, ...cabeceras.map((c) => c.th))),
      cuerpo,
    ),
  );

  const pintar = (): void => {
    const columna = columnas.find((c) => c.id === orden?.columna);
    visibles = columna && orden ? ordenarFilas(filas, columna.valor, orden.sentido) : filas;
    columnas.forEach((c, i) => {
      const th = cabeceras[i]!.th;
      if (c.id === orden?.columna) {
        th.setAttribute('aria-sort', orden.sentido === 'asc' ? 'ascending' : 'descending');
      } else th.removeAttribute('aria-sort');
    });
    reemplazar(
      cuerpo,
      ...visibles.map((fila) => {
        const tr = el(
          'tr',
          opciones.alElegir ? { tabindex: -1, class: 'tabla__fila--elegible' } : {},
          ...columnas.map((c, i) => {
            const v = c.valor(fila);
            const texto =
              v === null || v === undefined || Number.isNaN(v)
                ? t('juego.componentes.sinDato')
                : c.formato
                  ? c.formato(v, fila)
                  : String(v);
            return el('td', { class: cabeceras[i]!.numerica ? 'tabla__numero' : undefined }, texto);
          }),
        );
        if (opciones.alElegir) tr.addEventListener('click', () => opciones.alElegir!(fila));
        return tr;
      }),
    );
    const primera = cuerpo.querySelector('tr');
    if (primera && opciones.alElegir) primera.tabIndex = 0;
  };

  if (opciones.alElegir) {
    cuerpo.addEventListener('keydown', (evento) => {
      const filasDom = [...cuerpo.querySelectorAll('tr')];
      const actual = filasDom.indexOf(evento.target as HTMLTableRowElement);
      if (actual < 0) return;
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        opciones.alElegir!(visibles[actual]!);
        return;
      }
      const destino = indiceConTecla(actual, evento.key, filasDom.length, 'vertical');
      if (destino === null) return;
      evento.preventDefault();
      filasDom.forEach((fila, i) => (fila.tabIndex = i === destino ? 0 : -1));
      filasDom[destino]!.focus();
    });
  }

  const tabla: Tabla<T> = {
    elemento,
    get filasVisibles() {
      return visibles;
    },
    ordenar(columna, sentido = 'desc') {
      orden = { columna, sentido };
      pintar();
    },
    ponerFilas(nuevas) {
      filas = [...nuevas];
      pintar();
    },
  };
  pintar();
  return tabla;
}
