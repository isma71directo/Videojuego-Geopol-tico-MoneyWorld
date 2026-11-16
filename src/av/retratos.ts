/**
 * Retratos ilustrados de los cargos (tareas f8-t3 y f8-t4, decisión del jugador): bustos, del
 * torso hacia arriba, dibujados con código en SVG. Nunca son fotografías.
 *
 * - Los líderes de 2010 de los países y figuras importantes tienen sus rasgos elegidos a mano
 *   (config/retratos-lideres.json): un homenaje e interpretación del personaje, reconocible por
 *   el pelo, la barba, las gafas, la ropa o el tocado.
 * - El resto lleva un retrato genérico según la región del país, el estilo de su régimen, el sexo
 *   y la edad de la persona, siempre igual para la misma persona.
 * - Cada cara es distinta (ajuste f8-a1): forma, ojos, nariz, boca, orejas, cejas, arrugas y matiz
 *   de la piel varían, sin exagerar rasgos.
 *
 * Lógica pura (devuelve el texto del SVG), con tests.
 */

import lideres from './config/retratos-lideres.json';

/** Tonos de piel, de claro a oscuro. */
export const PIELES = [
  '#f3d9c6',
  '#e9c3a3',
  '#dba67f',
  '#c88b65',
  '#a96f4c',
  '#8b573a',
  '#6c412b',
  '#51301f',
] as const;

export const COLORES_PELO = {
  negro: '#1f1a17',
  castanoOscuro: '#3b2a20',
  castano: '#5b3c28',
  castanoClaro: '#8a6142',
  rubio: '#c9a66b',
  pelirrojo: '#9a4b2b',
  canoso: '#8f8f8f',
  blanco: '#e3e3e3',
} as const;

export type EstiloPelo =
  | 'calvo'
  | 'entradas'
  | 'corto'
  | 'raya'
  | 'atras'
  | 'ondulado'
  | 'rizado'
  | 'melena'
  | 'largo'
  | 'recogido'
  /** Muy corto, casi rapado. */
  | 'cortito'
  /** Media melena en casco con flequillo recto. */
  | 'bob'
  /** Rizos cortos con volumen (permanente). */
  | 'permanente'
  /** Recogido atrás con una trenza como corona. */
  | 'trenza'
  /** Mucho volumen arriba (cardado). */
  | 'cardado';

export type Barba = 'ninguna' | 'bigote' | 'perilla' | 'corta' | 'larga';

export type Ropa =
  | 'traje'
  | 'traje-mujer'
  | 'uniforme'
  | 'tunica'
  | 'clerigo'
  | 'papa'
  | 'mao'
  | 'boubou'
  | 'camisa'
  /** Chaqueta sin corbata, con la camisa abierta. */
  | 'chaqueta'
  /** Túnica blanca con capa (bisht) de borde dorado. */
  | 'bisht'
  /** Capa de rayas de Asia central (chapan). */
  | 'chapan'
  /** Sari con el extremo (pallu) cruzado sobre el hombro. */
  | 'sari';

export type Tocado =
  | 'ninguno'
  | 'boina'
  | 'gorra-militar'
  | 'kufiya'
  | 'turbante'
  | 'solideo'
  | 'gorro'
  /** Gorro de piel de astracán, con pico. */
  | 'karakul'
  /** Sombrero de dama. */
  | 'sombrero'
  /** Pañuelo o extremo del sari sobre el pelo. */
  | 'velo';

export type FormaCara = 'ovalada' | 'redonda' | 'cuadrada' | 'afilada' | 'larga';
export type Ojos = 'normales' | 'almendrados' | 'rasgados' | 'grandes' | 'caidos';
export type Nariz = 'recta' | 'ancha' | 'aguilena' | 'pequena' | 'larga' | 'chata';
export type Labios = 'finos' | 'medios' | 'gruesos';
export type Orejas = 'pequenas' | 'normales' | 'grandes' | 'separadas';
export type Cejas = 'normales' | 'arqueadas' | 'pobladas' | 'rectas' | 'finas' | 'caidas';
export type Expresion = 'neutra' | 'leve' | 'sonrisa' | 'seria';
/** Matiz de la piel sobre su tono. */
export type Matiz = 'neutro' | 'oliva' | 'rosado' | 'dorado' | 'rojizo';

export const COLORES_OJOS = {
  marronOscuro: '#3a2618',
  marron: '#5a3a22',
  avellana: '#7a5a30',
  verde: '#5d7346',
  azul: '#4d6f95',
  gris: '#6c7680',
} as const;

export interface Rasgos {
  sexo: 'h' | 'm';
  /** Edad en 2010 (canas y arrugas). */
  edad: number;
  /** Posición en PIELES (puede tener decimales: un tono entre dos). */
  piel: number;
  pelo: EstiloPelo;
  colorPelo: string;
  barba: Barba;
  /** Color de la barba (por defecto, el del pelo). */
  colorBarba?: string;
  gafas: 'ninguna' | 'finas' | 'gruesas' | 'redondas' | 'sol';
  ropa: Ropa;
  /** Color principal de la ropa (chaqueta, uniforme, túnica…). */
  colorRopa: string;
  /** Corbata, blusa o detalle (pañuelo de la kufiya…). */
  colorDetalle: string;
  tocado: Tocado;
  colorTocado?: string;
  /** Gesto de la boca (por defecto, neutro). */
  expresion?: Expresion;
  /** Forma de las cejas (por defecto, normales). */
  cejas?: Cejas;
  /** Altura de las cejas (-1 a 1; por defecto, 0). */
  alturaCejas?: number;
  /** Forma de la cara (por defecto, ovalada). */
  cara?: FormaCara;
  /** Anchura y largo de la cabeza (en torno a 1). */
  anchoCara?: number;
  largoCara?: number;
  ojos?: Ojos;
  colorOjos?: string;
  /** Separación de los ojos (-1 a 1; por defecto, 0). */
  separacionOjos?: number;
  nariz?: Nariz;
  labios?: Labios;
  /** Anchura de la boca (en torno a 1). */
  anchoBoca?: number;
  orejas?: Orejas;
  matiz?: Matiz;
  /** Cuánto se notan las arrugas de la edad (en torno a 1). */
  arrugas?: number;
  /** Lunar en la mejilla. */
  lunar?: boolean;
  /** Collar de perlas. */
  collar?: boolean;
  /** El color del pelo y de la barba es el exacto (no encanece con la edad). */
  colorFijo?: boolean;
}

/** Oscurece o aclara un color «#rrggbb» (factor < 1, más oscuro). */
export function tono(hex: string, factor: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const canal = (c: number): string =>
    Math.max(0, Math.min(255, Math.round(c * factor)))
      .toString(16)
      .padStart(2, '0');
  return `#${canal((n >>> 16) & 255)}${canal((n >>> 8) & 255)}${canal(n & 255)}`;
}

/** Color del pelo según la edad: con los años, canoso y después blanco. */
export function peloConEdad(color: string, edad: number): string {
  if (edad >= 72) return COLORES_PELO.blanco;
  if (edad >= 62) return COLORES_PELO.canoso;
  if (edad >= 55) return mezclar(color, COLORES_PELO.canoso, 0.45);
  return color;
}

