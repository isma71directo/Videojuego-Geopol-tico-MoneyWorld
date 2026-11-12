/**
 * Regiones del mapa como eran en 2010 (tarea f5-t1).
 *
 * Fuente: Natural Earth 1:10m, divisiones de primer nivel (admin-1 states provinces), versión
 *         fijada v5.1.2 (dominio público).
 * País de 2010: el de su punto de etiqueta, con las fronteras de 2010 de mapa-2010-detalle.json
 *         (así Crimea queda en Ucrania y los estados del sur de Sudán, en Sudán).
 * Regiones de 2010: scripts/datos/manual/regiones-2010.json dice cómo agrupar las unidades
 *         cuando un país tiene demasiadas (máximo orientativo: 30; el script falla por encima
 *         de «maximo» salvo en las excepciones anotadas) y cómo deshacer los cambios posteriores
 *         a 2010 (Telangana dentro de Andhra Pradesh, Francia con sus 22 regiones de 2010…).
 *         Un país sin divisiones en Natural Earth es una sola región.
 *
 * Salida: public/data/regiones-2010.json (TopoJSON, objeto «regiones», con id, país, nombre y
 *         punto de etiqueta) y fuentes/datos/regiones.json (las unidades de Natural Earth de
 *         cada región, con su identificador de Wikidata, para los datos de la tarea f5-t2).
 * Uso:    node scripts/datos/14-regiones.ts
 */
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { geoArea, geoCentroid, geoContains, geoDistance } from 'd3-geo';
import { feature, merge, quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, quantile, simplify, sphericalTriangleArea } from 'topojson-simplify';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { descargarJson, escribirJsonCompacto, escribirTexto, leerJson } from './lib/comun.ts';
import { comoMultiPoligono, orientarParaD3, redondearPunto } from './lib/geometria.ts';
import { crearLocalizador } from './lib/localizar.ts';
import { leerPaises } from './lib/paises.ts';

