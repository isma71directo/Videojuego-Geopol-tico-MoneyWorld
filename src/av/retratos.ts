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
  | 'cardado'
  /** Pelo afro corto, con textura. */
  | 'afro-corto'
  /** Pelo afro con volumen. */
  | 'afro'
  /** Rapado al cero (solo la sombra del pelo). */
  | 'rapado'
  /** Trenzas largas. */
  | 'trenzas'
  /** Tupé. */
  | 'tupe'
  /** Flequillo peinado hacia un lado. */
  | 'lateral';

export type Barba =
  | 'ninguna'
  | 'bigote'
  | 'bigote-grueso'
  | 'bigote-fino'
  | 'perilla'
  /** Solo en la barbilla, sin bigote. */
  | 'chivo'
  | 'corta'
  /** Barba corta y cerrada, hasta las mejillas. */
  | 'cerrada'
  | 'larga'
  /** Barba de tres días. */
  | 'tres-dias';

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
  | 'sari'
  /** Túnica amplia bordada de Nigeria y África occidental. */
  | 'agbada'
  /** Tela kente de Ghana, de franjas de colores, sobre el hombro. */
  | 'kente'
  /** Camisa con el cuello bordado en V. */
  | 'dashiki'
  /** Túnica blanca de África oriental con chaqueta encima. */
  | 'kanzu'
  /** Camisa de pliegues del Caribe y Centroamérica. */
  | 'guayabera'
  /** Camisa bordada y translúcida de Filipinas. */
  | 'barong'
  /** Camisa de batik (Indonesia, Malasia). */
  | 'batik'
  /** Camisa de flores del Pacífico. */
  | 'camisa-flores'
  /** Camisa larga (kameez) con chaleco. */
  | 'kameez'
  /** Ropa clara con un chal cruzado sobre el hombro. */
  | 'chal';

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
  | 'velo'
  /** Gorro blando yoruba caído a un lado. */
  | 'fila'
  /** Gorro redondo bordado (kufi). */
  | 'kufi'
  /** Gorro negro de terciopelo (Malasia, Indonesia). */
  | 'songkok'
  /** Pañuelo que cubre el pelo y enmarca la cara. */
  | 'hiyab'
  /** Tocado alto de tela de África occidental. */
  | 'gele'
  /** Gorro nepalí estampado. */
  | 'topi';

export type Gafas =
  | 'ninguna'
  | 'finas'
  | 'gruesas'
  | 'redondas'
  | 'sol'
  /** Montura de pasta de color. */
  | 'pasta'
  /** Montura dorada fina. */
  | 'doradas'
  /** Sin montura. */
  | 'al-aire'
  /** Monóculo con cadena. */
  | 'monoculo';

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
  gafas: Gafas;
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
  /** Canas solo en las sienes. */
  sienes?: boolean;
  /** Color de la camisa bajo el traje (por defecto, blanca). */
  colorCamisa?: string;
  /** Dibujo de la corbata (por defecto, lisa). */
  corbata?: 'lisa' | 'rayas' | 'lunares' | 'pajarita';
  /** Pañuelo en el bolsillo de la chaqueta. */
  panuelo?: boolean;
  /** Insignia en la solapa con el color del país. */
  insignia?: boolean;
  /** Pendientes. */
  pendientes?: boolean;
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

/** Franjas verticales sobre los hombros (chapan, kente…), sin salirse de su silueta. */
function franjas(colores: readonly string[], paso: number, grosor: number, hueco = true): string {
  const trazos: string[] = [];
  let i = 0;
  for (let x = 9; x <= 91; x += paso, i++) {
    if (hueco && x > 38 && x < 62) continue;
    const arriba = x < 50 ? 69 + Math.max(0, 40 - x) * 0.72 : 69 + Math.max(0, x - 60) * 0.72;
    trazos.push(
      `<path d="M${f(x)} ${f(arriba)} L${f(x)} 100" stroke="${colores[i % colores.length]}" stroke-width="${grosor}"/>`,
    );
  }
  return trazos.join('');
}

/** Motivos repartidos sobre los hombros (batik, flores, bordados). */
function motivos(dibujo: (x: number, y: number, i: number) => string, paso = 7): string {
  const partes: string[] = [];
  let i = 0;
  for (let y = 78; y <= 98; y += paso * 0.8) {
    for (let x = 12 + ((i * 3.5) % paso); x <= 88; x += paso, i++) {
      const borde = x < 50 ? 69 + Math.max(0, 40 - x) * 0.72 : 69 + Math.max(0, x - 60) * 0.72;
      if (y > borde + 2 && (x < 41 || x > 59)) partes.push(dibujo(x, y, i));
    }
  }
  return partes.join('');
}

