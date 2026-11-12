/**
 * Mapa de juego en Canvas (Fase 3): dibuja el mundo de 2010 a pantalla completa con la
 * proyección Miller y el nivel de detalle que toque según el zoom. Solo dibuja cuando algo
 * cambia, y se salta los países que quedan fuera de la vista.
 */
import {
  prepararAgua,
  zoomWeb,
  type CapaAgua,
  type ElementoAgua,
  type TopologiaAgua,
} from './agua';
import {
  camaraInicial,
  desplazar,
  zoomEn,
  copiasVisibles,
  limitar,
  rectanguloVisible,
  zoomRelativo,
  type Camara,
} from './camara';
import { cajasSeCruzan, prepararFiguras, type Figura, type TopologiaMapa } from './geometria';
import { ANCHO_MUNDO, crearProyeccion } from './proyeccion';
import { paisEnPunto, UMBRAL_PEQUENO_PX } from './seleccion';
import { Relieve } from './relieve';

/** A partir de este zoom (relativo al mundo entero) se usa el nivel de detalle. */
export const ZOOM_DETALLE = 2.5;

export interface Estilo {
  fondo: string;
  oceano: string;
  /** Lagos y ríos. */
  agua: string;
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
  private relieve: Relieve | null = null;
  private agua: CapaAgua | null = null;
  private readonly caminosAgua = new Map<ElementoAgua, Path2D>();
  /** Animación en curso (zoom suave o inercia); se cancela al tocar el mapa. */
  private animacion: number | null = null;
  private readonly sinMovimiento =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private detalle: Nivel | null = null;
  private cargandoDetalle = false;
  private dibujoPendiente = false;
  private readonly marcas: number[] = [];
  private msUltimo = 0;
  private nivelActual: 'mundo' | 'detalle' = 'mundo';
  private readonly observador: ResizeObserver;
  /** Se llama después de cada dibujo (p. ej. para el medidor de fps). */
  alDibujar: ((estadisticas: Estadisticas) => void) | null = null;
  /** País bajo el ratón (o null) y posición del ratón en la pantalla del mapa. */
  alSenalar: ((id: string | null, x: number, y: number) => void) | null = null;
  /** País seleccionado con un clic (o null al hacer clic en el mar). */
  alSeleccionar: ((id: string | null) => void) | null = null;
  private senalado: string | null = null;
  /** Última posición del ratón sin pulsar y la cámara con la que se miró qué había debajo. */
  private raton: [number, number] | null = null;
  private camaraSenalada: Camara | null = null;
  private seleccionado: string | null = null;
  private readonly proyeccion = crearProyeccion();

  constructor(
    private readonly contenedor: HTMLElement,
    private readonly urls: { mundo: string; detalle: string; relieve?: string; agua?: string },
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
    if (this.urls.relieve) {
      // El relieve es decorativo: si no carga, el mapa funciona igual.
      Relieve.cargar(this.urls.relieve, () => this.pedirDibujo())
        .then((relieve) => {
          this.relieve = relieve;
          this.pedirDibujo();
        })
        .catch(() => undefined);
    }
    if (this.urls.agua) {
      fetch(this.urls.agua)
        .then((r) => (r.ok ? (r.json() as Promise<TopologiaAgua>) : Promise.reject(new Error())))
        .then((topo) => {
          this.agua = prepararAgua(topo);
          this.pedirDibujo();
        })
        .catch(() => undefined);
    }
    this.mundo = crearNivel(await this.descargar(this.urls.mundo));
    this.pedirDibujo();
  }

  /** Detiene la animación en curso (al empezar un gesto nuevo). */
  detenerAnimacion(): void {
    if (this.animacion !== null) cancelAnimationFrame(this.animacion);
    this.animacion = null;
  }

