/**
 * Gráficos básicos (tarea f7-t2), dibujados con SVG propio: líneas (evolución), barras
 * (comparar), barra de partes (un todo repartido, p. ej. el mix eléctrico) y minigráficos.
 *
 * Reglas (guía de visualización del proyecto):
 * - Colores de serie en orden fijo (COLORES_SERIES), validados con los tres daltonismos.
 * - Trazos finos: líneas de 2 px, barras de 24 px como mucho con el extremo redondeado,
 *   rejilla tenue y un solo eje vertical.
 * - Leyenda siempre que hay dos series o más; los textos van en los colores de texto, nunca en
 *   el de la serie.
 * - Al pasar el ratón (o con las flechas del teclado) se ven los valores; y cada gráfico tiene
 *   su vista de tabla, para que ningún dato dependa del color ni del ratón.
 */
import { icono as crearIcono, type NombreIcono } from '../../av/iconos';
import { t } from '../../i18n';
import { el } from '../dom';
import { COLORES_SERIES, escalaLineal, formatoEje, marcasBonitas } from './escalas';
import { crearTabla, type Columna } from './tabla';
import '../estilos/componentes.css';

const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  etiqueta: K,
  atributos: Record<string, string | number> = {},
  ...hijos: (SVGElement | string | null)[]
): SVGElementTagNameMap[K] {
  const elemento = document.createElementNS(SVG, etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    elemento.setAttribute(nombre, String(valor));
  }
  for (const hijo of hijos) {
    if (hijo === null) continue;
    elemento.append(typeof hijo === 'string' ? document.createTextNode(hijo) : hijo);
  }
  return elemento;
}

const numero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, useGrouping: 'always' });
const formatoPorDefecto = (valor: number): string => numero.format(valor);

/** Marco común: título, leyenda, el gráfico, su recuadro de valores y el botón de tabla. */
function marco(
  titulo: string,
  leyenda: HTMLElement | null,
  dibujo: Element,
  tabla: () => HTMLElement,
): { figura: HTMLElement; info: HTMLElement } {
  const info = el('div', { class: 'grafico__info', hidden: true, 'aria-hidden': 'true' });
  const lienzo = el('div', { class: 'grafico__lienzo' }, dibujo, info);
  let vistaTabla: HTMLElement | null = null;
  const alternar = el(
    'button',
    { class: 'grafico__alternar', type: 'button', 'aria-pressed': 'false' },
    t('juego.componentes.graficos.verTabla'),
  );
  alternar.addEventListener('click', () => {
    const enTabla = alternar.getAttribute('aria-pressed') !== 'true';
    vistaTabla ??= tabla();
    if (!vistaTabla.isConnected) lienzo.after(vistaTabla);
    vistaTabla.hidden = !enTabla;
    lienzo.hidden = enTabla;
    if (leyenda) leyenda.hidden = enTabla;
    alternar.setAttribute('aria-pressed', String(enTabla));
    alternar.textContent = t(
      enTabla ? 'juego.componentes.graficos.verGrafico' : 'juego.componentes.graficos.verTabla',
    );
  });
  const figura = el(
    'figure',
    { class: 'grafico' },
    el('figcaption', { class: 'grafico__cabecera' }, el('span', {}, titulo), alternar),
    leyenda,
    lienzo,
  );
  return { figura, info };
}

function leyendaDe(nombres: readonly string[], forma: 'linea' | 'cuadro'): HTMLElement | null {
  if (nombres.length < 2) return null;
  return el(
    'ul',
    { class: 'grafico__leyenda' },
    ...nombres.map((nombre, i) => {
      const muestra = el('span', { class: `grafico__muestra grafico__muestra--${forma}` });
      muestra.style.background = COLORES_SERIES[i % COLORES_SERIES.length]!;
      return el('li', {}, muestra, nombre);
    }),
  );
}

