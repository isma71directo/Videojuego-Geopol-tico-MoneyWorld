/**
 * Cámara del mapa: qué parte del mundo se ve y a qué zoom. Lógica pura (sin DOM) para poder
 * probarla. El mundo da la vuelta en horizontal (al pasar el Pacífico se vuelve a América)
 * y tiene límites en vertical.
 */
import { ALTO_MUNDO, ANCHO_MUNDO } from './proyeccion';

export interface Camara {
  /** Centro de la vista en coordenadas de mundo. */
  cx: number;
  cy: number;
  /** Zoom: píxeles (CSS) por unidad de mundo. */
  k: number;
  /** Tamaño de la vista en píxeles CSS. */
  ancho: number;
  alto: number;
}

/** Cuánto se puede acercar respecto a la vista más alejada. */
export const ZOOM_MAXIMO_RELATIVO = 64;

/** Zoom mínimo: el mapa ocupa al menos todo el alto de la pantalla (sin franjas vacías). */
export function zoomMinimo(ancho: number, alto: number): number {
  return Math.max(alto / ALTO_MUNDO, ancho / (ANCHO_MUNDO * 2));
}

export const zoomMaximo = (ancho: number, alto: number): number =>
  zoomMinimo(ancho, alto) * ZOOM_MAXIMO_RELATIVO;

/** Resto positivo: la coordenada horizontal siempre queda entre 0 y ANCHO_MUNDO. */
export function envolverX(x: number): number {
  return ((x % ANCHO_MUNDO) + ANCHO_MUNDO) % ANCHO_MUNDO;
}

/** Ajusta la cámara a sus límites: zoom permitido, vuelta horizontal y tope vertical. */
export function limitar(camara: Camara): Camara {
  const k = Math.min(
    zoomMaximo(camara.ancho, camara.alto),
    Math.max(zoomMinimo(camara.ancho, camara.alto), camara.k),
  );
  const mitadAlto = camara.alto / (2 * k);
  const cy =
    mitadAlto * 2 >= ALTO_MUNDO
      ? ALTO_MUNDO / 2
      : Math.min(ALTO_MUNDO - mitadAlto, Math.max(mitadAlto, camara.cy));
  return { ...camara, k, cx: envolverX(camara.cx), cy };
}

/** Vista inicial: todo el alto del mundo, centrada en el meridiano de Greenwich. */
export function camaraInicial(ancho: number, alto: number): Camara {
  return limitar({ cx: ANCHO_MUNDO / 2, cy: ALTO_MUNDO / 2, k: 0, ancho, alto });
}

export function pantallaAMundo(camara: Camara, px: number, py: number): [number, number] {
  return [
    camara.cx + (px - camara.ancho / 2) / camara.k,
    camara.cy + (py - camara.alto / 2) / camara.k,
  ];
}

export function mundoAPantalla(camara: Camara, x: number, y: number): [number, number] {
  return [
    (x - camara.cx) * camara.k + camara.ancho / 2,
    (y - camara.cy) * camara.k + camara.alto / 2,
  ];
}

/** Mueve la vista los píxeles indicados (lo que hace el dedo al arrastrar). */
export function desplazar(camara: Camara, dx: number, dy: number): Camara {
  return limitar({ ...camara, cx: camara.cx - dx / camara.k, cy: camara.cy - dy / camara.k });
}

/** Multiplica el zoom manteniendo fijo el punto de la pantalla (px, py). */
export function zoomEn(camara: Camara, factor: number, px: number, py: number): Camara {
  const [x, y] = pantallaAMundo(camara, px, py);
  const k = Math.min(
    zoomMaximo(camara.ancho, camara.alto),
    Math.max(zoomMinimo(camara.ancho, camara.alto), camara.k * factor),
  );
  return limitar({
    ...camara,
    k,
    cx: x - (px - camara.ancho / 2) / k,
    cy: y - (py - camara.alto / 2) / k,
  });
}

/** Rectángulo visible en coordenadas de mundo (la x puede salirse de 0..ANCHO_MUNDO). */
export function rectanguloVisible(camara: Camara): [number, number, number, number] {
  const [x0, y0] = pantallaAMundo(camara, 0, 0);
  const [x1, y1] = pantallaAMundo(camara, camara.ancho, camara.alto);
  return [x0, y0, x1, y1];
}

/**
 * Copias del mundo que se ven a la vez (desplazamientos múltiplos de ANCHO_MUNDO): con el
 * zoom más alejado puede verse el final de América junto al principio de Asia.
 */
export function copiasVisibles(camara: Camara): number[] {
  const [x0, , x1] = rectanguloVisible(camara);
  const copias: number[] = [];
  for (let i = Math.floor(x0 / ANCHO_MUNDO); i <= Math.floor(x1 / ANCHO_MUNDO); i += 1) {
    copias.push(i * ANCHO_MUNDO);
  }
  return copias;
}

/** Zoom relativo a la vista más alejada (1 = mundo entero). */
export function zoomRelativo(camara: Camara): number {
  return camara.k / zoomMinimo(camara.ancho, camara.alto);
}

type Punto = readonly [number, number];

/**
 * Pellizco con dos dedos: el zoom sigue la distancia entre los dedos y el mapa sigue su punto
 * medio, de modo que lo que había bajo los dedos sigue bajo los dedos.
 */
export function pellizcar(
  camara: Camara,
  antes: readonly [Punto, Punto],
  despues: readonly [Punto, Punto],
): Camara {
  const distancia = ([a, b]: readonly [Punto, Punto]): number =>
    Math.hypot(a[0] - b[0], a[1] - b[1]);
  const medio = ([a, b]: readonly [Punto, Punto]): Punto => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const factor = distancia(antes) > 0 ? distancia(despues) / distancia(antes) : 1;
  const [mx0, my0] = medio(antes);
  const [mx1, my1] = medio(despues);
  return desplazar(zoomEn(camara, factor, mx0, my0), mx1 - mx0, my1 - my0);
}
