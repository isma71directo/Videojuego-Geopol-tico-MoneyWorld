/**
 * Cuentas de los gráficos y las tablas (tarea f7-t2), sin DOM y con tests: escalas, marcas
 * redondas de los ejes, números de los ejes y orden de las filas de una tabla.
 */

/** Colores de las series de los gráficos, en este orden fijo (nunca se reparten al azar). */
export const COLORES_SERIES = [
  '#3987e5', // azul
  '#d95926', // naranja
  '#199e70', // aguamarina
  '#c98500', // amarillo
  '#d55181', // magenta
  '#0ca30c', // verde
  '#9085e9', // violeta
  '#e66767', // rojo
] as const;

/** Escala lineal: lleva [d0, d1] a [r0, r1]. */
export function escalaLineal(
  [d0, d1]: readonly [number, number],
  [r0, r1]: readonly [number, number],
): (valor: number) => number {
  const ancho = d1 - d0 || 1;
  return (valor) => r0 + ((valor - d0) / ancho) * (r1 - r0);
}

/**
 * Marcas «bonitas» de un eje entre min y max: pasos de 1, 2, 2,5 o 5 por una potencia de 10,
 * unas `cuantas` en total, que cubren todo el intervalo.
 */
export function marcasBonitas(min: number, max: number, cuantas = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const margen = Math.abs(min) || 1;
    min -= margen;
    max += margen;
  }
  const bruto = (max - min) / Math.max(1, cuantas - 1);
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * potencia).find((p) => p >= bruto)!;
  const inicio = Math.floor(min / paso) * paso;
  const fin = Math.ceil(max / paso) * paso;
  const marcas: number[] = [];
  for (let v = inicio; v <= fin + paso / 2; v += paso) {
    // Se redondea para que 0,1 + 0,2 no dé 0,30000000000000004.
    marcas.push(Number(v.toPrecision(12)));
  }
  return marcas;
}

const enteros = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, useGrouping: 'always' });
const compacto = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * Número de un eje: completo por debajo de 10.000 («2.500») y compacto a partir de ahí
 * («20 mil», «1,5 M»); un mismo estilo para todo el eje, según su valor más grande.
 */
export function formatoEje(marcas: readonly number[]): (valor: number) => string {
  const mayor = Math.max(...marcas.map(Math.abs));
  const formato = mayor >= 10_000 ? compacto : enteros;
  return (valor) => formato.format(valor).replace('-', '−');
}

export type Sentido = 'asc' | 'desc';

/**
 * Ordena filas por un valor: números de menor a mayor (o al revés) y textos por orden
 * alfabético en español; las filas sin valor van siempre al final. El orden es estable.
 */
export function ordenarFilas<T>(
  filas: readonly T[],
  valor: (fila: T) => number | string | null | undefined,
  sentido: Sentido,
): T[] {
  const signo = sentido === 'asc' ? 1 : -1;
  return filas
    .map((fila, i) => ({ fila, i, v: valor(fila) }))
    .sort((a, b) => {
      const vaciaA = a.v === null || a.v === undefined || Number.isNaN(a.v);
      const vaciaB = b.v === null || b.v === undefined || Number.isNaN(b.v);
      if (vaciaA || vaciaB) return vaciaA === vaciaB ? a.i - b.i : vaciaA ? 1 : -1;
      const comparacion =
        typeof a.v === 'number' && typeof b.v === 'number'
          ? a.v - b.v
          : String(a.v).localeCompare(String(b.v), 'es', { sensitivity: 'base' });
      return comparacion * signo || a.i - b.i;
    })
    .map(({ fila }) => fila);
}

/** Sitio de un recuadro de información junto a su elemento: arriba si cabe; si no, abajo. */
export function posicionInformacion(
  objetivo: { x: number; y: number; ancho: number; alto: number },
  info: { ancho: number; alto: number },
  pantalla: { ancho: number; alto: number },
  separacion = 8,
): { x: number; y: number; lado: 'arriba' | 'abajo' } {
  const centro = objetivo.x + objetivo.ancho / 2;
  const x = Math.min(
    pantalla.ancho - info.ancho - 8,
    Math.max(8, Math.round(centro - info.ancho / 2)),
  );
  const arriba = objetivo.y - separacion - info.alto;
  if (arriba >= 8) return { x, y: Math.round(arriba), lado: 'arriba' };
  return {
    x,
    y: Math.round(Math.min(pantalla.alto - info.alto - 8, objetivo.y + objetivo.alto + separacion)),
    lado: 'abajo',
  };
}

/** Ajusta un valor a un deslizador: dentro de [min, max] y en un múltiplo del paso. */
export function ajustarAlPaso(valor: number, min: number, max: number, paso: number): number {
  const pasos = Math.round((valor - min) / paso);
  return Math.min(max, Math.max(min, Number((min + pasos * paso).toPrecision(12))));
}
