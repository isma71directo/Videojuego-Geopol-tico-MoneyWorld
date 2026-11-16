/**
 * Ingresos y gasto de las administraciones públicas en 2010 (tarea f10-t2), del FMI (Fiscal
 * Monitor). Sirven para la tesorería inicial provisional y, más adelante, para el presupuesto.
 * Van en un archivo aparte de fmi.json para no volver a descargar (y cambiar con las revisiones
 * del FMI) los indicadores de la Fase 1.
 *
 * Fuente: FMI, DataMapper API v1 (https://www.imf.org/external/datamapper/api/v1), base Fiscal
 *         Monitor (FM): GGR_G01_GDP_PT (ingresos) y G_X_G01_GDP_PT (gasto), en % del PIB.
 * Años:   2008–2010.
 *
 * Salida: fuentes/datos/fmi-fiscal.json
 * Uso:    node scripts/datos/23-fmi-fiscal.ts (después, 10-construir.ts)
 */
import { descargarTextoConCurl, escribirJsonCompacto } from './lib/comun.ts';
import { codigosFuente, hoy, leerPaises } from './lib/paises.ts';
import type { ArchivoFuente, SeriePorPais } from './lib/tipos.ts';

const INDICADORES: Record<string, { codigo: string; descripcion: string; unidad: string }> = {
  ingresosPublicosPib: {
    codigo: 'GGR_G01_GDP_PT',
    descripcion: 'Ingresos de las administraciones públicas',
    unidad: '% del PIB',
  },
  gastoPublicoPib: {
    codigo: 'G_X_G01_GDP_PT',
    descripcion: 'Gasto de las administraciones públicas',
    unidad: '% del PIB',
  },
};

const ANIOS = ['2008', '2009', '2010'];
const URL_BASE = 'https://www.imf.org/external/datamapper/api/v1';
const codigos = codigosFuente(leerPaises(), 'fmi');

const salida: ArchivoFuente = {
  fuente: 'FMI, Fiscal Monitor, vía DataMapper API',
  url: URL_BASE,
  descargado: hoy(),
  indicadores: {},
};

for (const [clave, indicador] of Object.entries(INDICADORES)) {
  type Respuesta = { values?: Record<string, Record<string, Record<string, number | null>>> };
  // El servidor del FMI rechaza las peticiones hechas desde Node; con curl las acepta.
  const respuesta = JSON.parse(
    descargarTextoConCurl(`${URL_BASE}/${indicador.codigo}`),
  ) as Respuesta;
  const todos = respuesta.values?.[indicador.codigo] ?? {};
  const valores: SeriePorPais = {};
  for (const codigo of Object.keys(todos).sort()) {
    if (!codigos.has(codigo)) continue;
    const serie = Object.fromEntries(
      ANIOS.filter((anio) => typeof todos[codigo]![anio] === 'number').map((anio) => [
        anio,
        todos[codigo]![anio] as number,
      ]),
    );
    if (Object.keys(serie).length > 0) valores[codigo] = serie;
  }
  salida.indicadores[clave] = { ...indicador, valores };
  console.log(
    `${clave.padEnd(20)} ${indicador.codigo.padEnd(16)} ${Object.keys(valores).length} países`,
  );
}

escribirJsonCompacto('fuentes/datos/fmi-fiscal.json', salida, 4);
