import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { CAMPOS, DERIVADOS } from '../scripts/datos/lib/campos.ts';
import { jsonCompacto, leerJson } from '../scripts/datos/lib/comun.ts';
import { construir, mediana, type Entradas } from '../scripts/datos/lib/construir.ts';
import type { ArchivoFuente, PaisBase, SeriePorPais } from '../scripts/datos/lib/tipos.ts';
import { ESTADOS_2010, cobertura, validar } from '../scripts/datos/lib/validar.ts';
import { esEstimado, type ConjuntoPaises } from '../src/datos/paises.ts';

const texto = readFileSync(new URL('../public/data/paises-2010.json', import.meta.url), 'utf8');
const conjunto = JSON.parse(texto) as ConjuntoPaises;
const paises = Object.values(conjunto.paises);
const pais = (id: string) => conjunto.paises[id]!;

describe('paises-2010.json (datos publicados)', () => {
  it('es válido según su esquema', () => {
    const esquema = leerJson<object>('public/data/paises-2010.schema.json');
    const validarEsquema = new Ajv({ allErrors: true }).compile(esquema);
    validarEsquema(conjunto);
    expect(validarEsquema.errors ?? []).toEqual([]);
  });

  it('pasa la validación de rangos, sumas y duplicados', () => {
    expect(validar(conjunto).errores).toEqual([]);
  });

  it('ningún país jugable carece de población, PIB o capital', () => {
    for (const p of paises.filter((uno) => uno.jugable)) {
      expect(p.datos.poblacion, `${p.nombre} sin población`).toBeGreaterThan(0);
      expect(p.datos.pib, `${p.nombre} sin PIB`).toBeGreaterThan(0);
      expect(p.capital, `${p.nombre} sin capital`).not.toBe('');
    }
  });

  it('tiene datos reales de población y PIB de al menos 190 países', () => {
    const reales = paises.filter(
      (p) => !esEstimado(p.origen.poblacion) && !esEstimado(p.origen.pib) && p.datos.pib !== null,
    );
    expect(reales.length).toBeGreaterThanOrEqual(190);
  });

  it('contiene los Estados de 2010 y los territorios especiales del GDD', () => {
    expect(paises.filter((p) => p.tipo === 'pais')).toHaveLength(ESTADOS_2010);
    const especiales = paises.filter((p) => p.tipo === 'especial').map((p) => p.nombre);
    expect(especiales.sort()).toEqual(
      [
        'Abjasia',
        'Chipre del Norte',
        'Kosovo',
        'Osetia del Sur',
        'Palestina',
        'Somalilandia',
        'Sáhara Occidental',
        'Taiwán',
        'Transnistria',
      ].sort(),
    );
  });

  it('refleja el mapa de 2010: Sudán unido y sin Sudán del Sur', () => {
    expect(conjunto.paises.SSD).toBeUndefined();
    // Sudán (unos 35 M) más Sudán del Sur (unos 10 M).
    expect(pais('SDN').datos.poblacion).toBeGreaterThan(42e6);
  });

  it('usa los nombres y las capitales de 2010', () => {
    expect(pais('MKD').nombre).toBe('Macedonia');
    expect(pais('SWZ').nombre).toBe('Suazilandia');
    expect(pais('BDI').capital).toBe('Buyumbura');
    expect(pais('ESP').capital).toBe('Madrid');
  });

  it('da cifras reconocibles de 2010 para países conocidos', () => {
    const espana = pais('ESP').datos;
    expect(espana.poblacion).toBeGreaterThan(46e6);
    expect(espana.poblacion).toBeLessThan(47.5e6);
    expect(espana.paro).toBeGreaterThan(19);
    expect(espana.paro).toBeLessThan(21);
    expect(pais('ESP').origen.paro).toBe('BM:2010');
    // China estaba a punto de superar a Japón como segunda economía (GDD, sección 3).
    expect(pais('USA').datos.pib!).toBeGreaterThan(pais('CHN').datos.pib!);
    expect(pais('CHN').datos.pib! / pais('JPN').datos.pib!).toBeGreaterThan(0.9);
    expect(pais('FRA').datos.elecNuclear! / pais('FRA').datos.generacionElectrica!).toBeGreaterThan(
      0.7,
    );
    expect(pais('SAU').datos.reservasPetroleo).toBeGreaterThan(200000);
    expect(pais('GRC').datos.deudaPib).toBeGreaterThan(120);
  });

  it('marca como estimado todo valor que no es un dato real', () => {
    for (const p of paises) {
      const estimados = Object.keys(p.origen).filter((campo) => esEstimado(p.origen[campo]));
      expect([...p.datosEstimados].sort()).toEqual(estimados.sort());
    }
    // Corea del Norte no publica su PIB: tiene que constar como estimación.
    expect(pais('PRK').datosEstimados).toContain('pib');
  });

  it('describe todos los campos que usa', () => {
    const claves = [...CAMPOS, ...DERIVADOS].map((campo) => campo.clave);
    expect(Object.keys(conjunto.campos)).toEqual(claves);
    for (const p of paises) expect(Object.keys(p.datos)).toEqual(claves);
  });

  it('está al día con las fuentes descargadas (npm run datos:construir)', () => {
    const archivo = (nombre: string) => leerJson<ArchivoFuente>(`fuentes/datos/${nombre}.json`);
    const entradas: Entradas = {
      paises: leerJson<{ paises: PaisBase[] }>('fuentes/datos/paises.json').paises,
      archivos: {
        bm: archivo('banco-mundial'),
        fmi: archivo('fmi'),
        energia: archivo('owid-energia'),
        emisiones: archivo('owid-emisiones'),
        recursos: archivo('recursos'),
      },
      territorios: leerJson<{ territorios: Entradas['territorios'] }>(
        'fuentes/datos/territorios.json',
      ).territorios,
    };
    expect(`${jsonCompacto(construir(entradas).conjunto, 3)}\n`).toBe(texto);
  });

  it('resume la cobertura sin perder ningún valor', () => {
    const { total, porPais } = cobertura(conjunto);
    const valores = paises.length * Object.keys(conjunto.campos).length;
    expect(total.reales + total.estimados + total.sinDato).toBe(valores);
    expect(Object.keys(porPais)).toHaveLength(paises.length);
    expect(total.reales).toBeGreaterThan(total.estimados);
  });
});