  /** Zoom animado (doble toque, teclado) manteniendo fijo el punto (x, y). */
  alPedirZoom = (factor: number, x: number, y: number): void => {
    this.detenerAnimacion();
    const inicio = this.camara;
    if (this.sinMovimiento) {
      this.vista = zoomEn(inicio, factor, x, y);
      return;
    }
    const duracion = 260;
    const t0 = performance.now();
    const paso = (ahora: number): void => {
      const t = Math.min(1, (ahora - t0) / duracion);
      const suave = 1 - (1 - t) ** 3;
      this.vista = zoomEn(inicio, factor ** suave, x, y);
      this.animacion = t < 1 ? requestAnimationFrame(paso) : null;
    };
    this.animacion = requestAnimationFrame(paso);
  };

  /** Inercia al soltar un arrastre: el mapa sigue un poco y se frena (velocidad en px/ms). */
  alSoltar = (vx: number, vy: number): void => {
    this.detenerAnimacion();
    if (this.sinMovimiento || Math.hypot(vx, vy) < 0.15) return;
    let ultimo = performance.now();
    let velocidad: [number, number] = [vx, vy];
    const paso = (ahora: number): void => {
      const dt = Math.min(48, ahora - ultimo);
      ultimo = ahora;
      this.vista = desplazar(this.camara, velocidad[0] * dt, velocidad[1] * dt);
      const freno = 0.994 ** dt;
      velocidad = [velocidad[0] * freno, velocidad[1] * freno];
      this.animacion = Math.hypot(...velocidad) > 0.02 ? requestAnimationFrame(paso) : null;
    };
    this.animacion = requestAnimationFrame(paso);
  };

  alEmpezarGesto = (): void => this.detenerAnimacion();

  /** País en un punto de la pantalla del mapa (o null si es mar). */
  paisEn(px: number, py: number): string | null {
    const nivel =
      this.detalle && zoomRelativo(this.camara) >= ZOOM_DETALLE ? this.detalle : this.mundo;
    if (!nivel) return null;
    const x = this.camara.cx + (px - this.camara.ancho / 2) / this.camara.k;
    const y = this.camara.cy + (py - this.camara.alto / 2) / this.camara.k;
    return paisEnPunto(nivel.figuras.paises, x, y, this.camara.k, (punto) => {
      const lugar = this.proyeccion.invert?.(punto);
      return lugar ? [lugar[0], lugar[1]] : null;
    });
  }

  /** El ratón se mueve sobre el mapa (sin pulsar); null si sale del mapa. */
  alPasar = (x: number | null, y: number | null): void => {
    const id = x === null || y === null ? null : this.paisEn(x, y);
    this.raton = x === null || y === null ? null : [x, y];
    this.camaraSenalada = this.camara;
    if (id !== this.senalado) {
      this.senalado = id;
      this.lienzo.style.cursor = id ? 'pointer' : '';
      this.pedirDibujo();
    }
    this.alSenalar?.(id, x ?? 0, y ?? 0);
  };

  /** Clic sin arrastre: selecciona el país (o quita la selección si es mar). */
  alTocar = (x: number, y: number): void => {
    this.seleccionar(this.paisEn(x, y));
  };

  get paisSeleccionado(): string | null {
    return this.seleccionado;
  }

  seleccionar(id: string | null): void {
    if (id === this.seleccionado) return;
    this.seleccionado = id;
    this.pedirDibujo();
    this.alSeleccionar?.(id);
  }

