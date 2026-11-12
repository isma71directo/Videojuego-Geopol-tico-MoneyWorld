/**
 * Banderas de los países y territorios vigentes el 1 de enero de 2010 (tarea f1-t9).
 *
 * Fuentes:
 *  - flag-icons (https://github.com/lipis/flag-icons), versión fijada, licencia MIT:
 *    banderas actuales en SVG, válidas para casi todos los países de 2010.
 *  - Wikimedia Commons: banderas que han cambiado desde 2010 y las de los territorios sin
 *    código ISO. La licencia y el autor de cada archivo se consultan y se guardan.
 *
 * Salida: public/av/banderas/<ID>.svg y public/av/banderas/creditos.json
 * Uso:    node scripts/datos/07-banderas.ts
 */
import { descargarJson, descargarTexto, escribirJson, escribirTexto } from './lib/comun.ts';
import { hoy, leerPaises } from './lib/paises.ts';

const VERSION_FLAG_ICONS = 'v7.6.0';
const URL_FLAG_ICONS = `https://raw.githubusercontent.com/lipis/flag-icons/${VERSION_FLAG_ICONS}`;

/**
 * Archivos de Wikimedia Commons para las banderas que flag-icons no tiene como eran el
 * 1 de enero de 2010, y para los territorios sin código ISO.
 */
const DE_COMMONS: Record<string, { archivo: string; motivo: string }> = {
  AFG: { archivo: 'Flag of Afghanistan (2004–2013).svg', motivo: 'Bandera de 2004 a 2013' },
  KGZ: { archivo: 'Flag of Kyrgyzstan (1992–2023).svg', motivo: 'Bandera de 1992 a 2023' },
  LBY: { archivo: 'Flag of Libya (1977–2011).svg', motivo: 'Bandera de 1977 a 2011' },
  MMR: { archivo: 'Flag of Myanmar (1974–2010).svg', motivo: 'Bandera de 1974 a octubre de 2010' },
  MRT: { archivo: 'Flag of Mauritania (1959–2017).svg', motivo: 'Bandera de 1959 a 2017' },
  SYR: { archivo: 'Flag of Syria (1980–2024).svg', motivo: 'Bandera de 1980 a 2024' },
  ABK: { archivo: 'Flag of the Republic of Abkhazia.svg', motivo: 'Territorio sin código ISO' },
  CYN: {
    archivo: 'Flag of the Turkish Republic of Northern Cyprus.svg',
    motivo: 'Territorio sin código ISO',
  },
  PMR: { archivo: 'Flag of Transnistria (state).svg', motivo: 'Territorio sin código ISO' },
  SOL: { archivo: 'Flag of Somaliland.svg', motivo: 'Territorio sin código ISO' },
  SOS: { archivo: 'Flag of South Ossetia.svg', motivo: 'Territorio sin código ISO' },
  ANT: {
    archivo: 'Flag of the Netherlands Antilles (1986–2010).svg',
    motivo: 'Bandera de 1986 a 2010 (las Antillas se disolvieron en octubre de 2010)',
  },
};

/**
 * Territorios sin bandera propia común: se usa la bandera de flag-icons indicada
 * (normalmente la de su país soberano) y se explica en los créditos.
 */
const SIN_BANDERA_PROPIA: Record<string, { iso2: string; motivo: string }> = {
  CHI: {
    iso2: 'gb',
    motivo:
      'Las Islas del Canal no tienen bandera común (Jersey y Guernsey tienen la suya): se usa la del Reino Unido',
  },
};

const pausa = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

function comprobarSvg(id: string, svg: string): string {
  if (!/<svg[\s>]/.test(svg)) throw new Error(`La bandera de ${id} no es un SVG`);
  if (/<script/i.test(svg)) throw new Error(`La bandera de ${id} contiene un script`);
  return svg;
}

interface PaginaCommons {
  title: string;
  imageinfo?: {
    descriptionurl: string;
    extmetadata: Record<string, { value: string } | undefined>;
  }[];
}

/** Licencia y autor de un archivo de Commons, sin etiquetas HTML. */
async function creditoCommons(
  archivo: string,
): Promise<{ url: string; licencia: string; autor: string }> {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo' +
    '&iiprop=extmetadata%7Curl&iiextmetadatafilter=LicenseShortName%7CArtist' +
    `&titles=${encodeURIComponent(`File:${archivo}`)}`;
  const respuesta = await descargarJson<{ query: { pages: Record<string, PaginaCommons> } }>(url);
  const info = Object.values(respuesta.query.pages)[0]?.imageinfo?.[0];
  if (!info) throw new Error(`Commons no tiene el archivo ${archivo}`);
  const limpio = (texto: string | undefined): string =>
    (texto ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  return {
    url: info.descriptionurl,
    licencia: limpio(info.extmetadata.LicenseShortName?.value) || 'sin indicar',
    autor: limpio(info.extmetadata.Artist?.value).slice(0, 120) || 'sin indicar',
  };
}

const paises = leerPaises();
const commons: Record<
  string,
  { archivo: string; motivo: string; url: string; licencia: string; autor: string }
> = {};
let deFlagIcons = 0;

for (const pais of paises) {
  const excepcion = DE_COMMONS[pais.id];
  let svg: string;
  if (excepcion) {
    svg = await descargarTexto(
      `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(excepcion.archivo)}`,
    );
    commons[pais.id] = { ...excepcion, ...(await creditoCommons(excepcion.archivo)) };
    // Commons limita las descargas seguidas.
    await pausa(1500);
  } else {
    const iso2 = SIN_BANDERA_PROPIA[pais.id]?.iso2 ?? pais.iso2?.toLowerCase();
    if (!iso2) throw new Error(`${pais.nombre} no tiene ISO2 ni bandera en Commons`);
    svg = await descargarTexto(`${URL_FLAG_ICONS}/flags/4x3/${iso2}.svg`);
    deFlagIcons += 1;
  }
  escribirTexto(`public/av/banderas/${pais.id}.svg`, comprobarSvg(pais.id, svg));
}

escribirJson('public/av/banderas/creditos.json', {
  descripcion: 'Procedencia y licencia de las banderas de public/av/banderas/.',
  descargado: hoy(),
  flagIcons: {
    proyecto: 'flag-icons',
    version: VERSION_FLAG_ICONS,
    url: 'https://github.com/lipis/flag-icons',
    licencia: 'MIT',
    autor: 'Panayiotis Lipiridis',
    banderas: deFlagIcons,
  },
  commons,
  sinBanderaPropia: SIN_BANDERA_PROPIA,
  diferenciasConocidas: [
    'Las banderas de flag-icons son las actuales. Se han sustituido las que cambiaron de forma visible desde 2010 (Afganistán, Kirguistán, Libia, Birmania, Mauritania y Siria) y se ha añadido la de las Antillas Neerlandesas, que dejó de usarse en 2010.',
    'No se han corregido cambios menores posteriores a 2010: tono del azul de Honduras (2022), escudo de Paraguay (2013) y Serbia (noviembre de 2010) y cenefa de Bielorrusia (2012).',
  ],
});
console.log(
  `Banderas: ${deFlagIcons} de flag-icons y ${Object.keys(commons).length} de Wikimedia Commons.`,
);