function corbata(r: Rasgos): string {
  const color = r.colorDetalle;
  if (r.corbata === 'pajarita') {
    return `<path d="M45.4 70.6 L50 72.4 L45.4 74.4 Z M54.6 70.6 L50 72.4 L54.6 74.4 Z" fill="${color}"/><circle cx="50" cy="72.4" r="1" fill="${tono(color, 0.8)}"/>`;
  }
  const base = `<path d="M48.4 71 L51.6 71 L53 86 L50 90 L47 86 Z" fill="${color}"/>`;
  if (r.corbata === 'rayas') {
    return (
      base +
      `<path d="M48.3 74.4 L52 72.8 M47.8 78.6 L52.5 76.8 M47.4 82.8 L52.9 80.8 M47.6 86.6 L52.6 84.6" stroke="${tono(color, 1.6)}" stroke-width="0.7"/>`
    );
  }
  if (r.corbata === 'lunares') {
    return (
      base +
      [
        [49.4, 74.6],
        [50.8, 77.6],
        [49.2, 80.6],
        [50.9, 83.4],
        [49.6, 86.4],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.5" fill="${tono(color, 1.8)}"/>`)
        .join('')
    );
  }
  return base;
}

function cuerpo(r: Rasgos, piel: string, fondo: string): string {
  const ropa = r.colorRopa;
  const oscuro = tono(ropa, 0.75);
  const camisa = r.colorCamisa ?? '#f4f4f2';
  // Pañuelo en el bolsillo e insignia con el color del país en la solapa.
  const extras =
    (r.panuelo
      ? `<path d="M62.6 82.6 L68 81.6 L67.2 84.8 Z" fill="${tono(r.colorDetalle, 1.3)}"/>`
      : '') +
    (r.insignia
      ? `<circle cx="63.4" cy="76.6" r="1.25" fill="${tono(fondo, 1.35)}" stroke="#d4b24c" stroke-width="0.45"/>`
      : '');
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
        `<path d="M41 69 L50 88 L59 69 Z" fill="${camisa}"/>` +
        corbata(r) +
        `<path d="M40 69 L50 90 L44 100 L33 74 Z M60 69 L50 90 L56 100 L67 74 Z" fill="${oscuro}" opacity="0.55"/>` +
        extras
      );
    case 'traje-mujer':
      return (
        cuello +
        hombros(ropa) +
        `<path d="M41 69 Q50 84 59 69 Z" fill="${r.colorDetalle}"/>` +
        `<path d="M40 69 L50 86 L45 100 L33 74 Z M60 69 L50 86 L55 100 L67 74 Z" fill="${oscuro}" opacity="0.5"/>` +
        extras
      );
    case 'agbada':
      return (
        cuello +
        `<path d="M1 100 C3 80 22 70 40 68.5 L60 68.5 C78 70 97 80 99 100 Z" fill="${ropa}"/>` +
        `<path d="M41 69 Q50 86 59 69" fill="none" stroke="${r.colorDetalle}" stroke-width="2.6"/>` +
        `<path d="M44 74 Q50 92 56 74 M38 72 Q50 96 62 72" fill="none" stroke="${r.colorDetalle}" stroke-width="0.9" stroke-dasharray="1.6 1"/>` +
        `<path d="M20 86 Q24 80 30 78 M80 86 Q76 80 70 78" fill="none" stroke="${tono(ropa, 0.85)}" stroke-width="1"/>`
      );
    case 'kente':
      return (
        cuello +
        hombros(ropa) +
        franjas([r.colorDetalle, '#2e7d32', '#c62828', '#1b1b1b'], 3.2, 1.3, false) +
        `<path d="M40 69 L46 69 L52 100 L40 100 C40 90 41 80 40 69 Z" fill="${tono(ropa, 0.92)}"/>`
      );
    case 'dashiki':
      return (
        cuello +
        hombros(ropa) +
        `<path d="M40 69 L50 84 L60 69 L57 69 L50 79 L43 69 Z" fill="${r.colorDetalle}"/>` +
        `<path d="M41.8 69.6 L50 82 L58.2 69.6" fill="none" stroke="${ropa}" stroke-width="0.6" stroke-dasharray="1 0.8"/>` +
        motivos(
          (x, y) =>
            `<path d="M${f(x - 1.4)} ${f(y)} L${f(x)} ${f(y - 1.6)} L${f(x + 1.4)} ${f(y)} Z" fill="${r.colorDetalle}" opacity="0.7"/>`,
          9,
        )
      );
    case 'kanzu':
      return (
        cuello +
        hombros(ropa) +
        '<path d="M42 69 L58 69 L56 100 L44 100 Z" fill="#f4f2ec"/>' +
        `<path d="M45 69 L50 75 L55 69" fill="none" stroke="${r.colorDetalle}" stroke-width="1.2"/>` +
        `<line x1="50" y1="75" x2="50" y2="90" stroke="${r.colorDetalle}" stroke-width="1"/>`
      );
    case 'guayabera':
      return (
        cuello +
        hombros(ropa) +
        `<path d="M42 69 L50 77 L45 79 Z M58 69 L50 77 L55 79 Z" fill="${tono(ropa, 0.88)}"/>` +
        `<path d="M38 74 L38 100 M41.5 72 L41.5 100 M62 74 L62 100 M58.5 72 L58.5 100" stroke="${tono(ropa, 0.8)}" stroke-width="0.6"/>` +
        [82, 89, 96]
          .map((y) => `<circle cx="50" cy="${y}" r="0.7" fill="${tono(ropa, 0.7)}"/>`)
          .join('')
      );
    case 'barong':
      return (
        cuello +
        hombros('#f6f1e3') +
        `<path d="M6 100 C8 82 24 72 40 69 L60 69 C76 72 92 82 94 100 Z" fill="${ropa}" opacity="0.35"/>` +
        `<path d="M44 69 L56 69 L55 71 L45 71 Z" fill="${tono(ropa, 0.8)}"/>` +
        `<path d="M44 74 Q50 80 56 74 M42 79 Q50 87 58 79 M43 85 Q50 92 57 85" fill="none" stroke="${r.colorDetalle}" stroke-width="0.7"/>` +
        `<line x1="50" y1="71" x2="50" y2="100" stroke="${r.colorDetalle}" stroke-width="0.5" stroke-dasharray="1 1.5"/>`
      );
    case 'batik':
      return (
        cuello +
        hombros(ropa) +
        motivos(
          (x, y, i) =>
            i % 2 === 0
              ? `<ellipse cx="${f(x)}" cy="${f(y)}" rx="2" ry="1.1" fill="none" stroke="${r.colorDetalle}" stroke-width="0.7"/>`
              : `<circle cx="${f(x)}" cy="${f(y)}" r="0.8" fill="${r.colorDetalle}"/>`,
          6,
        ) +
        `<path d="M42 69 L50 77 L45 79 Z M58 69 L50 77 L55 79 Z" fill="${tono(ropa, 0.8)}"/>`
      );
    case 'camisa-flores':
      return (
        cuello +
        hombros(ropa) +
        motivos(
          (x, y) =>
            `<circle cx="${f(x)}" cy="${f(y)}" r="1.9" fill="${r.colorDetalle}" opacity="0.85"/><circle cx="${f(x)}" cy="${f(y)}" r="0.7" fill="#f2d25c"/>`,
          8,
        ) +
        `<path d="M42 69 L50 77 L45 79 Z M58 69 L50 77 L55 79 Z" fill="${tono(ropa, 0.8)}"/>`
      );
    case 'kameez':
      return (
        cuello +
        hombros(r.colorDetalle) +
        `<path d="M6 100 C8 83 22 74 38 70.5 L45 100 Z M94 100 C92 83 78 74 62 70.5 L55 100 Z" fill="${ropa}"/>` +
        `<path d="M44 69 L56 69 L55.4 72 L44.6 72 Z" fill="${tono(r.colorDetalle, 0.9)}"/>` +
        `<line x1="50" y1="72" x2="50" y2="86" stroke="${tono(r.colorDetalle, 0.75)}" stroke-width="0.8"/>`
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
    case 'chal':
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
  if (r.pelo === 'afro') {
    return `<ellipse cx="50" cy="33" rx="19" ry="17.5" fill="${color}"/>`;
  }
  if (r.pelo === 'trenzas') {
    const lineas: string[] = [];
    for (let x = 31.5; x <= 68.5; x += 2.4) {
      lineas.push(`M${f(x)} 46 L${f(x + (x < 50 ? -0.6 : 0.6))} 75`);
    }
    return (
      `<path d="M32 40 C30 20 70 20 68 40 L70 75 C64 78 36 78 30 75 Z" fill="${color}"/>` +
      `<path d="${lineas.join(' ')}" stroke="${tono(color, 1.6)}" stroke-width="0.5"/>`
    );
  }
  return '';
}

/** Pañuelo o sari sobre la cabeza: la parte que cae por detrás. */
function veloDetras(r: Rasgos): string {
  if (r.tocado === 'hiyab') {
    const color = r.colorTocado ?? r.colorDetalle;
    return `<path d="M31 48 C28 15 72 15 69 48 C70 58 66 67 58 71 L42 71 C34 67 30 58 31 48 Z" fill="${tono(color, 0.9)}"/>`;
  }
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
    case 'afro-corto':
    case 'afro': {
      const grande = r.pelo === 'afro';
      const forma = grande
        ? `M33 44 C29 21 38 14.5 50 14.5 C62 14.5 71 21 67 44 C64.5 34 58.5 29.6 50 29.6 C41.5 29.6 35.5 34 33 44 Z`
        : `M35.1 41 C34.2 25.5 41.5 21.2 50 21.2 C58.5 21.2 65.8 25.5 64.9 41 C63.2 33.5 58 29.6 50 29.6 C42 29.6 36.8 33.5 35.1 41 Z`;
      const puntos: string[] = [];
      const alto = grande ? 17 : 23;
      for (let y = alto; y <= 33; y += 2.3) {
        for (let x = 38 + ((y * 1.7) % 2.4); x <= 62; x += 2.6) {
          const dentro = Math.abs(x - 50) < 12.5 - Math.max(0, alto + 4 - y) * 1.6;
          if (dentro && y < 29.5 - Math.abs(x - 50) * 0.05)
            puntos.push(`<circle cx="${f(x)}" cy="${f(y)}" r="0.55"/>`);
        }
      }
      return (
        `<path d="${forma}" fill="${color}"/>` +
        `<g fill="${tono(color, 1.7)}" opacity="0.45">${puntos.join('')}</g>`
      );
    }
    case 'rapado':
      return `<path d="M35.6 39 C35 27.5 42 24 50 24 C58 24 65 27.5 64.4 39 C63 33 58 30.6 50 30.6 C42 30.6 37 33 35.6 39 Z" fill="${color}" opacity="0.5"/>`;
    case 'trenzas':
      return (
        `<path d="M35 43 C33 25 42 21 50 21 L50 26 C44 27 38.4 31.5 35 43 Z M65 43 C67 25 58 21 50 21 L50 26 C56 27 61.6 31.5 65 43 Z" fill="${color}"/>` +
        `<path d="M47 22 Q41 26 37 36 M44 23.4 Q39 28 36 40 M53 22 Q59 26 63 36 M56 23.4 Q61 28 64 40" fill="none" stroke="${tono(color, 1.6)}" stroke-width="0.5"/>`
      );
    case 'tupe':
      return (
        `<path d="M35.4 40 C34.5 26 40 20.5 47 19 C52 17.6 60 18.6 63 22 C66 26 65.2 33 64.6 40 C62.5 32 58 28 51 27.6 C43 27.6 38 31 35.4 40 Z" fill="${color}"/>` +
        `<path d="M44 21.5 Q52 18.6 60 21.4" fill="none" stroke="${tono(color, 1.4)}" stroke-width="0.6"/>`
      );
    case 'lateral':
      return `<path d="M35.4 42 C34 27 42 21.5 51 21.5 C60 21.5 66 27 64.6 42 C63.6 35 61.6 31.4 58.6 30.4 C52 31.6 44.6 33.2 38.4 33.6 C36.8 36 35.8 39 35.4 42 Z" fill="${color}"/>`;
    case 'cardado':
      return `<path d="M35 41 C32.5 22 37 12.5 50 12.5 C63 12.5 67.5 22 65 41 C63 33 58 29.5 50 29.5 C42 29.5 37 33 35 41 Z" fill="${color}"/>`;
    case 'recogido':
      return (
        (r.tocado === 'velo' ? '' : `<circle cx="50" cy="20" r="5.5" fill="${color}"/>`) +
        `<path d="M35.4 42 C34.5 27 42 23 50 23 C58 23 65.5 27 64.6 42 C63 34 58 29 50 29 C42 29 37 34 35.4 42 Z" fill="${color}"/>`
      );
  }
}

