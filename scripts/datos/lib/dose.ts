/**
 * DOSE, «Global dataset of reported subnational economic output» (Wenz et al.), versión V2.14 en
 * Zenodo (registro 20035157), CC BY 4.0: cómo casar sus regiones con las nuestras por el nombre.
 * Lo usan la población y el PIB (15-regiones-datos.ts) y los sectores (21-regiones-economia.ts).
 */

export const URL_DOSE = 'https://zenodo.org/api/records/20035157/files/DOSE_V2.14.csv/content';

/** «Comunidad Foral de Navarra» → «foral navarra»: sin tildes, signos ni palabras de relleno. */
export const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(
      /\b(region|province|provincia|oblast|state|estado|departamento|department|governorate|prefecture|county|kraj|comunidad|autonomous|republic|of|de|del|la|el|the|and|y|city|ciudad)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

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

export interface RegionConUnidades {
  id: string;
  nombre: string;
  unidades: { nombre: string }[];
}

/**
 * Función que da, para el nombre de una región de DOSE, la nuestra del mismo país: por nombre
 * exacto (de la región o de una de sus unidades) o, si no, por el más parecido (al menos 0,82).
 */
export function resolverPorNombre(
  lista: readonly RegionConUnidades[],
): (nombre: string) => string | null {
  const porNombre = new Map<string, string>();
  for (const region of lista) {
    porNombre.set(normalizar(region.nombre), region.id);
    for (const unidad of region.unidades) porNombre.set(normalizar(unidad.nombre), region.id);
  }
  return (nombre) => {
    const exacto = porNombre.get(normalizar(nombre));
    if (exacto) return exacto;
    let mejor: string | null = null;
    let valor = 0.82;
    for (const [clave, id] of porNombre) {
      const p = parecido(normalizar(nombre), clave);
      if (p >= valor) {
        valor = p;
        mejor = id;
      }
    }
    return mejor;
  };
}
