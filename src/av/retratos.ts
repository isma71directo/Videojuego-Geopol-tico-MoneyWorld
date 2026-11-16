/**
 * Retratos ilustrados de los cargos (tareas f8-t3 y f8-t4, decisión del jugador): bustos, del
 * torso hacia arriba, dibujados con código en SVG. Nunca son fotografías.
 *
 * - Los líderes de 2010 de los países y figuras importantes tienen sus rasgos elegidos a mano
 *   (config/retratos-lideres.json): un homenaje e interpretación del personaje, reconocible por
 *   el pelo, la barba, las gafas, la ropa o el tocado.
 * - El resto lleva un retrato genérico según la región del país, el estilo de su régimen, el sexo
 *   y la edad de la persona. Siempre la misma cara base, sin rasgos exagerados: solo cambian el
 *   tono de piel, el pelo, la ropa y los complementos.
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
  | 'recogido';

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
  | 'camisa';

export type Tocado =
  'ninguno' | 'boina' | 'gorra-militar' | 'kufiya' | 'turbante' | 'solideo' | 'gorro';

export interface Rasgos {
  sexo: 'h' | 'm';
  /** Edad en 2010 (canas y arrugas). */
  edad: number;
  /** Índice en PIELES. */
  piel: number;
  pelo: EstiloPelo;
  colorPelo: string;
  barba: Barba;
  /** Color de la barba (por defecto, el del pelo). */
  colorBarba?: string;
  gafas: 'ninguna' | 'finas' | 'gruesas';
  ropa: Ropa;
  /** Color principal de la ropa (chaqueta, uniforme, túnica…). */
  colorRopa: string;
  /** Corbata, blusa o detalle (pañuelo de la kufiya…). */
  colorDetalle: string;
  tocado: Tocado;
  colorTocado?: string;
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

// ── Partes del dibujo (viewBox 0 0 100 100) ──────────────────────────────────────────────────

function cuerpo(r: Rasgos, piel: string): string {
  const ropa = r.colorRopa;
  const oscuro = tono(ropa, 0.75);
  const cuello = `<path d="M43 58 L43 70 L57 70 L57 58 Z" fill="${tono(piel, 0.9)}"/>`;
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
  }
}

/** Pelo que queda detrás de la cabeza (melenas largas). */
function peloDetras(r: Rasgos, color: string): string {
  if (r.pelo === 'largo') {
    return `<path d="M32 40 C30 20 70 20 68 40 L71 72 C64 76 36 76 29 72 Z" fill="${color}"/>`;
  }
  if (r.pelo === 'melena') {
    return `<path d="M33 40 C31 21 69 21 67 40 L68 58 C62 61 38 61 32 58 Z" fill="${color}"/>`;
  }
  return '';
}

function cabeza(piel: string, edad: number): string {
  const sombra = tono(piel, 0.86);
  const arrugas =
    edad >= 62
      ? `<path d="M43 31.5 Q50 30 57 31.5 M44.5 34 Q50 33 55.5 34" fill="none" stroke="${sombra}" stroke-width="0.6"/>` +
        `<path d="M41 52 Q42.5 55 44 56 M59 52 Q57.5 55 56 56" fill="none" stroke="${sombra}" stroke-width="0.6"/>`
      : '';
  return (
    `<ellipse cx="35.5" cy="44" rx="3" ry="4.3" fill="${sombra}"/>` +
    `<ellipse cx="64.5" cy="44" rx="3" ry="4.3" fill="${sombra}"/>` +
    `<ellipse cx="50" cy="42" rx="14.5" ry="18" fill="${piel}"/>` +
    arrugas
  );
}

function cara(r: Rasgos, piel: string, pelo: string): string {
  const linea = tono(piel, 0.62);
  const grosorCeja = r.edad >= 60 ? 1.3 : 1.1;
  return (
    `<path d="M41 37.6 Q44.2 36.2 47.2 37.6 M52.8 37.6 Q55.8 36.2 59 37.6" fill="none" stroke="${tono(pelo, 0.9)}" stroke-width="${grosorCeja}" stroke-linecap="round"/>` +
    '<ellipse cx="44.2" cy="41.6" rx="1.6" ry="1.2" fill="#2a211c"/>' +
    '<ellipse cx="55.8" cy="41.6" rx="1.6" ry="1.2" fill="#2a211c"/>' +
    `<path d="M50 44 Q48.4 49 49.4 50.2 Q50 50.6 51.2 50.2" fill="none" stroke="${linea}" stroke-width="0.9" stroke-linecap="round"/>` +
    `<path d="M45.6 54.6 Q50 56.6 54.4 54.6" fill="none" stroke="${tono(piel, 0.55)}" stroke-width="1.1" stroke-linecap="round"/>`
  );
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
    case 'recogido':
      return (
        `<circle cx="50" cy="20" r="5.5" fill="${color}"/>` +
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
    case 'turbante':
      return `<path d="M33.5 33 C31 17 69 17 66.5 33 C60 29 40 29 33.5 33 Z" fill="${color}"/><path d="M36 27 Q50 22 64 27" fill="none" stroke="${tono(color, 1.5)}" stroke-width="0.8"/>`;
    case 'solideo':
      return `<path d="M41 25 C43 20.5 57 20.5 59 25 Q50 23.5 41 25 Z" fill="${color}"/>`;
    case 'gorro':
      return `<path d="M35 31 C35 20 65 20 65 31 Z" fill="${color}"/>`;
  }
}

