/** Informe de cobertura de los datos (tarea f1-t7): docs/datos-cobertura.md. */
import type { ConjuntoPaises, PaisDatos } from '../../../src/datos/paises.ts';
import { esEstimacion } from './construir.ts';
import { cobertura, type Cobertura } from './validar.ts';

export interface OpcionesInforme {
  /** Fuente → fecha de descarga. */
  descargas: Record<string, string>;
  /** Avisos de las fuentes sobre huecos conocidos. */
  notas: string[];
  /** Ruta de la bandera de un país relativa a /docs, o null si no hay archivo. */
  bandera?: (pais: PaisDatos) => string | null;
}

const numero = (valor: number, decimales = 0): string =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: 'always',
  }).format(valor);

const porcentaje = (parte: number, total: number): string =>
  total === 0 ? '—' : `${numero((parte / total) * 100, 1)} %`;

const totalDe = (c: Cobertura): number => c.reales + c.estimados + c.sinDato;

function tabla(cabecera: string[], filas: string[][], alineacion: string[] = []): string {
  const separador = cabecera.map((_, i) => alineacion[i] ?? '---');
  return [cabecera, separador, ...filas].map((fila) => `| ${fila.join(' | ')} |`).join('\n');
}

export function informeCobertura(
  conjunto: ConjuntoPaises,
  avisos: string[],
  opciones: OpcionesInforme,
): string {
  const paises = Object.values(conjunto.paises).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es'),
  );
  const { total, porPais, porCampo } = cobertura(conjunto);
  const estados = paises.filter((pais) => pais.tipo === 'pais');
  const especiales = paises.filter((pais) => pais.tipo === 'especial');
  const jugables = paises.filter((pais) => pais.jugable);
  const conBasicosReales = paises.filter(
    (pais) =>
      pais.datos.poblacion != null &&
      pais.datos.pib != null &&
      !esEstimacion(pais.origen.poblacion!) &&
      !esEstimacion(pais.origen.pib!),
  );

  const sinDatoReservas = Object.entries(porCampo)
    .filter(([clave]) => /^reservas(?!Petroleo|Gas|Carbon)/.test(clave))
    .reduce((suma, [, c]) => suma + c.sinDato, 0);

  /** Valor de un campo con formato; los estimados llevan asterisco. */
  const celda = (pais: PaisDatos, campo: string, decimales = 0, divisor = 1): string => {
    const valor = pais.datos[campo];
    if (valor == null) return '—';
    return `${numero(valor / divisor, decimales)}${esEstimacion(pais.origen[campo]!) ? ' \\*' : ''}`;
  };
  const nombreCon = (pais: PaisDatos): string => {
    const bandera = opciones.bandera?.(pais);
    const imagen = bandera ? `<img src="${bandera}" alt="" width="24"> ` : '';
    return `${imagen}${pais.nombre}${pais.tipo === 'especial' ? ' †' : ''}`;
  };

  const secciones: string[] = [];

  secciones.push(`# Cobertura de los datos de 2010

> Informe generado por \`npm run datos:construir\` a partir de \`public/data/paises-2010.json\`.
> No se edita a mano: se regenera cada vez que cambian los datos.

## Resumen

- **${paises.length} países y territorios**: ${estados.length} Estados soberanos (los 192 miembros de la ONU el 1 de enero de 2010 y el Vaticano) y ${especiales.length} territorios de estatus especial o en disputa. **${jugables.length} son jugables.**
- **${Object.keys(conjunto.campos).length} campos por país** (${numero(totalDe(total))} valores en total).
- **${porcentaje(total.reales, totalDe(total))} son datos reales**, ${porcentaje(total.estimados, totalDe(total))} son estimaciones y ${porcentaje(total.sinDato, totalDe(total))} no tienen dato.
- **${conBasicosReales.length} países tienen población y PIB reales** (la Fase 1 exige al menos 190).
- De los ${numero(total.sinDato)} valores sin dato, ${numero(sinDatoReservas)} son reservas minerales de países que la fuente no lista; el resto, producción minera de territorios que la fuente no cubre.
- Sudán aparece unido, como en 2010: sus cifras suman las de Sudán y Sudán del Sur.

**Fuentes y fecha de descarga**

${Object.entries(opciones.descargas)
  .map(([fuente, fecha]) => `- ${fuente} — descargado el ${fecha.split('-').reverse().join('/')}`)
  .join('\n')}
- Wikidata y Banco Mundial (población de los territorios sin datos oficiales).

## Cómo leer este informe

- **Dato real:** viene de una fuente, con su año (se prefiere 2010; si falta, 2009 o 2008).
- **Estimación (\\*):** valor de respaldo calculado, nunca un dato real. En el juego irá marcado.
- **Sin dato (—):** ni la fuente lo da ni hay una forma razonable de estimarlo.
- **†** Territorio de estatus especial o en disputa.

## Datos principales por país

Para revisar de un vistazo los países que conozcas. PIB en millones de dólares de 2010.

${tabla(
  [
    'País',
    'Capital',
    'Población',
    'PIB (M$)',
    'PIB per cápita ($)',
    'Paro (%)',
    'Inflación (%)',
    'Deuda (% PIB)',
    'Datos reales',
  ],
  paises.map((pais) => [
    nombreCon(pais),
    pais.capital,
    celda(pais, 'poblacion'),
    celda(pais, 'pib', 0, 1e6),
    celda(pais, 'pibPerCapita'),
    celda(pais, 'paro', 1),
    celda(pais, 'inflacion', 1),
    celda(pais, 'deudaPib', 1),
    porcentaje(porPais[pais.id]!.reales, totalDe(porPais[pais.id]!)),
  ]),
  ['---', '---', '--:', '--:', '--:', '--:', '--:', '--:', '--:'],
)}`);

  secciones.push(`## Cobertura por campo

Cuántos de los ${paises.length} países y territorios tienen cada dato.

${tabla(
  ['Campo', 'Unidad', 'Real', 'Estimado', 'Sin dato', 'Fuentes de los reales'],
  Object.entries(conjunto.campos).map(([clave, campo]) => {
    const c = porCampo[clave]!;
    const fuentes = Object.entries(c.porFuente)
      .sort(([, a], [, b]) => b - a)
      .map(([fuente, n]) => `${fuente} ${n}`)
      .join(', ');
    return [
      campo.nombre,
      campo.unidad,
      String(c.reales),
      String(c.estimados),
      String(c.sinDato),
      fuentes || '—',
    ];
  }),
  ['---', '---', '--:', '--:', '--:', '---'],
)}

Siglas: ${Object.entries(conjunto.fuentes)
    .map(([sigla, nombre]) => `**${sigla}** = ${nombre}`)
    .join(
      '; ',
    )}. «OWID ausente» cuenta como real: la fuente solo lista productores y el país no figura (valor 0).`);

  const masEstimados = [...paises]
    .filter((pais) => porPais[pais.id]!.estimados > 0)
    .sort((a, b) => porPais[b.id]!.estimados - porPais[a.id]!.estimados)
    .slice(0, 30);
  secciones.push(`## Países con más estimaciones

${tabla(
  ['País', 'Jugable', 'Reales', 'Estimados', 'Sin dato', 'Campos estimados'],
  masEstimados.map((pais) => {
    const c = porPais[pais.id]!;
    const campos = pais.datosEstimados.map((clave) => conjunto.campos[clave]!.nombre);
    const lista =
      campos.length > 8
        ? `${campos.slice(0, 8).join(', ')}… (${campos.length})`
        : campos.join(', ');
    return [
      nombreCon(pais),
      pais.jugable ? 'sí' : 'no',
      String(c.reales),
      String(c.estimados),
      String(c.sinDato),
      lista,
    ];
  }),
  ['---', '---', '--:', '--:', '--:', '---'],
)}`);

  secciones.push(`## Territorios de estatus especial

${tabla(
  ['Territorio', 'Estatus en 2010', 'Reclamado por', 'Jugable', 'Datos reales'],
  especiales.map((pais) => [
    nombreCon(pais),
    pais.estatus ?? '',
    pais.reclamadoPor ? (conjunto.paises[pais.reclamadoPor]?.nombre ?? pais.reclamadoPor) : '—',
    pais.jugable ? 'sí' : 'no',
    porcentaje(porPais[pais.id]!.reales, totalDe(porPais[pais.id]!)),
  ]),
)}`);

  secciones.push(`## Valores llamativos

Datos que están dentro de lo posible pero fuera de lo habitual. Conviene comprobar que son correctos y no un error de la fuente.

${avisos.length === 0 ? 'Ninguno.' : avisos.map((aviso) => `- ${aviso}`).join('\n')}`);

  secciones.push(`## Huecos conocidos

${[
  ...opciones.notas,
  'Los territorios dependientes (Hong Kong, Groenlandia, Puerto Rico…) no están en este conjunto; su tratamiento se decide en las Fases 2 y 3 (mapa y regiones).',
  'El nivel de renta de los territorios sin RNB per cápita (y el de Corea del Norte) está fijado a mano.',
]
  .map((nota) => `- ${nota}`)
  .join('\n')}

## Métodos de estimación

${Object.entries(conjunto.metodosEstimacion)
  .map(([metodo, descripcion]) => `- **${metodo}:** ${descripcion}`)
  .join('\n')}

El nivel de renta de 2010 se calcula con los umbrales del Banco Mundial para ese año (RNB per cápita: bajo hasta 1.005 $, medio-bajo hasta 3.975 $, medio-alto hasta 12.275 $ y alto por encima).

Los tres sectores (agricultura, industria y servicios) se reescalan para sumar el 100 % del PIB, porque el Banco Mundial deja sin repartir los impuestos netos sobre los productos.

## Cómo regenerar los datos

\`\`\`bash
npm run datos:descargar   # vuelve a descargar todas las fuentes (necesita red)
npm run datos:construir   # une las fuentes, valida y regenera este informe (sin red)
\`\`\``);

  return `${secciones.join('\n\n')}\n`;
}