function mezclar(a: string, b: string, t: number): string {
  const na = Number.parseInt(a.slice(1), 16);
  const nb = Number.parseInt(b.slice(1), 16);
  const canal = (d: number): string =>
    Math.round(((na >> d) & 255) * (1 - t) + ((nb >> d) & 255) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${canal(16)}${canal(8)}${canal(0)}`;
}

/** Número corto para el SVG (dos decimales como mucho). */
const f = (n: number): string => (Math.round(n * 100) / 100).toString();

// ── Partes del dibujo (viewBox 0 0 100 100) ──────────────────────────────────────────────────

function cuerpo(r: Rasgos, piel: string): string {
  const ropa = r.colorRopa;
  const oscuro = tono(ropa, 0.75);
  // Cuello algo más estrecho que la cara, con la sombra de la barbilla.
  const mitad = (r.sexo === 'm' ? 4.6 : 5.4) * (r.anchoCara ?? 1);
  const cuello =
    `<path d="M${f(50 - mitad)} 55 C${f(50 - mitad)} 62 ${f(49.4 - mitad)} 66 ${f(48 - mitad)} 70 L${f(52 + mitad)} 70 C${f(50.6 + mitad)} 66 ${f(50 + mitad)} 62 ${f(50 + mitad)} 55 Z" fill="${tono(piel, 0.9)}"/>` +
    `<path d="M${f(50 - mitad)} 58.5 Q50 64.5 ${f(50 + mitad)} 58.5 L${f(50 + mitad)} 61 Q50 66.5 ${f(50 - mitad)} 61 Z" fill="${tono(piel, 0.72)}" opacity="0.55"/>`;
  const hombros = (color: string): string =>
    `<path d="M6 100 C8 82 24 72 40 69 L60 69 C76 72 92 82 94 100 Z" fill="${color}"/>`;
  switch (r.ropa) {
    case 'traje':
      return (
        cuello +
        hombros(ropa) +
        '<path d="M41 69 L50 88 L59 69 Z" fill="#f4f4f2"/>' +
        `<path d="M48.4 71 L51.6 71 L53 86 L50 90 L47 86 Z" fill="${r.colorDetalle}"/>` +
        `<path d="M40 69 L50 90 L44 100 L33 74 Z M60 69 L50 90 L56 100 L67 74 Z" fill="${oscuro}" opacity="0.55"/>`
      );
    case 'traje-mujer':
      return (
        cuello +
        hombros(ropa) +
        `<path d="M41 69 Q50 84 59 69 Z" fill="${r.colorDetalle}"/>` +
        `<path d="M40 69 L50 86 L45 100 L33 74 Z M60 69 L50 86 L55 100 L67 74 Z" fill="${oscuro}" opacity="0.5"/>`
      );
    case 'uniforme':
      return (
        cuello +
        hombros(ropa) +
        '<path d="M43 69 L50 80 L57 69 Z" fill="#e9e4d4"/>' +
        `<path d="M48.6 71 L51.4 71 L52.6 82 L50 85 L47.4 82 Z" fill="${tono(ropa, 0.5)}"/>` +
        `<path d="M16 79 L30 73 L32 77 L18 83 Z M84 79 L70 73 L68 77 L82 83 Z" fill="${r.colorDetalle}"/>` +
        `<rect x="31" y="84" width="9" height="3" rx="1" fill="${r.colorDetalle}"/>` +
        '<rect x="31" y="88" width="9" height="3" rx="1" fill="#b23b3b"/>'
      );
    case 'tunica':
      return (
        cuello +
        hombros(ropa) +
        `<path d="M44 69 L50 76 L56 69" fill="none" stroke="${tono(ropa, 0.8)}" stroke-width="1.5"/>` +
        `<line x1="50" y1="76" x2="50" y2="100" stroke="${tono(ropa, 0.85)}" stroke-width="1"/>`
      );
    case 'clerigo':
      return (
        cuello +
        hombros(r.colorDetalle) +
        `<path d="M6 100 C8 82 22 73 36 70 L44 100 Z M94 100 C92 82 78 73 64 70 L56 100 Z" fill="${ropa}"/>`
      );
    case 'papa':
      return (
        cuello +
        hombros(ropa) +
        `<path d="M20 78 C30 70 70 70 80 78 L76 88 C64 82 36 82 24 88 Z" fill="${tono(ropa, 0.94)}"/>` +
        `<line x1="50" y1="80" x2="50" y2="96" stroke="${r.colorDetalle}" stroke-width="1.6"/>` +
        `<line x1="45.5" y1="85" x2="54.5" y2="85" stroke="${r.colorDetalle}" stroke-width="1.6"/>`
      );
    case 'mao':
      return (
        cuello +
        hombros(ropa) +
        `<path d="M42 68 L58 68 L57 73 L43 73 Z" fill="${oscuro}"/>` +
        `<line x1="50" y1="73" x2="50" y2="100" stroke="${oscuro}" stroke-width="0.8"/>` +
        [78, 85, 92]
          .map((y) => `<circle cx="50" cy="${y}" r="1" fill="${tono(ropa, 0.6)}"/>`)
          .join('')
      );
    case 'boubou':
      return (
        cuello +
        hombros(ropa) +
        `<path d="M42 69 Q50 82 58 69" fill="none" stroke="${r.colorDetalle}" stroke-width="2.4"/>` +
        `<path d="M46 76 Q50 90 54 76" fill="none" stroke="${r.colorDetalle}" stroke-width="1.4"/>`
      );
    case 'camisa':
      return (
        cuello +
        hombros(ropa) +
        `<path d="M42 69 L50 79 L45 81 Z M58 69 L50 79 L55 81 Z" fill="${tono(ropa, 0.8)}"/>` +
        `<line x1="50" y1="79" x2="50" y2="100" stroke="${tono(ropa, 0.75)}" stroke-width="0.8"/>`
      );
    case 'chaqueta':
      return (
        cuello +
        hombros(ropa) +
        `<path d="M42 69 L50 81 L58 69 Z" fill="${r.colorDetalle}"/>` +
        `<path d="M42 69 L46 73 L44.5 76 Z M58 69 L54 73 L55.5 76 Z" fill="${tono(r.colorDetalle, 0.85)}"/>` +
        `<path d="M40 69 L50 86 L44 100 L33 74 Z M60 69 L50 86 L56 100 L67 74 Z" fill="${oscuro}" opacity="0.55"/>`
      );
    case 'bisht':
      return (
        cuello +
        hombros(ropa) +
        `<path d="M40 69 L60 69 L57 100 L43 100 Z" fill="${r.colorDetalle}"/>` +
        `<path d="M44 69 Q50 74 56 69" fill="none" stroke="${tono(r.colorDetalle, 0.85)}" stroke-width="1"/>` +
        '<path d="M40 69 L43 100 M60 69 L57 100" fill="none" stroke="#c9a64a" stroke-width="1.6"/>'
      );
    case 'chapan': {
      const rayas: string[] = [];
      for (let x = 9; x <= 91; x += 4.5) {
        if (x > 38 && x < 62) continue;
        const arriba = x < 50 ? 69 + (40 - x) * 0.72 : 69 + (x - 60) * 0.72;
        rayas.push(`M${x.toFixed(1)} ${arriba.toFixed(1)} L${x.toFixed(1)} 100`);
      }
      return (
        cuello +
        hombros(ropa) +
        `<path d="${rayas.join(' ')}" stroke="${r.colorDetalle}" stroke-width="1.5"/>` +
        '<path d="M42 69 L58 69 L55 100 L45 100 Z" fill="#ece8dc"/>' +
        `<path d="M40 69 L45 100 M60 69 L55 100" stroke="${tono(ropa, 0.6)}" stroke-width="1.4"/>`
      );
    }
    case 'sari':
      return (
        cuello +
        hombros(ropa) +
        `<path d="M42 69 Q50 76 58 69 Z" fill="${tono(ropa, 0.85)}"/>` +
        `<path d="M57 68.5 L71 71.5 L47 100 L32 100 Z" fill="${r.colorDetalle}"/>` +
        `<path d="M71 71.5 L47 100" stroke="#c9a64a" stroke-width="1.4"/>`
      );
  }
}

/** Collar de perlas. */
function collar(): string {
  const perlas: string[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = 41.5 + t * 17;
    const y = 69.6 + Math.sin(t * Math.PI) * 4.6;
    perlas.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.15" fill="#f3efe4"/>`);
  }
  return perlas.join('');
}

