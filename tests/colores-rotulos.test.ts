/** Colores de país y nombres sobre el mapa (Fase 4, tarea f4-t2). */
import { readFileSync } from 'node:fs';
import { neighbors } from 'topojson-client';
import { describe, expect, it } from 'vitest';
import type { MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import { asignarColores, coloresDelMapa, indiceEstable, paisesCercanos } from '../src/map/colores';
import { PALETA } from '../src/map/estilo';
import { prepararFiguras, type TopologiaMapa } from '../src/map/geometria';
import { camaraInicial } from '../src/map/camara';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  cajasSeSolapan,
  colocarRotulos,
  partirNombre,
  tamanoLetra,
  LETRA_MAXIMA,
  TAMANO_MINIMO_NOMBRE,
  LETRA_MINIMA,
  type CandidatoRotulo,
} from '../src/map/rotulos';

function topologia(nivel: 'mundo' | 'detalle'): TopologiaMapa {
  return JSON.parse(
    readFileSync(new URL(`../public/data/mapa-2010-${nivel}.json`, import.meta.url), 'utf8'),
  ) as TopologiaMapa;
}

describe('colores de país', () => {
  for (const nivel of ['mundo', 'detalle'] as const) {
    it(`dos países vecinos nunca tienen el mismo color (mapa ${nivel})`, () => {
      const topo = topologia(nivel);
      const geometrias = topo.objects.paises.geometries;
      const colores = coloresDelMapa(topo, PALETA);
      const vecinos = neighbors(geometrias);
      let fronteras = 0;
      geometrias.forEach((g, i) => {
        for (const j of vecinos[i]!) {
          const a = String(g.id);
          const b = String(geometrias[j]!.id);
          expect(colores.get(a), `${a} y ${b}`).not.toBe(colores.get(b));
          fronteras++;
        }
      });
      // España-Francia, Rusia-Ucrania… hay cientos de fronteras comprobadas.
      expect(fronteras).toBeGreaterThan(600);
    });
  }

  it('cada país tiene siempre el mismo color, se cargue el nivel que se cargue', () => {
    const mundo = coloresDelMapa(topologia('mundo'), PALETA);
    expect(coloresDelMapa(topologia('mundo'), PALETA)).toEqual(mundo);
    expect(coloresDelMapa(topologia('detalle'), PALETA)).toEqual(mundo);
  });

  it('en el entorno de un país (él y sus vecinos) ningún color se repite tres veces', () => {
    const topo = topologia('mundo');
    const geometrias = topo.objects.paises.geometries;
    const colores = coloresDelMapa(topo, PALETA);
    const vecinos = neighbors(geometrias);
    geometrias.forEach((g, i) => {
      const cuenta = new Map<string, number>();
      for (const k of [i, ...vecinos[i]!]) {
        const color = colores.get(String(geometrias[k]!.id))!;
        cuenta.set(color, (cuenta.get(color) ?? 0) + 1);
      }
      expect(Math.max(...cuenta.values()), String(g.id)).toBeLessThan(3);
    });
  });

  it('los países cercanos sin frontera (islas, estrechos) tampoco repiten color', () => {
    const topo = topologia('mundo');
    const colores = coloresDelMapa(topo, PALETA);
    const ids = topo.objects.paises.geometries.map((g) => String(g.id));
    const formas = feature(topo, topo.objects.paises).features.map(
      (f) => f.geometry as Polygon | MultiPolygon,
    );
    const cercanos = paisesCercanos(formas);
    const iguales = cercanos.flatMap((lista, i) =>
      lista.filter((j) => j > i && colores.get(ids[i]!) === colores.get(ids[j]!)),
    );
    expect(iguales.length).toBeLessThanOrEqual(3);
    for (const [a, b] of [
      ['GBR', 'FRA'],
      ['CUB', 'JAM'],
      ['JPN', 'KOR'],
      ['ESP', 'MAR'],
    ] as const) {
      expect(colores.get(a), `${a} y ${b}`).not.toBe(colores.get(b));
    }
  });

  it('se usan todos los colores de la paleta de forma equilibrada', () => {
    const usos = new Map<string, number>();
    for (const color of coloresDelMapa(topologia('mundo'), PALETA).values()) {
      usos.set(color, (usos.get(color) ?? 0) + 1);
    }
    expect(usos.size).toBe(PALETA.length);
    for (const veces of usos.values()) expect(veces).toBeGreaterThan(10);
  });

  it('el reparto también funciona en un caso pequeño', () => {
    // Un país rodeado por cuatro que forman un anillo.
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const vecinos = [
      [1, 2, 3, 4],
      [0, 2, 4],
      [0, 1, 3],
      [0, 2, 4],
      [0, 3, 1],
    ];
    const colores = asignarColores(ids, vecinos, 4);
    vecinos.forEach((lista, i) => lista.forEach((j) => expect(colores[i]).not.toBe(colores[j])));
    expect(indiceEstable('ESP', 8)).toBe(indiceEstable('ESP', 8));
  });

  it('la paleta tiene tonos claramente distintos', () => {
    const rgb = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    for (let i = 0; i < PALETA.length; i++) {
      for (let j = i + 1; j < PALETA.length; j++) {
        const [a, b] = [rgb(PALETA[i]!), rgb(PALETA[j]!)];
        const distancia = Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
        expect(distancia, `${PALETA[i]} y ${PALETA[j]}`).toBeGreaterThan(40);
      }
    }
  });
});

