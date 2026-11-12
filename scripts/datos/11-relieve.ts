/**
 * Relieve del mapa (tarea f3-t3): imagen de relieve sombreado y fondo oceánico reproyectada a
 * Miller y cortada en teselas por nivel de zoom.
 *
 * Fuentes (Natural Earth, dominio público):
 *  - «Gray Earth with Shaded Relief, Hypsography, and Ocean Bottom» 1:50m (GRAY_50M_SR_OB).
 *  - Tierra firme 1:50m (ne_50m_land), para distinguir tierra y mar.
 *
 * Proceso: se separa el sombreado (detalle del relieve) del brillo de fondo; en el mar se
 * conserva además la profundidad (plataforma continental más clara). El resultado está centrado
 * en gris medio para dibujarlo con el modo de fusión «luz suave»: aclara las laderas al sol y
 * oscurece las sombras sin cambiar el color de cada país.
 *
 * Salida: public/av/relieve/<nivel>/<columna>_<fila>.webp y public/av/relieve/relieve.json
 * Requiere: la orden «unzip» del sistema.
 * Uso:      node scripts/datos/11-relieve.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp, { type OutputInfo } from 'sharp';
import { ALTO_MUNDO, ANCHO_MUNDO, LATITUD_NORTE, millerCruda } from '../../src/map/proyeccion.ts';
import { descargar, descargarJson, escribirJson, ruta } from './lib/comun.ts';

const URL_RELIEVE = 'https://naciscdn.org/naturalearth/50m/raster/GRAY_50M_SR_OB.zip';
const URL_TIERRA =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_land.geojson';

/** Ancho del nivel más detallado y tamaño de cada tesela, en píxeles. */
const ANCHO_MAXIMO = 8192;
const TESELA = 512;
const NIVELES = [1024, 2048, 4096, 8192].filter((ancho) => ancho <= ANCHO_MAXIMO);
const CALIDAD_WEBP = 70;
/**
 * Refuerzo del sombreado por nivel: al reducir la imagen el relieve se suaviza, así que los
 * niveles de vista lejana se contrastan más para que el mundo entero no se vea plano.
 */
const REFUERZO_NIVEL: Record<number, number> = { 1024: 2.2, 2048: 1.8, 4096: 1.4, 8192: 1.15 };

/** Intensidad del sombreado en tierra y en el mar, y peso de la profundidad del mar. */
const GANANCIA_TIERRA = 1.6;
const GANANCIA_MAR = 1.1;
const PESO_PROFUNDIDAD = 0.55;
const BRILLO_MAR_MEDIO = 85;

sharp.cache(false);

/**
 * Comprueba que una imagen en bruto tiene un solo canal (gris): sharp convierte a color al
 * redimensionar si no se le pide lo contrario, y entonces las filas se leerían desplazadas.
 */
function unCanal({ data, info }: { data: Buffer; info: OutputInfo }): Buffer {
  if (info.channels !== 1 || data.length !== info.width * info.height) {
    throw new Error(`Imagen con ${info.channels} canales; se esperaba 1 (gris)`);
  }
  return data;
}

