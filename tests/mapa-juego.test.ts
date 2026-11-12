import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  camaraInicial,
  copiasVisibles,
  desplazar,
  envolverX,
  limitar,
  mundoAPantalla,
  pantallaAMundo,
  zoomEn,
  zoomMinimo,
  zoomRelativo,
  ZOOM_MAXIMO_RELATIVO,
} from '../src/map/camara';
import { cajasSeCruzan, prepararFiguras, type TopologiaMapa } from '../src/map/geometria';
import {
  ALTO_MUNDO,
  ANCHO_MUNDO,
  LATITUD_NORTE,
  LATITUD_SUR,
  crearProyeccion,
} from '../src/map/proyeccion';

const proyeccion = crearProyeccion();
const punto = (lon: number, lat: number) => proyeccion([lon, lat])!;

describe('proyección Miller del mapa de juego', () => {
  it('ocupa todo el ancho de 180° O a 180° E y el alto entre sus latitudes límite', () => {
    expect(punto(-180, 0)[0]).toBeCloseTo(0, 6);
    expect(punto(180, 0)[0]).toBeCloseTo(ANCHO_MUNDO, 6);
    expect(punto(0, LATITUD_NORTE)[1]).toBeCloseTo(0, 6);
    expect(punto(0, LATITUD_SUR)[1]).toBeCloseTo(ALTO_MUNDO, 6);
  });

  it('es más ancha que alta, como un mapa de juego de estrategia', () => {
    expect(ALTO_MUNDO / ANCHO_MUNDO).toBeGreaterThan(0.45);
    expect(ALTO_MUNDO / ANCHO_MUNDO).toBeLessThan(0.6);
  });

  it('sitúa ciudades conocidas donde corresponde', () => {
    const [x, y] = punto(-3.7, 40.42); // Madrid
    expect(x).toBeCloseTo(((180 - 3.7) / 360) * ANCHO_MUNDO, 6);
    const [, yEcuador] = punto(0, 0);
    expect(y).toBeLessThan(yEcuador);
    // Reikiavik está más al norte que Madrid y Sídney, al sur del ecuador.
    expect(punto(-21.9, 64.1)[1]).toBeLessThan(y);
    expect(punto(151.2, -33.9)[1]).toBeGreaterThan(yEcuador);
  });

  it('se invierte sin error (de la pantalla al mundo y vuelta)', () => {
    for (const [lon, lat] of [
      [-3.7, 40.42],
      [139.7, 35.7],
      [-58.4, -34.6],
    ]) {
      const [l2, p2] = proyeccion.invert!(punto(lon!, lat!))!;
      expect(l2).toBeCloseTo(lon!, 6);
      expect(p2).toBeCloseTo(lat!, 6);
    }
  });
});

describe('cámara del mapa', () => {
  const movil = camaraInicial(360, 740);
  const pc = camaraInicial(1280, 800);

  it('empieza mostrando todo el alto del mundo, sin franjas vacías', () => {
    for (const c of [movil, pc]) {
      expect(c.k * ALTO_MUNDO).toBeCloseTo(c.alto, 6);
      expect(zoomRelativo(c)).toBeCloseTo(1, 6);
    }
  });

  it('no deja alejarse más del mundo entero ni acercarse más del máximo', () => {
    expect(zoomEn(movil, 0.1, 180, 370).k).toBeCloseTo(zoomMinimo(360, 740), 6);
    const cerca = zoomEn(movil, 1e6, 180, 370);
    expect(zoomRelativo(cerca)).toBeCloseTo(ZOOM_MAXIMO_RELATIVO, 6);
  });

  it('al hacer zoom, el punto bajo el dedo se queda quieto', () => {
    const antes = pantallaAMundo(pc, 300, 200);
    const despues = zoomEn(pc, 3, 300, 200);
    const [px, py] = mundoAPantalla(despues, ...antes);
    expect(px).toBeCloseTo(300, 6);
    expect(py).toBeCloseTo(200, 6);
  });

  it('da la vuelta al mundo en horizontal: un mundo entero de desplazamiento vuelve al mismo sitio', () => {
    const lejos = desplazar(pc, -ANCHO_MUNDO * pc.k, 0);
    expect(lejos.cx).toBeCloseTo(pc.cx, 6);
    expect(envolverX(-10)).toBeCloseTo(ANCHO_MUNDO - 10, 6);
    expect(envolverX(ANCHO_MUNDO + 5)).toBeCloseTo(5, 6);
  });

  it('no deja salirse por arriba ni por abajo', () => {
    const cerca = zoomEn(pc, 8, 640, 400);
    const arriba = desplazar(cerca, 0, 1e6);
    expect(arriba.cy - arriba.alto / (2 * arriba.k)).toBeCloseTo(0, 6);
    const abajo = desplazar(cerca, 0, -1e6);
    expect(abajo.cy + abajo.alto / (2 * abajo.k)).toBeCloseTo(ALTO_MUNDO, 6);
  });

  it('dibuja dos copias del mundo cuando la vista cruza el Pacífico', () => {
    const enElPacifico = limitar({ ...pc, cx: 2 });
    expect(copiasVisibles(enElPacifico)).toEqual([-ANCHO_MUNDO, 0]);
    const enEuropa = zoomEn(limitar({ ...pc, cx: ANCHO_MUNDO / 2 }), 4, 640, 400);
    expect(copiasVisibles(enEuropa)).toEqual([0]);
  });
});

describe('geometría del mapa de juego', () => {
  const topo = JSON.parse(
    readFileSync(new URL('../public/data/mapa-2010-mundo.json', import.meta.url), 'utf8'),
  ) as TopologiaMapa;
  const { paises } = prepararFiguras(topo);

  it('proyecta todos los países dentro del mundo, con su caja', () => {
    expect(paises.length).toBeGreaterThan(200);
    for (const f of paises) {
      expect(f.caja[0], f.id).toBeGreaterThanOrEqual(-0.001);
      expect(f.caja[2], f.id).toBeLessThanOrEqual(ANCHO_MUNDO + 0.001);
      expect(f.caja[1], f.id).toBeGreaterThanOrEqual(-0.001);
      expect(f.caja[3], f.id).toBeLessThanOrEqual(ALTO_MUNDO + 0.001);
    }
  });

  it('la caja de España contiene Madrid', () => {
    const espana = paises.find((f) => f.id === 'ESP')!;
    const [x, y] = punto(-3.7, 40.42);
    expect(cajasSeCruzan(espana.caja, [x, y, x, y])).toBe(true);
  });
});