describe('nombres de los países', () => {
  // Medida aproximada: 0,62 em por letra.
  const medir = (texto: string, tamano: number): number => texto.length * tamano * 0.62;

  it('los nombres largos se parten en dos líneas', () => {
    expect(partirNombre('República Democrática del Congo')).toEqual([
      'República Democrática',
      'del Congo',
    ]);
    expect(partirNombre('Bosnia y Herzegovina')).toEqual(['Bosnia y', 'Herzegovina']);
    expect(partirNombre('Mauritania')).toEqual(['Mauritania']);
  });

  it('la letra crece con el país, entre un mínimo y un máximo', () => {
    expect(tamanoLetra(5)).toBe(LETRA_MINIMA);
    expect(tamanoLetra(5000)).toBe(LETRA_MAXIMA);
    expect(tamanoLetra(120)).toBeGreaterThan(tamanoLetra(60));
  });

  it('los nombres nunca se pisan y los países grandes van primero', () => {
    const candidatos: CandidatoRotulo[] = [
      { id: 'RUS', texto: 'Rusia', x: 400, y: 200, tamanoPais: 260 },
      { id: 'EST', texto: 'Estonia', x: 405, y: 204, tamanoPais: 60 },
      { id: 'ESP', texto: 'España', x: 100, y: 300, tamanoPais: 70 },
      { id: 'PRT', texto: 'Portugal', x: 70, y: 302, tamanoPais: 50 },
      { id: 'LUX', texto: 'Luxemburgo', x: 600, y: 300, tamanoPais: 3 },
    ];
    const rotulos = colocarRotulos(candidatos, medir, 1280, 720);
    const ids = rotulos.map((r) => r.id);
    expect(ids).toContain('RUS');
    expect(ids).toContain('ESP');
    expect(ids).not.toContain('EST'); // pisaría a Rusia
    expect(ids).not.toContain('LUX'); // demasiado pequeño a este zoom
    for (let i = 0; i < rotulos.length; i++) {
      for (let j = i + 1; j < rotulos.length; j++) {
        expect(cajasSeSolapan(rotulos[i]!.caja, rotulos[j]!.caja)).toBe(false);
      }
    }
  });

  it('un país pequeño que ya se ve muestra su nombre aunque no quepa dentro', () => {
    const [rotulo] = colocarRotulos(
      [{ id: 'CZE', texto: 'República Checa', x: 200, y: 200, tamanoPais: 12 }],
      medir,
      1280,
      720,
    );
    expect(rotulo?.id).toBe('CZE');
    expect(rotulo!.lineas).toEqual(['REPÚBLICA', 'CHECA']);
  });

  it('los países diminutos (Hong Kong) esperan al zoom', () => {
    const rotulos = colocarRotulos(
      [{ id: 'HKG', texto: 'Hong Kong', x: 200, y: 200, tamanoPais: TAMANO_MINIMO_NOMBRE - 1 }],
      medir,
      1280,
      720,
    );
    expect(rotulos).toEqual([]);
  });

  it('si el nombre entero no cabe, se prueba su forma corta', () => {
    const checa: CandidatoRotulo = {
      id: 'CZE',
      texto: 'República Checa',
      textoCorto: 'Rep. Checa',
      x: 200,
      y: 200,
      tamanoPais: 12,
    };
    // Entre dos nombres de vecinos solo queda un hueco de una línea: las dos líneas de
    // «REPÚBLICA CHECA» no caben, pero «REP. CHECA» sí.
    const vecinos: [number, number, number, number][] = [
      [0, 0, 400, 192],
      [0, 208, 400, 400],
    ];
    const [rotulo] = colocarRotulos([checa], medir, 1280, 720, vecinos);
    expect(rotulo?.lineas).toEqual(['REP. CHECA']);
  });

  it('con el mundo entero a la vista se ve el nombre de Marruecos, y no el de Hong Kong', () => {
    const topo = topologia('mundo');
    const figuras = prepararFiguras(topo).paises;
    const { paises } = JSON.parse(
      readFileSync(new URL('../public/data/paises-2010.json', import.meta.url), 'utf8'),
    ) as ConjuntoPaises;
    const camara = camaraInicial(1280, 720);
    const candidatos: CandidatoRotulo[] = figuras.flatMap((f) =>
      f.etiqueta
        ? [
            {
              id: f.id,
              texto: paises[f.id]!.nombre,
              x: (f.etiqueta[0] - camara.cx) * camara.k + camara.ancho / 2,
              y: (f.etiqueta[1] - camara.cy) * camara.k + camara.alto / 2,
              tamanoPais: Math.sqrt(f.area) * camara.k,
            },
          ]
        : [],
    );
    // Medida algo generosa (mayúsculas con espaciado) para no depender del tipo de letra.
    const medirMayusculas = (texto: string, tamano: number): number => texto.length * tamano * 0.7;
    const ids = colocarRotulos(candidatos, medirMayusculas, 1280, 720).map((r) => r.id);
    expect(ids).toContain('MAR');
    expect(ids).not.toContain('HKG');
    expect(ids.length).toBeGreaterThan(90);
  });

  it('no se colocan nombres fuera de la pantalla', () => {
    const rotulos = colocarRotulos(
      [{ id: 'BRA', texto: 'Brasil', x: -500, y: 300, tamanoPais: 200 }],
      medir,
      1280,
      720,
    );
    expect(rotulos).toEqual([]);
  });
});
