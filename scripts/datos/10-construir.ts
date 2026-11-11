/**
 * Construye el conjunto final de países de 2010 a partir de las fuentes ya descargadas
 * (no usa la red): une las fuentes, aplica los valores de respaldo, valida y escribe el
 * archivo que carga el juego y el informe de cobertura.
 *
 * Entrada: fuentes/datos/*.json (los generan los scripts 01 a 06)
 * Salida:  public/data/paises-2010.json y docs/datos-cobertura.md
 * Uso:     node scripts/datos/10-construir.ts
 */
import { existsSync } from 'node:fs';
import { escribirJsonCompacto, escribirTexto, leerJson, ruta } from './lib/comun.ts';
import { construir, type Entradas } from './lib/construir.ts';
import { informeCobertura } from './lib/informe.ts';
import { leerPaises } from './lib/paises.ts';
import type { ArchivoFuente } from './lib/tipos.ts';
import { validar } from './lib/validar.ts';

const archivo = (nombre: string): ArchivoFuente =>
  leerJson<ArchivoFuente>(`fuentes/datos/${nombre}.json`);

const entradas: Entradas = {
  paises: leerPaises(),
  archivos: {
    bm: archivo('banco-mundial'),
    fmi: archivo('fmi'),
    energia: archivo('owid-energia'),
    emisiones: archivo('owid-emisiones'),
    recursos: archivo('recursos'),
  },
  territorios: leerJson<{ territorios: Entradas['territorios'] }>('fuentes/datos/territorios.json')
    .territorios,
};

const { conjunto, incidencias } = construir(entradas);
const { errores, avisos } = validar(conjunto);

if (errores.length > 0) {
  console.error(
    `La validación ha encontrado ${errores.length} errores:\n- ${errores.join('\n- ')}`,
  );
  process.exit(1);
}

// Cada país ocupa pocas líneas: «datos» y «origen» van en una línea cada uno.
escribirJsonCompacto('public/data/paises-2010.json', conjunto, 3);
escribirTexto(
  'docs/datos-cobertura.md',
  informeCobertura(conjunto, avisos, {
    descargas: Object.fromEntries(
      Object.values(entradas.archivos).map((a) => [a.fuente, a.descargado]),
    ),
    notas: [...incidencias, ...(entradas.archivos.recursos.notas ?? [])],
    // Las banderas se ven en GitHub al abrir el informe (las descarga 07-banderas.ts).
    bandera: (pais) =>
      existsSync(ruta(`public/av/banderas/${pais.id}.svg`))
        ? `../public/av/banderas/${pais.id}.svg`
        : null,
  }),
);

console.log(
  `Conjunto generado: ${Object.keys(conjunto.paises).length} países y territorios, ` +
    `${Object.keys(conjunto.campos).length} campos, ${avisos.length} valores para revisar.`,
);
