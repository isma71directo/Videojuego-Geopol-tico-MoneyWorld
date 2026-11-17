/**
 * Cuentas nacionales de 2010 por país (tarea f15-t1, plan de la Fase 15, decisión del jugador:
 * siete sectores con datos reales): el peso de siete ramas de actividad en el valor añadido y el
 * reparto de la demanda (consumo de los hogares, consumo público, inversión, exportaciones e
 * importaciones) en el PIB.
 *
 * Fuentes:
 *  - ONU, División de Estadística (UNSD), «National Accounts – Analysis of Main Aggregates»
 *    (AMA): «GDP and its breakdown at current prices in US Dollars», todos los países
 *    (https://unstats.un.org/unsd/amaapi/api/file/2). Años 2008–2010. Uso libre citando la
 *    fuente (condiciones de UNdata).
 *  - ONU (UNSD), «Standard country or area codes for statistical use (M49)»: equivalencia entre
 *    el código M49 y el ISO 3166-1 alfa-3 (https://unstats.un.org/unsd/methodology/m49/overview/),
 *    para cruzar la ONU con los países del juego.
 *
 * Las siete ramas (CIIU rev. 3): agricultura, ganadería y pesca (A-B); minería y energía (C y E,
 * que la ONU da junto a la manufactura: se resta); industria manufacturera (D); construcción (F);
 * comercio, hostelería y turismo (G-H); transporte y comunicaciones (I); y otros servicios (J-P).
 *
 * Salida: fuentes/datos/onu-cuentas.json (códigos ISO3, como el Banco Mundial)
 * Uso:    node scripts/datos/25-onu-cuentas.ts (después, 10-construir.ts)
 */
import ExcelJS from 'exceljs';
import { descargar, descargarTexto, escribirJsonCompacto, redondear } from './lib/comun.ts';
import { codigosFuente, hoy, leerPaises } from './lib/paises.ts';
import type { ArchivoFuente, SeriePorPais } from './lib/tipos.ts';

const URL_ONU = 'https://unstats.un.org/unsd/amaapi/api/file/2';
const URL_M49 = 'https://unstats.un.org/unsd/methodology/m49/overview/';
const ANIOS = ['2008', '2009', '2010'];

/** Filas de la hoja de la ONU que se usan (columna «IndicatorName»). */
const FILAS = {
  hogares:
    'Household consumption expenditure (including Non-profit institutions serving households)',
  publico: 'General government final consumption expenditure',
  inversion: 'Gross capital formation',
  exportaciones: 'Exports of goods and services',
  importaciones: 'Imports of goods and services',
  pib: 'Gross Domestic Product (GDP)',
  agricultura: 'Agriculture, hunting, forestry, fishing (ISIC A-B)',
  industria: 'Mining, Manufacturing, Utilities (ISIC C-E)',
  manufactura: 'Manufacturing (ISIC D)',
  construccion: 'Construction (ISIC F)',
  comercio: 'Wholesale, retail trade, restaurants and hotels (ISIC G-H)',
  transporte: 'Transport, storage and communication (ISIC I)',
  otros: 'Other Activities (ISIC J-P)',
  total: 'Total Value Added',
} as const;
type Fila = keyof typeof FILAS;

/**
 * Códigos M49 sin ISO3 en la tabla de la ONU o que hay que tomar por partes, como hace el Banco
 * Mundial: el Sudán de 2010 se suma con sus dos partes (Sudán y Sudán del Sur) y las Antillas
 * Neerlandesas, con Curazao y Sint Maarten (el juego los une con «componentes»).
 */
const M49_A_MANO: Record<number, string | null> = {
  412: 'XKX', // Kosovo (código del Banco Mundial; no tiene código M49 propio).
  729: 'SDN', // Sudán (sin Sudán del Sur).
  728: 'SSD', // Sudán del Sur.
  736: null, // «Sudan (Former)»: se usan las dos partes, como en el Banco Mundial.
  530: null, // Antillas Neerlandesas: se usan Curazao (531) y Sint Maarten (534).
  830: 'CHI', // Islas del Canal (código del Banco Mundial; sin ISO3).
  835: 'TZA', // Tanzania continental …
  836: 'TZA', // … y Zanzíbar: la ONU las da por separado y se suman.
};

/** Texto de una celda HTML, sin etiquetas ni espacios de más. */
const textoCelda = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .trim();

/**
 * Equivalencias M49 → ISO3 de la tabla oficial de la ONU (la primera tabla de la página, en
 * inglés): columnas «M49 Code» e «ISO-alpha3 Code».
 */
