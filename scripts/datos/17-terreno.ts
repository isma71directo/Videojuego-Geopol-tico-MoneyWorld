/**
 * Terreno del mapa (tarea f6-t3, opción A elegida por el jugador): los colores de la tierra
 * (bosques, desiertos, hielo) y el mar más oscuro cuanto más profundo, reproyectados a Miller y
 * cortados en teselas por nivel de zoom. El mapa los dibuja debajo de los colores de los países.
 *
 * Fuentes (Natural Earth, dominio público):
 *  - «Natural Earth II with Shaded Relief and Water» 1:50m (NE2_50M_SR_W): colores de la tierra.
 *  - «Gray Earth with Shaded Relief, Hypsography, and Ocean Bottom» 1:50m (GRAY_50M_SR_OB): su
 *    fondo oceánico (más claro en la plataforma continental) da la profundidad del mar.
 *  - Tierra firme 1:50m (ne_50m_land), para separar tierra y mar.
 *
 * Salida: public/av/terreno/<nivel>/<columna>_<fila>.webp y public/av/terreno/terreno.json
 * Requiere: la orden «unzip» del sistema.
 * Uso:      node --max-old-space-size=6000 scripts/datos/17-terreno.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp, { type OutputInfo } from 'sharp';
import { ALTO_MUNDO, ANCHO_MUNDO, LATITUD_NORTE, millerCruda } from '../../src/map/proyeccion.ts';
import { descargar, descargarJson, escribirJson, ruta } from './lib/comun.ts';

const URL_COLOR = 'https://naciscdn.org/naturalearth/50m/raster/NE2_50M_SR_W.zip';
const URL_FONDO = 'https://naciscdn.org/naturalearth/50m/raster/GRAY_50M_SR_OB.zip';
const URL_TIERRA =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_land.geojson';

const ANCHO_MAXIMO = 8192;
const TESELA = 512;
const NIVELES = [1024, 2048, 4096, 8192];
const CALIDAD_WEBP = 72;

/**
 * Colores del mar según la profundidad (de la plataforma, clara, al fondo, oscuro), en sRGB.
 * Van con el tema oscuro del juego: el tono medio es el del océano de las fases anteriores.
 */
const MAR_SOMERO: [number, number, number] = [44, 98, 140];
const MAR_MEDIO: [number, number, number] = [23, 58, 94];
const MAR_PROFUNDO: [number, number, number] = [9, 26, 52];
/** La tierra de Natural Earth II es muy clara para el tema oscuro: se oscurece un poco. */
const BRILLO_TIERRA = 0.86;

sharp.cache(false);

function canales(n: number, { data, info }: { data: Buffer; info: OutputInfo }): Buffer {
  if (info.channels !== n || data.length !== info.width * info.height * n) {
    throw new Error(`Imagen con ${info.channels} canales; se esperaban ${n}`);
  }
  return data;
}

