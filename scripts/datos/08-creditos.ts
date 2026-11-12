/**
 * Genera docs/creditos.md: procedencia y licencia de los datos y del material audiovisual
 * de terceros (GDD, sección 7.1 y regla 19). No usa la red: lee lo que guardaron los
 * scripts de descarga.
 *
 * Uso: node scripts/datos/08-creditos.ts
 */
import { escribirTexto, leerJson } from './lib/comun.ts';
import { leerPaises } from './lib/paises.ts';

interface CreditosBanderas {
  descargado: string;
  flagIcons: {
    proyecto: string;
    version: string;
    url: string;
    licencia: string;
    autor: string;
    banderas: number;
  };
  commons: Record<
    string,
    { archivo: string; motivo: string; url: string; licencia: string; autor: string }
  >;
  sinBanderaPropia?: Record<string, { iso2: string; motivo: string }>;
  diferenciasConocidas: string[];
}

const banderas = leerJson<CreditosBanderas>('public/av/banderas/creditos.json');
const nombres = new Map(leerPaises().map((pais) => [pais.id, pais.nombre]));
const fecha = (iso: string): string => iso.split('-').reverse().join('/');
const celda = (texto: string): string => texto.replace(/\|/g, '\\|');

const filasCommons = Object.entries(banderas.commons)
  .sort(([a], [b]) => (nombres.get(a) ?? a).localeCompare(nombres.get(b) ?? b, 'es'))
  .map(
    ([id, c]) =>
      `| ${nombres.get(id) ?? id} | [${celda(c.archivo)}](${c.url}) | ${celda(c.licencia)} | ${celda(c.autor)} | ${c.motivo} |`,
  );

const texto = `# Créditos

> Generado por \`npm run datos:construir\`. No se edita a mano.

Procedencia y licencia de todo el material de terceros que usa el juego. Lo que no figura aquí
(iconos, interfaz, código) está hecho para el proyecto.

## Datos

| Fuente | Qué aporta | Condiciones |
| --- | --- | --- |
| [Banco Mundial, World Development Indicators](https://data.worldbank.org) | Población, PIB, paro, inflación, gasto público, sociedad | CC BY 4.0 |
| [FMI, Perspectivas de la economía mundial (WEO)](https://www.imf.org/external/datamapper) | Deuda, saldo fiscal, cuenta corriente y datos de respaldo | Reutilización con atribución, según las condiciones del FMI |
| [Our World in Data](https://ourworldindata.org) | Energía, emisiones y recursos (datos de Ember, Energy Institute, EIA, Global Carbon Project, USGS y BGS) | CC BY 4.0 para lo elaborado por OWID; los datos de terceros, según las condiciones de cada productor |
| [Wikidata](https://www.wikidata.org) | Capitales de 2010 y población de territorios sin datos oficiales | CC0 |
| [CLDR](https://cldr.unicode.org) | Nombres de los países en español | Licencia Unicode |
| [Natural Earth](https://www.naturalearthdata.com) | Fronteras (1:10m), tierra firme y relieve sombreado con fondo oceánico (1:50m) | Dominio público |

El detalle de cada dato (fuente y año) está en \`public/data/paises-2010.json\` y en el
[informe de cobertura](datos-cobertura.md).

## Banderas

Descargadas el ${fecha(banderas.descargado)} con \`scripts/datos/07-banderas.ts\`.

- **${banderas.flagIcons.banderas} banderas** de [${banderas.flagIcons.proyecto}](${banderas.flagIcons.url}) ${banderas.flagIcons.version}, de ${banderas.flagIcons.autor}. Licencia ${banderas.flagIcons.licencia}.
- **${filasCommons.length} banderas** de Wikimedia Commons: las que han cambiado desde 2010 y las de los territorios sin código ISO.

| País o territorio | Archivo | Licencia | Autor según Commons | Motivo |
| --- | --- | --- | --- | --- |
${filasCommons.join('\n')}

${Object.entries(banderas.sinBanderaPropia ?? {})
  .map(([id, c]) => `- **${nombres.get(id) ?? id}:** ${c.motivo}.`)
  .join('\n')}

**Diferencias conocidas con 2010**

${banderas.diferenciasConocidas.map((linea) => `- ${linea}`).join('\n')}
`;

escribirTexto('docs/creditos.md', texto);
console.log(`Créditos: ${banderas.flagIcons.banderas + filasCommons.length} banderas acreditadas.`);
