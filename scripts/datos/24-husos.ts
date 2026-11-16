/**
 * Huso horario de cada país y territorio el 1 de enero de 2010 (tarea f11-t2, decisión del
 * jugador: el reloj marca la hora local de la capital del jugador).
 *
 * Fuente: base de datos IANA de husos horarios (tzdata, dominio público),
 *         https://data.iana.org/time-zones/tzdata-latest.tar.gz, archivo zone.tab: las zonas de
 *         cada país (código ISO de dos letras) con su ciudad de referencia.
 * Año:    2010. El desfase de cada zona el 1 de enero de 2010 (con el horario de verano del
 *         hemisferio sur, si lo tenía) sale de las reglas históricas de la misma base de datos
 *         que trae Node (ICU); la versión se anota en el resultado.
 * Método: de las zonas del país, la más cercana a su capital de 2010 (ciudades-2010.json). Los
 *         territorios sin código ISO propio o con una hora distinta de la de su país
 *         (Abjasia, Kosovo…) llevan su zona a mano, con su motivo, en manual/husos-2010.json.
 *
 * Salida: public/data/husos-2010.json
 * Uso:    node scripts/datos/24-husos.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { descargar, escribirJsonCompacto, leerJson } from './lib/comun.ts';
import { leerPaises } from './lib/paises.ts';

const URL_TZDATA = 'https://data.iana.org/time-zones/tzdata-latest.tar.gz';
const INSTANTE = new Date('2010-01-01T12:00:00Z');

interface Ciudad {
  nombre: string;
  pais: string;
  lon: number;
  lat: number;
  capital: boolean;
  capitalDe: string | null;
}
interface Zona {
  pais: string;
  lat: number;
  lon: number;
  zona: string;
}
interface Manual {
  zonas: Record<string, { zona: string; motivo: string }>;
}

/** «+4024-00341» o «+404251-0034251» → [latitud, longitud] en grados. */
function coordenadas(texto: string): [number, number] {
  const partes = /^([+-]\d{4,6})([+-]\d{5,7})$/.exec(texto);
  if (!partes) throw new Error(`Coordenadas no válidas: ${texto}`);
  const grados = (valor: string, cifrasGrado: number): number => {
    const signo = valor.startsWith('-') ? -1 : 1;
    const cifras = valor.slice(1);
    const g = Number(cifras.slice(0, cifrasGrado));
    const m = Number(cifras.slice(cifrasGrado, cifrasGrado + 2));
    const s = Number(cifras.slice(cifrasGrado + 2) || 0);
    return signo * (g + m / 60 + s / 3600);
  };
  return [grados(partes[1]!, 2), grados(partes[2]!, 3)];
}

/** Distancia aproximada en grados (basta para elegir la zona más cercana). */
function distancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot(lat2 - lat1, dLon);
}

/** Minutos al este de UTC de una zona el 1 de enero de 2010 («GMT+05:45» → 345). */
function desfase(zona: string): number {
  const texto = new Intl.DateTimeFormat('en', { timeZone: zona, timeZoneName: 'longOffset' })
    .formatToParts(INSTANTE)
    .find((p) => p.type === 'timeZoneName')!.value;
  if (texto === 'GMT') return 0;
  const partes = /^GMT([+-])(\d{2}):(\d{2})$/.exec(texto);
  if (!partes) throw new Error(`Desfase no válido para ${zona}: ${texto}`);
  return (partes[1] === '-' ? -1 : 1) * (Number(partes[2]) * 60 + Number(partes[3]));
}

// 1. zone.tab de la última tzdata (en una carpeta temporal propia que se borra al terminar).
const carpeta = mkdtempSync(join(tmpdir(), 'tzdata-'));
let zonaTab: string;
try {
  const archivo = join(carpeta, 'tzdata.tar.gz');
  writeFileSync(archivo, new Uint8Array(await (await descargar(URL_TZDATA)).arrayBuffer()));
  zonaTab = execFileSync('tar', ['-xzOf', archivo, 'zone.tab'], { encoding: 'utf8' });
} finally {
  rmSync(carpeta, { recursive: true, force: true });
}
const zonas: Zona[] = zonaTab
  .split('\n')
  .filter((linea) => linea.trim() !== '' && !linea.startsWith('#'))
  .map((linea) => {
    const [pais, coords, zona] = linea.split('\t');
    const [lat, lon] = coordenadas(coords!);
    return { pais: pais!, lat, lon, zona: zona! };
  });

// 2. La zona de cada país: a mano, o la más cercana a su capital.
const manual = leerJson<Manual>('scripts/datos/manual/husos-2010.json');
const ciudades = leerJson<{ ciudades: Ciudad[] }>('public/data/ciudades-2010.json').ciudades;
const capitalDe = (id: string): Ciudad | undefined =>
  ciudades.find((c) => c.pais === id && c.capital && c.capitalDe === null) ??
  ciudades.find((c) => c.pais === id && c.capital);

const resultado: Record<string, [string, number]> = {};
const sinZona: string[] = [];
for (const pais of leerPaises()) {
  const aMano = manual.zonas[pais.id];
  let zona = aMano?.zona;
  if (!zona && pais.iso2) {
    const candidatas = zonas.filter((z) => z.pais === pais.iso2);
    const capital = capitalDe(pais.id);
    if (candidatas.length === 1) zona = candidatas[0]!.zona;
    else if (candidatas.length > 1 && capital) {
      zona = candidatas
        .map((z) => ({ z, d: distancia(capital.lat, capital.lon, z.lat, z.lon) }))
        .sort((a, b) => a.d - b.d)[0]!.z.zona;
    }
  }
  if (!zona) {
    sinZona.push(`${pais.id} (${pais.nombre})`);
    continue;
  }
  resultado[pais.id] = [zona, desfase(zona)];
}
if (sinZona.length > 0) {
  throw new Error(`Sin huso horario (añadir a manual/husos-2010.json): ${sinZona.join(', ')}`);
}

escribirJsonCompacto(
  'public/data/husos-2010.json',
  {
    fuente:
      'Base de datos IANA de husos horarios (tzdata, dominio público): zona de cada país más cercana a su capital y desfase el 1 de enero de 2010',
    url: URL_TZDATA,
    fecha: '2010-01-01',
    versionTz: process.versions.tz ?? 'desconocida',
    formato: '[zona IANA, minutos al este de UTC]',
    paises: Object.fromEntries(Object.entries(resultado).sort(([a], [b]) => a.localeCompare(b))),
  },
  2,
);
console.log(
  `Husos de ${Object.keys(resultado).length} países y territorios (tz ${process.versions.tz}).`,
);