/** Canas solo en las sienes (pelo entrecano). */
function sienes(r: Rasgos, pelo: string): string {
  if (!r.sienes || r.pelo === 'calvo' || r.pelo === 'rapado') return '';
  return `<path d="M35.5 41 C35.3 37 35.9 34 37.4 32.2 L38.2 40 Z M64.5 41 C64.7 37 64.1 34 62.6 32.2 L61.8 40 Z" fill="${mezclar(pelo, '#b0aca6', 0.6)}"/>`;
}

/** Pendientes en el lóbulo de las orejas. */
function pendientes(r: Rasgos): string {
  if (!r.pendientes) return '';
  const fuera = OREJAS[r.orejas ?? 'normales'].fuera;
  return [-1, 1]
    .map(
      (l) =>
        `<circle cx="${f(50 + l * (14.6 + fuera))}" cy="48.6" r="0.95" fill="#d9b44a" stroke="#a8862c" stroke-width="0.3"/>`,
    )
    .join('');
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
    case 'bigote-grueso':
      return `<path d="M43.8 52.4 Q50 49.2 56.2 52.4 L56.8 54.6 Q53 53.2 50 53.6 Q47 53.2 43.2 54.6 Z" fill="${color}"/>`;
    case 'bigote-fino':
      return `<path d="M45.2 52.9 Q50 51.5 54.8 52.9" fill="none" stroke="${color}" stroke-width="0.8" stroke-linecap="round"/>`;
    case 'chivo':
      return (
        `<path d="M46.6 57.4 Q50 59.2 53.4 57.4 L52.6 61.6 Q50 62.8 47.4 61.6 Z" fill="${color}"/>` +
        `<path d="M49.2 56.6 L50.8 56.6 L50.4 58 L49.6 58 Z" fill="${color}"/>`
      );
    case 'cerrada':
    case 'tres-dias':
      return `<path d="M35.8 42 C36 57 42 62.4 50 63 C58 62.4 64 57 64.2 42 C62.6 50 59 53.6 55.4 54.6 Q50 56.6 44.6 54.6 C41 53.6 37.4 50 35.8 42 Z M44.4 52.8 Q50 50.2 55.6 52.8 Q50 54.2 44.4 52.8 Z" fill="${color}"${r.barba === 'tres-dias' ? ' opacity="0.3"' : ''}/>`;
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
  if (r.gafas === 'monoculo') {
    return '<circle cx="55.8" cy="41.6" r="3.2" fill="#ffffff" fill-opacity="0.12" stroke="#c9a64a" stroke-width="0.6"/><path d="M58.9 42.6 Q62.4 52 60 63" fill="none" stroke="#c9a64a" stroke-width="0.35"/>';
  }
  if (r.gafas === 'al-aire') {
    return '<g fill="#ffffff" fill-opacity="0.12" stroke="#9a9a9a" stroke-width="0.35"><rect x="39.6" y="39" width="9" height="5.6" rx="2.2"/><rect x="51.4" y="39" width="9" height="5.6" rx="2.2"/></g><path d="M48.6 41.4 L51.4 41.4" stroke="#8a8a8a" stroke-width="0.6"/>';
  }
  const MONTURAS: Partial<Record<Gafas, [number, string]>> = {
    gruesas: [1.5, '#1d1d1d'],
    pasta: [1.3, '#5a3a22'],
    doradas: [0.65, '#b8962e'],
  };
  const [grosor, color] = MONTURAS[r.gafas] ?? [0.8, '#5d5d5d'];
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
    case 'fila':
      return (
        `<path d="M35 31 C34 20 46 16 58 17 C66 18 71.5 22 70.4 27.4 C68.6 29.4 66.4 30.4 64.8 31 C58 28 42 28 35 31 Z" fill="${color}"/>` +
        `<path d="M38 27 Q50 22 62 25 M40 23.6 Q52 19 63 21.8" fill="none" stroke="${tono(color, 0.78)}" stroke-width="0.7"/>`
      );
    case 'kufi':
      return (
        `<path d="M36 30 C36 19.6 64 19.6 64 30 C58 28 42 28 36 30 Z" fill="${color}"/>` +
        `<path d="M37 27.4 Q50 25 63 27.4 M39 23.6 Q50 21.4 61 23.6" fill="none" stroke="${tono(color, 0.75)}" stroke-width="0.8" stroke-dasharray="1.2 0.8"/>`
      );
    case 'songkok':
      return `<path d="M37 30 L38 21.5 Q50 19.4 62 21.5 L63 30 Q50 28.4 37 30 Z" fill="${r.colorTocado ?? '#151515'}"/>`;
    case 'topi':
      return (
        `<path d="M37 30 L39 20.6 Q52 17.8 62.6 22 L63 30 Q50 28.4 37 30 Z" fill="${color}"/>` +
        `<g fill="${tono(color, 1.6)}">${[
          [42, 24],
          [47, 22.6],
          [52, 22.4],
          [57, 23.4],
          [44, 27.4],
          [50, 26.8],
          [56, 27.4],
        ]
          .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.7"/>`)
          .join('')}</g>`
      );
    case 'gele':
      return (
        `<path d="M33 35 C29 21 36 10 50 8.4 C64 10 72 18 68 35 C60 30.5 40 30.5 33 35 Z" fill="${color}"/>` +
        `<path d="M61 13 C70 7.6 77 14 72.4 22.4 C70 19 66 16 61 13 Z" fill="${tono(color, 0.88)}"/>` +
        `<path d="M36 28 Q50 20 65 27 M38 21 Q50 13 63 19 M44 13 Q50 18 46 30" fill="none" stroke="${tono(color, 0.7)}" stroke-width="0.8"/>`
      );
    case 'hiyab':
      return `<path d="M34.4 43 C33 24 67 24 65.6 43 C65 52 61 58 56 61 L57 64.4 C62.4 61 67.6 54 67.8 43 C68 20.6 32 20.6 32.2 43 C32.4 54 37.6 61 43 64.4 L44 61 C39 58 35 52 34.4 43 Z" fill="${r.colorTocado ?? r.colorDetalle}"/>`;
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
    escala(veloDetras(rasgos) + (rasgos.tocado === 'hiyab' ? '' : peloDetras(rasgos, pelo))) +
    cuerpo(rasgos, piel, fondo) +
    (rasgos.collar ? collar() : '') +
    escala(
      cabeza(rasgos, piel) +
        cara(rasgos, piel, pelo) +
        barba(rasgos, colorBarba) +
        (['kufiya', 'turbante', 'karakul', 'hiyab'].includes(rasgos.tocado)
          ? ''
          : peloDelante(rasgos, pelo) + sienes(rasgos, pelo)) +
        pendientes(rasgos) +
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

/** Grupos de países para la ropa, el pelo y los tocados de los genéricos (ajuste f8-a2). */
const ZONAS = {
  sahel: ['SEN', 'MLI', 'NER', 'MRT', 'GMB', 'GIN', 'TCD', 'SDN', 'BFA', 'GNB'],
  golfoGuinea: ['NGA', 'BEN', 'TGO', 'GHA', 'CIV', 'LBR', 'SLE', 'CMR'],
  africaOriental: [
    'UGA',
    'KEN',
    'TZA',
    'RWA',
    'BDI',
    'MWI',
    'ZMB',
    'ETH',
    'ERI',
    'SOM',
    'SOL',
    'DJI',
    'SSD',
    'COM',
  ],
  africaCentral: ['COD', 'COG', 'CAF', 'GAB', 'GNQ', 'AGO', 'STP'],
  caribeCentro: [
    'CUB',
    'DOM',
    'PAN',
    'CRI',
    'HND',
    'SLV',
    'NIC',
    'GTM',
    'MEX',
    'VEN',
    'COL',
    'PRI',
    'BLZ',
  ],
  pacifico: ['FJI', 'WSM', 'TON', 'VUT', 'SLB', 'PNG', 'KIR', 'TUV', 'NRU', 'FSM', 'MHL', 'PLW'],
  musulmanes: [
    'AFG',
    'PAK',
    'BGD',
    'IRN',
    'IRQ',
    'SYR',
    'JOR',
    'SAU',
    'ARE',
    'QAT',
    'KWT',
    'BHR',
    'OMN',
    'YEM',
    'EGY',
    'LBY',
    'DZA',
    'MAR',
    'TUN',
    'MRT',
    'SDN',
    'SOM',
    'SOL',
    'DJI',
    'COM',
    'MDV',
    'MYS',
    'BRN',
    'IDN',
    'SEN',
    'GMB',
    'MLI',
    'NER',
    'GIN',
    'TCD',
    'PSE',
  ],
} as const;
const en = (zona: keyof typeof ZONAS, pais: string): boolean =>
  (ZONAS[zona] as readonly string[]).includes(pais);

const TRAJES = [
  '#25324a',
  '#2f2f35',
  '#3a3f4a',
  '#1f2b3d',
  '#1c1c20',
  '#4a4f58',
  '#5b5f68',
  '#6b5a48',
  '#8a7f6c',
  '#3d4a5c',
  '#2c3a2f',
];
const CORBATAS = [
  '#8b2332',
  '#a3242f',
  '#2c4f8a',
  '#6f93c4',
  '#5a5a64',
  '#9aa0a8',
  '#7b5b2a',
  '#b08a2e',
  '#2f6a4a',
  '#5b3f7a',
  '#c96a2c',
  '#c46a8a',
  '#2a7a7a',
  '#1c1c20',
];
const BLUSAS = ['#d9d2c5', '#b9cbe0', '#e4c7c7', '#c9d8c8', '#f3efe4', '#2f2f35', '#8a3a4a'];
const TRAJES_MUJER = [
  '#2f2f35',
  '#1f2b3d',
  '#7a2a3a',
  '#3e5f8a',
  '#5f8b5a',
  '#8a6a3a',
  '#c4542f',
  '#5b3f7a',
  '#d9d2c5',
];
const TELAS = [
  '#e9a43a',
  '#2f8a5a',
  '#c0392b',
  '#3d6fa8',
  '#7a3f6a',
  '#d4a017',
  '#1f6f6a',
  '#b5652f',
];

/** Peinado de un hombre según su piel, su zona y su edad. */
function peloHombre(d: DatosGenericos, piel: number, edad: number, azar: () => number): EstiloPelo {
  if (piel >= 4.5) {
    return conPeso<EstiloPelo>(azar, {
      'afro-corto': 30,
      cortito: 25,
      rapado: 15,
      calvo: edad > 55 ? 25 : 5,
      entradas: edad > 50 ? 12 : 3,
    });
  }
  if (en('pacifico', d.pais)) {
    return conPeso<EstiloPelo>(azar, {
      rizado: 30,
      'afro-corto': 25,
      cortito: 20,
      calvo: edad > 55 ? 20 : 5,
    });
  }
  if (edad > 58) {
    return conPeso<EstiloPelo>(azar, {
      entradas: 25,
      atras: 20,
      calvo: 20,
      raya: 15,
      lateral: 10,
      rapado: 5,
      cortito: 5,
    });
  }
  return conPeso<EstiloPelo>(azar, {
    corto: 20,
    raya: 20,
    atras: 15,
    ondulado: 12,
    lateral: 12,
    tupe: 8,
    cortito: 8,
    entradas: edad > 45 ? 10 : 3,
  });
}

function peloMujer(piel: number, edad: number, azar: () => number): EstiloPelo {
  if (piel >= 4.5) {
    return conPeso<EstiloPelo>(azar, {
      trenzas: 25,
      'afro-corto': 20,
      afro: 10,
      corto: 20,
      recogido: 25,
    });
  }
  return conPeso<EstiloPelo>(azar, {
    melena: 20,
    recogido: 15,
    largo: 12,
    corto: 15,
    bob: 12,
    ondulado: 8,
    permanente: edad > 60 ? 18 : 3,
  });
}

function barbaGenerica(d: DatosGenericos, azar: () => number): Barba {
  if (d.region === 'MEA' || d.region === 'SAS' || en('musulmanes', d.pais)) {
    return conPeso<Barba>(azar, {
      ninguna: 20,
      bigote: 25,
      'bigote-grueso': 15,
      corta: 15,
      cerrada: 10,
      perilla: 5,
      chivo: 5,
      'tres-dias': 5,
    });
  }
  if (d.region === 'SSF') {
    return conPeso<Barba>(azar, {
      ninguna: 45,
      bigote: 15,
      'bigote-fino': 10,
      chivo: 10,
      corta: 10,
      'tres-dias': 10,
    });
  }
  if (d.region === 'LCN') {
    return conPeso<Barba>(azar, {
      ninguna: 50,
      bigote: 25,
      'bigote-grueso': 10,
      perilla: 5,
      corta: 5,
      'tres-dias': 5,
    });
  }
  if (d.region === 'EAS') {
    return conPeso<Barba>(azar, { ninguna: 80, bigote: 10, 'bigote-fino': 5, 'tres-dias': 5 });
  }
  return conPeso<Barba>(azar, {
    ninguna: 65,
    bigote: 8,
    corta: 8,
    'tres-dias': 10,
    perilla: 5,
    chivo: 4,
  });
}

/** Ropa y tocado de un hombre según su zona (traje, salvo las prendas propias de cada sitio). */
function ropaHombre(d: DatosGenericos, azar: () => number): Partial<Rasgos> {
  const traje: Partial<Rasgos> = {
    ropa: 'traje',
    colorRopa: elegirAl(azar, TRAJES),
    colorDetalle: elegirAl(azar, CORBATAS),
    colorCamisa: conPeso(azar, { '#f4f4f2': 60, '#d7e3f0': 25, '#f0dede': 5, '#efe8d8': 10 }),
    corbata: conPeso(azar, { lisa: 55, rayas: 30, lunares: 15 }),
    panuelo: azar() < 0.2,
    insignia: azar() < 0.25,
  };
  const x = azar();
  if (d.regimen === 'junta') {
    const verde = elegirAl(azar, ['#4b5a3a', '#55603f', '#3f4b38', '#5a5040']);
    return {
      ropa: 'uniforme',
      colorRopa: verde,
      colorDetalle: '#c9a64a',
      tocado: 'gorra-militar',
      colorTocado: verde,
    };
  }
  if (en('musulmanes', d.pais) && ['SAU', 'ARE', 'QAT', 'KWT', 'BHR', 'OMN'].includes(d.pais)) {
    const roja = azar() < 0.35;
    return {
      ropa: azar() < 0.5 ? 'bisht' : 'tunica',
      colorRopa: elegirAl(azar, ['#3a2a1c', '#1c1c20', '#6b5a48', '#8a7f6c']),
      colorDetalle: roja ? '#f4f2ec' : '#b8343a',
      tocado: d.pais === 'OMN' ? 'turbante' : 'kufiya',
      colorTocado: d.pais === 'OMN' ? elegirAl(azar, TELAS) : roja ? '#c8454a' : '#f4f2ec',
    };
  }
  if (en('sahel', d.pais) && x < 0.5) {
    return {
      ropa: 'boubou',
      colorRopa: elegirAl(azar, ['#f1ece0', '#3d6fa8', '#e6d8a8', '#5f8b5a', '#7a3f6a', '#d9c9a0']),
      colorDetalle: '#c9a64a',
      ...(azar() < 0.6
        ? {
            tocado: 'kufi' as Tocado,
            colorTocado: elegirAl(azar, ['#f1ece0', '#3d6fa8', '#7a3f6a', '#1c1c20']),
          }
        : {}),
    };
  }
  if (en('golfoGuinea', d.pais) && x < 0.45) {
    if (d.pais === 'GHA' || (d.pais === 'CIV' && azar() < 0.5)) {
      return {
        ropa: 'kente',
        colorRopa: '#d4a017',
        colorDetalle: elegirAl(azar, ['#c0392b', '#2e7d32', '#1b1b1b']),
      };
    }
    if (d.pais === 'NGA' || d.pais === 'BEN') {
      const tela = elegirAl(azar, ['#f1ece0', '#3d6fa8', '#7a3f6a', '#2f8a5a', '#d9c9a0']);
      return {
        ropa: 'agbada',
        colorRopa: tela,
        colorDetalle: '#c9a64a',
        tocado: 'fila',
        colorTocado: tono(tela, 0.85),
      };
    }
    return {
      ropa: 'dashiki',
      colorRopa: elegirAl(azar, TELAS),
      colorDetalle: elegirAl(azar, ['#1b1b1b', '#f1ece0', '#d4a017']),
    };
  }
  if (en('africaOriental', d.pais) && x < 0.3) {
    return ['UGA', 'TZA', 'KEN'].includes(d.pais)
      ? { ropa: 'kanzu', colorRopa: elegirAl(azar, TRAJES), colorDetalle: '#7a2a2a' }
      : {
          ropa: 'mao',
          colorRopa: elegirAl(azar, ['#8a7f6c', '#6b5a48', '#d9c9a0', '#3a3f4a']),
          colorDetalle: '#5a5a64',
        };
  }
  if (en('africaCentral', d.pais) && x < 0.3) {
    return {
      ropa: 'mao',
      colorRopa: elegirAl(azar, ['#2f2f35', '#3a3f4a', '#6b5a48', '#1f2b3d']),
      colorDetalle: '#5a5a64',
    };
  }
  if (en('caribeCentro', d.pais) && x < 0.3) {
    return {
      ropa: 'guayabera',
      colorRopa: elegirAl(azar, ['#f4f2ec', '#efe8d8', '#d7e3f0', '#e6d8a8']),
      colorDetalle: '#f4f2ec',
    };
  }
  if (d.pais === 'PHL' && x < 0.5) {
    return { ropa: 'barong', colorRopa: '#e9dcb8', colorDetalle: '#b8a77a' };
  }
  if (['IDN', 'MYS', 'BRN'].includes(d.pais) && x < 0.5) {
    return {
      ropa: 'batik',
      colorRopa: elegirAl(azar, ['#6b3a1f', '#1f3a5a', '#7a5a2a', '#3a2a4a']),
      colorDetalle: elegirAl(azar, ['#e9c46a', '#f4f2ec', '#c96a2c']),
      ...(azar() < 0.6 ? { tocado: 'songkok' as Tocado } : {}),
    };
  }
  if (en('pacifico', d.pais) && x < 0.45) {
    return {
      ropa: 'camisa-flores',
      colorRopa: elegirAl(azar, ['#1f6f6a', '#3d6fa8', '#7a2a3a', '#2f8a5a']),
      colorDetalle: elegirAl(azar, ['#f4f2ec', '#e9a43a', '#c46a8a']),
    };
  }
  if (['PAK', 'AFG'].includes(d.pais) && x < 0.45) {
    return {
      ropa: 'kameez',
      colorRopa: elegirAl(azar, ['#1c1c20', '#3a3f4a', '#6b5a48']),
      colorDetalle: elegirAl(azar, ['#f4f2ec', '#e6dcc4', '#d7e3f0']),
    };
  }
  if (['IND', 'BGD', 'NPL', 'LKA'].includes(d.pais) && x < 0.4) {
    return {
      ropa: 'mao',
      colorRopa: elegirAl(azar, ['#e6dcc4', '#8a7f6c', '#3a3f4a', '#1c1c20', '#f4f2ec']),
      colorDetalle: '#5a5a64',
      ...(d.pais === 'NPL'
        ? {
            tocado: 'topi' as Tocado,
            colorTocado: elegirAl(azar, ['#7a2a3a', '#3d6fa8', '#2f6a4a']),
          }
        : {}),
    };
  }
  return traje;
}

function ropaMujer(d: DatosGenericos, piel: number, azar: () => number): Partial<Rasgos> {
  const base: Partial<Rasgos> = {
    ropa: 'traje-mujer',
    colorRopa: elegirAl(azar, TRAJES_MUJER),
    colorDetalle: elegirAl(azar, BLUSAS),
    pendientes: azar() < 0.6,
    collar: azar() < 0.25,
  };
  if (['IND', 'BGD', 'NPL', 'LKA'].includes(d.pais) && azar() < 0.6) {
    const tela = elegirAl(azar, ['#e8d3a8', '#c46a8a', '#3d6fa8', '#2f8a5a', '#e9a43a']);
    return {
      ...base,
      ropa: 'sari',
      colorRopa: tela,
      colorDetalle: elegirAl(azar, TELAS),
      ...(azar() < 0.5 ? { tocado: 'velo' as Tocado, colorTocado: tela } : {}),
    };
  }
  if (en('musulmanes', d.pais) && azar() < 0.55) {
    return {
      ...base,
      tocado: 'hiyab',
      colorTocado: elegirAl(azar, ['#3d4a5c', '#7a2a3a', '#d9d2c5', '#1c1c20', '#5f8b5a']),
    };
  }
  if (
    piel >= 4.5 &&
    (en('golfoGuinea', d.pais) || en('sahel', d.pais) || en('africaCentral', d.pais)) &&
    azar() < 0.55
  ) {
    const tela = elegirAl(azar, TELAS);
    return {
      ...base,
      ropa: 'dashiki',
      colorRopa: tela,
      colorDetalle: elegirAl(azar, ['#1b1b1b', '#f1ece0', '#d4a017']),
      tocado: 'gele',
      colorTocado: tela,
    };
  }
  return base;
}

const elegirAl = <T>(azar: () => number, lista: readonly T[]): T =>
  lista[Math.floor(azar() * lista.length)]!;

/** Rasgos de un retrato genérico, respetuoso y estable para la misma persona. */
export function rasgosGenericos(d: DatosGenericos): Rasgos {
  const azar = azarDe(d.persona);
  const sexo = d.sexo ?? 'h';
  const edad = d.edad ?? 58;
  const zona = ZONAS_PIEL.find(([paises]) => paises.includes(d.pais));
  const [desde, hasta] = zona ? [zona[1], zona[2]] : (PIEL_REGION[d.region] ?? [1, 5]);
  const piel = entre(azar, desde, hasta);
  const colorPelo =
    piel <= 1.4
      ? conPeso(azar, {
          [COLORES_PELO.castano]: 30,
          [COLORES_PELO.castanoOscuro]: 25,
          [COLORES_PELO.castanoClaro]: 20,
          [COLORES_PELO.rubio]: 15,
          [COLORES_PELO.pelirrojo]: 5,
          [COLORES_PELO.negro]: 5,
        })
      : piel <= 2.6
        ? conPeso(azar, {
            [COLORES_PELO.negro]: 45,
            [COLORES_PELO.castanoOscuro]: 40,
            [COLORES_PELO.castano]: 15,
          })
        : conPeso(azar, { [COLORES_PELO.negro]: 75, [COLORES_PELO.castanoOscuro]: 25 });
  const pelo = sexo === 'm' ? peloMujer(piel, edad, azar) : peloHombre(d, piel, edad, azar);
  const barba: Barba = sexo === 'm' ? 'ninguna' : barbaGenerica(d, azar);
  const gafas: Gafas =
    azar() < (edad > 45 ? 0.4 : 0.15)
      ? conPeso<Gafas>(azar, { finas: 35, pasta: 20, doradas: 20, 'al-aire': 15, gruesas: 10 })
      : 'ninguna';
  const ropa = sexo === 'm' ? ropaMujer(d, piel, azar) : ropaHombre(d, azar);
  return {
    sexo,
    edad,
    piel,
    pelo,
    colorPelo,
    barba,
    gafas,
    ropa: 'traje',
    colorRopa: TRAJES[0]!,
    colorDetalle: CORBATAS[0]!,
    tocado: 'ninguno',
    sienes: sexo === 'h' && edad >= 42 && edad <= 62 && azar() < 0.4,
    ...ropa,
    ...caraGenerica(d, sexo, edad, piel, azar),
  } as Rasgos;
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
  // Un homenaje solo lleva barba, gafas, tocado, canas en las sienes y joyas si se le ponen a
  // propósito. De lo genérico toma lo que no dice: la cara, si no la tiene, y los detalles del
  // traje (camisa, dibujo de la corbata, pañuelo, insignia), que no cambian al personaje.
  const sinComplementos: Partial<Rasgos> = {
    barba: 'ninguna',
    gafas: 'ninguna',
    tocado: 'ninguno',
    sienes: false,
    pendientes: false,
    collar: false,
    lunar: false,
  };
  const base: Rasgos = { ...genericos };
  delete base.colorTocado;
  // El color de pelo de un homenaje se elige mirando al personaje en 2010: no encanece más.
  return {
    ...base,
    ...sinComplementos,
    ...propios,
    ...(propios.colorPelo ? { colorFijo: true } : {}),
  };
}