// ── Lógica de construcción, con un mundo inventado de pocos países ──────────────────────

function fuente(indicadores: Record<string, SeriePorPais>): ArchivoFuente {
  return {
    fuente: 'prueba',
    url: 'https://example.org',
    descargado: '2026-01-01',
    indicadores: Object.fromEntries(
      Object.entries(indicadores).map(([clave, valores]) => [
        clave,
        { codigo: clave, descripcion: clave, unidad: '', valores },
      ]),
    ),
  };
}

function paisDePrueba(id: string, extra: Partial<PaisBase> = {}): PaisBase {
  return {
    id,
    iso2: id.slice(0, 2),
    nombre: `País ${id}`,
    tipo: 'pais',
    jugable: true,
    capital: `Capital de ${id}`,
    capitalFuente: 'manual',
    region: 'ECS',
    regionNombre: 'Europa y Asia Central',
    codigos: { bm: id, fmi: id, owid: id, wikidata: null },
    ...extra,
  };
}

const en2010 = (valores: Record<string, number>): SeriePorPais =>
  Object.fromEntries(Object.entries(valores).map(([id, valor]) => [id, { '2010': valor }]));

/** Cuatro países iguales de renta alta; cada test cambia lo que necesita. */
function mundo(cambios: {
  bm?: Record<string, SeriePorPais>;
  paises?: PaisBase[];
  recursos?: Record<string, SeriePorPais>;
}): Entradas {
  const ids = ['AAA', 'BBB', 'CCC', 'DDD'];
  const todos = (valor: number) => en2010(Object.fromEntries(ids.map((id) => [id, valor])));
  return {
    paises: cambios.paises ?? ids.map((id) => paisDePrueba(id)),
    archivos: {
      bm: fuente({
        poblacion: todos(1e6),
        pib: todos(3e10),
        rnbPerCapita: todos(30000),
        paro: en2010({ AAA: 4, BBB: 6, CCC: 10 }),
        agriculturaPib: todos(2),
        industriaPib: todos(28),
        serviciosPib: todos(60),
        ...cambios.bm,
      }),
      fmi: fuente({}),
      energia: fuente({}),
      emisiones: fuente({}),
      recursos: fuente(cambios.recursos ?? {}),
    },
    territorios: {},
  };
}