/** Pone el recuadro de valores junto a un punto del gráfico (en px dentro del lienzo). */
function situarInfo(info: HTMLElement, x: number, y: number, anchoLienzo: number): void {
  info.hidden = false;
  const ancho = info.offsetWidth || 160;
  const izquierda = x + 14 + ancho > anchoLienzo ? x - 14 - ancho : x + 14;
  info.style.transform = `translate(${Math.max(0, izquierda)}px, ${Math.max(0, y - 10)}px)`;
}

function filaInfo(color: string | null, valor: string, nombre: string): HTMLElement {
  const muestra = el('span', { class: 'grafico__muestra grafico__muestra--punto' });
  if (color) muestra.style.background = color;
  return el(
    'div',
    { class: 'grafico__info-fila' },
    color ? muestra : null,
    el('strong', {}, valor),
    el('span', {}, nombre),
  );
}

// ── Líneas ──────────────────────────────────────────────────────────────────────

export interface Serie {
  nombre: string;
  /** Puntos [x, y], de menor a mayor x (p. ej. [año, valor]). */
  puntos: readonly (readonly [number, number])[];
}

export interface OpcionesLineas {
  titulo: string;
  series: readonly Serie[];
  ancho?: number;
  alto?: number;
  formatoX?: (x: number) => string;
  formatoY?: (y: number) => string;
  /** Nombre de la columna de x en la vista de tabla (por defecto, «Año»). */
  nombreX?: string;
  /** Las líneas se dibujan de izquierda a derecha al aparecer (tarea f15-t4). */
  animado?: boolean;
  /** Valores de x con etiqueta en el eje (por defecto, unas ocho repartidas). */
  marcasX?: readonly number[];
  /** El punto final late una vez (al llegar un dato nuevo, tarea f15-t4). */
  latido?: boolean;
  /**
   * El eje vertical empieza en 0 (por defecto). Sin él, se ajusta a los valores, para ver
   * cambios pequeños (p. ej. el PIB mes a mes, tarea f15-t3).
   */
  desdeCero?: boolean;
  /**
   * Líneas horizontales de referencia, discontinuas y con su nombre (p. ej. la prima a la que
   * se cierran los mercados, tarea f18-t4). El eje vertical llega siempre hasta ellas.
   */
  referencias?: readonly { valor: number; etiqueta: string }[];
}

