/**
 * Recursos naturales: reservas y producción (tarea f1-t3).
 *
 * Fuentes, todas servidas por Our World in Data:
 *  - Reservas probadas de petróleo, gas y carbón (Energy Institute y EIA), años 2008–2010:
 *    https://ourworldindata.org/grapher/oil-proved-reserves (y las de gas y carbón).
 *  - Producción minera por país (USGS y British Geological Survey), años 2008–2010:
 *    https://ourworldindata.org/explorers/minerals
 *  - Reservas minerales por país (USGS): la fuente solo las publica desde 2022. Se guarda el
 *    primer año disponible y el conjunto final las marca como estimación para 2010.
 *
 * Salida: fuentes/datos/recursos.json
 * Uso:    node scripts/datos/05-recursos.ts
 */
import {
  descargarJson,
  descargarTexto,
  escribirJsonCompacto,
  leerCsv,
  numero,
  redondear,
} from './lib/comun.ts';
import { hoy, leerPaises } from './lib/paises.ts';
import type { ArchivoFuente, SeriePorPais } from './lib/tipos.ts';

const ANIOS = [2008, 2009, 2010];

const codigos = new Set(
  leerPaises()
    .map((pais) => pais.codigos.owid)
    .filter((codigo): codigo is string => codigo !== null),
);
codigos.add('SSD');

const salida: ArchivoFuente = {
  fuente: 'Our World in Data: Energy Institute y EIA (reservas fósiles); USGS y BGS (minerales)',
  url: 'https://ourworldindata.org/explorers/minerals',
  descargado: hoy(),
  indicadores: {},
};

function ordenar(valores: SeriePorPais): SeriePorPais {
  return Object.fromEntries(
    Object.keys(valores)
      .sort()
      .map((codigo) => [codigo, valores[codigo]!]),
  );
}

// ── 1) Reservas probadas de combustibles fósiles ─────────────────────────────────────────

const FOSILES = [
  {
    clave: 'reservasPetroleo',
    grafico: 'oil-proved-reserves',
    columna: 'oil_reserves_m3',
    descripcion: 'Reservas probadas de petróleo',
    unidad: 'millones de barriles',
    // 1 m³ = 6,2898 barriles.
    factor: 6.2898 / 1e6,
  },
  {
    clave: 'reservasGas',
    grafico: 'natural-gas-proved-reserves',
    columna: 'gas_reserves_m3',
    descripcion: 'Reservas probadas de gas natural',
    unidad: 'miles de millones de m³',
    factor: 1 / 1e9,
  },
  {
    clave: 'reservasCarbon',
    grafico: 'coal-proved-reserves',
    columna: 'coal_reserves_tonnes',
    descripcion: 'Reservas probadas de carbón',
    unidad: 'millones de toneladas',
    factor: 1 / 1e6,
  },
];

for (const fosil of FOSILES) {
  const url = `https://ourworldindata.org/grapher/${fosil.grafico}.csv?csvType=full&useColumnShortNames=true`;
  const filas = leerCsv(await descargarTexto(url));
  const valores: SeriePorPais = {};
  for (const fila of filas) {
    const valor = numero(fila[fosil.columna]);
    if (valor === null || !codigos.has(fila.code!) || !ANIOS.includes(Number(fila.year))) continue;
    (valores[fila.code!] ??= {})[fila.year!] = redondear(valor * fosil.factor);
  }
  salida.indicadores[fosil.clave] = {
    codigo: fosil.grafico,
    descripcion: fosil.descripcion,
    unidad: fosil.unidad,
    valores: ordenar(valores),
  };
  console.log(`${fosil.clave.padEnd(26)} ${Object.keys(valores).length} países`);
}

// ── 2) Minerales: producción y reservas ──────────────────────────────────────────────────

/**
 * Mineral del juego → nombre en las columnas de OWID («reserves_<owid>_tonnes»).
 * La producción de 2010 por país sale del conjunto de minerales («minerales»), de un gráfico
 * del Energy Institute («grafico») o no existe en ninguna fuente accesible (null).
 */
interface Mineral {
  owid: string;
  nombre: string;
  produccion: 'minerales' | { grafico: string; columna: string } | null;
}

const MINERALES: Record<string, Mineral> = {
  Hierro: { owid: 'iron_ore_mine__crude_ore', nombre: 'mineral de hierro', produccion: null },
  Cobre: { owid: 'copper_mine', nombre: 'cobre', produccion: 'minerales' },
  Bauxita: { owid: 'bauxite_mine', nombre: 'bauxita', produccion: 'minerales' },
  Niquel: { owid: 'nickel_mine', nombre: 'níquel', produccion: null },
  // Las columnas se llaman «_kt», pero los valores están en toneladas (comprobado con el
  // total mundial de 2010: unas 26.000 t de litio y unas 129.000 t de cobalto).
  Litio: {
    owid: 'lithium_mine',
    nombre: 'litio',
    produccion: { grafico: 'lithium-production', columna: 'lithium_production_kt' },
  },
  Cobalto: {
    owid: 'cobalt_mine',
    nombre: 'cobalto',
    produccion: { grafico: 'cobalt-production', columna: 'cobalt_production_kt' },
  },
  TierrasRaras: { owid: 'rare_earths_mine', nombre: 'tierras raras', produccion: null },
  Oro: { owid: 'gold_mine', nombre: 'oro', produccion: 'minerales' },
  Plata: { owid: 'silver_mine', nombre: 'plata', produccion: 'minerales' },
  Fosfatos: { owid: 'phosphate_rock_mine', nombre: 'roca fosfática', produccion: 'minerales' },
  Uranio: { owid: 'uranium_mine', nombre: 'uranio', produccion: 'minerales' },
};