/** Pelo que queda detrás de la cabeza (melenas largas). */
function peloDetras(r: Rasgos, color: string): string {
  if (r.pelo === 'largo') {
    return `<path d="M32 40 C30 20 70 20 68 40 L71 72 C64 76 36 76 29 72 Z" fill="${color}"/>`;
  }
  if (r.pelo === 'melena') {
    return `<path d="M33 40 C31 21 69 21 67 40 L68 58 C62 61 38 61 32 58 Z" fill="${color}"/>`;
  }
  if (r.pelo === 'bob') {
    return `<path d="M33 40 C31 21 69 21 67 40 L67.5 52 C62 54 38 54 32.5 52 Z" fill="${color}"/>`;
  }
  return '';
}

/** Pañuelo o sari sobre la cabeza: la parte que cae por detrás. */
function veloDetras(r: Rasgos): string {
  if (r.tocado !== 'velo') return '';
  const color = r.colorTocado ?? r.colorDetalle;
  return `<path d="M32 46 C28.5 15 71.5 15 68 46 L71 72 C62 67 38 67 29 72 Z" fill="${tono(color, 0.9)}"/>`;
}

/** Color de la piel: el tono de PIELES (con decimales, entre dos) y su matiz. */
export function colorPiel(piel: number, matiz: Matiz = 'neutro'): string {
  const p = Math.max(0, Math.min(PIELES.length - 1, piel));
  const i = Math.min(PIELES.length - 2, Math.floor(p));
  const base = mezclar(PIELES[i]!, PIELES[i + 1]!, p - i);
  const MATICES: Record<Matiz, string | null> = {
    neutro: null,
    oliva: '#a89060',
    rosado: '#e8a090',
    dorado: '#c8903c',
    rojizo: '#9a4a30',
  };
  const m = MATICES[matiz];
  return m ? mezclar(base, m, 0.12) : base;
}

/** Contorno de la cara: arriba, media elipse; abajo, la mandíbula según la forma. */
const CONTORNOS: Record<
  FormaCara,
  { c1: [number, number]; c2: [number, number]; barbilla: number }
> = {
  ovalada: { c1: [64.5, 51.9], c2: [58, 60], barbilla: 60 },
  redonda: { c1: [65.2, 54.6], c2: [59.6, 60.4], barbilla: 60.2 },
  cuadrada: { c1: [64.7, 57.2], c2: [56.4, 60.8], barbilla: 60.5 },
  afilada: { c1: [63.8, 50.4], c2: [55.2, 59.6], barbilla: 60.9 },
  larga: { c1: [64.3, 55.2], c2: [57, 62.2], barbilla: 62 },
};

function contorno(forma: FormaCara): string {
  const { c1, c2, barbilla } = CONTORNOS[forma];
  return (
    `M35.5 42 C35.5 32 42 24 50 24 C58 24 64.5 32 64.5 42 ` +
    `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} 50 ${barbilla} ` +
    `C${f(100 - c2[0])} ${c2[1]} ${f(100 - c1[0])} ${c1[1]} 35.5 42 Z`
  );
}

const OREJAS: Record<Orejas, { rx: number; ry: number; fuera: number }> = {
  pequenas: { rx: 2.5, ry: 3.7, fuera: 0 },
  normales: { rx: 3, ry: 4.3, fuera: 0 },
  grandes: { rx: 3.4, ry: 5, fuera: 0.3 },
  separadas: { rx: 3.5, ry: 4.6, fuera: 1.3 },
};

function cabeza(r: Rasgos, piel: string): string {
  const sombra = tono(piel, 0.86);
  const o = OREJAS[r.orejas ?? 'normales'];
  const oreja = (lado: number): string => {
    const cx = 50 + lado * (14.5 + o.fuera);
    return (
      `<ellipse cx="${f(cx)}" cy="44" rx="${o.rx}" ry="${o.ry}" fill="${sombra}"/>` +
      `<path d="M${f(cx - lado * 0.6)} ${f(44 - o.ry * 0.6)} Q${f(cx + lado * 1.1)} 44 ${f(cx - lado * 0.4)} ${f(44 + o.ry * 0.6)}" fill="none" stroke="${tono(piel, 0.68)}" stroke-width="0.5"/>`
    );
  };
  return oreja(-1) + oreja(1) + `<path d="${contorno(r.cara ?? 'ovalada')}" fill="${piel}"/>`;
}

/** Cejas (la izquierda; la derecha es su reflejo): punto interior, control y exterior. */
const CEJAS: Record<
  Cejas,
  { puntos: [number, number, number, number, number, number]; grosor: number }
> = {
  normales: { puntos: [47.2, 37.6, 44.2, 36.2, 41, 37.6], grosor: 1.1 },
  // Más altas por dentro, en ángulo.
  arqueadas: { puntos: [47.4, 35.6, 44, 37.2, 41, 38], grosor: 1.1 },
  pobladas: { puntos: [47.4, 37.2, 44.2, 36.4, 40.8, 37.4], grosor: 2 },
  rectas: { puntos: [47.3, 37.3, 44.2, 36.9, 41, 37.4], grosor: 1.25 },
  finas: { puntos: [47.1, 37.5, 44, 35.8, 41.1, 37.4], grosor: 0.7 },
  // Caídas por fuera.
  caidas: { puntos: [47.2, 36.9, 44.4, 36.1, 41.2, 38.5], grosor: 1.15 },
};

const OJOS: Record<
  Ojos,
  { ancho: number; arriba: number; abajo: number; caida: number; iris: number; pliegue: boolean }
> = {
  normales: { ancho: 2.2, arriba: 1.7, abajo: 1.3, caida: 0, iris: 1.05, pliegue: true },
  almendrados: { ancho: 2.5, arriba: 1.6, abajo: 1.1, caida: -0.35, iris: 1.05, pliegue: true },
  rasgados: { ancho: 2.3, arriba: 1, abajo: 0.9, caida: -0.25, iris: 0.95, pliegue: false },
  grandes: { ancho: 2.4, arriba: 2, abajo: 1.6, caida: 0, iris: 1.2, pliegue: true },
  caidos: { ancho: 2.3, arriba: 1.5, abajo: 1.2, caida: 0.45, iris: 1.05, pliegue: true },
};

const NARICES: Record<Nariz, { ancho: number; base: number; puente: number }> = {
  recta: { ancho: 2.3, base: 50.3, puente: 0.6 },
  ancha: { ancho: 3.3, base: 50.4, puente: 0.5 },
  // Con caballete.
  aguilena: { ancho: 2.4, base: 50.6, puente: 1.9 },
  pequena: { ancho: 1.8, base: 49.6, puente: 0.4 },
  larga: { ancho: 2.3, base: 51.4, puente: 0.8 },
  chata: { ancho: 3, base: 49.8, puente: 0.2 },
};

/** Grosor de los labios: superior e inferior. */
const LABIOS: Record<Labios, [number, number]> = {
  finos: [0.45, 0.6],
  medios: [0.8, 1.05],
  gruesos: [1.25, 1.6],
};