describe('construcción del conjunto de países', () => {
  it('prefiere 2010 y, si falta, usa 2009 o 2008 indicando el año', () => {
    const { conjunto: c } = construir(
      mundo({ bm: { paro: { AAA: { '2008': 3, '2009': 5 }, BBB: { '2010': 6, '2009': 9 } } } }),
    );
    expect(c.paises.AAA!.datos.paro).toBe(5);
    expect(c.paises.AAA!.origen.paro).toBe('BM:2009');
    expect(c.paises.BBB!.datos.paro).toBe(6);
    expect(c.paises.BBB!.origen.paro).toBe('BM:2010');
  });

  it('rellena lo que falta con la mediana de su grupo y lo marca como estimado', () => {
    const { conjunto: c } = construir(mundo({}));
    // DDD no tiene paro: mediana de 4, 6 y 10.
    expect(c.paises.DDD!.datos.paro).toBe(6);
    expect(c.paises.DDD!.origen.paro).toBe('EST:mediana-grupo');
    expect(c.paises.DDD!.datosEstimados).toContain('paro');
    expect(c.paises.AAA!.datosEstimados).not.toContain('paro');
  });

  it('una estimación nunca sirve de base para otra', () => {
    const { conjunto: c } = construir(mundo({ bm: { paro: en2010({ AAA: 4 }) } }));
    // Solo hay un dato real: no llega al mínimo del grupo y nadie recibe estimación.
    expect(c.paises.BBB!.datos.paro).toBeNull();
    expect(c.paises.BBB!.origen.paro).toBeUndefined();
  });

  it('estima el PIB con la mediana por habitante de su grupo', () => {
    const { conjunto: c } = construir(
      mundo({
        bm: {
          poblacion: en2010({ AAA: 1e6, BBB: 1e6, CCC: 1e6, DDD: 5e6 }),
          pib: en2010({ AAA: 2e10, BBB: 3e10, CCC: 4e10 }),
        },
      }),
    );
    expect(c.paises.DDD!.datos.pib).toBe(1.5e11);
    expect(c.paises.DDD!.origen.pib).toBe('EST:per-capita-grupo');
    expect(c.paises.DDD!.origen.pibPerCapita).toBe('EST:derivado');
    expect(c.paises.AAA!.origen.pibPerCapita).toBe('DER');
  });

  it('reescala los tres sectores para que sumen el 100 % del PIB', () => {
    const { conjunto: c } = construir(mundo({}));
    const { agriculturaPib, industriaPib, serviciosPib } = c.paises.AAA!.datos;
    expect(agriculturaPib! + industriaPib! + serviciosPib!).toBeCloseTo(100, 3);
    expect(industriaPib).toBeCloseTo(31.1111, 3);
  });

  it('descarta los sectores que la fuente da a cero y avisa', () => {
    const cero = { agriculturaPib: 0, industriaPib: 0, serviciosPib: 0 };
    const bm = Object.fromEntries(
      Object.entries(cero).map(([clave]) => [
        clave,
        en2010({
          AAA: clave === 'serviciosPib' ? 60 : clave === 'industriaPib' ? 28 : 2,
          BBB: 2,
          CCC: 2,
          DDD: 0,
        }),
      ]),
    );
    bm.industriaPib = en2010({ AAA: 28, BBB: 28, CCC: 28, DDD: 0 });
    bm.serviciosPib = en2010({ AAA: 60, BBB: 60, CCC: 60, DDD: 0 });
    const { conjunto: c, incidencias } = construir(mundo({ bm }));
    expect(incidencias.join()).toContain('País DDD');
    expect(c.paises.DDD!.origen.serviciosPib).toBe('EST:mediana-grupo');
    expect(c.paises.DDD!.datos.serviciosPib).toBeGreaterThan(50);
  });

  it('une los países que en 2010 eran uno: suma lo absoluto y pondera las tasas', () => {
    const unido = paisDePrueba('AAA', { componentes: ['AAA', 'ZZZ'] });
    const { conjunto: c } = construir(
      mundo({
        paises: [unido, paisDePrueba('BBB'), paisDePrueba('CCC'), paisDePrueba('DDD')],
        bm: {
          poblacion: en2010({ AAA: 3e6, ZZZ: 1e6, BBB: 1e6, CCC: 1e6, DDD: 1e6 }),
          paro: en2010({ AAA: 10, ZZZ: 20, BBB: 6, CCC: 6, DDD: 6 }),
        },
      }),
    );
    expect(c.paises.AAA!.datos.poblacion).toBe(4e6);
    // (10 × 3 M + 20 × 1 M) / 4 M
    expect(c.paises.AAA!.datos.paro).toBe(12.5);
    expect(c.paises.ZZZ).toBeUndefined();
  });

  it('en las listas de productores, no figurar es producir 0 (y no es una estimación)', () => {
    const { conjunto: c } = construir(
      mundo({ recursos: { produccionCobre: en2010({ AAA: 500 }) } }),
    );
    expect(c.paises.AAA!.datos.produccionCobre).toBe(500);
    expect(c.paises.BBB!.datos.produccionCobre).toBe(0);
    expect(c.paises.BBB!.origen.produccionCobre).toBe('OWID:ausente');
    expect(c.paises.BBB!.datosEstimados).not.toContain('produccionCobre');
  });

  it('las reservas de otro año se usan, pero como estimación', () => {
    const { conjunto: c } = construir(
      mundo({ recursos: { reservasLitio: { AAA: { '2022': 9e6 } } } }),
    );
    expect(c.paises.AAA!.datos.reservasLitio).toBe(9e6);
    expect(c.paises.AAA!.origen.reservasLitio).toBe('EST:anio-2022');
    expect(c.paises.BBB!.datos.reservasLitio).toBeNull();
  });

  it('clasifica el nivel de renta con los umbrales de 2010', () => {
    const { conjunto: c } = construir(
      mundo({ bm: { rnbPerCapita: en2010({ AAA: 900, BBB: 3000, CCC: 9000, DDD: 40000 }) } }),
    );
    expect(Object.values(c.paises).map((p) => p.nivelRenta)).toEqual([
      'bajo',
      'medio-bajo',
      'medio-alto',
      'alto',
    ]);
  });
});

