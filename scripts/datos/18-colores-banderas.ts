/**
 * Colores de las banderas (ajuste f7-a1, opción B elegida por el jugador): cada país del mapa
 * político lleva, dentro de la paleta, el color que se le asocia. Este script saca los colores
 * principales de la bandera de cada país y territorio, con la parte de la bandera que ocupa
 * cada uno; el mapa los usa como preferencia junto con la lista de colores tradicionales
 * (src/map/config/colores-tradicionales.json, hecha a mano y revisable por el jugador).
 *
 * Fuente: las banderas de 2010 del propio juego (public/av/banderas/*.svg), que descarga y
 * documenta 07-banderas.ts (licencias en docs/creditos.md). No hace falta red.
 *
 * Método: cada bandera se dibuja a 160 × 120 píxeles; los píxeles se agrupan por colores
 * parecidos a la vista (distancia en OKLab menor que 0,08) y se guarda, de cada grupo, su color
 * más frecuente y la parte de la bandera que ocupa. Se descartan los que ocupan menos del 3 %
 * (bordes suavizados, detalles de los escudos). Blanco, negro y grises se marcan como neutros:
 * no sirven para elegir el color del país.
 *
 * Salida: src/map/config/colores-banderas.json
 * Uso:    node scripts/datos/18-colores-banderas.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { linealAOklab } from '../../src/map/rampas.ts';
import { escribirJsonCompacto, ruta } from './lib/comun.ts';

const ANCHO = 160;
const ALTO = 120;
/** Dos colores a menos de esta distancia (OKLab) cuentan como el mismo color de la bandera. */
const MISMO_COLOR = 0.08;
/** Parte mínima de la bandera para que un color cuente. */
const PARTE_MINIMA = 0.03;
/** Por debajo de este croma (OKLCH), el color es neutro: blanco, negro o gris. */
const CROMA_NEUTRO = 0.035;
const MAXIMO_COLORES = 5;

sharp.cache(false);

const lineal = (x: number): number => {
  const v = x / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

interface Grupo {
  color: number;
  lab: [number, number, number];
  pixeles: number;
}

/** Un color de la bandera: [«#rrggbb», parte de la bandera] o, si es neutro, con «neutro». */
type ColorBandera = [string, number] | [string, number, 'neutro'];

async function coloresDeBandera(archivo: string): Promise<ColorBandera[]> {
  const { data, info } = await sharp(readFileSync(archivo), { density: 96 })
    .resize(ANCHO, ALTO, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cuenta = new Map<number, number>();
  let opacos = 0;
  for (let p = 0; p < info.width * info.height; p++) {
    const k = p * info.channels;
    if (data[k + 3]! < 128) continue;
    opacos++;
    const color = (data[k]! << 16) | (data[k + 1]! << 8) | data[k + 2]!;
    cuenta.set(color, (cuenta.get(color) ?? 0) + 1);
  }
  // Del color más frecuente al menos: cada uno se une al primer grupo parecido.
  const grupos: Grupo[] = [];
  for (const [color, pixeles] of [...cuenta].sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
    const lab = linealAOklab([
      lineal((color >> 16) & 255),
      lineal((color >> 8) & 255),
      lineal(color & 255),
    ]);
    const grupo = grupos.find(
      (g) => Math.hypot(g.lab[0] - lab[0], g.lab[1] - lab[1], g.lab[2] - lab[2]) < MISMO_COLOR,
    );
    if (grupo) grupo.pixeles += pixeles;
    else grupos.push({ color, lab, pixeles });
  }
  return grupos
    .map((g) => [g, g.pixeles / opacos] as const)
    .filter(([, parte]) => parte >= PARTE_MINIMA)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAXIMO_COLORES)
    .map(([g, parte]): ColorBandera => {
      const redondeada = Math.round(parte * 1000) / 1000;
      return Math.hypot(g.lab[1], g.lab[2]) < CROMA_NEUTRO
        ? [hex(g.color), redondeada, 'neutro']
        : [hex(g.color), redondeada];
    });
}

const carpeta = ruta('public/av/banderas');
const paises: Record<string, ColorBandera[]> = {};
for (const nombre of readdirSync(carpeta).sort()) {
  if (!nombre.endsWith('.svg')) continue;
  paises[nombre.slice(0, -4)] = await coloresDeBandera(`${carpeta}/${nombre}`);
}

escribirJsonCompacto(
  'src/map/config/colores-banderas.json',
  {
    fuente:
      'Colores principales de las banderas de 2010 del juego (public/av/banderas), calculados por scripts/datos/18-colores-banderas.ts. Cada color va con la parte de la bandera que ocupa; «neutro» marca el blanco, el negro y los grises, que no sirven para elegir el color del país.',
    paises,
  },
  2,
);
console.log(`Colores de ${Object.keys(paises).length} banderas guardados.`);
