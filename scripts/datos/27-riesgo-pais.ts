/**
 * Riesgo país de 2010 (tarea f18-t1; decisión del jugador: rating y prima con una fórmula
 * calibrada con los tipos reales de la OCDE).
 *
 * Fuentes:
 *  - OCDE, Financial market (SDMX, DSD_STES@DF_FINMARK): tipo de interés a largo plazo (bono
 *    público a 10 años), media anual, 2008–2010. 40 países.
 *    https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,4.0
 *  - Banco Mundial, Worldwide Governance Indicators: estabilidad política y ausencia de
 *    violencia, 2008–2010 (en la escala que publica ahora el Banco Mundial, con 0 en la media
 *    mundial: Alemania 2010, 16,7; Yemen, −50,9).
 *
 * Salida: fuentes/datos/ocde-tipos.json y fuentes/datos/bm-gobernanza.json
 * Uso:    node scripts/datos/27-riesgo-pais.ts
 */
import { execFileSync } from 'node:child_process';
import { descargarIndicadorBM, URL_BASE_BM } from './lib/banco-mundial.ts';
import { escribirJsonCompacto, leerCsv } from './lib/comun.ts';
import { codigosBM, hoy, leerPaises } from './lib/paises.ts';
import type { ArchivoFuente, SeriePorPais } from './lib/tipos.ts';

const codigos = codigosBM(leerPaises());

// ── OCDE: tipos a 10 años ──
const URL_OCDE =
  'https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,4.0/.A.IRLT.PA.....';
const csv = execFileSync(
  'curl',
  [
    '--silent',
    '--show-error',
    '--fail',
    '--location',
    '--retry',
    '3',
    '--max-time',
    '120',
    `${URL_OCDE}?startPeriod=2008&endPeriod=2010&format=csvfilewithlabels`,
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
).replace(/^\uFEFF/, '');
const tipos: SeriePorPais = {};
for (const fila of leerCsv(csv)) {
  const codigo = fila['REF_AREA'];
  const anio = fila['TIME_PERIOD'];
  const valor = fila['OBS_VALUE'];
  // Solo países (no la zona del euro ni otros agregados).
  if (!codigo || !codigos.has(codigo) || !anio || valor === undefined || valor === '') continue;
  (tipos[codigo] ??= {})[anio] = Number(valor);
}
const ordenar = (serie: SeriePorPais): SeriePorPais =>
  Object.fromEntries(
    Object.keys(serie)
      .sort()
      .map((c) => [
        c,
        Object.fromEntries(Object.entries(serie[c]!).sort(([a], [b]) => a.localeCompare(b))),
      ]),
  );
const ocde: ArchivoFuente = {
  fuente: 'OCDE, Financial market (tipos de interés a largo plazo)',
  url: URL_OCDE,
  descargado: hoy(),
  indicadores: {
    tipoBono10: {
      codigo: 'IRLT',
      descripcion: 'Tipo de interés a largo plazo (bono público a 10 años), media anual',
      unidad: '% anual',
      valores: ordenar(tipos),
    },
  },
};
escribirJsonCompacto('fuentes/datos/ocde-tipos.json', ocde, 4);
console.log(`tipoBono10              OCDE IRLT            ${Object.keys(tipos).length} países`);

// ── Banco Mundial: estabilidad política (WGI) ──
const estabilidad = descargarIndicadorBM(
  {
    codigo: 'PV.EST',
    descripcion: 'Estabilidad política y ausencia de violencia o terrorismo (WGI)',
    unidad: 'índice WGI (escala actual del Banco Mundial; 0 = media mundial)',
  },
  codigos,
);
const gobernanza: ArchivoFuente = {
  fuente: 'Banco Mundial, Worldwide Governance Indicators',
  url: URL_BASE_BM,
  descargado: hoy(),
  indicadores: {
    estabilidadPolitica: {
      codigo: 'PV.EST',
      descripcion: 'Estabilidad política y ausencia de violencia o terrorismo',
      unidad: 'índice WGI (escala actual del Banco Mundial; 0 = media mundial)',
      actualizadoFuente: estabilidad.actualizadoFuente,
      valores: estabilidad.valores,
    },
  },
};
escribirJsonCompacto('fuentes/datos/bm-gobernanza.json', gobernanza, 4);
console.log(
  `estabilidadPolitica     PV.EST               ${Object.keys(estabilidad.valores).length} países`,
);