export function graficoLineas(opciones: OpcionesLineas): HTMLElement {
  const ancho = opciones.ancho ?? 520;
  const alto = opciones.alto ?? 240;
  const series = opciones.series.slice(0, COLORES_SERIES.length);
  const formatoX = opciones.formatoX ?? ((x: number) => String(x));
  const formatoY = opciones.formatoY ?? formatoPorDefecto;
  const xs = [...new Set(series.flatMap((s) => s.puntos.map(([x]) => x)))].sort((a, b) => a - b);
  const referencias = opciones.referencias ?? [];
  const ys = [
    ...series.flatMap((s) => s.puntos.map(([, y]) => y)),
    ...referencias.map((r) => r.valor),
  ];
  const [minimoY, maximoY] = [Math.min(...ys), Math.max(...ys)];
  // Ajustado a los valores, con un poco de aire (y algo de alto si todos son iguales).
  const aire = Math.max((maximoY - minimoY) * 0.15, Math.abs(maximoY) * 0.01, 1e-9);
  const marcasY =
    opciones.desdeCero === false
      ? marcasBonitas(minimoY - aire, maximoY + aire, 5)
      : marcasBonitas(Math.min(0, ...ys), maximoY, 5);
  const etiquetaEje = formatoEje(marcasY);
  const directas = series.length <= 4;
  const margen = { izq: 46, der: directas ? 92 : 14, arr: 10, aba: 26 };
  const x = escalaLineal([xs[0]!, xs.at(-1)!], [margen.izq, ancho - margen.der]);
  const y = escalaLineal([marcasY[0]!, marcasY.at(-1)!], [alto - margen.aba, margen.arr]);

  const rejilla = marcasY.map((m) =>
    svg(
      'g',
      {},
      svg('line', {
        class: 'grafico__rejilla',
        x1: margen.izq,
        x2: ancho - margen.der,
        y1: y(m),
        y2: y(m),
      }),
      svg(
        'text',
        {
          class: 'grafico__eje',
          x: margen.izq - 8,
          y: y(m),
          'text-anchor': 'end',
          'dominant-baseline': 'middle',
        },
        etiquetaEje(m),
      ),
    ),
  );
  const lineasReferencia = referencias.map((r) =>
    svg(
      'g',
      { class: 'grafico__referencia' },
      svg('line', {
        class: 'grafico__referencia-linea',
        x1: margen.izq,
        x2: ancho - margen.der,
        y1: y(r.valor),
        y2: y(r.valor),
      }),
      svg(
        'text',
        {
          class: 'grafico__referencia-texto',
          x: ancho - margen.der - 4,
          y: y(r.valor) - 5,
          'text-anchor': 'end',
        },
        r.etiqueta,
      ),
    ),
  );
  const pasoX = Math.max(1, Math.ceil(xs.length / 8));
  const ejeX = (
    opciones.marcasX
      ? opciones.marcasX.filter((v) => v >= xs[0]! && v <= xs.at(-1)!)
      : xs.filter((_, i) => i % pasoX === 0 || i === xs.length - 1)
  ).map((v) =>
    svg(
      'text',
      { class: 'grafico__eje', x: x(v), y: alto - 6, 'text-anchor': 'middle' },
      formatoX(v),
    ),
  );
  const lineas = series.map((serie, i) =>
    svg('path', {
      class: opciones.animado ? 'grafico__linea grafico__linea--dibujar' : 'grafico__linea',
      // Con largo 1, la animación no depende de lo larga que sea la línea.
      ...(opciones.animado ? { pathLength: 1 } : {}),
      d: serie.puntos
        .map(([px, py], j) => `${j ? 'L' : 'M'}${x(px).toFixed(1)},${y(py).toFixed(1)}`)
        .join(''),
      stroke: COLORES_SERIES[i]!,
    }),
  );
  // Fin de cada serie: un punto y, con pocas series que no se pisan, su nombre al lado.
  const finales = series.map((serie) => serie.puntos.at(-1)!);
  const separadas = finales
    .map(([, py]) => y(py))
    .sort((a, b) => a - b)
    .every((v, i, lista) => i === 0 || v - lista[i - 1]! >= 14);
  const extremos = series.map((serie, i) => {
    const [px, py] = finales[i]!;
    return svg(
      'g',
      {},
      svg('circle', {
        class: [
          'grafico__punto',
          opciones.animado ? 'grafico__punto--aparecer' : '',
          opciones.latido ? 'grafico__punto--latido' : '',
        ]
          .filter(Boolean)
          .join(' '),
        cx: x(px),
        cy: y(py),
        r: 4,
        fill: COLORES_SERIES[i]!,
      }),
      directas && separadas
        ? svg(
            'text',
            { class: 'grafico__etiqueta', x: x(px) + 9, y: y(py), 'dominant-baseline': 'middle' },
            serie.nombre,
          )
        : null,
    );
  });
  const guia = svg('line', {
    class: 'grafico__guia',
    y1: margen.arr,
    y2: alto - margen.aba,
    visibility: 'hidden',
  });
  const marcas = svg('g', {});
  const dibujo = svg(
    'svg',
    {
      class: 'grafico__svg',
      viewBox: `0 0 ${ancho} ${alto}`,
      role: 'img',
      tabindex: 0,
      'aria-label': t('juego.componentes.graficos.resumenLineas', {
        titulo: opciones.titulo,
        series: series.map((s) => s.nombre).join(', '),
        desde: formatoX(xs[0]!),
        hasta: formatoX(xs.at(-1)!),
      }),
    },
    ...rejilla,
    ...ejeX,
    ...lineasReferencia,
    guia,
    ...lineas,
    ...extremos,
    marcas,
  );

  const columnas: Columna<number>[] = [
    {
      id: 'x',
      titulo: opciones.nombreX ?? t('juego.componentes.graficos.anio'),
      valor: (v) => v,
      formato: (v) => formatoX(Number(v)),
    },
    ...series.map((serie, i) => ({
      id: `s${i}`,
      titulo: serie.nombre,
      valor: (v: number) => serie.puntos.find(([px]) => px === v)?.[1] ?? null,
      formato: (v: number | string) => formatoY(Number(v)),
      numerica: true,
    })),
  ];
  const { figura, info } = marco(
    opciones.titulo,
    leyendaDe(
      series.map((s) => s.nombre),
      'linea',
    ),
    dibujo,
    () => crearTabla({ etiqueta: opciones.titulo, columnas, filas: xs }).elemento,
  );

  // Guía vertical que busca el año más cercano al ratón o al que se llega con las flechas.
  let indice = -1;
  const mostrar = (i: number): void => {
    indice = Math.max(0, Math.min(xs.length - 1, i));
    const valorX = xs[indice]!;
    const cx = x(valorX);
    guia.setAttribute('x1', String(cx));
    guia.setAttribute('x2', String(cx));
    guia.setAttribute('visibility', 'visible');
    marcas.replaceChildren(
      ...series.flatMap((serie, s) => {
        const punto = serie.puntos.find(([px]) => px === valorX);
        return punto
          ? [
              svg('circle', {
                class: 'grafico__punto',
                cx,
                cy: y(punto[1]),
                r: 4,
                fill: COLORES_SERIES[s]!,
              }),
            ]
          : [];
      }),
    );
    info.replaceChildren(
      el('div', { class: 'grafico__info-titulo' }, formatoX(valorX)),
      ...series.flatMap((serie, s) => {
        const punto = serie.puntos.find(([px]) => px === valorX);
        return punto
          ? [
              filaInfo(
                series.length > 1 ? COLORES_SERIES[s]! : null,
                formatoY(punto[1]),
                serie.nombre,
              ),
            ]
          : [];
      }),
    );
    const caja = dibujo.getBoundingClientRect();
    const escala = caja.width ? caja.width / ancho : 1;
    situarInfo(info, cx * escala, margen.arr * escala, caja.width || ancho);
  };
  const ocultar = (): void => {
    guia.setAttribute('visibility', 'hidden');
    marcas.replaceChildren();
    info.hidden = true;
  };
  dibujo.addEventListener('pointermove', (evento) => {
    const caja = dibujo.getBoundingClientRect();
    const px = ((evento.clientX - caja.left) / (caja.width || ancho)) * ancho;
    let cercano = 0;
    xs.forEach((v, i) => {
      if (Math.abs(x(v) - px) < Math.abs(x(xs[cercano]!) - px)) cercano = i;
    });
    mostrar(cercano);
  });
  dibujo.addEventListener('pointerleave', ocultar);
  dibujo.addEventListener('blur', ocultar);
  dibujo.addEventListener('keydown', (evento) => {
    const destino =
      evento.key === 'ArrowLeft'
        ? indice - 1
        : evento.key === 'ArrowRight'
          ? indice + 1
          : evento.key === 'Home'
            ? 0
            : evento.key === 'End'
              ? xs.length - 1
              : null;
    if (destino === null) {
      if (evento.key === 'Escape') ocultar();
      return;
    }
    evento.preventDefault();
    mostrar(indice < 0 && destino < 0 ? xs.length - 1 : destino);
  });
  return figura;
}