/** Posición de las comisuras y del centro de la boca según el gesto. */
const GESTOS: Record<Expresion, { comisura: number; centro: number }> = {
  neutra: { comisura: 0, centro: 0.35 },
  leve: { comisura: -0.4, centro: 0.65 },
  sonrisa: { comisura: -0.8, centro: 1.3 },
  // Comisuras hacia abajo.
  seria: { comisura: 0.9, centro: -0.25 },
};

function ojo(cx: number, lado: number, r: Rasgos, piel: string): string {
  const o = OJOS[r.ojos ?? 'normales'];
  const y = 41.6;
  const xi = cx - lado * o.ancho;
  const xe = cx + lado * o.ancho;
  const ye = y + o.caida;
  const arriba = y - 2 * o.arriba;
  const abajo = y + 2 * o.abajo;
  const blanco = r.piel >= 4.5 ? '#eee6da' : '#f6f2ec';
  const iris = r.colorOjos ?? COLORES_OJOS.marronOscuro;
  const ry = Math.min(o.iris, ((o.arriba + o.abajo) / 2) * 0.95);
  const parpado = tono(piel, 0.42);
  return (
    `<path d="M${f(xi)} ${y} Q${f(cx)} ${f(arriba)} ${f(xe)} ${f(ye)} Q${f(cx)} ${f(abajo)} ${f(xi)} ${y} Z" fill="${blanco}"/>` +
    `<ellipse cx="${f(cx)}" cy="${f(y + 0.05)}" rx="${o.iris}" ry="${f(ry)}" fill="${iris}"/>` +
    `<circle cx="${f(cx)}" cy="${f(y + 0.05)}" r="${f(ry * 0.48)}" fill="#17110d"/>` +
    `<circle cx="${f(cx + 0.35)}" cy="${f(y - 0.3)}" r="0.28" fill="#ffffff" opacity="0.8"/>` +
    `<path d="M${f(xi)} ${y} Q${f(cx)} ${f(arriba)} ${f(xe)} ${f(ye)}" fill="none" stroke="${parpado}" stroke-width="0.8" stroke-linecap="round"/>` +
    (o.pliegue
      ? `<path d="M${f(cx - lado * o.ancho * 0.8)} ${f(y - o.arriba - 0.9)} Q${f(cx)} ${f(y - 2 * o.arriba - 1.1)} ${f(cx + lado * o.ancho * 0.85)} ${f(y - o.arriba - 0.7 + o.caida * 0.5)}" fill="none" stroke="${tono(piel, 0.78)}" stroke-width="0.45"/>`
      : '')
  );
}

function cejas(r: Rasgos, pelo: string): string {
  const c = CEJAS[r.cejas ?? 'normales'];
  const dy = (r.alturaCejas ?? 0) * 0.6;
  const [xi, yi, xc, yc, xe, ye] = c.puntos;
  const izquierda = `M${xi} ${f(yi + dy)} Q${xc} ${f(yc + dy)} ${xe} ${f(ye + dy)}`;
  const derecha = `M${f(100 - xi)} ${f(yi + dy)} Q${f(100 - xc)} ${f(yc + dy)} ${f(100 - xe)} ${f(ye + dy)}`;
  const grosor = c.grosor + (r.edad >= 60 && r.cejas !== 'finas' ? 0.2 : 0);
  return `<path d="${izquierda} ${derecha}" fill="none" stroke="${tono(pelo, 0.9)}" stroke-width="${f(grosor)}" stroke-linecap="round"/>`;
}

function nariz(r: Rasgos, piel: string): string {
  const n = NARICES[r.nariz ?? 'recta'];
  const linea = tono(piel, 0.62);
  const b = n.base;
  return (
    `<path d="M50.8 43.6 Q${f(50.8 + n.puente)} ${f((43.6 + b) / 2)} ${f(50 + n.ancho * 0.55)} ${f(b - 1)}" fill="none" stroke="${linea}" stroke-width="0.7" stroke-linecap="round" opacity="0.75"/>` +
    `<path d="M${f(50 - n.ancho)} ${f(b - 0.7)} Q${f(50 - n.ancho + 0.3)} ${f(b + 0.9)} 50 ${f(b + 0.6)} Q${f(50 + n.ancho - 0.3)} ${f(b + 0.9)} ${f(50 + n.ancho)} ${f(b - 0.7)}" fill="none" stroke="${linea}" stroke-width="0.8" stroke-linecap="round"/>` +
    `<ellipse cx="${f(50 - n.ancho * 0.45)}" cy="${f(b + 0.15)}" rx="0.55" ry="0.35" fill="${tono(piel, 0.45)}"/>` +
    `<ellipse cx="${f(50 + n.ancho * 0.45)}" cy="${f(b + 0.15)}" rx="0.55" ry="0.35" fill="${tono(piel, 0.45)}"/>`
  );
}

/** Altura de la boca: un poco más abajo si la nariz es larga. */
const alturaBoca = (r: Rasgos): number => 54.6 + (NARICES[r.nariz ?? 'recta'].base - 50.3) * 0.5;

function boca(r: Rasgos, piel: string): string {
  const [arriba, abajo] = LABIOS[r.labios ?? 'medios'];
  const g = GESTOS[r.expresion ?? 'neutra'];
  const w = 4.4 * (r.anchoBoca ?? 1);
  const y = alturaBoca(r);
  const yc = y + g.comisura;
  const ym = y + g.centro;
  const control = 2 * ym - yc;
  const xi = 50 - w;
  const xd = 50 + w;
  const labio = mezclar(tono(piel, 0.86), '#a8504a', r.piel < 4 ? 0.3 : 0.15);
  const superior =
    `<path d="M${f(xi)} ${f(yc)} C${f(50 - w * 0.6)} ${f(yc - arriba * 1.1)} 48.8 ${f(ym - arriba * 1.5)} 50 ${f(ym - arriba * 1.05)} ` +
    `C51.2 ${f(ym - arriba * 1.5)} ${f(50 + w * 0.6)} ${f(yc - arriba * 1.1)} ${f(xd)} ${f(yc)} Q50 ${f(control)} ${f(xi)} ${f(yc)} Z" fill="${tono(labio, 0.9)}"/>`;
  const abierta = r.expresion === 'sonrisa' ? 1.1 : 0;
  const dientes = abierta
    ? `<path d="M${f(xi + 0.3)} ${f(yc)} Q50 ${f(control)} ${f(xd - 0.3)} ${f(yc)} Q50 ${f(control + 2 * abierta)} ${f(xi + 0.3)} ${f(yc)} Z" fill="#f3efe6"/>`
    : '';
  const inferior = `<path d="M${f(xi + 0.4)} ${f(yc + abierta * 0.3)} Q50 ${f(control + 2 * abierta)} ${f(xd - 0.4)} ${f(yc + abierta * 0.3)} Q50 ${f(control + 2 * abierta + abajo * 2.2)} ${f(xi + 0.4)} ${f(yc + abierta * 0.3)} Z" fill="${labio}"/>`;
  const linea = `<path d="M${f(xi)} ${f(yc)} Q50 ${f(control)} ${f(xd)} ${f(yc)}" fill="none" stroke="${tono(piel, 0.45)}" stroke-width="0.7" stroke-linecap="round"/>`;
  return superior + inferior + dientes + linea;
}

