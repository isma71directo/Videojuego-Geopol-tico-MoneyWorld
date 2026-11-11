/**
 * Indicadores del FMI (Perspectivas de la economía mundial, WEO) (tarea f1-t1).
 * Segunda fuente para deuda y déficit, y para los países que el Banco Mundial no cubre
 * (Taiwán) o cubre con huecos.
 *
 * Fuente: FMI, DataMapper API v1 (https://www.imf.org/external/datamapper/api/v1), base WEO.
 * Años:   2008–2010.
 *
 * Salida: fuentes/datos/fmi.json
 * Uso:    node scripts/datos/03-fmi.ts
 */
import { descargarTextoConCurl, escribirJsonCompacto } from './lib/comun.ts';
import { hoy, leerPaises } from './lib/paises.ts';
import type { ArchivoFuente, SeriePorPais } from './lib/tipos.ts';

const INDICADORES_FMI: Record<string, { codigo: string; descripcion: string; unidad: string }> = {
  pib: { codigo: 'NGDPD', descripcion: 'PIB', unidad: 'miles de millones de US$ corrientes' },
  pibPerCapita: { codigo: 'NGDPDPC', descripcion: 'PIB per cápita', unidad: 'US$ corrientes' },
  poblacion: { codigo: 'LP', descripcion: 'Población', unidad: 'millones de habitantes' },
  crecimientoPib: {
    codigo: 'NGDP_RPCH',
    descripcion: 'Crecimiento del PIB real',
    unidad: '% anual',
  },
  inflacion: {
    codigo: 'PCPIPCH',
    descripcion: 'Inflación, precios al consumo (media anual)',
    unidad: '% anual',
  },
  paro: { codigo: 'LUR', descripcion: 'Tasa de paro', unidad: '% de la población activa' },
  deudaPib: {
    codigo: 'GGXWDG_NGDP',
    descripcion: 'Deuda bruta de las administraciones públicas',
    unidad: '% del PIB',
  },
  saldoFiscalPib: {
    codigo: 'GGXCNL_NGDP',
    descripcion: 'Capacidad (+) o necesidad (−) de financiación de las administraciones públicas',
    unidad: '% del PIB',
  },
  cuentaCorrientePib: {
    codigo: 'BCA_NGDPD',
    descripcion: 'Saldo de la balanza por cuenta corriente',
    unidad: '% del PIB',
  },
};

const ANIOS = ['2008', '2009', '2010'];
const URL_BASE = 'https://www.imf.org/external/datamapper/api/v1';

const codigos = new Set(
  leerPaises()
    .map((pais) => pais.codigos.fmi)
    .filter((codigo): codigo is string => codigo !== null),
);
// Sudán del Sur, para reconstruir el Sudán unido de 2010.
codigos.add('SSD');

const salida: ArchivoFuente = {
  fuente: 'FMI, Perspectivas de la economía mundial (WEO), vía DataMapper API',
  url: URL_BASE,
  descargado: hoy(),
  indicadores: {},
};

for (const [clave, indicador] of Object.entries(INDICADORES_FMI)) {
  type Respuesta = { values?: Record<string, Record<string, Record<string, number>>> };
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
        todos[codigo]![anio]!,
      ]),
    );
    if (Object.keys(serie).length > 0) valores[codigo] = serie;
  }
  salida.indicadores[clave] = { ...indicador, valores };
  console.log(
    `${clave.padEnd(20)} ${indicador.codigo.padEnd(14)} ${Object.keys(valores).length} países`,
  );
}

escribirJsonCompacto('fuentes/datos/fmi.json', salida, 4);