  /** Círculo alrededor de un país que en pantalla es demasiado pequeño para verse resaltado. */
  private anillo(figura: Figura, camara: Camara, color: string): void {
    const [x0, y0, x1, y1] = figura.caja;
    if (!figura.etiqueta || Math.max(x1 - x0, y1 - y0) * camara.k >= UMBRAL_PEQUENO_PX) return;
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(figura.etiqueta[0], figura.etiqueta[1], 7 / camara.k, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 / camara.k;
    ctx.stroke();
  }

  private resaltar(nivel: Nivel, paises: Figura[], camara: Camara): void {
    const { ctx } = this;
    const senalada = paises.find((f) => f.id === this.senalado && f.id !== this.seleccionado);
    if (senalada) {
      const camino = this.camino(nivel, senalada);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fill(camino);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.4 / camara.k;
      ctx.stroke(camino);
      this.anillo(senalada, camara, 'rgba(255, 255, 255, 0.85)');
    }
    const elegida = paises.find((f) => f.id === this.seleccionado);
    if (elegida) {
      const camino = this.camino(nivel, elegida);
      ctx.fillStyle = 'rgba(255, 214, 120, 0.16)';
      ctx.fill(camino);
      ctx.strokeStyle = '#ffd678';
      ctx.lineWidth = 2.2 / camara.k;
      ctx.stroke(camino);
      this.anillo(elegida, camara, '#ffd678');
    }
  }

  private caminoAgua(elemento: ElementoAgua): Path2D {
    let camino = this.caminosAgua.get(elemento);
    if (!camino) {
      camino = new Path2D(elemento.camino);
      this.caminosAgua.set(elemento, camino);
    }
    return camino;
  }

  destruir(): void {
    this.detenerAnimacion();
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
    // El océano se pinta de una vez en todo el lienzo: pintarlo por copias del mundo dejaba
    // una línea fina donde se juntan al cruzar el Pacífico.
    ctx.fillStyle = this.mundo ? estilo.oceano : estilo.fondo;
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

        const zonas = nivel.figuras.zonas.filter((f) => cajasSeCruzan(f.caja, visible));
        const paises = nivel.figuras.paises.filter((f) => cajasSeCruzan(f.caja, visible));
        ctx.fillStyle = estilo.zona;
        for (const figura of zonas) ctx.fill(this.camino(nivel, figura));
        for (const figura of paises) {
          ctx.fillStyle = estilo.colorPais(figura.id);
          ctx.fill(this.camino(nivel, figura));
        }
        // Lagos antes del relieve, para que también tengan su sombreado.
        const z = zoomWeb(camara.k);
        const lagos = (this.agua?.lagos ?? []).filter(
          (lago) => lago.z <= z + 0.6 && cajasSeCruzan(lago.caja, visible),
        );
        ctx.fillStyle = estilo.agua;
        for (const lago of lagos) ctx.fill(this.caminoAgua(lago));
        if (this.relieve) {
          // «Luz suave»: el gris medio no cambia nada; más claro ilumina y más oscuro sombrea.
          ctx.globalCompositeOperation = 'soft-light';
          ctx.imageSmoothingQuality = 'high';
          this.relieve.dibujar(ctx, visible, ANCHO_MUNDO * camara.k * dpr, 0.6 / camara.k);
          ctx.globalCompositeOperation = 'source-over';
        }
        // Ríos: más gruesos los grandes y al acercarse.
        ctx.strokeStyle = estilo.agua;
        ctx.lineCap = 'round';
        for (const rio of this.agua?.rios ?? []) {
          if (rio.z > z + 0.6 || !cajasSeCruzan(rio.caja, visible)) continue;
          const grosor = Math.min(2.2, 0.5 + 0.25 * (z - rio.z) + (rio.z <= 2.1 ? 0.4 : 0));
          ctx.lineWidth = Math.max(0.5, grosor) / camara.k;
          ctx.stroke(this.caminoAgua(rio));
        }
        ctx.strokeStyle = estilo.borde;
        ctx.lineWidth = Math.min(1.4, 0.6 + 0.12 * (z - 2.5)) / camara.k;
        ctx.lineJoin = 'round';
        for (const figura of [...zonas, ...paises]) ctx.stroke(this.camino(nivel, figura));
        this.resaltar(nivel, paises, camara);
      }
    }

    const fin = performance.now();
    this.msUltimo = fin - inicio;
    this.marcas.push(fin);
    while (this.marcas.length > 0 && this.marcas[0]! < fin - 1000) this.marcas.shift();
    this.alDibujar?.({ fps: this.marcas.length, msUltimo: this.msUltimo, nivel: this.nivelActual });

    // Si el mapa se ha movido bajo un ratón quieto (teclado, zoom animado), el país señalado cambia.
    const raton = this.raton;
    if (raton && this.camaraSenalada !== this.camara) {
      queueMicrotask(() => this.alPasar(raton[0], raton[1]));
    }
  }
}
