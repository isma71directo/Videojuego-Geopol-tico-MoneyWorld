/**
 * Fronteras del 1 de enero de 2010 (tarea f2-t2).
 *
 * Fuente: Natural Earth 1:10m, versión fijada (dominio público), desde el repositorio
 *         nvkelso/natural-earth-vector: países (admin-0) y zonas en disputa.
 * Correcciones de 2010 (GDD, sección 3) en scripts/datos/manual/mapa-2010.json:
 *  - Sudán y Sudán del Sur unidos; Crimea dentro de Ucrania.
 *  - Abjasia, Osetia del Sur y Transnistria separadas de Georgia y Moldavia; el Sáhara
 *    Occidental entero como territorio en disputa (no como parte de Marruecos).
 *  - Antillas Neerlandesas (Curazao, Sint Maarten, Bonaire, Saba y San Eustaquio) e Islas
 *    del Canal (Jersey y Guernsey) unidas; Åland dentro de Finlandia.
 *  - Territorios dependientes sin datos (Malvinas, Anguila…) dentro de su país soberano.
 *  - Zonas sin país (Antártida, Bir Tawil…) aparte, como zonas neutras.
 *
 * Salida: public/data/mapa-2010-mundo.json y mapa-2010-detalle.json (TopoJSON con los objetos
 *         «paises» y «zonas»), uno por nivel de detalle.
 * Uso:    node scripts/datos/09-fronteras.ts
 */
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import polygonClipping from 'polygon-clipping';
import { geoArea } from 'd3-geo';
import { feature, quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, quantile, simplify, sphericalTriangleArea } from 'topojson-simplify';
import { descargarJson, escribirTexto, leerJson } from './lib/comun.ts';
import {
  areaConSigno,
  comoMultiPoligono,
  longitudMaxima,
  orientarParaD3,
  poligonoMayor,
  redondearPunto,
  type MultiPoligono,
} from './lib/geometria.ts';
import { leerPaises } from './lib/paises.ts';