describe('validación de los datos', () => {
  const copia = (): ConjuntoPaises => structuredClone(conjunto);

  it('rechaza un país jugable sin PIB', () => {
    const malo = copia();
    malo.paises.ESP!.datos.pib = null;
    delete malo.paises.ESP!.origen.pib;
    expect(validar(malo).errores).toContain('España: es jugable pero no tiene pib');
  });

  it('rechaza valores imposibles', () => {
    const malo = copia();
    malo.paises.ESP!.datos.paro = 140;
    expect(validar(malo).errores.some((e) => e.startsWith('España: paro = 140'))).toBe(true);
  });

  it('rechaza sectores que no suman el 100 % del PIB', () => {
    const malo = copia();
    malo.paises.ESP!.datos.serviciosPib = 20;
    expect(validar(malo).errores.some((e) => e.includes('los sectores suman'))).toBe(true);
  });

  it('rechaza nombres repetidos', () => {
    const malo = copia();
    malo.paises.PRT!.nombre = 'España';
    expect(validar(malo).errores).toContain('Nombre de país repetido: España');
  });

  it('avisa de los valores poco habituales sin rechazarlos', () => {
    const raro = copia();
    raro.paises.ESP!.datos.inflacion = 80;
    const { errores, avisos } = validar(raro);
    expect(errores).toEqual([]);
    expect(avisos.some((a) => a.startsWith('España: Inflación = 80'))).toBe(true);
  });
});

describe('mediana', () => {
  it('funciona con cantidades pares e impares', () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
  });
});