// ── Barras ──────────────────────────────────────────────────────────────────────

export interface Barra {
  etiqueta: string;
  valor: number;
}

export interface OpcionesBarras {
  titulo: string;
  barras: readonly Barra[];
  formato?: (valor: number) => string;
  ancho?: number;
}

/** Barras horizontales: el nombre a la izquierda, la barra y su valor en el extremo. */
export function graficoBarras(opciones: OpcionesBarras): HTMLElement {
  const ancho = opciones.ancho ?? 520;
  const formato = opciones.formato ?? formatoPorDefecto;
  const grosor = 18;
  const hueco = 10;
  const izq = 130;
  const der = 70;
  const alto = opciones.barras.length * (grosor + hueco) + 8;
  const maximo = Math.max(...opciones.barras.map((b) => b.valor), 0) || 1;
  const x = escalaLineal([0, maximo], [izq, ancho - der]);
  const color = COLORES_SERIES[0];
  const filas = opciones.barras.map((barra, i) => {
    const y0 = 4 + i * (grosor + hueco);
    const largo = Math.max(0, x(Math.max(0, barra.valor)) - izq);
    const r = Math.min(4, largo / 2);
    // Recta en la base y redondeada en el extremo del dato.
    const d = `M${izq},${y0}h${largo - r}a${r},${r} 0 0 1 ${r},${r}v${grosor - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(largo - r)}z`;
    const grupo = svg(
      'g',
      {
        class: 'grafico__barra',
        tabindex: 0,
        role: 'img',
        'aria-label': `${barra.etiqueta}: ${formato(barra.valor)}`,
      },
      svg(
        'text',
        {
          class: 'grafico__etiqueta',
          x: izq - 10,
          y: y0 + grosor / 2,
          'text-anchor': 'end',
          'dominant-baseline': 'middle',
        },
        barra.etiqueta,
      ),
      largo > 0 ? svg('path', { d, fill: color }) : null,
      svg(
        'text',
        {
          class: 'grafico__valor',
          x: izq + largo + 8,
          y: y0 + grosor / 2,
          'dominant-baseline': 'middle',
        },
        formato(barra.valor),
      ),
    );
    return { grupo, barra, y0 };
  });
  const dibujo = svg(
    'svg',
    {
      class: 'grafico__svg',
      viewBox: `0 0 ${ancho} ${alto}`,
      role: 'group',
      'aria-label': opciones.titulo,
    },
    svg('line', { class: 'grafico__base', x1: izq, x2: izq, y1: 0, y2: alto }),
    ...filas.map((f) => f.grupo),
  );
  const { figura, info } = marco(
    opciones.titulo,
    null,
    dibujo,
    () =>
      crearTabla({
        etiqueta: opciones.titulo,
        columnas: [
          {
            id: 'nombre',
            titulo: t('juego.componentes.graficos.nombre'),
            valor: (b: Barra) => b.etiqueta,
          },
          {
            id: 'valor',
            titulo: t('juego.componentes.graficos.valor'),
            valor: (b: Barra) => b.valor,
            formato: (v) => formato(Number(v)),
          },
        ],
        filas: opciones.barras,
      }).elemento,
  );
  for (const { grupo, barra, y0 } of filas) {
    const mostrar = (): void => {
      info.replaceChildren(filaInfo(null, formato(barra.valor), barra.etiqueta));
      const caja = dibujo.getBoundingClientRect();
      const escala = caja.width ? caja.width / ancho : 1;
      situarInfo(info, x(Math.max(0, barra.valor)) * escala, y0 * escala, caja.width || ancho);
    };
    grupo.addEventListener('pointerenter', mostrar);
    grupo.addEventListener('focus', mostrar);
    grupo.addEventListener('pointerleave', () => (info.hidden = true));
    grupo.addEventListener('blur', () => (info.hidden = true));
  }
  return figura;
}

