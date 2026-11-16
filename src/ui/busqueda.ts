/**
 * Búsqueda de países, regiones y ciudades (tarea f9-t2): lógica pura, sin DOM, con tests.
 * Encuentra lo escrito con y sin tildes, mayúsculas o signos, por el principio del nombre, por
 * el principio de cualquiera de sus palabras, por un trozo o, con una errata, por parecido.
 */

export type TipoResultado = 'pais' | 'region' | 'ciudad';

export interface EntradaBusqueda {
  tipo: TipoResultado;
  /** País: su código; región: su id; ciudad: «país|nombre». */
  id: string;
  nombre: string;
  /** País al que pertenece (el propio, si es un país). */
  pais: string;
  /** Otros nombres con los que se puede buscar (en inglés, códigos…). */
  alias?: readonly string[];
  /** Población (para ordenar lo igual de parecido): primero lo más poblado. */
  peso: number;
}

export interface ResultadoBusqueda {
  entrada: EntradaBusqueda;
  puntos: number;
}

interface EntradaIndice {
  entrada: EntradaBusqueda;
  claves: { texto: string; palabras: string[] }[];
}

export interface IndiceBusqueda {
  entradas: EntradaIndice[];
}

/** «Ciudad de México» → «ciudad de mexico»; «Côte d'Ivoire» → «cote d ivoire». */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function crearIndice(entradas: readonly EntradaBusqueda[]): IndiceBusqueda {
  // Sin repetidos (dos ciudades con el mismo nombre en el mismo país): se queda la más poblada.
  const unicas = new Map<string, EntradaBusqueda>();
  for (const entrada of entradas) {
    const clave = `${entrada.tipo}|${entrada.id}`;
    const previa = unicas.get(clave);
    if (!previa || entrada.peso > previa.peso) unicas.set(clave, entrada);
  }
  return {
    entradas: [...unicas.values()].map((entrada) => ({
      entrada,
      claves: [entrada.nombre, ...(entrada.alias ?? [])]
        .map(normalizarBusqueda)
        .filter((texto) => texto !== '')
        .map((texto) => ({ texto, palabras: texto.split(' ') })),
    })),
  };
}

/** Parecido entre dos textos (coeficiente de Dice sobre pares de letras), de 0 a 1. */
export function parecido(a: string, b: string): number {
  const pares = (t: string): string[] => [...t].slice(0, -1).map((c, i) => c + t[i + 1]);
  const pa = pares(a);
  const pb = pares(b);
  if (pa.length === 0 || pb.length === 0) return a === b ? 1 : 0;
  const resto = [...pb];
  let comunes = 0;
  for (const par of pa) {
    const i = resto.indexOf(par);
    if (i >= 0) {
      comunes++;
      resto.splice(i, 1);
    }
  }
  return (2 * comunes) / (pa.length + pb.length);
}

/** Por tipo: a igualdad, primero los países y luego las regiones. */
const VENTAJA_TIPO: Record<TipoResultado, number> = { pais: 60, region: 30, ciudad: 0 };
/** Parecido mínimo para aceptar una errata. */
const PARECIDO_MINIMO = 0.75;

function puntosClave(clave: { texto: string; palabras: string[] }, consulta: string): number {
  const { texto, palabras } = clave;
  if (texto === consulta) return 1000;
  if (texto.startsWith(consulta)) return 800;
  if (palabras.some((p) => p.startsWith(consulta))) return 600;
  // Varias palabras escritas: cada una empieza alguna del nombre («nueva gal» → Nueva Gales…).
  const partes = consulta.split(' ');
  if (partes.length > 1 && partes.every((p) => palabras.some((w) => w.startsWith(p)))) return 550;
  if (texto.includes(consulta)) return 400;
  if (consulta.length >= 4) {
    // Una errata: se compara con el principio del nombre de la misma longitud y, si tienen un
    // largo parecido, con el nombre entero («Catalunya» → Cataluña; no «cataluna» → Natal).
    let p = parecido(texto.slice(0, consulta.length), consulta);
    if (Math.abs(texto.length - consulta.length) <= Math.max(2, consulta.length * 0.3)) {
      p = Math.max(p, parecido(texto, consulta));
    }
    if (p >= PARECIDO_MINIMO) return Math.round(300 * p);
  }
  return 0;
}

/** Los mejores resultados para lo escrito (vacío si no se ha escrito nada). */
export function buscar(indice: IndiceBusqueda, texto: string, maximo = 8): ResultadoBusqueda[] {
  const consulta = normalizarBusqueda(texto);
  if (consulta === '') return [];
  const resultados: ResultadoBusqueda[] = [];
  for (const { entrada, claves } of indice.entradas) {
    let mejor = 0;
    for (const clave of claves) mejor = Math.max(mejor, puntosClave(clave, consulta));
    if (mejor === 0) continue;
    const puntos = mejor + VENTAJA_TIPO[entrada.tipo] + Math.log10(entrada.peso + 1) * 6;
    resultados.push({ entrada, puntos });
  }
  return resultados
    .sort((a, b) => b.puntos - a.puntos || a.entrada.nombre.localeCompare(b.entrada.nombre, 'es'))
    .slice(0, maximo);
}

/**
 * Parte del nombre que coincide con lo escrito, para resaltarla: [antes, coincidencia, después]
 * en el nombre original (con sus tildes), o null si lo escrito no aparece tal cual.
 */
export function resaltar(nombre: string, texto: string): [string, string, string] | null {
  const consulta = normalizarBusqueda(texto);
  if (consulta === '') return null;
  // El nombre normalizado letra a letra, recordando de qué posición del original sale cada una.
  let normal = '';
  const origen: number[] = [];
  let posicion = 0;
  for (const caracter of nombre) {
    const convertido = caracter
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/ß/g, 'ss')
      .replace(/[^\p{L}\p{N}]/gu, ' ');
    for (const c of convertido) {
      // Como en normalizarBusqueda: sin espacios repetidos ni al principio.
      if (c === ' ' && (normal === '' || normal.endsWith(' '))) continue;
      normal += c;
      origen.push(posicion);
    }
    posicion += caracter.length;
  }
  // Mejor al principio de una palabra que en medio.
  const enPalabra = normal.startsWith(consulta) ? 0 : normal.indexOf(` ${consulta}`);
  const inicio = enPalabra > 0 ? enPalabra + 1 : enPalabra === 0 ? 0 : normal.indexOf(consulta);
  if (inicio < 0) return null;
  const fin = inicio + consulta.length;
  const desde = origen[inicio]!;
  const hasta = fin < origen.length ? origen[fin]! : nombre.length;
  return [nombre.slice(0, desde), nombre.slice(desde, hasta), nombre.slice(hasta)];
}