/** Arrugas de la edad: surcos, frente, bolsas, patas de gallo y papada. */
function arrugas(r: Rasgos, piel: string): string {
  const a = r.arrugas ?? 1;
  const color = tono(piel, 0.8);
  const n = NARICES[r.nariz ?? 'recta'];
  const y = alturaBoca(r);
  const w = 4.4 * (r.anchoBoca ?? 1);
  const trazo = (d: string, desde: number, hasta: number): string => {
    if (r.edad < desde) return '';
    const opacidad = Math.min(1, ((r.edad - desde) / (hasta - desde)) * a);
    return opacidad > 0.05
      ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="0.55" stroke-linecap="round" opacity="${f(opacidad)}"/>`
      : '';
  };
  const surcos = [-1, 1]
    .map(
      (l) =>
        `M${f(50 + l * (n.ancho + 0.7))} ${f(n.base - 0.3)} Q${f(50 + l * (n.ancho + 2.6))} ${f(n.base + 2.4)} ${f(50 + l * (w + 0.7))} ${f(y + 0.8)}`,
    )
    .join(' ');
  return (
    trazo(surcos, 38, 62) +
    trazo('M43 31.5 Q50 30 57 31.5 M44.5 34 Q50 33 55.5 34', 50, 70) +
    trazo('M41.6 45.4 Q44.2 46.6 46.6 45.4 M53.4 45.4 Q55.8 46.6 58.4 45.4', 52, 72) +
    trazo(
      'M39.2 41.2 L37.8 40.4 M39.2 42.4 L37.7 42.9 M60.8 41.2 L62.2 40.4 M60.8 42.4 L62.3 42.9',
      58,
      75,
    ) +
    trazo('M40.5 52.5 Q41.4 56.6 44.2 58.4 M59.5 52.5 Q58.6 56.6 55.8 58.4', 64, 82)
  );
}

function cara(r: Rasgos, piel: string, pelo: string): string {
  const sep = (r.separacionOjos ?? 0) * 0.5;
  const rubor =
    r.sexo === 'm' || r.edad < 40
      ? `<ellipse cx="42.6" cy="48.6" rx="2.6" ry="1.6" fill="#e07a6a" opacity="${r.piel >= 4.5 ? 0.07 : 0.13}"/><ellipse cx="57.4" cy="48.6" rx="2.6" ry="1.6" fill="#e07a6a" opacity="${r.piel >= 4.5 ? 0.07 : 0.13}"/>`
      : '';
  const lunar = r.lunar
    ? `<circle cx="${f(57.6 + (semilla(pelo) % 3))}" cy="${f(49.5 + (semilla(piel) % 3) * 0.8)}" r="0.5" fill="${tono(piel, 0.5)}"/>`
    : '';
  return (
    rubor +
    arrugas(r, piel) +
    cejas(r, pelo) +
    ojo(44.2 - sep, -1, r, piel) +
    ojo(55.8 + sep, 1, r, piel) +
    nariz(r, piel) +
    boca(r, piel) +
    lunar
  );
}

/** Trenza en corona: óvalos inclinados a lo largo de un arco sobre la cabeza. */
function trenza(color: string): string {
  // Curva de Bézier (35.6,34) (36,17) (64,17) (64.4,34).
  const punto = (t: number, a: number, b: number, c: number, d: number): number =>
    (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
  const ovalos: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = punto(t, 35.6, 36, 64, 64.4);
    const y = punto(t, 34, 17, 17, 34);
    const dx = punto(t + 0.01, 35.6, 36, 64, 64.4) - x;
    const dy = punto(t + 0.01, 34, 17, 17, 34) - y;
    const angulo = (Math.atan2(dy, dx) * 180) / Math.PI + (i % 2 === 0 ? 35 : -35);
    ovalos.push(
      `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="2.7" ry="1.7" transform="rotate(${angulo.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${color}" stroke="${tono(color, 0.7)}" stroke-width="0.5"/>`,
    );
  }
  return ovalos.join('');
}

function peloDelante(r: Rasgos, color: string): string {
  switch (r.pelo) {
    case 'calvo':
      return `<path d="M35.5 45 C35 38 37 34 38.5 33 L39 44 Z M64.5 45 C65 38 63 34 61.5 33 L61 44 Z" fill="${color}"/>`;
    case 'entradas':
      return `<path d="M35.5 44 C34.5 30 40 24 45 24.5 C47 28 53 28 55 24.5 C60 24 65.5 30 64.5 44 C63 38 61 33 58 31 C55 31 52 30.5 50 31.5 C48 30.5 45 31 42 31 C39 33 37 38 35.5 44 Z" fill="${color}"/>`;
    case 'corto':
      return `<path d="M35.4 42 C34.5 27 42 22.5 50 22.5 C58 22.5 65.5 27 64.6 42 C63 34 58 29.5 50 29.5 C42 29.5 37 34 35.4 42 Z" fill="${color}"/>`;
    case 'raya':
      return (
        `<path d="M35.4 42 C34 27 42 22 50 22 C59 22 66 27 64.6 42 C63.5 34 61 30 55 28.8 C48 28 40 30.5 35.4 42 Z" fill="${color}"/>` +
        `<path d="M44 23.5 Q45 26 46 29" fill="none" stroke="${tono(color, 1.35)}" stroke-width="0.6"/>`
      );
    case 'atras':
      return `<path d="M35.4 40 C34.5 25 42 21.5 50 21.5 C58 21.5 65.5 25 64.6 40 C62 31 57 27.5 50 27.5 C43 27.5 38 31 35.4 40 Z" fill="${color}"/>`;
    case 'ondulado':
      return `<path d="M34.6 43 C32 26 41 20 50 20.5 C60 20 68 26 65.4 43 C64 37 62 34 60 32 C57 30.5 54 31.5 52 29.5 C49 31.5 46 30.5 44 31.5 C40 31 37 36 34.6 43 Z" fill="${color}"/>`;
    case 'rizado':
      return (
        `<path d="M35.4 41 C34.5 27 42 23.5 50 23.5 C58 23.5 65.5 27 64.6 41 C63 34 58 30.5 50 30.5 C42 30.5 37 34 35.4 41 Z" fill="${color}"/>` +
        [37, 43, 50, 57, 63]
          .map(
            (x) =>
              `<circle cx="${x}" cy="${x === 50 ? 23.6 : x < 40 || x > 60 ? 28 : 24.6}" r="2.6" fill="${color}"/>`,
          )
          .join('')
      );
    case 'melena':
    case 'largo':
      return `<path d="M35 43 C33 25 42 21 50 21 C59 21 67 25 65 43 C63 34 60 29 54 28 C50 31 43 32 38 33 C36 36 35.4 39 35 43 Z" fill="${color}"/>`;
    case 'cortito':
      return `<path d="M35.6 40 C35 27.5 42 23.6 50 23.6 C58 23.6 65 27.5 64.4 40 C63 33.5 58 30.4 50 30.4 C42 30.4 37 33.5 35.6 40 Z" fill="${color}"/>`;
    case 'bob':
      return `<path d="M33.6 51 C31 29 38 20.5 50 20.5 C62 20.5 69 29 66.4 51 L62.8 51 C63.2 43 62.6 38 61.4 34.6 C56 33.2 44 33.2 38.6 34.6 C37.4 38 36.8 43 37.2 51 Z" fill="${color}"/>`;
    case 'permanente':
      return (
        `<path d="M35 42 C33.5 26 41 21.5 50 21.5 C59 21.5 66.5 26 65 42 C63 34 58 30 50 30 C42 30 37 34 35 42 Z" fill="${color}"/>` +
        [
          [35, 31],
          [33.8, 37.5],
          [34.6, 43.5],
          [65, 31],
          [66.2, 37.5],
          [65.4, 43.5],
          [39.5, 25],
          [45, 21.8],
          [50.5, 20.8],
          [56, 21.8],
          [61, 25],
        ]
          .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.7" fill="${color}"/>`)
          .join('')
      );
    case 'trenza':
      return (
        `<path d="M35.4 40 C34.5 25 42 21.5 50 21.5 C58 21.5 65.5 25 64.6 40 C62 31 57 27.5 50 27.5 C43 27.5 38 31 35.4 40 Z" fill="${color}"/>` +
        trenza(color)
      );
    case 'cardado':
      return `<path d="M35 41 C32.5 22 37 12.5 50 12.5 C63 12.5 67.5 22 65 41 C63 33 58 29.5 50 29.5 C42 29.5 37 33 35 41 Z" fill="${color}"/>`;
    case 'recogido':
      return (
        (r.tocado === 'velo' ? '' : `<circle cx="50" cy="20" r="5.5" fill="${color}"/>`) +
        `<path d="M35.4 42 C34.5 27 42 23 50 23 C58 23 65.5 27 64.6 42 C63 34 58 29 50 29 C42 29 37 34 35.4 42 Z" fill="${color}"/>`
      );
  }
}