// ── Barra de partes ─────────────────────────────────────────────────────────────

export interface Parte {
  etiqueta: string;
  valor: number;
  /**
   * Color fijo (índice en COLORES_SERIES), para que una misma parte (el carbón, el gas…) lleve
   * siempre el mismo color aunque falten otras (la leyenda sigue al ente, no a su posición).
   */
  color?: number;
  /** Icono que acompaña a la parte en la leyenda (p. ej. cada sector, tarea f15-t4). */
  icono?: NombreIcono;
}

/**
 * Un todo repartido en partes (mix eléctrico, presupuesto…): una barra de 28 px con cada parte
 * en su color y su porcentaje dentro si cabe, y la leyenda debajo con el nombre y el valor.
 * Se lee mejor que un gráfico de sectores.
 */
export function barraDePartes(opciones: {
  titulo: string;
  partes: readonly Parte[];
  formato?: (valor: number) => string;
}): HTMLElement {
  const formato = opciones.formato ?? formatoPorDefecto;
  const partes = opciones.partes.filter((p) => p.valor > 0).slice(0, COLORES_SERIES.length);
  const total = partes.reduce((suma, p) => suma + p.valor, 0) || 1;
  const porcentaje = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 0 });
  const bloques = partes.map((parte, i) => {
    const cuota = parte.valor / total;
    const bloque = el(
      'span',
      {
        class: 'partes__bloque',
        tabindex: 0,
        role: 'img',
        'aria-label': `${parte.etiqueta}: ${formato(parte.valor)} (${porcentaje.format(cuota)})`,
      },
      // Solo se escribe el porcentaje dentro si hay sitio de sobra.
      cuota >= 0.1 ? porcentaje.format(cuota) : '',
    );
    bloque.style.flexGrow = String(parte.valor);
    bloque.style.background = COLORES_SERIES[parte.color ?? i]!;
    return bloque;
  });
  const barra = el('div', { class: 'partes__barra' }, ...bloques);
  const leyenda = el(
    'ul',
    { class: 'grafico__leyenda grafico__leyenda--partes' },
    ...partes.map((parte, i) => {
      const muestra = el('span', { class: 'grafico__muestra grafico__muestra--cuadro' });
      muestra.style.background = COLORES_SERIES[parte.color ?? i]!;
      return el(
        'li',
        {},
        muestra,
        parte.icono ? crearIcono(parte.icono) : null,
        `${parte.etiqueta} · ${formato(parte.valor)}`,
      );
    }),
  );
  const { figura, info } = marco(
    opciones.titulo,
    leyenda,
    barra,
    () =>
      crearTabla({
        etiqueta: opciones.titulo,
        columnas: [
          {
            id: 'nombre',
            titulo: t('juego.componentes.graficos.nombre'),
            valor: (p: Parte) => p.etiqueta,
          },
          {
            id: 'valor',
            titulo: t('juego.componentes.graficos.valor'),
            valor: (p: Parte) => p.valor,
            formato: (v) => formato(Number(v)),
          },
          {
            id: 'cuota',
            titulo: '%',
            valor: (p: Parte) => p.valor / total,
            formato: (v) => porcentaje.format(Number(v)),
          },
        ],
        filas: partes,
      }).elemento,
  );
  bloques.forEach((bloque, i) => {
    const parte = partes[i]!;
    const mostrar = (): void => {
      info.replaceChildren(
        filaInfo(
          COLORES_SERIES[i]!,
          `${formato(parte.valor)} (${porcentaje.format(parte.valor / total)})`,
          parte.etiqueta,
        ),
      );
      situarInfo(info, bloque.offsetLeft + bloque.offsetWidth / 2, 30, barra.offsetWidth || 400);
    };
    bloque.addEventListener('pointerenter', mostrar);
    bloque.addEventListener('focus', mostrar);
    bloque.addEventListener('pointerleave', () => (info.hidden = true));
    bloque.addEventListener('blur', () => (info.hidden = true));
  });
  return figura;
}

// ── Minigráfico ─────────────────────────────────────────────────────────────────

/** Minigráfico de tendencia (sin ejes) para fichas y tablas; el último valor, con un punto. */
export function minigrafico(
  valores: readonly number[],
  opciones: { etiqueta: string; ancho?: number; alto?: number },
): SVGSVGElement {
  const ancho = opciones.ancho ?? 88;
  const alto = opciones.alto ?? 26;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const x = escalaLineal([0, Math.max(1, valores.length - 1)], [3, ancho - 5]);
  const y = escalaLineal([min, max === min ? min + 1 : max], [alto - 4, 4]);
  const d = valores.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return svg(
    'svg',
    {
      class: 'minigrafico',
      viewBox: `0 0 ${ancho} ${alto}`,
      width: ancho,
      height: alto,
      role: 'img',
      'aria-label': opciones.etiqueta,
    },
    svg('path', { d, class: 'minigrafico__linea' }),
    valores.length
      ? svg('circle', {
          cx: x(valores.length - 1),
          cy: y(valores.at(-1)!),
          r: 3,
          class: 'minigrafico__punto',
        })
      : null,
  );
}
