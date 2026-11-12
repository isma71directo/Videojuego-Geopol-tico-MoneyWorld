/**
 * Gestos del mapa: arrastrar con el dedo o el ratón, pellizcar, rueda, doble toque o doble
 * clic para acercar, y teclado (flechas y +/−). Un toque corto sin arrastre se avisa aparte
 * para poder seleccionar países (Fase 4).
 */
import { desplazar, pellizcar, zoomEn, type Camara } from './camara';

export interface DestinoGestos {
  vista: Camara;
  /** Toque o clic sin arrastre, en píxeles relativos al mapa. */
  alTocar?: (x: number, y: number) => void;
  /** Zoom pedido por doble toque o teclado; permite animarlo. */
  alPedirZoom?: (factor: number, x: number, y: number) => void;
  /** Al soltar un arrastre, con su velocidad en px/ms (para la inercia). */
  alSoltar?: (vx: number, vy: number) => void;
  /** Al empezar cualquier gesto (para detener animaciones). */
  alEmpezarGesto?: () => void;
  /** El ratón se mueve sin pulsar sobre el mapa (null al salir). */
  alPasar?: (x: number | null, y: number | null) => void;
}

/** Por debajo de esta distancia (px) un toque no cuenta como arrastre. */
const UMBRAL_ARRASTRE = 6;
const DOBLE_TOQUE_MS = 300;
const DOBLE_TOQUE_PX = 24;
const PASO_TECLADO = 80;

export function conectarGestos(elemento: HTMLElement, destino: DestinoGestos): () => void {
  const punteros = new Map<number, [number, number]>();
  let arrastrado = false;
  let inicioToque: [number, number] | null = null;
  let ultimoToque = { t: 0, x: 0, y: 0 };
  /** Últimas posiciones del arrastre, para calcular la velocidad al soltar. */
  let huella: { t: number; x: number; y: number }[] = [];

  const posicion = (evento: { clientX: number; clientY: number }): [number, number] => {
    const caja = elemento.getBoundingClientRect();
    return [evento.clientX - caja.left, evento.clientY - caja.top];
  };
  const pedirZoom = (factor: number, x: number, y: number): void => {
    if (destino.alPedirZoom) destino.alPedirZoom(factor, x, y);
    else destino.vista = zoomEn(destino.vista, factor, x, y);
  };

  const alBajar = (evento: PointerEvent): void => {
    destino.alEmpezarGesto?.();
    // Mientras se arrastra no se señala nada; vuelve al mover el ratón sin pulsar.
    destino.alPasar?.(null, null);
    huella = [];
    elemento.setPointerCapture(evento.pointerId);
    punteros.set(evento.pointerId, posicion(evento));
    if (punteros.size === 1) {
      arrastrado = false;
      inicioToque = posicion(evento);
    } else {
      // Con dos dedos ya no es un toque.
      arrastrado = true;
    }
  };

  const alMover = (evento: PointerEvent): void => {
    const anterior = punteros.get(evento.pointerId);
    if (!anterior) {
      // Ratón sin pulsar: señalar lo que hay debajo.
      if (evento.pointerType === 'mouse') destino.alPasar?.(...posicion(evento));
      return;
    }
    const actual = posicion(evento);
    if (punteros.size === 1) {
      if (
        inicioToque &&
        Math.hypot(actual[0] - inicioToque[0], actual[1] - inicioToque[1]) > UMBRAL_ARRASTRE
      ) {
        arrastrado = true;
      }
      if (arrastrado) {
        destino.vista = desplazar(destino.vista, actual[0] - anterior[0], actual[1] - anterior[1]);
        const ahora = performance.now();
        huella.push({ t: ahora, x: actual[0], y: actual[1] });
        huella = huella.filter((marca) => marca.t > ahora - 100);
      }
    } else if (punteros.size === 2) {
      const [otroId, otro] = [...punteros].find(([id]) => id !== evento.pointerId)!;
      void otroId;
      destino.vista = pellizcar(destino.vista, [anterior, otro], [actual, otro]);
    }
    punteros.set(evento.pointerId, actual);
  };

  const alSubir = (evento: PointerEvent): void => {
    const habiaUno = punteros.size === 1;
    const final = punteros.get(evento.pointerId);
    punteros.delete(evento.pointerId);
    if (habiaUno && arrastrado && huella.length >= 2) {
      const primera = huella[0]!;
      const ultima = huella.at(-1)!;
      const dt = ultima.t - primera.t;
      if (dt > 0 && performance.now() - ultima.t < 60) {
        destino.alSoltar?.((ultima.x - primera.x) / dt, (ultima.y - primera.y) / dt);
      }
    }
    if (!habiaUno || arrastrado || !final) return;
    const ahora = performance.now();
    const [x, y] = final;
    if (
      ahora - ultimoToque.t < DOBLE_TOQUE_MS &&
      Math.hypot(x - ultimoToque.x, y - ultimoToque.y) < DOBLE_TOQUE_PX
    ) {
      ultimoToque = { t: 0, x: 0, y: 0 };
      pedirZoom(2, x, y);
    } else {
      ultimoToque = { t: ahora, x, y };
      destino.alTocar?.(x, y);
    }
  };

  const alCancelar = (evento: PointerEvent): void => {
    punteros.delete(evento.pointerId);
  };

  const alSalir = (): void => destino.alPasar?.(null, null);

  const alRueda = (evento: WheelEvent): void => {
    evento.preventDefault();
    destino.alEmpezarGesto?.();
    // Ratón (saltos grandes) y panel táctil (saltos pequeños) dan un zoom proporcional.
    const delta = evento.deltaMode === 1 ? evento.deltaY * 16 : evento.deltaY;
    const [x, y] = posicion(evento);
    destino.vista = zoomEn(destino.vista, Math.exp(-delta * 0.0018), x, y);
  };

  const alTeclear = (evento: KeyboardEvent): void => {
    const { ancho, alto } = destino.vista;
    const acciones: Record<string, () => void> = {
      ArrowLeft: () => (destino.vista = desplazar(destino.vista, PASO_TECLADO, 0)),
      ArrowRight: () => (destino.vista = desplazar(destino.vista, -PASO_TECLADO, 0)),
      ArrowUp: () => (destino.vista = desplazar(destino.vista, 0, PASO_TECLADO)),
      ArrowDown: () => (destino.vista = desplazar(destino.vista, 0, -PASO_TECLADO)),
      '+': () => pedirZoom(1.6, ancho / 2, alto / 2),
      '=': () => pedirZoom(1.6, ancho / 2, alto / 2),
      '-': () => pedirZoom(1 / 1.6, ancho / 2, alto / 2),
    };
    const accion = acciones[evento.key];
    if (accion) {
      evento.preventDefault();
      accion();
    }
  };

  elemento.addEventListener('pointerdown', alBajar);
  elemento.addEventListener('pointermove', alMover);
  elemento.addEventListener('pointerup', alSubir);
  elemento.addEventListener('pointercancel', alCancelar);
  elemento.addEventListener('pointerleave', alSalir);
  elemento.addEventListener('wheel', alRueda, { passive: false });
  elemento.addEventListener('keydown', alTeclear);
  return () => {
    elemento.removeEventListener('pointerdown', alBajar);
    elemento.removeEventListener('pointermove', alMover);
    elemento.removeEventListener('pointerup', alSubir);
    elemento.removeEventListener('pointercancel', alCancelar);
    elemento.removeEventListener('pointerleave', alSalir);
    elemento.removeEventListener('wheel', alRueda);
    elemento.removeEventListener('keydown', alTeclear);
  };
}