const temporal = mkdtempSync(join(tmpdir(), 'relieve-'));
try {
  // 1) Imagen de relieve (equirectangular, 10800 x 5400, un canal).
  const zip = join(temporal, 'relieve.zip');
  const respuesta = await descargar(URL_RELIEVE);
  writeFileSync(zip, Buffer.from(await respuesta.arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zip, '-d', temporal]);
  const tif = join(temporal, 'GRAY_50M_SR_OB.tif');
  const alturaFuente = 5400;

  // Se trabaja con el ancho del nivel máximo y las filas originales.
  const original = sharp(tif, { limitInputPixels: false }).resize(ANCHO_MAXIMO, alturaFuente, {
    fit: 'fill',
  });
  const gris = unCanal(
    await original.clone().toColourspace('b-w').raw().toBuffer({ resolveWithObject: true }),
  );
  // 2) Máscara de tierra firme a la misma resolución.
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
  const mascara = unCanal(
    await sharp(Buffer.from(svg), { limitInputPixels: false })
      .removeAlpha()
      .toColourspace('b-w')
      .raw()
      .toBuffer({ resolveWithObject: true }),
  );

  // Brillo de fondo: el relieve muy desenfocado, calculado por separado en tierra y en mar
  // (si no, el salto de brillo de la costa deja un halo). La diferencia es el sombreado.
  const desenfocar = async (datos: Uint8Array): Promise<Buffer> =>
    unCanal(
      await sharp(datos, { raw: { width: ANCHO_MAXIMO, height: alturaFuente, channels: 1 } })
        .blur(12)
        .toColourspace('b-w')
        .raw()
        .toBuffer({ resolveWithObject: true }),
    );
  const soloTierra = new Uint8Array(gris.length);
  const soloMar = new Uint8Array(gris.length);
  const mar = new Uint8Array(gris.length);
  for (let i = 0; i < gris.length; i += 1) {
    const m = mascara[i]! / 255;
    soloTierra[i] = Math.round(gris[i]! * m);
    soloMar[i] = Math.round(gris[i]! * (1 - m));
    mar[i] = 255 - mascara[i]!;
  }
  const [tierraBorrosa, marBorroso, mascaraBorrosa, marMascaraBorrosa] = await Promise.all([
    desenfocar(soloTierra),
    desenfocar(soloMar),
    desenfocar(mascara),
    desenfocar(mar),
  ]);
  const fondo = new Float32Array(gris.length);
  for (let i = 0; i < gris.length; i += 1) {
    const enTierra = mascara[i]! >= 128;
    const peso = enTierra ? mascaraBorrosa[i]! : marMascaraBorrosa[i]!;
    const suma = enTierra ? tierraBorrosa[i]! : marBorroso[i]!;
    fondo[i] = peso > 0 ? (suma * 255) / peso : gris[i]!;
  }

  // 3) Reproyección a Miller: cada fila de salida toma la media de las filas de origen que cubre.
  const altoSalida = Math.round((ANCHO_MAXIMO * ALTO_MUNDO) / ANCHO_MUNDO);
  const escala = ANCHO_MUNDO / (2 * Math.PI);
  const yNorte = escala * millerCruda(0, (LATITUD_NORTE * Math.PI) / 180)[1];
  const latitudDeFila = (fila: number): number => {
    const yMundo = (fila / altoSalida) * ALTO_MUNDO;
    const [, phi] = millerCruda.invert!(0, (yNorte - yMundo) / escala)!;
    return (phi * 180) / Math.PI;
  };
  const filaFuente = (latitud: number): number => ((90 - latitud) / 180) * alturaFuente;

  const salida = Buffer.alloc(ANCHO_MAXIMO * altoSalida);
  const acumulado = new Float64Array(ANCHO_MAXIMO * 3);
  for (let fila = 0; fila < altoSalida; fila += 1) {
    const r0 = filaFuente(latitudDeFila(fila));
    const r1 = filaFuente(latitudDeFila(fila + 1));
    const desde = Math.max(0, Math.floor(r0));
    const hasta = Math.min(alturaFuente - 1, Math.max(desde, Math.ceil(r1) - 1));
    acumulado.fill(0);
    for (let r = desde; r <= hasta; r += 1) {
      const base = r * ANCHO_MAXIMO;
      for (let x = 0; x < ANCHO_MAXIMO; x += 1) {
        acumulado[x * 3] = acumulado[x * 3]! + gris[base + x]!;
        acumulado[x * 3 + 1] = acumulado[x * 3 + 1]! + fondo[base + x]!;
        acumulado[x * 3 + 2] = acumulado[x * 3 + 2]! + mascara[base + x]!;
      }
    }
    const n = hasta - desde + 1;
    const destino = fila * ANCHO_MAXIMO;
    for (let x = 0; x < ANCHO_MAXIMO; x += 1) {
      const g = acumulado[x * 3]! / n;
      const f = acumulado[x * 3 + 1]! / n;
      const m = acumulado[x * 3 + 2]! / n / 255;
      const sombraTierra = 128 + (g - f) * GANANCIA_TIERRA;
      const mar = 128 + (g - f) * GANANCIA_MAR + (f - BRILLO_MAR_MEDIO) * PESO_PROFUNDIDAD;
      const valor = m * sombraTierra + (1 - m) * mar;
      salida[destino + x] = Math.max(0, Math.min(255, Math.round(valor)));
    }
  }

  // 4) Teselas por nivel.
  const base = sharp(salida, { raw: { width: ANCHO_MAXIMO, height: altoSalida, channels: 1 } });
  const niveles = [];
  let bytes = 0;
  for (const ancho of NIVELES) {
    const alto = Math.round((ancho * altoSalida) / ANCHO_MAXIMO);
    const imagen = unCanal(
      await base
        .clone()
        .resize(ancho, alto, { kernel: 'lanczos3' })
        .toColourspace('b-w')
        .raw()
        .toBuffer({ resolveWithObject: true }),
    );
    mkdirSync(ruta(`public/av/relieve/${ancho}`), { recursive: true });
    const refuerzo = REFUERZO_NIVEL[ancho] ?? 1;
    for (let i = 0; i < imagen.length; i += 1) {
      imagen[i] = Math.max(0, Math.min(255, Math.round(128 + (imagen[i]! - 128) * refuerzo)));
    }
    const columnas = Math.ceil(ancho / TESELA);
    const filas = Math.ceil(alto / TESELA);
    for (let fila = 0; fila < filas; fila += 1) {
      for (let columna = 0; columna < columnas; columna += 1) {
        const anchoTesela = Math.min(TESELA, ancho - columna * TESELA);
        const altoTesela = Math.min(TESELA, alto - fila * TESELA);
        const archivo = ruta(`public/av/relieve/${ancho}/${columna}_${fila}.webp`);
        const info = await sharp(imagen, { raw: { width: ancho, height: alto, channels: 1 } })
          .extract({
            left: columna * TESELA,
            top: fila * TESELA,
            width: anchoTesela,
            height: altoTesela,
          })
          .webp({ quality: CALIDAD_WEBP, effort: 6 })
          .toFile(archivo);
        bytes += info.size;
      }
    }
    niveles.push({ ancho, alto, columnas, filas });
  }

  escribirJson('public/av/relieve/relieve.json', {
    descripcion:
      'Relieve sombreado y fondo oceánico en proyección Miller (60° S a 84° N), centrado en gris medio para fusionarlo con «luz suave».',
    fuente: 'Natural Earth: GRAY_50M_SR_OB y ne_50m_land (dominio público)',
    tesela: TESELA,
    formato: 'webp',
    niveles,
  });
  console.log(
    `Relieve: ${niveles.map((n) => `${n.ancho} px (${n.columnas}x${n.filas})`).join(', ')} · ${(bytes / 1024 / 1024).toFixed(1)} MB`,
  );
} finally {
  rmSync(temporal, { recursive: true, force: true });
}
