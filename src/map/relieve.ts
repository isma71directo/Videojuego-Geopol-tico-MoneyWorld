/**
 * Relieve sombreado del mapa (tarea f3-t3): teselas por nivel de zoom que se descargan cuando
 * hacen falta y se dibujan con el modo de fusión «luz suave» sobre los países y el océano.
 */
import { ALTO_MUNDO, ANCHO_MUNDO } from './proyeccion';

export interface NivelRelieve {
  ancho: number;
  alto: number;
  columnas: number;
  filas: number;
}

export interface ManifiestoRelieve {
  tesela: number;
  formato: string;
  niveles: NivelRelieve[];
}

/** Tesela visible: posición en la rejilla y rectángulo en coordenadas de mundo. */
export interface TeselaVisible {
  columna: number;
  fila: number;
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/**
 * Nivel adecuado para un mundo que ocupa `anchoPx` píxeles reales de pantalla: el más pequeño
 * que no se vea borroso (se admite estirar un poco) o, si no hay, el más grande.
 */
export function nivelPara(manifiesto: ManifiestoRelieve, anchoPx: number): NivelRelieve {
  const niveles = [...manifiesto.niveles].sort((a, b) => a.ancho - b.ancho);
  return niveles.find((nivel) => nivel.ancho >= anchoPx * 0.75) ?? niveles.at(-1)!;
}

/** Teselas de un nivel que se cruzan con un rectángulo [x0, y0, x1, y1] del mundo. */
export function teselasVisibles(
  manifiesto: ManifiestoRelieve,
  nivel: NivelRelieve,
  [x0, y0, x1, y1]: readonly number[],
): TeselaVisible[] {
  const t = manifiesto.tesela;
  const porPixelX = ANCHO_MUNDO / nivel.ancho;
  const porPixelY = ALTO_MUNDO / nivel.alto;
  const c0 = Math.max(0, Math.floor(x0! / porPixelX / t));
  const c1 = Math.min(nivel.columnas - 1, Math.floor(x1! / porPixelX / t));
  const f0 = Math.max(0, Math.floor(y0! / porPixelY / t));
  const f1 = Math.min(nivel.filas - 1, Math.floor(y1! / porPixelY / t));
  const teselas: TeselaVisible[] = [];
  for (let fila = f0; fila <= f1; fila += 1) {
    for (let columna = c0; columna <= c1; columna += 1) {
      const anchoPx = Math.min(t, nivel.ancho - columna * t);
      const altoPx = Math.min(t, nivel.alto - fila * t);
      teselas.push({
        columna,
        fila,
        x: columna * t * porPixelX,
        y: fila * t * porPixelY,
        ancho: anchoPx * porPixelX,
        alto: altoPx * porPixelY,
      });
    }
  }
  return teselas;
}

export class Relieve {
  private readonly imagenes = new Map<string, HTMLImageElement>();
  private readonly base: NivelRelieve;

  private constructor(
    private readonly carpeta: string,
    private readonly manifiesto: ManifiestoRelieve,
    private readonly alCargar: () => void,
  ) {
    this.base = [...manifiesto.niveles].sort((a, b) => a.ancho - b.ancho)[0]!;
    // El nivel más pequeño se descarga entero: sirve de reserva mientras llegan los demás.
    for (const tesela of teselasVisibles(manifiesto, this.base, [0, 0, ANCHO_MUNDO, ALTO_MUNDO])) {
      this.imagen(this.base, tesela);
    }
  }

  static async cargar(carpeta: string, alCargar: () => void): Promise<Relieve> {
    const respuesta = await fetch(`${carpeta}relieve.json`);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} en el relieve`);
    return new Relieve(carpeta, (await respuesta.json()) as ManifiestoRelieve, alCargar);
  }

  private imagen(nivel: NivelRelieve, tesela: TeselaVisible): HTMLImageElement {
    const clave = `${nivel.ancho}/${tesela.columna}_${tesela.fila}`;
    let imagen = this.imagenes.get(clave);
    if (!imagen) {
      imagen = new Image();
      imagen.decoding = 'async';
      imagen.onload = this.alCargar;
      imagen.src = `${this.carpeta}${clave}.${this.manifiesto.formato}`;
      this.imagenes.set(clave, imagen);
    }
    return imagen;
  }

  private static lista(imagen: HTMLImageElement): boolean {
    return imagen.complete && imagen.naturalWidth > 0;
  }

  /**
   * Dibuja el relieve de la zona visible. `anchoPx` es lo que mide el mundo entero en píxeles
   * reales de pantalla; `margen` solapa un poco las teselas para que no se vean las juntas.
   */
  dibujar(
    ctx: CanvasRenderingContext2D,
    visible: readonly number[],
    anchoPx: number,
    margen: number,
  ): void {
    const nivel = nivelPara(this.manifiesto, anchoPx);
    for (const tesela of teselasVisibles(this.manifiesto, nivel, visible)) {
      const imagen = this.imagen(nivel, tesela);
      if (Relieve.lista(imagen)) {
        ctx.drawImage(imagen, tesela.x, tesela.y, tesela.ancho + margen, tesela.alto + margen);
        continue;
      }
      // Mientras llega la tesela buena, se usa la del nivel más pequeño, recortada a su sitio.
      ctx.save();
      ctx.beginPath();
      ctx.rect(tesela.x, tesela.y, tesela.ancho + margen, tesela.alto + margen);
      ctx.clip();
      for (const reserva of teselasVisibles(this.manifiesto, this.base, [
        tesela.x,
        tesela.y,
        tesela.x + tesela.ancho,
        tesela.y + tesela.alto,
      ])) {
        const imagenReserva = this.imagen(this.base, reserva);
        if (Relieve.lista(imagenReserva)) {
          ctx.drawImage(
            imagenReserva,
            reserva.x,
            reserva.y,
            reserva.ancho + margen,
            reserva.alto + margen,
          );
        }
      }
      ctx.restore();
    }
  }
}
