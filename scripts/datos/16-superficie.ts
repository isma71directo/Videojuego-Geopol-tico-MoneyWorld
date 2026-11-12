/**
 * Superficie terrestre de cada país (tarea f6-t2), para la capa de densidad de población.
 *
 * Fuente: FAO, vía Banco Mundial (indicador AG.LND.TOTL.K2), servida por Our World in Data:
 *         https://ourworldindata.org/grapher/land-area-km
 *         (la API del Banco Mundial no responde desde el entorno de trabajo; es el mismo dato).
 * Años:   2008–2012 (la superficie apenas cambia; se prefiere la de 2010).
 * Nota:   es la superficie de tierra, sin las aguas interiores, como la que usa el Banco Mundial
 *         para la densidad de población. Los territorios sin dato reciben en 10-construir.ts la
 *         superficie medida en el mapa, marcada como estimación.
 *
 * Salida: fuentes/datos/superficie.json
 * Uso:    node scripts/datos/16-superficie.ts
 */
import { descargarTexto, escribirJsonCompacto, leerCsv, numero, redondear } from './lib/comun.ts';
import { codigosFuente, hoy, leerPaises } from './lib/paises.ts';
import type { ArchivoFuente, SeriePorPais } from './lib/tipos.ts';

const ANIOS = new Set(['2008', '2009', '2010', '2011', '2012']);
const GRAFICO = 'land-area-km';
const COLUMNA = 'ag_lnd_totl_k2';

const paises = leerPaises();
// Códigos que usa OWID: los propios de cada país y los componentes (p. ej. Sudán = SDN + SSD).
const codigos = new Set([...codigosFuente(paises, 'owid'), ...codigosFuente(paises, 'bm')]);

const url = `https://ourworldindata.org/grapher/${GRAFICO}.csv?csvType=full&useColumnShortNames=true`;
const valores: SeriePorPais = {};
for (const fila of leerCsv(await descargarTexto(url))) {
  const valor = numero(fila[COLUMNA]);
  if (valor === null || !fila.code || !codigos.has(fila.code) || !ANIOS.has(fila.year!)) continue;
  (valores[fila.code] ??= {})[fila.year!] = redondear(valor);
}

const ordenados: SeriePorPais = Object.fromEntries(
  Object.keys(valores)
    .sort()
    .map((codigo) => [codigo, valores[codigo]!]),
);

const sinDato = paises
  .filter((pais) => {
    const propios = [pais.codigos.owid, pais.codigos.bm, ...(pais.componentes ?? [])];
    return !propios.some((codigo) => codigo && ordenados[codigo]);
  })
  .map((pais) => pais.id);

const salida: ArchivoFuente = {
  fuente: 'FAO, vía Banco Mundial (AG.LND.TOTL.K2), servida por Our World in Data',
  url: `https://ourworldindata.org/grapher/${GRAFICO}`,
  descargado: hoy(),
  notas: [
    `Superficie terrestre: sin dato para ${sinDato.length} territorios (${sinDato.join(', ')}); ` +
      'se usa la superficie medida en el mapa, marcada como estimación.',
  ],
  indicadores: {
    superficie: {
      codigo: COLUMNA,
      descripcion: 'Superficie terrestre (sin aguas interiores)',
      unidad: 'km²',
      valores: ordenados,
    },
  },
};

escribirJsonCompacto('fuentes/datos/superficie.json', salida, 3);
console.log(
  `superficie.json: ${Object.keys(ordenados).length} códigos con dato; ` +
    `sin dato: ${sinDato.join(', ') || 'ninguno'}.`,
);
