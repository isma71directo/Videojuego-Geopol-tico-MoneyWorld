/** Colores de país y nombres sobre el mapa (Fase 4, tarea f4-t2). */
import { readFileSync } from 'node:fs';
import { neighbors } from 'topojson-client';
import { describe, expect, it } from 'vitest';
import type { MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import {
  DISTANCIA_CASI_IGUAL,
  DISTANCIA_MINIMA_VECINOS,
  LUZ_MAXIMA_GRANDES,
  candidatosDeColor,
  colorearPaises,
  coloresDelMapa,
  desajuste,
  difTono,
  importancia,
  oklch,
  paisesCercanos,
  preferenciasDeColor,
} from '../src/map/colores';
import { distancia } from '../src/map/rampas';
import { geoArea, geoCentroid, geoDistance } from 'd3-geo';
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

describe('colores de país (ajustes f6-a1, f7-a1 y f7-a3)', () => {
  const mundo = topologia('mundo');
  const ids = mundo.objects.paises.geometries.map((g) => String(g.id));
  // Los colores del juego: los calcula 19-colores-pais.ts y el mapa los lee.
  const guardados = JSON.parse(
    readFileSync(new URL('../public/data/colores-pais.json', import.meta.url), 'utf8'),
  ) as { colores: Record<string, string> };
  const colores = new Map(Object.entries(guardados.colores));
  const centros = feature(mundo, mundo.objects.paises).features.map((f) => geoCentroid(f));
  const km = (i: number, j: number): number => geoDistance(centros[i]!, centros[j]!) * 6371;
  const superficies = feature(mundo, mundo.objects.paises).features.map(
    (f) => geoArea(f) * 6371 ** 2,
  );

  it('el archivo de colores está al día con la tabla, las banderas y el mapa', () => {
    expect(coloresDelMapa(mundo)).toEqual(colores);
    expect([...colores.keys()].sort()).toEqual([...ids].sort());
    for (const color of colores.values()) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  for (const nivel of ['mundo', 'detalle'] as const) {
    it(`dos países vecinos nunca tienen colores parecidos (mapa ${nivel})`, () => {
      const geometrias = topologia(nivel).objects.paises.geometries;
      const vecinos = neighbors(geometrias);
      let fronteras = 0;
      geometrias.forEach((g, i) => {
        for (const j of vecinos[i]!) {
          const a = String(g.id);
          const b = String(geometrias[j]!.id);
          expect(distancia(colores.get(a)!, colores.get(b)!), `${a} y ${b}`).toBeGreaterThanOrEqual(
            DISTANCIA_MINIMA_VECINOS - 1e-9,
          );
          fronteras++;
        }
      });
      // España-Francia, Rusia-Ucrania… hay cientos de fronteras comprobadas.
      expect(fronteras).toBeGreaterThan(600);
    });
  }

  it('el mapa lee los colores calculados y solo los calcula si falta el archivo', () => {
    const codigo = readFileSync(new URL('../src/map/mapa.ts', import.meta.url), 'utf8');
    expect(codigo.match(/coloresDelMapa\(/g)).toHaveLength(1);
    const pantalla = readFileSync(new URL('../src/ui/mapa-del-juego.ts', import.meta.url), 'utf8');
    expect(pantalla).toContain("colores: './data/colores-pais.json'");
  });

  it('los países cercanos sin frontera (islas, estrechos) no llevan colores casi iguales', () => {
    const formas = feature(mundo, mundo.objects.paises).features.map(
      (f) => f.geometry as Polygon | MultiPolygon,
    );
    const cercanos = paisesCercanos(formas);
    const casiIguales = cercanos.flatMap((lista, i) =>
      lista.filter(
        (j) =>
          j > i && distancia(colores.get(ids[i]!)!, colores.get(ids[j]!)!) < DISTANCIA_CASI_IGUAL,
      ),
    );
    expect(casiIguales).toHaveLength(0);
    for (const [a, b] of [
      ['GBR', 'FRA'],
      ['CUB', 'JAM'],
      ['JPN', 'KOR'],
      ['ESP', 'MAR'],
    ] as const) {
      expect(distancia(colores.get(a)!, colores.get(b)!), `${a} y ${b}`).toBeGreaterThan(0.06);
    }
  });

  it('con el mundo entero a la vista no se nota la repetición', () => {
    let parecidos = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const d = distancia(colores.get(ids[i]!)!, colores.get(ids[j]!)!);
        // A menos de 1.500 km, ninguno casi igual y muy pocos parecidos (de unos 1.400 pares).
        // Los microestados (Mónaco, Vaticano…), que con el mundo entero no se ven, no cuentan.
        const visibles = Math.min(superficies[i]!, superficies[j]!) > 1000;
        if (km(i, j) <= 1500 && visibles) {
          expect(d, `${ids[i]} y ${ids[j]}`).toBeGreaterThanOrEqual(DISTANCIA_CASI_IGUAL);
          if (d < 0.06) parecidos++;
        }
      }
    }
    expect(parecidos).toBeLessThan(45);
  });

  it('los países muy grandes no llevan tonos claros y no repiten color entre ellos', () => {
    const grandes = ['RUS', 'CAN', 'USA', 'CHN', 'BRA', 'AUS', 'IND', 'ARG', 'KAZ', 'DZA', 'GRL'];
    for (const [i, a] of grandes.entries()) {
      expect(oklch(colores.get(a)!)[0], a).toBeLessThanOrEqual(LUZ_MAXIMA_GRANDES + 0.005);
      for (const b of grandes.slice(i + 1)) {
        expect(colores.get(a), `${a} y ${b}`).not.toBe(colores.get(b));
      }
    }
  });

  it('cada país lleva su color representativo: España y Rumanía amarillo, Portugal rojo…', () => {
    const tono = (id: string): number => oklch(colores.get(id)!)[2];
    const esperado: [string, number, number][] = [
      ['ESP', 70, 110], // amarillo (decisión del jugador)
      ['ROU', 70, 110], // amarillo (petición del jugador)
      ['PRT', 0, 45], // rojo (petición del jugador)
      ['GBR', 0, 45], // rojo
      ['MAR', 0, 45], // rojo
      ['ITA', 160, 200], // verde azulado
      ['NLD', 40, 75], // naranja
      ['FRA', 240, 285], // azul
      ['IRL', 125, 175], // verde
      ['BRA', 125, 175], // verde
      ['CHN', 0, 45], // rojo
      ['CAN', 0, 45], // rojo
      ['ARG', 225, 270], // celeste
    ];
    for (const [id, desde, hasta] of esperado) {
      const h = tono(id);
      expect(h >= desde && h <= hasta, `${id}: tono ${h.toFixed(0)}`).toBe(true);
    }
  });

  it('casi todos llevan el tono de su color (o el de su segundo color)', () => {
    const preferencias = preferenciasDeColor();
    let propio = 0;
    let alguno = 0;
    for (const [id, color] of colores) {
      const h = oklch(color)[2];
      const tonos = preferencias.get(id)!.colores.map((c) => oklch(c)[2]);
      if (difTono(h, tonos[0]!) <= 25) propio++;
      if (tonos.some((t) => difTono(h, t) <= 25)) alguno++;
    }
    expect(propio / colores.size).toBeGreaterThan(0.85);
    expect(alguno).toBe(colores.size);
  });
});

describe('preferencias y variantes de color (ajuste f7-a3)', () => {
  it('la tabla manda; después, la bandera, sin blancos ni negros', () => {
    const preferencias = preferenciasDeColor();
    const espana = preferencias.get('ESP')!;
    expect(espana.deTabla).toBe(true);
    // Amarillo y rojo de la tabla, y los de la bandera solo si no se parecen a esos.
    expect(espana.colores.slice(0, 2)).toEqual(['#f2c500', '#d52b1e']);
    // Japón: el blanco de la bandera no cuenta.
    for (const color of preferencias.get('JPN')!.colores) {
      expect(oklch(color)[1]).toBeGreaterThan(0.04);
    }
    // Un territorio pequeño sin entrada en la tabla usa su bandera.
    expect(preferencias.get('ABW')!.deTabla).toBe(false);
    // Una tabla propia admite nombres y «#rrggbb»; un nombre desconocido se ignora.
    const propias = preferenciasDeColor(
      { colores: { rojo: '#d52b1e' }, paises: { AAA: ['rojo', '#2e9e4f', 'fucsia'] } },
      { AAA: [['#ffffff', 0.5, 'neutro']] },
    );
    expect(propias.get('AAA')).toEqual({ colores: ['#d52b1e', '#2e9e4f'], deTabla: true });
  });

  it('las variantes rodean al color pedido y la más parecida va primero', () => {
    const candidatos = candidatosDeColor({ colores: ['#f2c500', '#d52b1e'], deTabla: true });
    expect(candidatos.length).toBeGreaterThan(40);
    expect(candidatos[0]!.desajuste).toBeLessThan(0.3);
    expect(difTono(oklch(candidatos[0]!.hex)[2], oklch('#f2c500')[2])).toBeLessThan(5);
    // Las del segundo color cuestan más que las mejores del primero.
    const rojas = candidatos.filter((c) => difTono(oklch(c.hex)[2], 30) < 15);
    expect(Math.min(...rojas.map((c) => c.desajuste))).toBeGreaterThan(candidatos[0]!.desajuste);
    // Un país muy grande no tiene variantes claras.
    const grande = candidatosDeColor({ colores: ['#f2c500'], deTabla: true }, true);
    for (const c of grande) expect(oklch(c.hex)[0]).toBeLessThanOrEqual(LUZ_MAXIMA_GRANDES + 0.005);
    expect(desajuste([0.7, 0.1, 90], [0.7, 0.1, 90])).toBeCloseTo(0, 5);
    expect(importancia(500_000, true)).toBeGreaterThan(importancia(500_000, false));
  });

  it('el reparto también funciona en un caso pequeño', () => {
    // Un país rodeado por cuatro que forman un anillo, todos queriendo el mismo rojo.
    const vecinos = [
      [1, 2, 3, 4],
      [0, 2, 4],
      [0, 1, 3],
      [0, 2, 4],
      [0, 3, 1],
    ];
    const candidatos = vecinos.map(() =>
      candidatosDeColor({ colores: ['#d52b1e', '#2e9e4f'], deTabla: false }),
    );
    const elegidos = colorearPaises(vecinos, candidatos);
    const lab = (i: number): string => candidatos[i]![elegidos[i]!]!.hex;
    vecinos.forEach((lista, i) =>
      lista.forEach((j) =>
        expect(distancia(lab(i), lab(j))).toBeGreaterThanOrEqual(DISTANCIA_MINIMA_VECINOS - 1e-9),
      ),
    );
    expect(colorearPaises(vecinos, candidatos)).toEqual(elegidos);
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
