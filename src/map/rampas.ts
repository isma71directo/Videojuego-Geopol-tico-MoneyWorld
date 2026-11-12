/**
 * Rampas de color de las capas del mapa (tarea f6-t1), creadas con código en el espacio OKLCH:
 * en él, la luminosidad que se ve cambia de forma pareja de un color al siguiente. Las rampas
 * evitan el par rojo-verde y van de claro a oscuro, para que se distingan también con
 * daltonismo (los tests lo comprueban simulando los tres tipos).
 *
 * Fórmulas de OKLab: Björn Ottosson (2020), https://bottosson.github.io/posts/oklab/
 * Simulación de daltonismo: Machado, Oliveira y Fernandes (2009), matrices de intensidad 1.
 */

/** Color en OKLCH: luminosidad (0 a 1), croma (0 a ~0,37) y tono en grados. */
export type Oklch = readonly [number, number, number];
export type Rgb = readonly [number, number, number];

const lineal = (x: number): number => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const gamma = (x: number): number => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);

/** OKLab → sRGB lineal (puede salirse de 0 a 1 si el color no existe en pantalla). */
function oklabALineal(l: number, a: number, b: number): Rgb {
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1,
    -1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1,
    -0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1,
  ];
}

/** sRGB lineal → OKLab. */
export function linealAOklab([r, g, b]: Rgb): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const dentro = (rgb: Rgb): boolean => rgb.every((x) => x >= -1e-4 && x <= 1 + 1e-4);

/**
 * OKLCH → «#rrggbb». Si el color no cabe en la pantalla (sRGB), se le baja el croma hasta que
 * quepa, sin tocar la luminosidad ni el tono.
 */
export function hexDeOklch([l, c, h]: Oklch): string {
  const rad = (h * Math.PI) / 180;
  const aLineal = (croma: number): Rgb =>
    oklabALineal(l, croma * Math.cos(rad), croma * Math.sin(rad));
  let rgb = aLineal(c);
  if (!dentro(rgb)) {
    let bajo = 0;
    let alto = c;
    for (let i = 0; i < 24; i++) {
      const medio = (bajo + alto) / 2;
      if (dentro(aLineal(medio))) bajo = medio;
      else alto = medio;
    }
    rgb = aLineal(bajo);
  }
  return (
    '#' +
    rgb
      .map((x) =>
        Math.round(gamma(Math.min(1, Math.max(0, x))) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** «#rrggbb» → sRGB lineal. */
export function linealDeHex(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [lineal(((n >> 16) & 255) / 255), lineal(((n >> 8) & 255) / 255), lineal((n & 255) / 255)];
}

/** «#rrggbb» → OKLab. */
export function oklabDeHex(hex: string): [number, number, number] {
  return linealAOklab(linealDeHex(hex));
}

/** Distancia entre dos colores en OKLab (0,02 apenas se nota; 0,1 se ve bien). */
export function distancia(a: string, b: string): number {
  const [l1, a1, b1] = oklabDeHex(a);
  const [l2, a2, b2] = oklabDeHex(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export type Daltonismo = 'protanopia' | 'deuteranopia' | 'tritanopia';

const MATRICES: Record<Daltonismo, readonly number[]> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039,
  ],
};

/** Cómo ve un color una persona con ese tipo de daltonismo (en «#rrggbb»). */
export function simularDaltonismo(hex: string, tipo: Daltonismo): string {
  const [r, g, b] = linealDeHex(hex);
  const m = MATRICES[tipo];
  const salida = [0, 1, 2].map((i) =>
    Math.min(1, Math.max(0, m[i * 3]! * r + m[i * 3 + 1]! * g + m[i * 3 + 2]! * b)),
  );
  return (
    '#' +
    salida
      .map((x) =>
        Math.round(gamma(x) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

const mezclar = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Rampa de n colores de «desde» (el valor más bajo) a «hasta» (el más alto). */
export function rampaSecuencial(n: number, desde: Oklch, hasta: Oklch): string[] {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 1 : i / (n - 1);
    return hexDeOklch([
      mezclar(desde[0], hasta[0], t),
      mezclar(desde[1], hasta[1], t),
      mezclar(desde[2], hasta[2], t),
    ]);
  });
}

/** Un brazo de una rampa divergente: su color más intenso y, si cambia, el tono de partida. */
export interface Brazo {
  extremo: Oklch;
  tonoInicial?: number;
}

/**
 * Rampa divergente: nBajo colores por debajo del centro (del más intenso al más suave) y nAlto
 * por encima (del más suave al más intenso). Cada brazo va del color del centro a su extremo;
 * el centro en sí no se usa, para que la clase más próxima ya tenga el tono de su lado.
 */
export function rampaDivergente(
  nBajo: number,
  nAlto: number,
  centro: Oklch,
  bajo: Brazo,
  alto: Brazo,
): string[] {
  const brazo = (n: number, { extremo, tonoInicial }: Brazo): string[] =>
    Array.from({ length: n }, (_, i) => {
      const t = (i + 1) / n;
      const tono = mezclar(tonoInicial ?? extremo[2], extremo[2], n === 1 ? 1 : i / (n - 1));
      return hexDeOklch([
        mezclar(centro[0], extremo[0], t),
        mezclar(centro[1], extremo[1], t),
        tono,
      ]);
    });
  return [...brazo(nBajo, bajo).reverse(), ...brazo(nAlto, alto)];
}