function barba(r: Rasgos, color: string): string {
  switch (r.barba) {
    case 'ninguna':
      return '';
    case 'bigote':
      return `<path d="M44.6 52.6 Q50 50.2 55.4 52.6 Q50 54 44.6 52.6 Z" fill="${color}"/>`;
    case 'perilla':
      return (
        `<path d="M45 52.6 Q50 50.6 55 52.6 Q50 53.8 45 52.6 Z" fill="${color}"/>` +
        `<path d="M46.5 57 Q50 59 53.5 57 L52.5 61.5 Q50 62.6 47.5 61.5 Z" fill="${color}"/>`
      );
    case 'corta':
      return `<path d="M36 44 C36.5 56 42 61 50 61.5 C58 61 63.5 56 64 44 C62 52 58 55 55 55.6 Q50 57.4 45 55.6 C42 55 38 52 36 44 Z M44.6 52.8 Q50 50.4 55.4 52.8 Q50 54 44.6 52.8 Z" fill="${color}"/>`;
    case 'larga':
      return `<path d="M35.6 43 C35.6 60 41 67.5 50 68.5 C59 67.5 64.4 60 64.4 43 C62.5 52 58.5 55 55 55.6 Q50 57.4 45 55.6 C41.5 55 37.5 52 35.6 43 Z M44.6 52.8 Q50 50.4 55.4 52.8 Q50 54 44.6 52.8 Z" fill="${color}"/>`;
  }
}

function gafas(r: Rasgos): string {
  if (r.gafas === 'ninguna') return '';
  if (r.gafas === 'redondas') {
    return '<g fill="none" stroke="#4a4a4a" stroke-width="0.8"><circle cx="44.2" cy="41.6" r="3.6"/><circle cx="55.8" cy="41.6" r="3.6"/><path d="M47.8 41.2 L52.2 41.2"/></g>';
  }
  if (r.gafas === 'sol') {
    return '<g fill="#161616" stroke="#0d0d0d" stroke-width="0.9"><rect x="39.4" y="38.6" width="9.4" height="6.2" rx="2.6"/><rect x="51.2" y="38.6" width="9.4" height="6.2" rx="2.6"/><path d="M48.8 41.2 L51.2 41.2" fill="none"/></g>';
  }
  const grosor = r.gafas === 'gruesas' ? 1.5 : 0.8;
  const color = r.gafas === 'gruesas' ? '#1d1d1d' : '#5d5d5d';
  return `<g fill="none" stroke="${color}" stroke-width="${grosor}"><rect x="39.6" y="38.8" width="9" height="6" rx="2.4"/><rect x="51.4" y="38.8" width="9" height="6" rx="2.4"/><path d="M48.6 41.4 L51.4 41.4"/></g>`;
}

function tocado(r: Rasgos): string {
  const color = r.colorTocado ?? '#222';
  switch (r.tocado) {
    case 'ninguno':
      return '';
    case 'boina':
      return `<path d="M33 31 C33 21 46 17.5 56 18.5 C66 19.5 70 26 67 31 C58 27.5 42 27.5 33 31 Z" fill="${color}"/>`;
    case 'gorra-militar':
      return (
        `<path d="M33 30 C33 17 67 17 67 30 Z" fill="${color}"/>` +
        `<path d="M34 30 L66 30 L68 34 L32 34 Z" fill="${tono(color, 0.6)}"/>` +
        '<circle cx="50" cy="25" r="2" fill="#d4b24c"/>'
      );
    case 'kufiya':
      return (
        `<path d="M31 46 C29 21 71 21 69 46 L76 80 C64 72 58 66 57 58 C60 52 61 44 60 36 C55 30 45 30 40 36 C39 44 40 52 43 58 C42 66 36 72 24 80 Z" fill="${color}"/>` +
        `<path d="M33.5 30 C40 25 60 25 66.5 30" fill="none" stroke="${r.colorDetalle}" stroke-width="2.2"/>` +
        '<path d="M34 33 C40 28.5 60 28.5 66 33" fill="none" stroke="#1d1d1d" stroke-width="2"/>'
      );
    case 'turbante': {
      const vuelta = mezclar(color, '#ffffff', 0.22);
      return (
        `<path d="M32.4 35 C28 12.5 72 12.5 67.6 35 C60 30.5 40 30.5 32.4 35 Z" fill="${color}"/>` +
        `<path d="M34.5 29 Q50 20 65.5 29 M36.5 23.5 Q50 17 63.5 23.5" fill="none" stroke="${vuelta}" stroke-width="0.9"/>` +
        `<path d="M50 31 L47 18.5 M50 31 L53 18.5" fill="none" stroke="${vuelta}" stroke-width="0.7"/>`
      );
    }
    case 'solideo':
      return `<path d="M41 25 C43 20.5 57 20.5 59 25 Q50 23.5 41 25 Z" fill="${color}"/>`;
    case 'gorro':
      return `<path d="M35 31 C35 20 65 20 65 31 Z" fill="${color}"/>`;
    case 'karakul':
      return (
        `<path d="M35 31.5 L36.6 19.5 Q50 13.6 63.4 19.5 L65 31.5 Q50 28.6 35 31.5 Z" fill="${color}"/>` +
        `<path d="M50 15.2 L50 29.4" stroke="${tono(color, 0.7)}" stroke-width="1.2"/>` +
        `<path d="M38 24 h2 M43 21 h2 M55 21 h2 M60 24 h2 M39 28 h2 M58 28 h2 M44 26 h2 M54 26 h2" stroke="${tono(color, 1.25)}" stroke-width="1.2" stroke-linecap="round"/>`
      );
    case 'sombrero':
      return (
        `<path d="M36 25.5 C36 11 64 11 64 25.5 Z" fill="${color}"/>` +
        `<path d="M36.1 21.8 L63.9 21.8 L64 25.5 L36 25.5 Z" fill="${tono(color, 0.75)}"/>` +
        `<ellipse cx="50" cy="25.8" rx="20" ry="3.2" fill="${color}"/>`
      );
    case 'velo':
      return `<path d="M33.6 42 C31 16.5 69 16.5 66.4 42 C63 31.5 57 27.4 50 27.4 C43 27.4 37 31.5 33.6 42 Z" fill="${r.colorTocado ?? r.colorDetalle}"/>`;
  }
}

/**
 * SVG del retrato (busto) con un fondo del color dado. `titulo` se anuncia a los lectores de
 * pantalla; sin él, el retrato es decorativo.
 */
