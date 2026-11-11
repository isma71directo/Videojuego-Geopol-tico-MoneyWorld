/**
 * Indicadores del Banco Mundial (WDI) para el estado inicial de cada país (tarea f1-t1).
 *
 * Fuente: Banco Mundial, World Development Indicators, API v2 (https://api.worldbank.org/v2).
 * Años:   2008–2010; en indicadores que se miden pocas veces (alfabetización, gasto en
 *         educación) se descarga 2005–2012 para poder usar el año más cercano.
 *
 * Salida: fuentes/datos/banco-mundial.json
 * Uso:    node scripts/datos/02-banco-mundial.ts
 */
import { descargarJson, escribirJsonCompacto } from './lib/comun.ts';
import { codigosBM, hoy, leerPaises } from './lib/paises.ts';
import type { ArchivoFuente, SeriePorPais } from './lib/tipos.ts';

interface Indicador {
  codigo: string;
  descripcion: string;
  unidad: string;
  /** Años que se descargan; por defecto 2008–2010. */
  anios?: [number, number];
}

const AMPLIO: [number, number] = [2005, 2012];

export const INDICADORES_BM: Record<string, Indicador> = {
  poblacion: { codigo: 'SP.POP.TOTL', descripcion: 'Población total', unidad: 'habitantes' },
  pib: { codigo: 'NY.GDP.MKTP.CD', descripcion: 'PIB', unidad: 'US$ corrientes' },
  pibPerCapita: {
    codigo: 'NY.GDP.PCAP.CD',
    descripcion: 'PIB per cápita',
    unidad: 'US$ corrientes',
  },
  rnbPerCapita: {
    codigo: 'NY.GNP.PCAP.CD',
    descripcion: 'RNB per cápita, método Atlas (para el nivel de renta)',
    unidad: 'US$ corrientes',
  },
  crecimientoPib: {
    codigo: 'NY.GDP.MKTP.KD.ZG',
    descripcion: 'Crecimiento del PIB real',
    unidad: '% anual',
  },
  agriculturaPib: {
    codigo: 'NV.AGR.TOTL.ZS',
    descripcion: 'Agricultura, silvicultura y pesca, valor añadido',
    unidad: '% del PIB',
  },
  industriaPib: {
    codigo: 'NV.IND.TOTL.ZS',
    descripcion: 'Industria (incluida la construcción), valor añadido',
    unidad: '% del PIB',
  },
  serviciosPib: {
    codigo: 'NV.SRV.TOTL.ZS',
    descripcion: 'Servicios, valor añadido',
    unidad: '% del PIB',
  },
  paro: {
    codigo: 'SL.UEM.TOTL.ZS',
    descripcion: 'Paro (estimación modelada de la OIT)',
    unidad: '% de la población activa',
  },
  inflacion: {
    codigo: 'FP.CPI.TOTL.ZG',
    descripcion: 'Inflación, precios al consumo',
    unidad: '% anual',
  },
  deudaPib: {
    codigo: 'GC.DOD.TOTL.GD.ZS',
    descripcion: 'Deuda del gobierno central',
    unidad: '% del PIB',
  },
  gastoSanidadPib: {
    codigo: 'SH.XPD.CHEX.GD.ZS',
    descripcion: 'Gasto corriente en sanidad',
    unidad: '% del PIB',
  },
  gastoEducacionPib: {
    codigo: 'SE.XPD.TOTL.GD.ZS',
    descripcion: 'Gasto público en educación',
    unidad: '% del PIB',
    anios: AMPLIO,
  },
  gastoDefensaPib: {
    codigo: 'MS.MIL.XPND.GD.ZS',
    descripcion: 'Gasto militar (SIPRI)',
    unidad: '% del PIB',
  },
  esperanzaVida: {
    codigo: 'SP.DYN.LE00.IN',
    descripcion: 'Esperanza de vida al nacer',
    unidad: 'años',
  },
  alfabetizacion: {
    codigo: 'SE.ADT.LITR.ZS',
    descripcion: 'Tasa de alfabetización de adultos (15 años o más)',
    unidad: '%',
    anios: AMPLIO,
  },
  accesoElectricidad: {
    codigo: 'EG.ELC.ACCS.ZS',
    descripcion: 'Acceso a la electricidad',
    unidad: '% de la población',
  },
  usuariosInternet: {
    codigo: 'IT.NET.USER.ZS',
    descripcion: 'Personas que usan internet',
    unidad: '% de la población',
  },
  comercioPib: {
    codigo: 'NE.TRD.GNFS.ZS',
    descripcion: 'Comercio (exportaciones más importaciones)',
    unidad: '% del PIB',
  },
  efectivosMilitares: {
    codigo: 'MS.MIL.TOTL.P1',
    descripcion: 'Personal de las fuerzas armadas',
    unidad: 'personas',
  },
};

interface FilaBM {
  countryiso3code: string;
  date: string;
  value: number | null;
}
type RespuestaBM = [{ pages: number; lastupdated?: string }, FilaBM[] | null];

const URL_BASE = 'https://api.worldbank.org/v2';

async function descargarIndicador(
  indicador: Indicador,
  codigos: Set<string>,
): Promise<{ valores: SeriePorPais; actualizadoFuente?: string }> {
  const [desde, hasta] = indicador.anios ?? [2008, 2010];
  const valores: SeriePorPais = {};
  let actualizadoFuente: string | undefined;
  for (let pagina = 1; ; pagina += 1) {
    const url = `${URL_BASE}/country/all/indicator/${indicador.codigo}?format=json&date=${desde}:${hasta}&per_page=2000&page=${pagina}`;
    const [meta, filas] = await descargarJson<RespuestaBM>(url);
    actualizadoFuente = meta.lastupdated;
    for (const fila of filas ?? []) {
      if (fila.value === null || !codigos.has(fila.countryiso3code)) continue;
      (valores[fila.countryiso3code] ??= {})[fila.date] = fila.value;
    }
    if (pagina >= meta.pages) break;
  }
  // Orden estable: países y años ordenados.
  const ordenados: SeriePorPais = {};
  for (const codigo of Object.keys(valores).sort()) {
    ordenados[codigo] = Object.fromEntries(
      Object.entries(valores[codigo]!).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return { valores: ordenados, actualizadoFuente };
}

const codigos = codigosBM(leerPaises());
const salida: ArchivoFuente = {
  fuente: 'Banco Mundial, World Development Indicators (API v2)',
  url: URL_BASE,
  descargado: hoy(),
  indicadores: {},
};

for (const [clave, indicador] of Object.entries(INDICADORES_BM)) {
  const { valores, actualizadoFuente } = await descargarIndicador(indicador, codigos);
  salida.indicadores[clave] = {
    codigo: indicador.codigo,
    descripcion: indicador.descripcion,
    unidad: indicador.unidad,
    actualizadoFuente,
    valores,
  };
  console.log(
    `${clave.padEnd(20)} ${indicador.codigo.padEnd(20)} ${Object.keys(valores).length} países`,
  );
}

escribirJsonCompacto('fuentes/datos/banco-mundial.json', salida, 4);