/**
 * SVG del retrato (busto) con un fondo del color dado. `titulo` se anuncia a los lectores de
 * pantalla; sin él, el retrato es decorativo.
 */
export function svgRetrato(rasgos: Rasgos, fondo: string, titulo?: string): string {
  const piel = PIELES[Math.max(0, Math.min(PIELES.length - 1, rasgos.piel))]!;
  const pelo = peloConEdad(rasgos.colorPelo, rasgos.edad);
  const colorBarba = peloConEdad(rasgos.colorBarba ?? rasgos.colorPelo, rasgos.edad);
  const accesible = titulo
    ? `role="img" aria-label="${titulo.replace(/"/g, '&quot;')}"`
    : 'aria-hidden="true"';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ${accesible}>` +
    `<rect width="100" height="100" fill="${fondo}"/>` +
    `<circle cx="50" cy="38" r="34" fill="${tono(fondo, 1.18)}" opacity="0.5"/>` +
    peloDetras(rasgos, pelo) +
    cuerpo(rasgos, piel) +
    cabeza(piel, rasgos.edad) +
    cara(rasgos, piel, pelo) +
    barba(rasgos, colorBarba) +
    (rasgos.tocado === 'kufiya' || rasgos.tocado === 'turbante' ? '' : peloDelante(rasgos, pelo)) +
    gafas(rasgos) +
    tocado(rasgos) +
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

/** Rasgos de un retrato genérico, respetuoso y estable para la misma persona. */
export function rasgosGenericos(d: DatosGenericos): Rasgos {
  const n = semilla(d.persona);
  const sexo = d.sexo ?? 'h';
  const edad = d.edad ?? 58;
  const zona = ZONAS_PIEL.find(([paises]) => paises.includes(d.pais));
  const [desde, hasta] = zona ? [zona[1], zona[2]] : (PIEL_REGION[d.region] ?? [1, 5]);
  const piel = desde + (n % (hasta - desde + 1));
  const africana = piel >= 5;
  const coloresPelo =
    piel <= 1
      ? [
          COLORES_PELO.castano,
          COLORES_PELO.castanoOscuro,
          COLORES_PELO.castanoClaro,
          COLORES_PELO.rubio,
        ]
      : [COLORES_PELO.negro, COLORES_PELO.castanoOscuro];
  const colorPelo = elegir(coloresPelo, n >>> 3);
  const pelo: EstiloPelo =
    sexo === 'm'
      ? elegir(['melena', 'recogido', 'largo', 'corto'] as const, n >>> 5)
      : africana
        ? elegir(['rizado', 'calvo', 'rizado'] as const, n >>> 5)
        : edad > 60
          ? elegir(['entradas', 'atras', 'calvo', 'raya'] as const, n >>> 5)
          : elegir(['corto', 'raya', 'atras', 'ondulado'] as const, n >>> 5);
  const conBarba = sexo === 'h' && ['MEA', 'SAS'].includes(d.region);
  const barba: Barba =
    sexo === 'm'
      ? 'ninguna'
      : conBarba
        ? elegir(['bigote', 'corta', 'bigote', 'ninguna'] as const, n >>> 7)
        : elegir(['ninguna', 'ninguna', 'ninguna', 'bigote'] as const, n >>> 7);
  const gafas = edad > 55 && (n >>> 9) % 4 === 0 ? 'finas' : 'ninguna';
  const trajes = ['#25324a', '#2f2f35', '#3a3f4a', '#1f2b3d'];
  const corbatas = ['#8b2332', '#2c4f8a', '#5a5a64', '#7b5b2a', '#2f6a4a'];
  let ropa: Ropa = sexo === 'm' ? 'traje-mujer' : 'traje';
  let colorRopa = elegir(trajes, n >>> 11);
  let colorDetalle = elegir(
    sexo === 'm' ? ['#d9d2c5', '#b9cbe0', '#e4c7c7', '#c9d8c8'] : corbatas,
    n >>> 13,
  );
  let toc: Tocado = 'ninguno';
  let colorTocado: string | undefined;
  if (d.regimen === 'junta') {
    ropa = 'uniforme';
    colorRopa = elegir(['#4b5a3a', '#55603f', '#3f4b38'], n >>> 11);
    colorDetalle = '#c9a64a';
    toc = 'gorra-militar';
    colorTocado = colorRopa;
  } else if (sexo === 'h' && GOLFO.includes(d.pais) && d.regimen === 'monarquia-absoluta') {
    ropa = 'tunica';
    colorRopa = '#f4f2ec';
    colorDetalle = '#b8343a';
    toc = 'kufiya';
    colorTocado = elegir(['#f4f2ec', '#ffffff'], n >>> 11);
  } else if (sexo === 'h' && BOUBOU.includes(d.pais) && (n >>> 15) % 2 === 0) {
    ropa = 'boubou';
    colorRopa = elegir(['#f1ece0', '#3d6fa8', '#e6d8a8', '#5f8b5a'], n >>> 11);
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
  };
}

/** Rasgos propios de los líderes de 2010 (homenajes, tarea f8-t4), por su id de Wikidata. */
export const RASGOS_LIDERES: Readonly<Record<string, Partial<Rasgos>>> = lideres.lideres as Record<
  string,
  Partial<Rasgos>
>;

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
  return propios ? { ...genericos, ...propios } : genericos;
}