// La página del explorador lista cada columna con el número de su indicador.
const explorador = await descargarTexto('https://ourworldindata.org/explorers/minerals');
const indicadores = new Map(
  [...explorador.matchAll(/minerals\/minerals#([a-z0-9_]+)\\t(\d+)/g)].map((m) => [m[1]!, m[2]!]),
);

interface DatosOwid {
  values: number[];
  years: number[];
  entities: number[];
}
interface MetaOwid {
  dimensions: { entities: { values: { id: number; code: string | null }[] } };
}

/** Descarga un indicador de OWID y lo devuelve como país → año → valor. */
async function indicador(columna: string): Promise<SeriePorPais | null> {
  const id = indicadores.get(columna);
  if (!id) return null;
  const base = `https://api.ourworldindata.org/v1/indicators/${id}`;
  const datos = await descargarJson<DatosOwid>(`${base}.data.json`);
  const meta = await descargarJson<MetaOwid>(`${base}.metadata.json`);
  const codigoDe = new Map(meta.dimensions.entities.values.map((e) => [e.id, e.code]));
  const serie: SeriePorPais = {};
  datos.values.forEach((valor, i) => {
    const codigo = codigoDe.get(datos.entities[i]!);
    if (!codigo || !codigos.has(codigo) || !Number.isFinite(valor)) return;
    (serie[codigo] ??= {})[String(datos.years[i])] = redondear(valor);
  });
  return serie;
}

/** Producción por país de un gráfico de OWID (CSV), solo los años del escenario. */
async function produccionDeGrafico(grafico: string, columna: string): Promise<SeriePorPais> {
  const url = `https://ourworldindata.org/grapher/${grafico}.csv?csvType=full&useColumnShortNames=true`;
  const serie: SeriePorPais = {};
  for (const fila of leerCsv(await descargarTexto(url))) {
    const valor = numero(fila[columna]);
    if (valor === null || !codigos.has(fila.code!)) continue;
    (serie[fila.code!] ??= {})[fila.year!] = redondear(valor);
  }
  return serie;
}

const sinProduccion: string[] = [];

for (const [mineral, { owid, nombre, produccion: origen }] of Object.entries(MINERALES)) {
  const produccionAnios: SeriePorPais = {};
  if (origen === null) {
    sinProduccion.push(nombre);
  } else {
    const produccion =
      origen === 'minerales'
        ? await indicador(`production_${owid}_tonnes`)
        : await produccionDeGrafico(origen.grafico, origen.columna);
    if (!produccion) throw new Error(`OWID ya no publica la producción de ${nombre}`);
    for (const [codigo, serie] of Object.entries(produccion)) {
      const filtrada = Object.fromEntries(
        ANIOS.filter((a) => a in serie).map((a) => [a, serie[a]!]),
      );
      if (Object.keys(filtrada).length > 0) produccionAnios[codigo] = filtrada;
    }
    salida.indicadores[`produccion${mineral}`] = {
      codigo: origen === 'minerales' ? `production_${owid}_tonnes` : origen.grafico,
      descripcion: `Producción minera de ${nombre}`,
      unidad: 'toneladas',
      valores: ordenar(produccionAnios),
    };
  }

  // Reservas: solo el primer año que publique la fuente (2022 en adelante).
  const reservas = await indicador(`reserves_${owid}_tonnes`);
  const reservasPrimerAnio: SeriePorPais = {};
  for (const [codigo, serie] of Object.entries(reservas ?? {})) {
    const primero = Object.keys(serie).sort()[0];
    if (primero) reservasPrimerAnio[codigo] = { [primero]: serie[primero]! };
  }
  if (reservas) {
    salida.indicadores[`reservas${mineral}`] = {
      codigo: `reserves_${owid}_tonnes`,
      descripcion: `Reservas de ${nombre} (primer año publicado; no hay dato de 2010)`,
      unidad: 'toneladas',
      valores: ordenar(reservasPrimerAnio),
    };
  }
  console.log(
    `${mineral.padEnd(14)} producción 2008–2010: ${String(Object.keys(produccionAnios).length).padStart(3)} países · reservas: ${Object.keys(reservasPrimerAnio).length} países`,
  );
}

salida.notas = [
  `Sin producción por país en 2010 en las fuentes accesibles: ${sinProduccion.join(', ')}. Pendiente para la Fase 43 (recursos naturales).`,
  'Las reservas minerales por país solo se publican desde 2022; se guarda el primer año disponible.',
];
escribirJsonCompacto('fuentes/datos/recursos.json', salida, 4);