const VERSION_NE = 'v5.1.2';
const URL_REGIONES = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${VERSION_NE}/geojson/ne_10m_admin_1_states_provinces.geojson`;
/** Distancia máxima (km) a un país para una unidad cuya etiqueta cae justo en el mar. */
const DISTANCIA_COSTA_KM = 60;
/** Proporción de puntos que se conservan al simplificar y rejilla de cuantización. */
const PROPORCION_PUNTOS = 0.1;
const CUANTIZACION = 1e6;

type Propiedades = Record<string, string | number | null>;

interface ReglaCampo {
  campo: string;
  nombres: Record<string, string>;
  sinCampo?: Record<string, string>;
  equivalentes?: Record<string, string>;
  porNombre?: string[];
  porNacion?: Record<string, string>;
}
interface ReglaLista {
  porCodigo?: boolean;
  grupos: Record<string, string[]>;
}
interface Manual {
  maximo: number;
  excepciones: Record<string, string>;
  agruparPorCampo: Record<string, ReglaCampo | string>;
  agruparPorLista: Record<string, ReglaLista | string>;
  unir: Record<string, string>;
  nombres: Record<string, string>;
  asignar: Record<string, string>;
  excluir: Record<string, string>;
  unaRegion: Record<string, string>;
  nombreOriginal: Record<string, string>;
}

/** Una región de 2010 y las unidades de Natural Earth que la forman. */
interface Region {
  id: string;
  pais: string;
  nombre: string;
  unidades: { nombre: string; codigo: string | null; wikidata: string | null; km2: number }[];
  /** Índices de las unidades en la topología. */
  indices: number[];
}

const manual = leerJson<Manual>('scripts/datos/manual/regiones-2010.json');
const sinNotas = <T>(tabla: Record<string, T | string>): Map<string, T> =>
  new Map(Object.entries(tabla).filter(([clave]) => !clave.startsWith('_')) as [string, T][]);
const porCampo = sinNotas<ReglaCampo>(manual.agruparPorCampo);
const porLista = sinNotas<ReglaLista>(manual.agruparPorLista);
const unir = sinNotas<string>(manual.unir);
const nombresCorregidos = sinNotas<string>(manual.nombres);
const excepciones = sinNotas<string>(manual.excepciones);
const asignar = sinNotas<string>(manual.asignar);
const excluir = sinNotas<string>(manual.excluir);
const unaRegion = sinNotas<string>(manual.unaRegion);
const nombreOriginal = sinNotas<string>(manual.nombreOriginal);
const usadas = new Set<string>();
/**
 * Grupo de las unidades de territorios dependientes sin datos que en 2010 forman parte de su
 * país soberano (Dhekelia en el Reino Unido, San Pedro y Miquelón en Francia…).
 */
const ULTRAMAR = 'Territorios de ultramar';
// Del mapa de 2010: códigos de Natural Earth que son otro nombre de un país de los datos
// (Kosovo, Sudán del Sur…) y territorios sin datos unidos a su país soberano.
const mapa2010 = leerJson<{
  equivalencias: Record<string, string>;
  aSoberano: { unidades: string[] };
}>('scripts/datos/manual/mapa-2010.json');
const equivalencias = sinNotas<string>(mapa2010.equivalencias);
const unidosASoberano = new Set(mapa2010.aSoberano.unidades);

const paises = new Map(leerPaises().map((pais) => [pais.id, pais]));
const localizador = crearLocalizador(leerJson<Topology>('public/data/mapa-2010-detalle.json'));

console.log('Descargando las divisiones de primer nivel de Natural Earth…');
const coleccion =
  await descargarJson<FeatureCollection<Polygon | MultiPolygon, Propiedades>>(URL_REGIONES);
const texto = (unidad: Propiedades, campo: string): string => String(unidad[campo] ?? '');

/** «Comunidad Valenciana» → «comunidad-valenciana». */
const enlace = (nombre: string): string =>
  nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// 1. Cada unidad, en su país de 2010 (por su punto de etiqueta).
const unidades: { f: Feature<Polygon | MultiPolygon, Propiedades>; pais: string }[] = [];
const sinPais: string[] = [];
let sinNombre = 0;
for (const f of coleccion.features) {
  if (!f.geometry || !f.properties.name) {
    sinNombre++;
    continue;
  }
  const lon = Number(f.properties.longitude);
  const lat = Number(f.properties.latitude);
  const codigo = texto(f.properties, 'adm0_a3');
  const claveNE = `${codigo}|${texto(f.properties, 'name')}`;
  if (excluir.has(claveNE)) {
    usadas.add(`excluir:${claveNE}`);
    continue;
  }
  if (asignar.has(claveNE)) usadas.add(`asignar:${claveNE}`);
  const porCodigo = equivalencias.get(codigo) ?? codigo;
  const pais =
    asignar.get(claveNE) ??
    localizador.paisDe(lon, lat) ??
    localizador.paisCercano(lon, lat, DISTANCIA_COSTA_KM) ??
    // Islas que el mapa simplificado no dibuja (Niuas, en Tonga): el país de Natural Earth.
    (paises.has(porCodigo) ? porCodigo : null);
  if (!pais || !paises.has(pais)) {
    sinPais.push(`${texto(f.properties, 'adm0_a3')}|${texto(f.properties, 'name')}`);
    continue;
  }
  f.geometry = {
    type: 'MultiPolygon',
    coordinates: orientarParaD3(comoMultiPoligono(f.geometry)),
  };
  unidades.push({ f, pais });
}

// 2. La región de 2010 de cada unidad: «país|nombre del grupo».
const nombreDeGrupo = new Map<string, string>();
function grupoDe(unidad: Propiedades, pais: string): string {
  const nombre = texto(unidad, 'name');
  if (unaRegion.has(pais)) {
    usadas.add(`unaRegion:${pais}`);
    const nombrePais = paises.get(pais)!.nombre;
    nombreDeGrupo.set(`${pais}|${nombrePais}`, nombrePais);
    return `${pais}|${nombrePais}`;
  }
  if (unidosASoberano.has(texto(unidad, 'adm0_a3'))) {
    nombreDeGrupo.set(`${pais}|${ULTRAMAR}`, ULTRAMAR);
    return `${pais}|${ULTRAMAR}`;
  }
  const lista = porLista.get(pais);
  if (lista) {
    const valor = lista.porCodigo ? texto(unidad, 'iso_3166_2') : nombre;
    const grupo = Object.entries(lista.grupos).find(([, miembros]) => miembros.includes(valor));
    if (!grupo)
      throw new Error(`${pais}: la unidad «${nombre}» (${valor}) no está en ningún grupo`);
    usadas.add(`lista:${pais}`);
    nombreDeGrupo.set(`${pais}|${grupo[0]}`, grupo[0]);
    return `${pais}|${grupo[0]}`;
  }
  const regla = porCampo.get(pais);
  if (regla) {
    usadas.add(`campo:${pais}`);
    let valor: string;
    if (regla.porNacion && regla.porNacion[texto(unidad, 'geonunit')]) {
      const nacion = regla.porNacion[texto(unidad, 'geonunit')]!;
      nombreDeGrupo.set(`${pais}|${nacion}`, nacion);
      return `${pais}|${nacion}`;
    } else if (regla.porNombre?.includes(nombre)) {
      valor = nombre;
    } else {
      valor = texto(unidad, regla.campo) || regla.sinCampo?.[nombre] || '';
      if (!valor) throw new Error(`${pais}: la unidad «${nombre}» no tiene «${regla.campo}»`);
    }
    valor = regla.equivalentes?.[valor] ?? valor;
    const espanol = regla.nombres[valor];
    if (!espanol) throw new Error(`${pais}: falta el nombre en español del grupo «${valor}»`);
    nombreDeGrupo.set(`${pais}|${espanol}`, espanol);
    return `${pais}|${espanol}`;
  }
  // Sin agrupar: la propia unidad, o aquella de la que salió después de 2010.
  const destino = unir.get(`${pais}|${nombre}`);
  if (destino) usadas.add(`unir:${pais}|${nombre}`);
  return `${pais}|${destino ?? nombre}`;
}

const regiones = new Map<string, Region>();
unidades.forEach(({ f, pais }, indice) => {
  const clave = grupoDe(f.properties, pais);
  let region = regiones.get(clave);
  if (!region) {
    region = { id: '', pais, nombre: '', unidades: [], indices: [] };
    regiones.set(clave, region);
  }
  region.indices.push(indice);
  region.unidades.push({
    nombre: texto(f.properties, 'name'),
    codigo: texto(f.properties, 'iso_3166_2') || null,
    wikidata: texto(f.properties, 'wikidataid') || null,
    km2: Number(f.properties.area_sqkm ?? 0),
  });
});

/**
 * Quita de los nombres en español de Natural Earth los prefijos de tipo de división y los
 * artículos sueltos («Voivodato de Silesia» → «Silesia», «del Beni» → «Beni»), salvo si el
 * nombre quedaría igual que el del país («Estado de México»).
 */
function limpiarNombre(nombre: string, nombrePais: string): string {
  const limpio = nombre
    .replace(
      /^(Voivodato|Municipio|Municipalidad|Parroquia|Estado|Departamento|Provincia|Distrito|Gobernación|Gobernorado|Condado|Prefectura|Óblast|Cantón|Región|Autónoma) (de la |de los |de las |del |de )/u,
      '',
    )
    .replace(/^(del|de|las|los|la|el) /u, '');
  const conMayuscula = limpio.charAt(0).toLocaleUpperCase('es') + limpio.slice(1);
  return conMayuscula === nombrePais ? nombre : conMayuscula;
}

// Nombre en español de cada región: el del grupo, o el de su unidad principal.
for (const [clave, region] of regiones) {
  const deGrupo = nombreDeGrupo.get(clave);
  if (deGrupo) {
    region.nombre = deGrupo;
    continue;
  }
  const nombreNE = clave.slice(clave.indexOf('|') + 1);
  const principal = unidades.find(
    ({ f, pais }) => pais === region.pais && texto(f.properties, 'name') === nombreNE,
  );
  const corregido = nombresCorregidos.get(`${region.pais}|${nombreNE}`);
  if (corregido) usadas.add(`nombre:${region.pais}|${nombreNE}`);
  const espanol =
    principal && !nombreOriginal.has(region.pais) ? texto(principal.f.properties, 'name_es') : '';
  if (nombreOriginal.has(region.pais)) usadas.add(`original:${region.pais}`);
  region.nombre =
    corregido ?? (espanol ? limpiarNombre(espanol, paises.get(region.pais)!.nombre) : nombreNE);
}

/**
 * Punto dentro del polígono más grande de una región y lo más alejado posible de sus bordes
 * (búsqueda en una rejilla de 24 × 24). Null si el polígono es demasiado pequeño.
 */
function puntoInterior(multi: MultiPolygon): [number, number] | null {
  const mayor = multi.coordinates
    .map((poligono) => ({ poligono, area: geoArea({ type: 'Polygon', coordinates: poligono }) }))
    .sort((a, b) => b.area - a.area)[0];
  if (!mayor) return null;
  const forma: Polygon = { type: 'Polygon', coordinates: mayor.poligono };
  const puntos = mayor.poligono.flat();
  const xs = puntos.map((p) => p[0]!);
  const ys = puntos.map((p) => p[1]!);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let mejor: [number, number] | null = null;
  let holgura = -1;
  const pasos = 24;
  for (let i = 1; i < pasos; i++) {
    for (let j = 1; j < pasos; j++) {
      const candidato: [number, number] = [
        x0 + ((x1 - x0) * i) / pasos,
        y0 + ((y1 - y0) * j) / pasos,
      ];
      if (!geoContains(forma, candidato)) continue;
      let cerca = Infinity;
      for (const p of puntos)
        cerca = Math.min(cerca, geoDistance(p as [number, number], candidato));
      if (cerca > holgura) {
        holgura = cerca;
        mejor = candidato;
      }
    }
  }
  return mejor;
}

// 3. Comprobaciones: tabla manual al día y no más regiones de la cuenta por país.
const sobran = [
  ...[...porLista.keys()].map((p) => `lista:${p}`),
  ...[...porCampo.keys()].map((p) => `campo:${p}`),
  ...[...unir.keys()].map((c) => `unir:${c}`),
  ...[...nombresCorregidos.keys()].map((c) => `nombre:${c}`),
  ...[...asignar.keys()].map((c) => `asignar:${c}`),
  ...[...excluir.keys()].map((c) => `excluir:${c}`),
  ...[...unaRegion.keys()].map((p) => `unaRegion:${p}`),
  ...[...nombreOriginal.keys()].map((p) => `original:${p}`),
].filter((clave) => !usadas.has(clave));
if (sobran.length > 0) {
  console.error(`Entradas de manual/regiones-2010.json sin usar:\n  ${sobran.join('\n  ')}`);
  process.exit(1);
}
const repetidos = [...regiones.values()]
  .map((r) => `${r.pais}|${r.nombre}`)
  .filter((clave, i, todas) => todas.indexOf(clave) !== i);
if (repetidos.length > 0) {
  console.error(
    `Regiones con el mismo nombre en un país (corregir en «nombres»):\n  ${repetidos.join('\n  ')}`,
  );
  process.exit(1);
}
const cuenta = new Map<string, number>();
for (const region of regiones.values()) cuenta.set(region.pais, (cuenta.get(region.pais) ?? 0) + 1);
const demasiadas = [...cuenta].filter(([pais, n]) => n > manual.maximo && !excepciones.has(pais));
if (demasiadas.length > 0) {
  console.error(
    `Países con más de ${manual.maximo} regiones (agruparlos en manual/regiones-2010.json):\n  ` +
      demasiadas.map(([pais, n]) => `${pais}: ${n}`).join('\n  '),
  );
  process.exit(1);
}

// 4. Geometría de cada región: unión de sus unidades (las fronteras se comparten en TopoJSON).
const coleccionUnidades: Record<string, FeatureCollection> = {
  unidades: { type: 'FeatureCollection', features: unidades.map((u) => u.f) },
};
const topoUnidades = topology(coleccionUnidades, 1e7) as unknown as Topology<{
  unidades: GeometryCollection;
}>;
const geometrias = topoUnidades.objects.unidades.geometries;
const usados = new Set<string>();
const salida: Feature<
  MultiPolygon,
  { id: string; pais: string; nombre: string; etiqueta: [number, number] }
>[] = [];
const ordenadas = [...regiones.values()].sort(
  (a, b) => a.pais.localeCompare(b.pais) || a.nombre.localeCompare(b.nombre, 'es'),
);
for (const region of ordenadas) {
  let id = `${region.pais}-${enlace(region.nombre)}`;
  for (let n = 2; usados.has(id); n++) id = `${region.pais}-${enlace(region.nombre)}-${n}`;
  usados.add(id);
  region.id = id;
  const unida = merge(
    topoUnidades as unknown as Parameters<typeof merge>[0],
    region.indices.map((i) => geometrias[i]!) as unknown as Parameters<typeof merge>[1],
  );
  const multi = orientarParaD3(comoMultiPoligono(unida));
  const forma: Feature<MultiPolygon> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'MultiPolygon', coordinates: multi },
  };
  // Etiqueta: el centro si cae dentro; si no, la etiqueta de la unidad más grande.
  const centro = geoCentroid(forma) as [number, number];
  const mayor = region.indices
    .map((i) => unidades[i]!.f.properties)
    .sort((a, b) => Number(b.area_sqkm ?? 0) - Number(a.area_sqkm ?? 0))[0]!;
  const etiqueta = geoContains(forma, centro)
    ? centro
    : ([Number(mayor.longitude), Number(mayor.latitude)] as [number, number]);
  salida.push({
    type: 'Feature',
    id,
    properties: {
      id,
      pais: region.pais,
      nombre: region.nombre,
      etiqueta: redondearPunto(etiqueta),
    },
    geometry: { type: 'MultiPolygon', coordinates: multi },
  });
}

// Países sin divisiones en Natural Earth: una sola región con la forma del país.
const conRegiones = new Set(salida.map((f) => f.properties.pais));
for (const [id, pais] of paises) {
  if (conRegiones.has(id)) continue;
  const forma = localizador.forma(id);
  if (!forma) continue;
  const multi = orientarParaD3(comoMultiPoligono(forma));
  const idRegion = `${id}-${enlace(pais.nombre)}`;
  const centro = geoCentroid({ type: 'MultiPolygon', coordinates: multi }) as [number, number];
  salida.push({
    type: 'Feature',
    id: idRegion,
    properties: { id: idRegion, pais: id, nombre: pais.nombre, etiqueta: redondearPunto(centro) },
    geometry: { type: 'MultiPolygon', coordinates: multi },
  });
  regiones.set(`${id}|${pais.nombre}`, {
    id: idRegion,
    pais: id,
    nombre: pais.nombre,
    unidades: [],
    indices: [],
  });
}

// 5. TopoJSON final, simplificado y cuantizado como el nivel de detalle del mapa.
const coleccionRegiones: Record<string, FeatureCollection> = {
  regiones: { type: 'FeatureCollection', features: salida },
};
const topo = presimplify(
  topology(coleccionRegiones, 1e6) as unknown as Parameters<typeof presimplify>[0],
  sphericalTriangleArea,
);
const simplificado = simplify(topo, quantile(topo, PROPORCION_PUNTOS));
const final = quantize(simplificado, CUANTIZACION) as unknown as Topology<{
  regiones: GeometryCollection<{ id: string }>;
}>;
// Un islote diminuto puede quedar invertido al simplificar o cuantizar (d3 lo dibujaría
// cubriendo el resto del mundo): se quita de la región; el mapa de países ya lo dibuja.
let islotesQuitados = 0;
for (const geometria of final.objects.regiones.geometries) {
  const g = geometria as unknown as { type: string; arcs: number[][][] | number[][][][] };
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue;
  const poligonos = (g.type === 'Polygon' ? [g.arcs] : g.arcs) as number[][][];
  const validos = poligonos.filter((arcos) => {
    const f = feature(
      final as unknown as Parameters<typeof feature>[0],
      {
        type: 'Polygon',
        arcs: arcos,
      } as unknown as Parameters<typeof feature>[1],
    );
    return geoArea(f as unknown as Feature) <= 2 * Math.PI;
  });
  islotesQuitados += poligonos.length - validos.length;
  if (validos.length === 0) throw new Error(`La región ${geometria.id} se queda sin polígonos`);
  g.type = 'MultiPolygon';
  g.arcs = validos;
}
// La etiqueta debe caer dentro de la región ya simplificada: si no (una región que rodea a
// otra, como Bohemia Central alrededor de Praga), se busca el punto interior más alejado de
// los bordes.
let etiquetasMovidas = 0;
const decodificadas = (
  feature(
    final as unknown as Parameters<typeof feature>[0],
    final.objects.regiones as unknown as Parameters<typeof feature>[1],
  ) as unknown as FeatureCollection<MultiPolygon, { etiqueta: [number, number] }>
).features;
decodificadas.forEach((region, i) => {
  if (geoContains(region, region.properties.etiqueta)) return;
  const interior = puntoInterior(region.geometry);
  if (!interior) return;
  const propiedades = (
    final.objects.regiones.geometries[i] as unknown as {
      properties: { etiqueta: [number, number] };
    }
  ).properties;
  propiedades.etiqueta = redondearPunto(interior);
  etiquetasMovidas++;
});
const textoTopo = JSON.stringify(final);
escribirTexto('public/data/regiones-2010.json', `${textoTopo}\n`);
escribirJsonCompacto(
  'fuentes/datos/regiones.json',
  {
    fuente: `Natural Earth 1:10m, divisiones de primer nivel ${VERSION_NE} (dominio público), agrupadas como en 2010 según scripts/datos/manual/regiones-2010.json.`,
    regiones: [...regiones.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, pais, nombre, unidades: miembros }) => ({
        id,
        pais,
        nombre,
        unidades: miembros,
      })),
  },
  2,
);

const porPais = [...cuenta.values()];
console.log(
  `regiones-2010.json: ${salida.length} regiones de ${conRegiones.size} países ` +
    `(+${salida.length - [...regiones.values()].filter((r) => r.indices.length > 0).length} países de una sola región), ` +
    `máximo ${Math.max(...porPais)} por país; ${(textoTopo.length / 1024).toFixed(0)} KB; ` +
    `${islotesQuitados} islotes invertidos quitados; ${etiquetasMovidas} etiquetas recolocadas. ` +
    `Unidades sin nombre: ${sinNombre}; sin país de 2010: ${sinPais.length}${sinPais.length ? ` (${sinPais.join(', ')})` : ''}.`,
);
