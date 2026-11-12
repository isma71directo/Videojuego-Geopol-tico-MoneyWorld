/**
 * Energía y emisiones de Our World in Data (tarea f1-t2).
 *
 * Fuentes (archivos CSV completos en GitHub; OWID reúne datos de Ember, Energy Institute,
 * EIA y Global Carbon Project):
 *  - https://github.com/owid/energy-data  (mix eléctrico, consumo y producción de energía)
 *  - https://github.com/owid/co2-data     (emisiones de CO₂ y gases de efecto invernadero)
 * Años: 2008–2010.
 *
 * Salida: fuentes/datos/owid-energia.json y fuentes/datos/owid-emisiones.json
 * Uso:    node scripts/datos/04-owid.ts
 */
import { descargarTexto, escribirJsonCompacto, leerCsv, numero, redondear } from './lib/comun.ts';
import { codigosFuente, hoy, leerPaises } from './lib/paises.ts';
import type { ArchivoFuente, SeriePorPais } from './lib/tipos.ts';

type Columnas = Record<string, { columna: string; descripcion: string; unidad: string }>;

const TWH = 'TWh';

const ENERGIA: Columnas = {
  poblacion: {
    columna: 'population',
    descripcion: 'Población (Naciones Unidas, vía OWID)',
    unidad: 'habitantes',
  },
  generacionElectrica: {
    columna: 'electricity_generation',
    descripcion: 'Generación eléctrica',
    unidad: TWH,
  },
  demandaElectrica: {
    columna: 'electricity_demand',
    descripcion: 'Demanda eléctrica',
    unidad: TWH,
  },
  importacionesNetasElectricidad: {
    columna: 'net_elec_imports',
    descripcion: 'Importaciones netas de electricidad',
    unidad: TWH,
  },
  elecCarbon: { columna: 'coal_electricity', descripcion: 'Electricidad de carbón', unidad: TWH },
  elecGas: { columna: 'gas_electricity', descripcion: 'Electricidad de gas', unidad: TWH },
  elecPetroleo: {
    columna: 'oil_electricity',
    descripcion: 'Electricidad de petróleo y fuel',
    unidad: TWH,
  },
  elecNuclear: { columna: 'nuclear_electricity', descripcion: 'Electricidad nuclear', unidad: TWH },
  elecHidraulica: {
    columna: 'hydro_electricity',
    descripcion: 'Electricidad hidráulica',
    unidad: TWH,
  },
  elecEolica: { columna: 'wind_electricity', descripcion: 'Electricidad eólica', unidad: TWH },
  elecSolar: { columna: 'solar_electricity', descripcion: 'Electricidad solar', unidad: TWH },
  elecBiomasa: {
    columna: 'biofuel_electricity',
    descripcion: 'Electricidad de biomasa',
    unidad: TWH,
  },
  elecOtrasRenovables: {
    columna: 'other_renewable_exc_biofuel_electricity',
    descripcion: 'Electricidad de otras renovables (geotérmica, mareas…)',
    unidad: TWH,
  },
  consumoEnergiaPrimaria: {
    columna: 'primary_energy_consumption',
    descripcion: 'Consumo de energía primaria',
    unidad: TWH,
  },
  consumoCarbon: { columna: 'coal_consumption', descripcion: 'Consumo de carbón', unidad: TWH },
  consumoPetroleo: { columna: 'oil_consumption', descripcion: 'Consumo de petróleo', unidad: TWH },
  consumoGas: { columna: 'gas_consumption', descripcion: 'Consumo de gas', unidad: TWH },
  produccionCarbon: {
    columna: 'coal_production',
    descripcion: 'Producción de carbón',
    unidad: TWH,
  },
  produccionPetroleo: {
    columna: 'oil_production',
    descripcion: 'Producción de petróleo',
    unidad: TWH,
  },
  produccionGas: { columna: 'gas_production', descripcion: 'Producción de gas', unidad: TWH },
};

const MT = 'millones de toneladas de CO₂';

const EMISIONES: Columnas = {
  co2: {
    columna: 'co2',
    descripcion: 'Emisiones de CO₂ (combustibles fósiles e industria)',
    unidad: MT,
  },
  co2PerCapita: {
    columna: 'co2_per_capita',
    descripcion: 'Emisiones de CO₂ por habitante',
    unidad: 'toneladas',
  },
  co2Carbon: { columna: 'coal_co2', descripcion: 'CO₂ del carbón', unidad: MT },
  co2Petroleo: { columna: 'oil_co2', descripcion: 'CO₂ del petróleo', unidad: MT },
  co2Gas: { columna: 'gas_co2', descripcion: 'CO₂ del gas', unidad: MT },
  co2Cemento: { columna: 'cement_co2', descripcion: 'CO₂ del cemento', unidad: MT },
  co2Consumo: {
    columna: 'consumption_co2',
    descripcion: 'CO₂ según el consumo (ajustado por comercio)',
    unidad: MT,
  },
  co2Acumulado: { columna: 'cumulative_co2', descripcion: 'CO₂ acumulado desde 1750', unidad: MT },
  gasesInvernadero: {
    columna: 'total_ghg',
    descripcion: 'Gases de efecto invernadero totales',
    unidad: 'millones de toneladas de CO₂ equivalente',
  },
};

const ANIOS = new Set(['2008', '2009', '2010']);

/** Países que OWID publica sin código ISO; se les da el código de la tabla de países. */
const SIN_ISO: Record<string, string> = { Kosovo: 'OWID_KOS' };

const codigos = codigosFuente(leerPaises(), 'owid');

async function procesar(url: string, fuente: string, columnas: Columnas): Promise<ArchivoFuente> {
  const texto = await descargarTexto(url);
  // El archivo completo ocupa varios megas: solo se analizan la cabecera y los años necesarios.
  const [cabecera, ...lineas] = texto.split('\n');
  const utiles = lineas.filter((linea) => /,(2008|2009|2010),/.test(linea));
  const filas = leerCsv([cabecera, ...utiles].join('\n'))
    .map((fila): Record<string, string> => ({
      ...fila,
      iso_code: fila.iso_code || (SIN_ISO[fila.country!] ?? ''),
    }))
    .filter((fila) => ANIOS.has(fila.year!) && codigos.has(fila.iso_code!));
  const salida: ArchivoFuente = { fuente, url, descargado: hoy(), indicadores: {} };
  for (const [clave, definicion] of Object.entries(columnas)) {
    if (!(definicion.columna in (filas[0] ?? {}))) {
      throw new Error(`La columna ${definicion.columna} ya no existe en ${url}`);
    }
    const valores: SeriePorPais = {};
    for (const fila of [...filas].sort((a, b) => a.iso_code!.localeCompare(b.iso_code!))) {
      const valor = numero(fila[definicion.columna]);
      if (valor === null) continue;
      (valores[fila.iso_code!] ??= {})[fila.year!] = redondear(valor);
    }
    salida.indicadores[clave] = {
      codigo: definicion.columna,
      descripcion: definicion.descripcion,
      unidad: definicion.unidad,
      valores,
    };
    console.log(`${clave.padEnd(32)} ${Object.keys(valores).length} países`);
  }
  return salida;
}

const energia = await procesar(
  'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv',
  'Our World in Data, energy-data (Ember, Energy Institute, EIA)',
  ENERGIA,
);
escribirJsonCompacto('fuentes/datos/owid-energia.json', energia, 4);

const emisiones = await procesar(
  'https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv',
  'Our World in Data, co2-data (Global Carbon Project y otros)',
  EMISIONES,
);
escribirJsonCompacto('fuentes/datos/owid-emisiones.json', emisiones, 4);