async function descomprimir(url: string, nombre: string, carpeta: string): Promise<string> {
  const zip = join(carpeta, `${nombre}.zip`);
  const respuesta = await descargar(url);
  writeFileSync(zip, Buffer.from(await respuesta.arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', '-j', zip, '-d', join(carpeta, nombre)]);
  return join(carpeta, nombre, `${nombre}.tif`);
}

const temporal = mkdtempSync(join(tmpdir(), 'terreno-'));
try {
  const alturaFuente = 5400;
  const [tifColor, tifFondo] = await Promise.all([
    descomprimir(URL_COLOR, 'NE2_50M_SR_W', temporal),
    descomprimir(URL_FONDO, 'GRAY_50M_SR_OB', temporal),
  ]);
  const color = canales(
    3,
    await sharp(tifColor, { limitInputPixels: false })
      .resize(ANCHO_MAXIMO, alturaFuente, { fit: 'fill' })
      .removeAlpha()
      .toColourspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true }),
  );
  const gris = canales(
    1,
    await sharp(tifFondo, { limitInputPixels: false })
      .resize(ANCHO_MAXIMO, alturaFuente, { fit: 'fill' })
      .toColourspace('b-w')
      .raw()
      .toBuffer({ resolveWithObject: true }),
  );

  // Máscara de tierra firme a la misma resolución.
  type Anillo = number[][];
  const tierra = await descargarJson<{
    features: { geometry: { type: string; coordinates: Anillo[] | Anillo[][] } }[];
  }>(URL_TIERRA);
  const caminos: string[] = [];
  for (const { geometry } of tierra.features) {
    const poligonos = (
      geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    ) as Anillo[][];
    for (const poligono of poligonos) {
      for (const anillo of poligono) {
        caminos.push(
          `M${anillo
            .map(
              ([lon, lat]) =>
                `${(((lon! + 180) / 360) * ANCHO_MAXIMO).toFixed(1)},${(((90 - lat!) / 180) * alturaFuente).toFixed(1)}`,
            )
            .join('L')}Z`,
        );
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO_MAXIMO}" height="${alturaFuente}"><rect width="100%" height="100%" fill="#000"/><path fill="#fff" fill-rule="evenodd" d="${caminos.join('')}"/></svg>`;
  const mascara = canales(
    1,
    await sharp(Buffer.from(svg), { limitInputPixels: false })
      .removeAlpha()
      .toColourspace('b-w')
      .raw()
      .toBuffer({ resolveWithObject: true }),
  );

  // Profundidad: el brillo del fondo oceánico, muy desenfocado y solo en el mar (si no, la
  // costa deja un halo claro). Más claro es menos profundo.
  const desenfocar = async (datos: Uint8Array, radio: number): Promise<Buffer> =>
    canales(
      1,
      await sharp(datos, { raw: { width: ANCHO_MAXIMO, height: alturaFuente, channels: 1 } })
        .blur(radio)
        .toColourspace('b-w')
        .raw()
        .toBuffer({ resolveWithObject: true }),
    );
  const soloMar = new Uint8Array(gris.length);
  const mar = new Uint8Array(gris.length);
  for (let i = 0; i < gris.length; i += 1) {
    mar[i] = 255 - mascara[i]!;
    soloMar[i] = Math.round((gris[i]! * mar[i]!) / 255);
  }
  const [marBorroso, pesoMar] = await Promise.all([desenfocar(soloMar, 6), desenfocar(mar, 6)]);
  const brilloMar = new Float32Array(gris.length);
  const muestra: number[] = [];
  for (let i = 0; i < gris.length; i += 1) {
    brilloMar[i] = pesoMar[i]! > 0 ? (marBorroso[i]! * 255) / pesoMar[i]! : gris[i]!;
    if (mascara[i]! < 8 && i % 97 === 0) muestra.push(brilloMar[i]!);
  }
  // Escala de profundidad entre los percentiles 3 y 97 del brillo del mar.
  muestra.sort((a, b) => a - b);
  const profundo = muestra[Math.floor(muestra.length * 0.03)]!;
  const somero = muestra[Math.floor(muestra.length * 0.97)]!;
  console.log(`Brillo del mar: profundo ${profundo.toFixed(0)}, somero ${somero.toFixed(0)}`);
  const colorMar = (brillo: number, canal: number): number => {
    const t = Math.min(1, Math.max(0, (brillo - profundo) / (somero - profundo)));
    // Dos tramos: del fondo al tono medio y del tono medio a la plataforma.
    return t < 0.5
      ? MAR_PROFUNDO[canal]! + (MAR_MEDIO[canal]! - MAR_PROFUNDO[canal]!) * (t / 0.5)
      : MAR_MEDIO[canal]! + (MAR_SOMERO[canal]! - MAR_MEDIO[canal]!) * ((t - 0.5) / 0.5);
  };

  // Reproyección a Miller: cada fila de salida toma la media de las filas de origen que cubre.
  const altoSalida = Math.round((ANCHO_MAXIMO * ALTO_MUNDO) / ANCHO_MUNDO);
  const escala = ANCHO_MUNDO / (2 * Math.PI);
  const yNorte = escala * millerCruda(0, (LATITUD_NORTE * Math.PI) / 180)[1];
  const latitudDeFila = (fila: number): number => {
    const yMundo = (fila / altoSalida) * ALTO_MUNDO;
    const [, phi] = millerCruda.invert!(0, (yNorte - yMundo) / escala)!;
    return (phi * 180) / Math.PI;
  };
  const filaFuente = (latitud: number): number => ((90 - latitud) / 180) * alturaFuente;

  const salida = Buffer.alloc(ANCHO_MAXIMO * altoSalida * 3);
  const acumulado = new Float64Array(ANCHO_MAXIMO * 5);
  for (let fila = 0; fila < altoSalida; fila += 1) {
    const r0 = filaFuente(latitudDeFila(fila));
    const r1 = filaFuente(latitudDeFila(fila + 1));
    const desde = Math.max(0, Math.floor(r0));
    const hasta = Math.min(alturaFuente - 1, Math.max(desde, Math.ceil(r1) - 1));
    acumulado.fill(0);
    for (let r = desde; r <= hasta; r += 1) {
      const base = r * ANCHO_MAXIMO;
      for (let x = 0; x < ANCHO_MAXIMO; x += 1) {
        const i = base + x;
        acumulado[x * 5] = acumulado[x * 5]! + color[i * 3]!;
        acumulado[x * 5 + 1] = acumulado[x * 5 + 1]! + color[i * 3 + 1]!;
        acumulado[x * 5 + 2] = acumulado[x * 5 + 2]! + color[i * 3 + 2]!;
        acumulado[x * 5 + 3] = acumulado[x * 5 + 3]! + brilloMar[i]!;
        acumulado[x * 5 + 4] = acumulado[x * 5 + 4]! + mascara[i]!;
      }
    }
    const n = hasta - desde + 1;
    const destino = fila * ANCHO_MAXIMO * 3;
    for (let x = 0; x < ANCHO_MAXIMO; x += 1) {
      const m = acumulado[x * 5 + 4]! / n / 255;
      const brillo = acumulado[x * 5 + 3]! / n;
      for (let canal = 0; canal < 3; canal += 1) {
        const enTierra = (acumulado[x * 5 + canal]! / n) * BRILLO_TIERRA;
        const valor = m * enTierra + (1 - m) * colorMar(brillo, canal);
        salida[destino + x * 3 + canal] = Math.max(0, Math.min(255, Math.round(valor)));
      }
    }
  }

  // Teselas por nivel.
  const base = sharp(salida, { raw: { width: ANCHO_MAXIMO, height: altoSalida, channels: 3 } });
  const niveles = [];
  let bytes = 0;
  for (const ancho of NIVELES) {
    const alto = Math.round((ancho * altoSalida) / ANCHO_MAXIMO);
    const imagen = canales(
      3,
      await base
        .clone()
        .resize(ancho, alto, { kernel: 'lanczos3' })
        .raw()
        .toBuffer({ resolveWithObject: true }),
    );
    mkdirSync(ruta(`public/av/terreno/${ancho}`), { recursive: true });
    const columnas = Math.ceil(ancho / TESELA);
    const filas = Math.ceil(alto / TESELA);
    for (let fila = 0; fila < filas; fila += 1) {
      for (let columna = 0; columna < columnas; columna += 1) {
        const info = await sharp(imagen, { raw: { width: ancho, height: alto, channels: 3 } })
          .extract({
            left: columna * TESELA,
            top: fila * TESELA,
            width: Math.min(TESELA, ancho - columna * TESELA),
            height: Math.min(TESELA, alto - fila * TESELA),
          })
          .webp({ quality: CALIDAD_WEBP, effort: 6 })
          .toFile(ruta(`public/av/terreno/${ancho}/${columna}_${fila}.webp`));
        bytes += info.size;
      }
    }
    niveles.push({ ancho, alto, columnas, filas });
  }

  escribirJson('public/av/terreno/terreno.json', {
    descripcion:
      'Colores del terreno (Natural Earth II) y mar más oscuro cuanto más profundo, en proyección Miller (60° S a 84° N). Se dibuja debajo de los colores de los países.',
    fuente: 'Natural Earth: NE2_50M_SR_W, GRAY_50M_SR_OB y ne_50m_land (dominio público)',
    tesela: TESELA,
    formato: 'webp',
    niveles,
  });
  console.log(
    `Terreno: ${niveles.map((n) => `${n.ancho} px (${n.columnas}x${n.filas})`).join(', ')} · ${(bytes / 1024 / 1024).toFixed(1)} MB`,
  );
} finally {
  rmSync(temporal, { recursive: true, force: true });
}