export function svgRetrato(rasgos: Rasgos, fondo: string, titulo?: string): string {
  const piel = colorPiel(rasgos.piel, rasgos.matiz);
  const sx = rasgos.anchoCara ?? 1;
  const sy = rasgos.largoCara ?? 1;
  // La cabeza (con el pelo y lo que lleva encima) se estira o se estrecha desde su centro.
  const escala = (contenido: string): string =>
    sx === 1 && sy === 1
      ? contenido
      : `<g transform="matrix(${f(sx)} 0 0 ${f(sy)} ${f(50 - 50 * sx)} ${f(42 - 42 * sy)})">${contenido}</g>`;
  const conEdad = (color: string): string =>
    rasgos.colorFijo ? color : peloConEdad(color, rasgos.edad);
  const pelo = conEdad(rasgos.colorPelo);
  const colorBarba = conEdad(rasgos.colorBarba ?? rasgos.colorPelo);
  const accesible = titulo
    ? `role="img" aria-label="${titulo.replace(/"/g, '&quot;')}"`
    : 'aria-hidden="true"';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${accesible}>` +
    `<rect width="100" height="100" fill="${fondo}"/>` +
    `<circle cx="50" cy="38" r="34" fill="${tono(fondo, 1.18)}" opacity="0.5"/>` +
    escala(veloDetras(rasgos) + peloDetras(rasgos, pelo)) +
    cuerpo(rasgos, piel) +
    (rasgos.collar ? collar() : '') +
    escala(
      cabeza(rasgos, piel) +
        cara(rasgos, piel, pelo) +
        barba(rasgos, colorBarba) +
        (['kufiya', 'turbante', 'karakul'].includes(rasgos.tocado)
          ? ''
          : peloDelante(rasgos, pelo)) +
        gafas(rasgos) +
        tocado(rasgos),
    ) +
    '</svg>'
  );
}

// ── Retratos genéricos ───────────────────────────────────────────────────────────────────────

/** Número estable a partir de un texto (el mismo para la misma persona). */
export function semilla(texto: string): number {
  let h = 2166136261;
  for (const caracter of texto) {
    h ^= caracter.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

const elegir = <T>(lista: readonly T[], n: number): T => lista[n % lista.length]!;

/** Zonas con tonos de piel distintos de los de su región (índices en PIELES, de-a). */
const ZONAS_PIEL: [readonly string[], number, number][] = [
  [['AUS', 'NZL', 'USA', 'CAN', 'ARG', 'URY', 'CHL', 'ISR'], 0, 1],
  [['KAZ', 'UZB', 'KGZ', 'TJK', 'TKM', 'AZE', 'TUR', 'GEO', 'ARM', 'CYP', 'CYN', 'MNG'], 1, 3],
  [
    [
      'HTI',
      'JAM',
      'BRB',
      'BHS',
      'TTO',
      'ATG',
      'DMA',
      'GRD',
      'KNA',
      'LCA',
      'VCT',
      'SUR',
      'GUY',
      'BLZ',
    ],
    4,
    7,
  ],
  [['BOL', 'PER', 'ECU', 'GTM', 'PRY', 'NIC', 'HND', 'SLV'], 3, 5],
  [
    ['FJI', 'PNG', 'SLB', 'VUT', 'WSM', 'TON', 'KIR', 'TUV', 'NRU', 'FSM', 'MHL', 'PLW', 'TLS'],
    4,
    6,
  ],
  [['CHN', 'JPN', 'KOR', 'PRK', 'TWN', 'HKG', 'MAC'], 0, 1],
  [['IDN', 'MYS', 'PHL', 'THA', 'VNM', 'LAO', 'KHM', 'MMR', 'SGP', 'BRN'], 2, 4],
  [['ZAF'], 5, 7],
];
/** Tono de piel por región del Banco Mundial (índices de-a). */
const PIEL_REGION: Record<string, [number, number]> = {
  ECS: [0, 2],
  NAC: [0, 2],
  LCN: [1, 4],
  MEA: [2, 4],
  SAS: [3, 6],
  SSF: [5, 7],
  EAS: [1, 3],
};
/** Países del Golfo, cuyos jefes visten túnica y kufiya. */
const GOLFO = ['SAU', 'ARE', 'QAT', 'KWT', 'BHR', 'OMN', 'YEM'];
/** Sahel y África occidental, donde muchos líderes visten boubou. */
const BOUBOU = ['SEN', 'MLI', 'NER', 'MRT', 'GMB', 'GIN', 'TCD', 'SDN', 'BFA', 'NGA'];

export interface DatosGenericos {
  pais: string;
  region: string;
  regimen: string | null;
  sexo: 'h' | 'm' | null;
  edad: number | null;
  /** Identificador de la persona (para que salga siempre igual). */
  persona: string;
}

/**
 * Generador de números al azar estable (mulberry32): la misma persona da siempre la misma serie,
 * así que su retrato no cambia de una partida a otra.
 */
export function azarDe(texto: string): () => number {
  let a = semilla(texto);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Elige una opción con su peso. */
function conPeso<T extends string>(azar: () => number, pesos: Partial<Record<T, number>>): T {
  const opciones = Object.entries(pesos) as [T, number][];
  const total = opciones.reduce((suma, [, peso]) => suma + peso, 0);
  let x = azar() * total;
  for (const [opcion, peso] of opciones) {
    x -= peso;
    if (x < 0) return opcion;
  }
  return opciones[opciones.length - 1]![0];
}

const entre = (azar: () => number, desde: number, hasta: number): number =>
  Math.round((desde + azar() * (hasta - desde)) * 100) / 100;

/** Asia oriental y central y sudeste asiático, por la forma de los ojos más frecuente. */
const ASIA_ORIENTAL = ['CHN', 'JPN', 'KOR', 'PRK', 'TWN', 'HKG', 'MAC', 'MNG'];
const SUDESTE_ASIATICO = [
  'IDN',
  'MYS',
  'PHL',
  'THA',
  'VNM',
  'LAO',
  'KHM',
  'MMR',
  'SGP',
  'BRN',
  'TLS',
];
const ASIA_CENTRAL = ['KAZ', 'KGZ', 'TJK', 'TKM', 'UZB'];

/** Rasgos de la cara de un genérico (ajuste f8-a1): variados y sin exagerar. */
function caraGenerica(
  d: DatosGenericos,
  sexo: 'h' | 'm',
  edad: number,
  piel: number,
  azar: () => number,
): Partial<Rasgos> {
  const ojos: Ojos = ASIA_ORIENTAL.includes(d.pais)
    ? conPeso<Ojos>(azar, { rasgados: 55, almendrados: 35, normales: 10 })
    : SUDESTE_ASIATICO.includes(d.pais)
      ? conPeso<Ojos>(azar, { rasgados: 30, almendrados: 45, normales: 25 })
      : ASIA_CENTRAL.includes(d.pais)
        ? conPeso<Ojos>(azar, { rasgados: 35, almendrados: 35, normales: 30 })
        : conPeso<Ojos>(azar, {
            normales: 35,
            almendrados: 30,
            grandes: 15,
            caidos: edad > 55 ? 30 : 10,
          });
  const nariz: Nariz =
    piel >= 4.5
      ? conPeso<Nariz>(azar, { ancha: 40, chata: 20, recta: 25, pequena: 15 })
      : d.region === 'MEA' || d.region === 'SAS'
        ? conPeso<Nariz>(azar, { aguilena: 25, larga: 25, recta: 30, ancha: 20 })
        : ASIA_ORIENTAL.includes(d.pais) || SUDESTE_ASIATICO.includes(d.pais)
          ? conPeso<Nariz>(azar, { pequena: 35, chata: 30, recta: 20, ancha: 15 })
          : conPeso<Nariz>(azar, { recta: 30, aguilena: 15, larga: 20, pequena: 20, ancha: 15 });
  const labios: Labios =
    piel >= 4.5
      ? conPeso<Labios>(azar, { gruesos: 55, medios: 45 })
      : piel >= 3
        ? conPeso<Labios>(azar, { medios: 60, gruesos: 25, finos: 15 })
        : conPeso<Labios>(azar, { finos: 35, medios: 55, gruesos: 10 });
  const claros = piel <= 1.4 && ['ECS', 'NAC', 'LCN'].includes(d.region);
  const colorOjos = claros
    ? COLORES_OJOS[
        conPeso<keyof typeof COLORES_OJOS>(azar, {
          azul: 22,
          verde: 12,
          avellana: 18,
          gris: 8,
          marron: 40,
        })
      ]
    : piel <= 2.5
      ? COLORES_OJOS[conPeso<keyof typeof COLORES_OJOS>(azar, { avellana: 25, marron: 75 })]
      : COLORES_OJOS[conPeso<keyof typeof COLORES_OJOS>(azar, { marronOscuro: 70, marron: 30 })];
  const matiz: Matiz =
    piel <= 2
      ? conPeso<Matiz>(azar, { neutro: 40, rosado: 35, oliva: 25 })
      : piel < 4.5
        ? conPeso<Matiz>(azar, { dorado: 35, oliva: 35, neutro: 30 })
        : conPeso<Matiz>(azar, { neutro: 50, dorado: 25, rojizo: 25 });
  return {
    cara: conPeso<FormaCara>(azar, {
      ovalada: 30,
      redonda: 20,
      cuadrada: sexo === 'h' ? 20 : 8,
      afilada: 15,
      larga: 15,
    }),
    anchoCara: entre(azar, 0.92, 1.08),
    largoCara: entre(azar, 0.96, 1.04),
    ojos,
    colorOjos,
    separacionOjos: entre(azar, -1, 1),
    nariz,
    labios,
    anchoBoca: entre(azar, 0.86, 1.12),
    orejas: conPeso<Orejas>(azar, { normales: 45, pequenas: 20, grandes: 20, separadas: 15 }),
    cejas:
      sexo === 'm'
        ? conPeso<Cejas>(azar, { finas: 35, arqueadas: 30, normales: 25, rectas: 10 })
        : conPeso<Cejas>(azar, {
            normales: 25,
            rectas: 20,
            arqueadas: 10,
            pobladas: 15,
            finas: 10,
            caidas: 20,
          }),
    alturaCejas: entre(azar, -1, 1),
    expresion: conPeso<Expresion>(azar, { neutra: 35, leve: 30, sonrisa: 20, seria: 15 }),
    matiz,
    arrugas: entre(azar, 0.7, 1.3),
    lunar: azar() < 0.12,
  };
}

/** Rasgos de un retrato genérico, respetuoso y estable para la misma persona. */
export function rasgosGenericos(d: DatosGenericos): Rasgos {
  const azar = azarDe(d.persona);
  const sexo = d.sexo ?? 'h';
  const edad = d.edad ?? 58;
  const zona = ZONAS_PIEL.find(([paises]) => paises.includes(d.pais));
  const [desde, hasta] = zona ? [zona[1], zona[2]] : (PIEL_REGION[d.region] ?? [1, 5]);
  const piel = entre(azar, desde, hasta);
  const africana = piel >= 4.5;
  const coloresPelo =
    piel <= 1.4
      ? [
          COLORES_PELO.castano,
          COLORES_PELO.castanoOscuro,
          COLORES_PELO.castanoClaro,
          COLORES_PELO.rubio,
        ]
      : [COLORES_PELO.negro, COLORES_PELO.castanoOscuro];
  const n = (): number => Math.floor(azar() * 1000);
  const colorPelo = elegir(coloresPelo, n());
  const pelo: EstiloPelo =
    sexo === 'm'
      ? elegir(['melena', 'recogido', 'largo', 'corto'] as const, n())
      : africana
        ? elegir(['rizado', 'calvo', 'rizado'] as const, n())
        : edad > 60
          ? elegir(['entradas', 'atras', 'calvo', 'raya'] as const, n())
          : elegir(['corto', 'raya', 'atras', 'ondulado'] as const, n());
  const conBarba = sexo === 'h' && ['MEA', 'SAS'].includes(d.region);
  const barba: Barba =
    sexo === 'm'
      ? 'ninguna'
      : conBarba
        ? elegir(['bigote', 'corta', 'bigote', 'ninguna'] as const, n())
        : elegir(['ninguna', 'ninguna', 'ninguna', 'bigote'] as const, n());
  const gafas = edad > 55 && n() % 4 === 0 ? 'finas' : 'ninguna';
  const trajes = ['#25324a', '#2f2f35', '#3a3f4a', '#1f2b3d'];
  const corbatas = ['#8b2332', '#2c4f8a', '#5a5a64', '#7b5b2a', '#2f6a4a'];
  let ropa: Ropa = sexo === 'm' ? 'traje-mujer' : 'traje';
  let colorRopa = elegir(trajes, n());
  let colorDetalle = elegir(
    sexo === 'm' ? ['#d9d2c5', '#b9cbe0', '#e4c7c7', '#c9d8c8'] : corbatas,
    n(),
  );
  let toc: Tocado = 'ninguno';
  let colorTocado: string | undefined;
  const otro = n();
  if (d.regimen === 'junta') {
    ropa = 'uniforme';
    colorRopa = elegir(['#4b5a3a', '#55603f', '#3f4b38'], otro);
    colorDetalle = '#c9a64a';
    toc = 'gorra-militar';
    colorTocado = colorRopa;
  } else if (sexo === 'h' && GOLFO.includes(d.pais) && d.regimen === 'monarquia-absoluta') {
    ropa = 'tunica';
    colorRopa = '#f4f2ec';
    colorDetalle = '#b8343a';
    toc = 'kufiya';
    colorTocado = elegir(['#f4f2ec', '#ffffff'], otro);
  } else if (sexo === 'h' && BOUBOU.includes(d.pais) && otro % 2 === 0) {
    ropa = 'boubou';
    colorRopa = elegir(['#f1ece0', '#3d6fa8', '#e6d8a8', '#5f8b5a'], n());
    colorDetalle = '#c9a64a';
  }
  return {
    sexo,
    edad,
    piel,
    pelo,
    colorPelo,
    barba,
    gafas,
    ropa,
    colorRopa,
    colorDetalle,
    tocado: toc,
    ...(colorTocado ? { colorTocado } : {}),
    ...caraGenerica(d, sexo, edad, piel, azar),
  };
}

/** Rasgos propios de los líderes de 2010 (homenajes, tarea f8-t4), por su id de Wikidata. */
export const RASGOS_LIDERES: Readonly<Record<string, Partial<Rasgos>>> = Object.fromEntries(
  Object.entries(lideres.lideres as Record<string, { quien: string; rasgos: Partial<Rasgos> }>).map(
    ([persona, { rasgos }]) => [persona, rasgos],
  ),
);

/** ¿Tiene esta persona un retrato homenaje propio? */
export function tieneHomenaje(persona: string): boolean {
  return persona in RASGOS_LIDERES;
}

/**
 * Rasgos del retrato de una persona: los de su homenaje, si lo tiene (lo que no diga se toma del
 * genérico), o los genéricos.
 */
export function rasgosDe(datos: DatosGenericos): Rasgos {
  const genericos = rasgosGenericos(datos);
  const propios = RASGOS_LIDERES[datos.persona];
  if (!propios) return genericos;
  // El color de pelo de un homenaje se elige mirando al personaje en 2010: no encanece más.
  return { ...genericos, ...propios, ...(propios.colorPelo ? { colorFijo: true } : {}) };
}