async function equivalencias(): Promise<Map<number, string>> {
  const html = await descargarTexto(URL_M49);
  const inicio = html.indexOf('id = "downloadTableEN"');
  const fin = html.indexOf('</table>', inicio);
  if (inicio < 0 || fin < 0) throw new Error('La página M49 de la ONU ha cambiado: sin la tabla');
  const filas = [...html.slice(inicio, fin).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((fila) =>
    [...fila[1]!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((celda) =>
      textoCelda(celda[1]!),
    ),
  );
  const cabecera = filas[0] ?? [];
  const [columnaM49, columnaIso3] = [
    cabecera.indexOf('M49 Code'),
    cabecera.indexOf('ISO-alpha3 Code'),
  ];
  if (columnaM49 < 0 || columnaIso3 < 0) throw new Error('La tabla M49 de la ONU ha cambiado');
  const mapa = new Map<number, string>();
  for (const fila of filas.slice(1)) {
    const m49 = Number(fila[columnaM49]);
    const iso3 = fila[columnaIso3] ?? '';
    if (Number.isInteger(m49) && /^[A-Z]{3}$/.test(iso3)) mapa.set(m49, iso3);
  }
  if (mapa.size < 200) throw new Error(`Tabla M49 incompleta: ${mapa.size} países`);
  return mapa;
}

const codigos = codigosFuente(leerPaises(), 'bm');
const deLaOnu = await equivalencias();
/** ISO3 del juego para un código M49, o null si no es un país del juego. */
function iso3De(m49: number): string | null {
  if (m49 in M49_A_MANO) return M49_A_MANO[m49] ?? null;
  const iso3 = deLaOnu.get(m49);
  return iso3 && codigos.has(iso3) ? iso3 : null;
}

// La hoja de la ONU: una fila por país e indicador, una columna por año.
const libro = new ExcelJS.Workbook();
await libro.xlsx.load(await (await descargar(URL_ONU)).arrayBuffer());
const hoja = libro.worksheets[0]!;
const cabecera = (hoja.getRow(3).values as unknown[]).map((valor) => String(valor ?? ''));
const columnaDe = (titulo: string): number => {
  const columna = cabecera.indexOf(titulo);
  if (columna < 0) throw new Error(`La hoja de la ONU no tiene la columna «${titulo}»`);
  return columna;
};
const [columnaPais, columnaIndicador] = [columnaDe('CountryID'), columnaDe('IndicatorName')];
const columnaAnio = Object.fromEntries(ANIOS.map((anio) => [anio, columnaDe(anio)]));

/** datos[iso3][fila][año] en dólares corrientes. */
const datos = new Map<string, Partial<Record<Fila, Record<string, number>>>>();
const sinEquivalencia = new Set<string>();
const filaDe = new Map<string, Fila>(
  Object.entries(FILAS).map(([clave, texto]) => [texto, clave as Fila]),
);
hoja.eachRow((fila, numero) => {
  if (numero <= 3) return;
  const valores = fila.values as unknown[];
  const fuente = filaDe.get(String(valores[columnaIndicador] ?? ''));
  if (!fuente) return;
  const m49 = Number(valores[columnaPais]);
  const iso3 = iso3De(m49);
  if (!iso3) {
    sinEquivalencia.add(`${m49} ${String(valores[columnaPais + 1] ?? '')}`);
    return;
  }
  const serie: Record<string, number> = {};
  for (const anio of ANIOS) {
    const valor = valores[columnaAnio[anio]!];
    if (typeof valor === 'number' && Number.isFinite(valor)) serie[anio] = valor;
  }
  const delPais = datos.get(iso3) ?? {};
  const anterior = delPais[fuente];
  if (anterior) {
    // Dos filas del mismo país (Tanzania continental y Zanzíbar): se suman los años de las dos.
    for (const anio of ANIOS) {
      if (anterior[anio] !== undefined && serie[anio] !== undefined) anterior[anio] += serie[anio];
      else delete anterior[anio];
    }
  } else {
    delPais[fuente] = serie;
  }
  datos.set(iso3, delPais);
});

/** Indicadores de salida: cómo se calculan a partir de las filas de la ONU. */
const INDICADORES: Record<
  string,
  {
    descripcion: string;
    unidad: string;
    calcular: (f: (fila: Fila) => number | undefined) => number | undefined;
  }
> = {};
const porcentaje = (parte: number | undefined, total: number | undefined): number | undefined =>
  parte !== undefined && total !== undefined && total > 0
    ? redondear((parte / total) * 100, 4)
    : undefined;

// Ramas: peso en el valor añadido. Si a un país le falta alguna rama pero las demás ya suman casi
// todo su valor añadido (al menos el 98 %), la que falta vale 0: la ONU la incluye en otra (p. ej.
// en Corea del Norte el comercio y el transporte van en «otros servicios») o no existe (la
// agricultura de Macao). Si no, se queda sin dato y se estima en la construcción.
const RAMAS: Record<
  string,
  { descripcion: string; valor: (f: (fila: Fila) => number | undefined) => number | undefined }
> = {
  vabAgricultura: {
    descripcion: 'Agricultura, ganadería, silvicultura y pesca (CIIU A-B)',
    valor: (f) => f('agricultura'),
  },
  vabMineriaEnergia: {
    descripcion: 'Minería, electricidad, gas y agua (CIIU C y E)',
    valor: (f) => {
      const industria = f('industria');
      const manufactura = f('manufactura');
      return industria !== undefined && manufactura !== undefined
        ? Math.max(0, industria - manufactura)
        : undefined;
    },
  },
  vabManufactura: {
    descripcion: 'Industria manufacturera (CIIU D)',
    valor: (f) => f('manufactura'),
  },
  vabConstruccion: { descripcion: 'Construcción (CIIU F)', valor: (f) => f('construccion') },
  vabComercio: {
    descripcion: 'Comercio, hostelería y restauración (CIIU G-H)',
    valor: (f) => f('comercio'),
  },
  vabTransporte: {
    descripcion: 'Transporte, almacenamiento y comunicaciones (CIIU I)',
    valor: (f) => f('transporte'),
  },
  vabOtrosServicios: {
    descripcion:
      'Otros servicios: finanzas, inmobiliaria, administración, educación, sanidad… (CIIU J-P)',
    valor: (f) => f('otros'),
  },
};
const CUBIERTO = 0.98;
/** Las siete ramas de un país y año (las que faltan, a 0 si el resto cubre el total), o null. */
function ramas(f: (fila: Fila) => number | undefined): Record<string, number> | null {
  const valores = Object.fromEntries(
    Object.entries(RAMAS).map(([clave, rama]) => [clave, rama.valor(f)]),
  );
  const presentes = Object.values(valores).filter((valor) => valor !== undefined) as number[];
  if (presentes.length === 0) return null;
  const suma = presentes.reduce((total, valor) => total + valor, 0);
  if (presentes.length < Object.keys(RAMAS).length) {
    // Con la manufactura y sin el total de C-E (o al revés) no se sabe la minería: sin dato.
    const total = f('total');
    if (total === undefined || total <= 0 || suma / total < CUBIERTO) return null;
  }
  return Object.fromEntries(Object.entries(valores).map(([clave, valor]) => [clave, valor ?? 0]));
}
for (const clave of Object.keys(RAMAS)) {
  INDICADORES[clave] = {
    descripcion: RAMAS[clave]!.descripcion,
    unidad: '% del valor añadido',
    calcular: (f) => {
      const todas = ramas(f);
      if (!todas) return undefined;
      const suma = Object.values(todas).reduce((total, valor) => total + valor, 0);
      return porcentaje(todas[clave], suma);
    },
  };
}
// Demanda: peso en el PIB.
const DEMANDA: Record<string, { fila: Fila; descripcion: string }> = {
  consumoHogaresPib: { fila: 'hogares', descripcion: 'Consumo de los hogares (con las ISFLSH)' },
  consumoPublicoPib: {
    fila: 'publico',
    descripcion: 'Consumo final de las administraciones públicas',
  },
  inversionPib: { fila: 'inversion', descripcion: 'Formación bruta de capital (inversión)' },
  exportacionesPib: { fila: 'exportaciones', descripcion: 'Exportaciones de bienes y servicios' },
  importacionesPib: { fila: 'importaciones', descripcion: 'Importaciones de bienes y servicios' },
};
for (const [clave, { fila, descripcion }] of Object.entries(DEMANDA)) {
  INDICADORES[clave] = {
    descripcion,
    unidad: '% del PIB',
    calcular: (f) => porcentaje(f(fila), f('pib')),
  };
}

const salida: ArchivoFuente = {
  fuente: 'ONU (UNSD), National Accounts – Analysis of Main Aggregates; códigos M49 de la ONU',
  url: URL_ONU,
  descargado: hoy(),
  notas: [
    'Minería y energía = (CIIU C-E) − manufactura (D); las siete ramas suman el 100 % del valor añadido.',
    'Si faltan ramas pero las demás suman al menos el 98 % del valor añadido, las que faltan valen 0.',
    'Tanzania = Tanzania continental + Zanzíbar.',
    'El Sudán de 2010 y las Antillas Neerlandesas se toman por partes, como en el Banco Mundial.',
  ],
  indicadores: {},
};
for (const [clave, indicador] of Object.entries(INDICADORES)) {
  const valores: SeriePorPais = {};
  for (const [iso3, filas] of [...datos.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const serie: Record<string, number> = {};
    for (const anio of ANIOS) {
      const valor = indicador.calcular((fila) => filas[fila]?.[anio]);
      if (valor !== undefined) serie[anio] = valor;
    }
    if (Object.keys(serie).length > 0) valores[iso3] = serie;
  }
  salida.indicadores[clave] = {
    codigo: clave,
    descripcion: indicador.descripcion,
    unidad: indicador.unidad,
    valores,
  };
  console.log(`${clave.padEnd(20)} ${Object.keys(valores).length} países`);
}
console.log(
  `Sin equivalencia en el juego (regiones o países fuera del escenario): ${sinEquivalencia.size}`,
);

escribirJsonCompacto('fuentes/datos/onu-cuentas.json', salida, 4);
