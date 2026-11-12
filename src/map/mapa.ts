/**
 * Mapa de juego en Canvas (Fase 3): dibuja el mundo de 2010 a pantalla completa con la
 * proyección Miller y el nivel de detalle que toque según el zoom. Solo dibuja cuando algo
 * cambia, y se salta los países que quedan fuera de la vista.
 */
import {
  camaraInicial,
  copiasVisibles,
  limitar,
  rectanguloVisible,
  zoomRelativo,
  type Camara,
} from './camara';
import { cajasSeCruzan, prepararFiguras, type Figura, type TopologiaMapa } from './geometria';
import { ALTO_MUNDO, ANCHO_MUNDO } from './proyeccion';

/** A partir de este zoom (relativo al mundo entero) se usa el nivel de detalle. */
export const ZOOM_DETALLE = 2.5;

export interface Estilo {
  fondo: string;
  oceano: string;
  zona: string;
  borde: string;
  /** Color de relleno de cada país o territorio. */
  colorPais(id: string): string;
}

interface Nivel {
  figuras: { paises: Figura[]; zonas: Figura[] };
  caminos: Map<Figura, Path2D>;
}

export interface Estadisticas {
  /** Fotogramas dibujados en el último segundo. */
  fps: number;
  /** Lo que tardó el último dibujo, en milisegundos. */
  msUltimo: number;
  nivel: 'mundo' | 'detalle';
}

function crearNivel(topo: TopologiaMapa): Nivel {
  return { figuras: prepararFiguras(topo), caminos: new Map() };
}

export class MapaMundo {
  readonly lienzo: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private camara: Camara;
  private dpr = 1;
  private mundo: Nivel | null = null;
  private detalle: Nivel | null = null;
  private cargandoDetalle = false;
  private dibujoPendiente = false;
  private readonly marcas: number[] = [];
  private msUltimo = 0;
  private nivelActual: 'mundo' | 'detalle' = 'mundo';
  private readonly observador: ResizeObserver;
  /** Se llama después de cada dibujo (p. ej. para el medidor de fps). */
  alDibujar: ((estadisticas: Estadisticas) => void) | null = null;

  constructor(
    private readonly contenedor: HTMLElement,
    private readonly urls: { mundo: string; detalle: string },
    private readonly estilo: Estilo,
  ) {
    this.lienzo = document.createElement('canvas');
    this.lienzo.className = 'mapa__lienzo';
    this.ctx = this.lienzo.getContext('2d', { alpha: false })!;
    contenedor.appendChild(this.lienzo);
    this.camara = camaraInicial(contenedor.clientWidth || 1, contenedor.clientHeight || 1);
    this.observador = new ResizeObserver(() => this.ajustarTamano());
    this.observador.observe(contenedor);
    this.ajustarTamano();
  }

  /** Descarga el nivel «mundo» y dibuja. El de detalle se descarga cuando hace falta. */
  async iniciar(): Promise<void> {
    this.mundo = crearNivel(await this.descargar(this.urls.mundo));
    this.pedirDibujo();
  }

  destruir(): void {
    this.observador.disconnect();
    this.lienzo.remove();
  }

  get vista(): Camara {
    return this.camara;
  }

  set vista(camara: Camara) {
    this.camara = limitar(camara);
    this.pedirDibujo();
  }

  /** Dibuja en el siguiente fotograma (varias peticiones seguidas se juntan en una). */
  pedirDibujo(): void {
    if (this.dibujoPendiente) return;
    this.dibujoPendiente = true;
    requestAnimationFrame(() => {
      this.dibujoPendiente = false;
      this.dibujar();
    });
  }

  private async descargar(url: string): Promise<TopologiaMapa> {
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} en ${url}`);
    return (await respuesta.json()) as TopologiaMapa;
  }

  private ajustarTamano(): void {
    const ancho = this.contenedor.clientWidth || 1;
    const alto = this.contenedor.clientHeight || 1;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.lienzo.width = Math.round(ancho * this.dpr);
    this.lienzo.height = Math.round(alto * this.dpr);
    this.lienzo.style.width = `${ancho}px`;
    this.lienzo.style.height = `${alto}px`;
    this.camara = limitar({ ...this.camara, ancho, alto });
    this.pedirDibujo();
  }

  private nivelParaZoom(): Nivel | null {
    if (zoomRelativo(this.camara) >= ZOOM_DETALLE) {
      if (this.detalle) return this.detalle;
      if (!this.cargandoDetalle) {
        this.cargandoDetalle = true;
        this.descargar(this.urls.detalle)
          .then((topo) => {
            this.detalle = crearNivel(topo);
            this.pedirDibujo();
          })
          .catch(() => {
            // Sin conexión se sigue usando el nivel «mundo»; se reintenta en el próximo zoom.
            this.cargandoDetalle = false;
          });
      }
    }
    return this.mundo;
  }

  private camino(nivel: Nivel, figura: Figura): Path2D {
    let camino = nivel.caminos.get(figura);
    if (!camino) {
      camino = new Path2D(figura.camino);
      nivel.caminos.set(figura, camino);
    }
    return camino;
  }

  private dibujar(): void {
    const inicio = performance.now();
    const { ctx, camara, dpr, estilo } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = estilo.fondo;
    ctx.fillRect(0, 0, this.lienzo.width, this.lienzo.height);

    const nivel = this.nivelParaZoom();
    if (nivel) {
      this.nivelActual = nivel === this.detalle ? 'detalle' : 'mundo';
      const [vx0, vy0, vx1, vy1] = rectanguloVisible(camara);
      for (const desplazamiento of copiasVisibles(camara)) {
        // Cada copia del mundo se dibuja con su propio desplazamiento horizontal.
        ctx.setTransform(
          dpr * camara.k,
          0,
          0,
          dpr * camara.k,
          dpr * ((desplazamiento - camara.cx) * camara.k + camara.ancho / 2),
          dpr * ((0 - camara.cy) * camara.k + camara.alto / 2),
        );
        const visible = [vx0 - desplazamiento, vy0, vx1 - desplazamiento, vy1];
        ctx.fillStyle = estilo.oceano;
        ctx.fillRect(0, 0, ANCHO_MUNDO, ALTO_MUNDO);

        const zonas = nivel.figuras.zonas.filter((f) => cajasSeCruzan(f.caja, visible));
        const paises = nivel.figuras.paises.filter((f) => cajasSeCruzan(f.caja, visible));
        ctx.fillStyle = estilo.zona;
        for (const figura of zonas) ctx.fill(this.camino(nivel, figura));
        for (const figura of paises) {
          ctx.fillStyle = estilo.colorPais(figura.id);
          ctx.fill(this.camino(nivel, figura));
        }
        ctx.strokeStyle = estilo.borde;
        ctx.lineWidth = 0.9 / camara.k;
        ctx.lineJoin = 'round';
        for (const figura of [...zonas, ...paises]) ctx.stroke(this.camino(nivel, figura));
      }
    }

    const fin = performance.now();
    this.msUltimo = fin - inicio;
    this.marcas.push(fin);
    while (this.marcas.length > 0 && this.marcas[0]! < fin - 1000) this.marcas.shift();
    this.alDibujar?.({ fps: this.marcas.length, msUltimo: this.msUltimo, nivel: this.nivelActual });
  }
}