const VERSION_NE = 'v5.1.2';
const URL_NE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${VERSION_NE}/geojson`;

interface ManualMapa {
  equivalencias: Record<string, string>;
  soberanos: Record<string, string>;
  aSoberano: { unidades: string[] };
  zonasNeutras: Record<string, string>;
  separar: { zona: string; unidadZona?: string; de: string; a: string }[];
  partesAlOeste: { de: string; a: string; longitudMaxima: number }[];
}

type PropiedadesNE = Record<string, string | number | null>;
type ColeccionNE = FeatureCollection<Polygon | MultiPolygon, PropiedadesNE>;

const manual = leerJson<ManualMapa>('scripts/datos/manual/mapa-2010.json');
const sinNotas = <T>(tabla: Record<string, T>): Map<string, T> =>
  new Map(Object.entries(tabla).filter(([clave]) => !clave.startsWith('_')));
const equivalencias = sinNotas(manual.equivalencias);
const soberanos = sinNotas(manual.soberanos);
const zonasNeutras = sinNotas(manual.zonasNeutras);
const aSoberano = new Set(manual.aSoberano.unidades);

const ids = new Set(leerPaises().map((pais) => pais.id));

const [unidades, disputadas] = await Promise.all([
  descargarJson<ColeccionNE>(`${URL_NE}/ne_10m_admin_0_countries.geojson`),
  descargarJson<ColeccionNE>(`${URL_NE}/ne_10m_admin_0_disputed_areas.geojson`),
]);

interface Grupo {
  partes: MultiPoligono[];
  etiqueta?: [number, number];
}
const grupos = new Map<string, Grupo>();
const zonas: Feature<MultiPolygon, { nombre: string }>[] = [];

function anadir(destino: string, geometria: MultiPoligono, etiqueta?: [number, number]): void {
  const grupo = grupos.get(destino) ?? { partes: [] };
  grupo.partes.push(geometria);
  if (etiqueta) grupo.etiqueta = etiqueta;
  grupos.set(destino, grupo);
}

const sinClasificar: string[] = [];
for (const unidad of unidades.features) {
  const p = unidad.properties;
  const codigo = String(p.ADM0_A3);
  let geometria = comoMultiPoligono(unidad.geometry);

  const zona = zonasNeutras.get(codigo);
  if (zona) {
    zonas.push({
      type: 'Feature',
      id: codigo,
      properties: { nombre: zona },
      geometry: { type: 'MultiPolygon', coordinates: geometria },
    });
    continue;
  }

  // Partes lejanas que en 2010 pertenecían a otro territorio (islas del Caribe neerlandés).
  for (const parte of manual.partesAlOeste.filter((regla) => regla.de === codigo)) {
    const oeste = geometria.filter((poligono) => longitudMaxima(poligono) < parte.longitudMaxima);
    geometria = geometria.filter((poligono) => longitudMaxima(poligono) >= parte.longitudMaxima);
    if (oeste.length === 0)
      throw new Error(`${codigo} ya no tiene partes al oeste de ${parte.longitudMaxima}`);
    anadir(parte.a, oeste);
  }

  const destino =
    equivalencias.get(codigo) ??
    (ids.has(codigo) ? codigo : null) ??
    (ids.has(String(p.ISO_A3)) ? String(p.ISO_A3) : null) ??
    (aSoberano.has(codigo) ? (soberanos.get(String(p.SOV_A3)) ?? null) : null);
  if (!destino) {
    sinClasificar.push(`${codigo} (${p.ADMIN})`);
    continue;
  }
  // La etiqueta del país es la de su unidad principal en Natural Earth.
  const principal =
    destino === codigo || destino === p.ISO_A3 || equivalencias.get(codigo) === destino;
  const etiqueta: [number, number] | undefined =
    principal && typeof p.LABEL_X === 'number' && typeof p.LABEL_Y === 'number'
      ? [p.LABEL_X, p.LABEL_Y]
      : undefined;
  anadir(destino, geometria, grupos.get(destino)?.etiqueta ? undefined : etiqueta);
}
if (sinClasificar.length > 0) {
  throw new Error(
    `Unidades de Natural Earth sin clasificar en manual/mapa-2010.json:\n${sinClasificar.join('\n')}`,
  );
}

/** Une las partes de un grupo; si es una sola, la deja tal cual (conserva sus vértices). */
function unir(partes: MultiPoligono[]): MultiPoligono {
  if (partes.length === 1) return partes[0]!;
  return polygonClipping.union(...(partes as [MultiPoligono, ...MultiPoligono[]])) as MultiPoligono;
}

const geometrias = new Map<string, MultiPoligono>();
for (const [id, grupo] of grupos) geometrias.set(id, unir(grupo.partes));

// Zonas que en 2010 tenían otro dueño (Crimea) o eran territorios aparte (Abjasia…).
for (const regla of manual.separar) {
  const zona = disputadas.features.find(
    (f) =>
      f.properties.BRK_NAME === regla.zona &&
      (regla.unidadZona === undefined || f.properties.ADM0_A3 === regla.unidadZona),
  );
  if (!zona) throw new Error(`Natural Earth ya no tiene la zona «${regla.zona}»`);
  const geometriaZona = comoMultiPoligono(zona.geometry);
  const origen = geometrias.get(regla.de);
  if (!origen) throw new Error(`No hay geometría de ${regla.de}`);
  geometrias.set(regla.de, polygonClipping.difference(origen, geometriaZona) as MultiPoligono);
  const destino = geometrias.get(regla.a);
  geometrias.set(
    regla.a,
    destino ? (polygonClipping.union(destino, geometriaZona) as MultiPoligono) : geometriaZona,
  );
  if (!grupos.get(regla.a)?.etiqueta && typeof zona.properties.LABEL_X === 'number') {
    const grupo = grupos.get(regla.a) ?? { partes: [] };
    grupo.etiqueta = [zona.properties.LABEL_X, Number(zona.properties.LABEL_Y)];
    grupos.set(regla.a, grupo);
  }
}

// Comprobación: cada país de los datos tiene geometría y no sobra ninguna.
const sinGeometria = [...ids].filter((id) => !geometrias.has(id));
const sobrantes = [...geometrias.keys()].filter((id) => !ids.has(id));
if (sinGeometria.length > 0 || sobrantes.length > 0) {
  throw new Error(`Sin geometría: ${sinGeometria.join(', ')} · Sin datos: ${sobrantes.join(', ')}`);
}

const paises: Feature<MultiPolygon, { etiqueta: [number, number] }>[] = [...geometrias.keys()]
  .sort()
  .map((id) => {
    const multi = orientarParaD3(geometrias.get(id)!);
    // Si Natural Earth no da punto de etiqueta, se usa el primer vértice del polígono mayor.
    const etiqueta = grupos.get(id)?.etiqueta ?? poligonoMayor(multi)[0]![0]!;
    return {
      type: 'Feature',
      id,
      properties: { etiqueta: redondearPunto(etiqueta) },
      geometry: { type: 'MultiPolygon', coordinates: multi },
    };
  });
for (const zona of zonas)
  zona.geometry.coordinates = orientarParaD3(zona.geometry.coordinates as MultiPoligono);

/**
 * Por debajo de esta área (grados², plana) el polígono principal de un país se protege de la
 * simplificación: así los microestados (Vaticano, Mónaco, San Marino…) y los países isleños
 * pequeños no desaparecen del mapa.
 */
const AREA_PROTEGIDA = 2;

type ArcoConPeso = number[][];
type GeometriaTopo = { type: string; arcs?: number[][][] | number[][]; id?: string | number };

/** Coordenadas de un anillo de TopoJSON a partir de sus arcos (un índice negativo va al revés). */
function anilloDeArcos(arcos: ArcoConPeso[], indices: number[]): number[][] {
  const puntos: number[][] = [];
  for (const indice of indices) {
    const arco = indice < 0 ? [...arcos[~indice]!].reverse() : arcos[indice]!;
    puntos.push(...(puntos.length > 0 ? arco.slice(1) : arco));
  }
  return puntos;
}

/**
 * Marca con peso infinito los puntos de los países pequeños para que la simplificación no los
 * borre: el polígono principal si es pequeño y, con `todo`, todos los polígonos de los países
 * pequeños (la península de Macao, las islas de Malta…). `todo` solo sirve con una rejilla fina:
 * con una gruesa, los atolos diminutos se invierten al cuantizar.
 */
function protegerPequenos(topo: Parameters<typeof presimplify>[0], todo: boolean): void {
  const arcos = topo.arcs as unknown as ArcoConPeso[];
  const paisesTopo = (topo.objects.paises as unknown as { geometries: GeometriaTopo[] }).geometries;
  const proteger = (anillo: number[]): void => {
    for (const indice of anillo) {
      for (const punto of arcos[indice < 0 ? ~indice : indice]!) punto[2] = Infinity;
    }
  };
  for (const geometria of paisesTopo) {
    const poligonos = (
      geometria.type === 'Polygon' ? [geometria.arcs] : geometria.arcs
    ) as number[][][];
    const areas = poligonos.map((poligono) =>
      Math.abs(areaConSigno(anilloDeArcos(arcos, poligono[0]!))),
    );
    const total = areas.reduce((suma, area) => suma + area, 0);
    if (todo && total < AREA_PROTEGIDA) {
      for (const poligono of poligonos) proteger(poligono[0]!);
    } else {
      const mayor = areas.indexOf(Math.max(...areas));
      if (areas[mayor]! < AREA_PROTEGIDA) proteger(poligonos[mayor]![0]!);
    }
  }
}

/** Construye el TopoJSON: fronteras compartidas una sola vez, simplificadas y cuantizadas. */
function mapa(proporcionPuntos: number, cuantizacion: number, protegerTodo: boolean): string {
  const colecciones: Record<string, FeatureCollection> = {
    paises: { type: 'FeatureCollection', features: paises },
    zonas: { type: 'FeatureCollection', features: zonas },
  };
  // Los tipos de topojson-server y topojson-simplify no coinciden del todo: mismo formato.
  const topo = presimplify(
    topology(colecciones, 1e6) as unknown as Parameters<typeof presimplify>[0],
    sphericalTriangleArea,
  );
  // «quantile» ordena los pesos de mayor a menor: devuelve el peso que conserva esa proporción.
  const umbral = quantile(topo, proporcionPuntos);
  protegerPequenos(topo, protegerTodo);
  const simplificado = simplify(topo, umbral);
  return JSON.stringify(quantize(simplificado, cuantizacion));
}

/**
 * Niveles de detalle (tarea f2-t3):
 *  - «mundo»: para ver el mundo entero en el móvil; ligero. Los microestados más pequeños
 *    (Vaticano) quedan por debajo de la rejilla: se tocan por su punto de etiqueta.
 *  - «detalle»: para acercarse a un país o una región; rejilla fina para que no se pierda
 *    ningún país.
 */
const NIVELES = [
  { nombre: 'mundo', proporcionPuntos: 0.03, cuantizacion: 3e4, protegerTodo: false },
  { nombre: 'detalle', proporcionPuntos: 0.12, cuantizacion: 1e6, protegerTodo: true },
];

/**
 * Comprueba que ninguna geometría ha quedado invertida al simplificar o cuantizar: d3-geo la
 * dibujaría cubriendo el resto del mundo.
 */
function comprobarOrientacion(texto: string, nivel: string): void {
  const topo = JSON.parse(texto) as Parameters<typeof feature>[0];
  for (const objeto of ['paises', 'zonas']) {
    const coleccion = feature(topo, topo.objects[objeto]!) as unknown as FeatureCollection;
    for (const f of coleccion.features) {
      if (geoArea(f) > 2 * Math.PI) throw new Error(`${f.id} queda invertido en el nivel ${nivel}`);
    }
  }
}

const tamanos: string[] = [];
for (const nivel of NIVELES) {
  const texto = mapa(nivel.proporcionPuntos, nivel.cuantizacion, nivel.protegerTodo);
  comprobarOrientacion(texto, nivel.nombre);
  escribirTexto(`public/data/mapa-2010-${nivel.nombre}.json`, `${texto}\n`);
  tamanos.push(`${nivel.nombre} ${(texto.length / 1024).toFixed(0)} KB`);
}
console.log(
  `Mapa de 2010: ${paises.length} países y territorios y ${zonas.length} zonas neutras · ` +
    `${tamanos.join(' · ')} (Natural Earth ${VERSION_NE}).`,
);
