// @vitest-environment happy-dom
/** Ficha de región con pestañas (tarea f9-t3). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import {
  actividadPrincipal,
  sectoresDePais,
  type ConjuntoEconomiaRegiones,
} from '../src/datos/regiones-economia';
import type { RegionSenalada } from '../src/map/mapa';
import {
  contenidoPanelRegion,
  iconoDeRecurso,
  type ConjuntoRegiones,
} from '../src/ui/ficha-region';
import { NOMBRES_ICONOS } from '../src/av/iconos';
import { EFECTOS } from '../src/av/sonido';
import { LATIDOS_RESALTADO } from '../src/map/mapa';
import { t } from '../src/i18n';
import { RECURSOS } from '../src/datos/regiones-economia';
import { el } from '../src/ui/dom';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(resolve(ruta), 'utf8')) as T;
const paises = leer<ConjuntoPaises>('public/data/paises-2010.json');
const datos = leer<ConjuntoRegiones>('public/data/regiones-2010-datos.json');
const economia = leer<ConjuntoEconomiaRegiones>('public/data/regiones-2010-economia.json');
const nombres = new Map(
  leer<{ regiones: [string, string, string][] }>('public/data/buscador-2010.json').regiones.map(
    ([id, nombre, pais]) => [id, { nombre, pais }],
  ),
);

const region = (id: string): RegionSenalada => ({
  id,
  pais: nombres.get(id)!.pais,
  nombre: nombres.get(id)!.nombre,
  superficie: 1000,
});

function ficha(id: string, opciones: Record<string, unknown> = {}): HTMLElement {
  const contenedor = el('aside', { class: 'panel-pais' });
  contenedor.append(
    ...contenidoPanelRegion(
      region(id),
      paises,
      datos.regiones[id] ?? null,
      () => undefined,
      () => undefined,
      { economia: economia.regiones[id] ?? null, ...opciones },
    ).filter((h): h is HTMLElement => h instanceof HTMLElement),
  );
  document.body.appendChild(contenedor);
  return contenedor;
}
const pestanas = (f: HTMLElement): HTMLButtonElement[] => [
  ...f.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
];
const abrir = (f: HTMLElement, titulo: string): HTMLElement => {
  pestanas(f)
    .find((p) => p.textContent?.trim() === titulo)!
    .click();
  return f.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')!;
};

describe('actividad principal (tarea f9-t3)', () => {
  it('el sector que más pesa y en qué destaca frente a su país', () => {
    const pais = sectoresDePais(2, 20, 78)!;
    expect(pais[1]).toBeCloseTo(0.2);
    const a = actividadPrincipal([0.01, 0.35, 0.64], pais);
    expect(a.principal).toBe('servicios');
    expect(a.peso).toBeCloseTo(0.64);
    expect(a.destaca).toMatchObject({ sector: 'industria', mediaPais: 0.2 });
    // Una región con la misma estructura que su país no destaca en nada.
    expect(actividadPrincipal([0.02, 0.2, 0.78], pais).destaca).toBeNull();
    // Sin datos del país, tampoco.
    expect(actividadPrincipal([0.3, 0.2, 0.5], null)).toMatchObject({
      principal: 'servicios',
      destaca: null,
    });
    expect(sectoresDePais(null, 20, 70)).toBeNull();
  });
});

describe('ficha de región (tarea f9-t3)', () => {
  afterEach(() => document.body.replaceChildren());

  it('tiene cuatro pestañas: Resumen, Economía, Ciudades y Fuentes', () => {
    const f = ficha('ESP-cataluna');
    expect(pestanas(f).map((p) => p.textContent?.trim())).toEqual([
      'Resumen',
      'Economía',
      'Ciudades',
      'Fuentes',
    ]);
    expect(f.querySelector('#panel-pais-titulo')!.textContent).toBe('Cataluña');
    expect(f.textContent).toContain('Región de España');
  });

  it('el resumen da capital, población, superficie, densidad y actividad principal', () => {
    const resumen = ficha('ESP-cataluna').querySelector<HTMLElement>(
      '[role="tabpanel"]:not([hidden])',
    )!;
    const texto = resumen.textContent!;
    expect(texto).toContain('Capital');
    expect(texto).toContain('Barcelona');
    expect(texto).toContain('km²');
    expect(texto).toContain('hab./km²');
    expect(texto).toMatch(/Actividad principal.*Servicios/);
    // Texas pesa mucho más en industria que la media de Estados Unidos.
    document.body.replaceChildren();
    expect(ficha('USA-texas').textContent).toMatch(/Destaca la industria.*Estados Unidos/);
  });

  it('economía: sectores y recursos por tipo, o los sectores del país si no hay de la región', () => {
    const texas = abrir(ficha('USA-texas'), 'Economía');
    expect(texas.textContent).toContain('Valor añadido por sectores');
    expect(texas.querySelector('.ficha-recursos__recurso')!.getAttribute('data-recurso')).toBe(
      'petroleo',
    );
    expect(texas.textContent).toContain('Energía');
    expect(texas.textContent).toMatch(/Petróleo\d[\d.]* yacimientos/);
    document.body.replaceChildren();
    // Los grupos, de más a menos yacimientos: en Antofagasta, primero los metales (cobre).
    const antofagasta = abrir(ficha('CHL-antofagasta'), 'Economía');
    expect(antofagasta.querySelector('.ficha-recursos__tipo')!.textContent).toBe('Metales');
    document.body.replaceChildren();
    // Nigeria no tiene DOSE: el reparto del país, y lo dice.
    const lagos = abrir(ficha('NGA-lagos'), 'Economía');
    expect(lagos.textContent).toContain('Sin dato de la región: reparto de Nigeria');
    expect(lagos.textContent).toContain('No quiere decir que la región no tenga recursos');
  });

  it('ciudades: las principales con su población, y un clic va a ellas', () => {
    const alIrACiudad = vi.fn();
    const ciudades = abrir(ficha('USA-texas', { alIrACiudad }), 'Ciudades');
    const botones = [...ciudades.querySelectorAll<HTMLButtonElement>('.ficha-ciudades__boton')];
    expect(botones[0]!.textContent).toContain('Houston');
    const austin = botones.find((b) => b.textContent?.includes('Austin'))!;
    expect(austin.textContent).toContain('Capital de la región');
    austin.click();
    expect(alIrACiudad).toHaveBeenCalledWith('Austin');
  });

  it('fuentes de cada dato', () => {
    const fuentes = abrir(ficha('ESP-cataluna'), 'Fuentes').textContent!;
    expect(fuentes).toContain('DOSE (2010)');
    expect(fuentes).toContain('USGS');
    expect(fuentes).toContain('Wikidata');
  });

  it('mientras se cargan los datos lo dice, y recuerda la pestaña elegida', () => {
    const f = ficha('ESP-cataluna', { economia: undefined });
    expect(f.textContent).toContain('Cargando la economía');
    document.body.replaceChildren();
    let elegida = '';
    const g = ficha('ESP-cataluna', {
      pestana: 'ciudades',
      alCambiarPestana: (id: string) => (elegida = id),
    });
    expect(g.querySelector('[aria-selected="true"]')!.textContent?.trim()).toBe('Ciudades');
    abrir(g, 'Fuentes');
    expect(elegida).toBe('fuentes');
  });

  it('muchas regiones de todo el mundo, sin errores ni textos sin traducir', () => {
    const ids = Object.keys(economia.regiones).filter((_, i) => i % 9 === 0);
    for (const id of ids) {
      const f = ficha(id);
      for (const titulo of ['Economía', 'Ciudades', 'Fuentes']) abrir(f, titulo);
      expect(f.textContent, id).not.toMatch(/juego\.mapa\./);
      document.body.replaceChildren();
    }
  });
});

describe('audiovisual de la Fase 9 (tarea f9-t4)', () => {
  it('cada recurso tiene un icono registrado; la energía, el suyo', () => {
    for (const recurso of RECURSOS) {
      expect(NOMBRES_ICONOS as string[], recurso).toContain(iconoDeRecurso(recurso));
      expect(t(`juego.mapa.region.recursos.nombres.${recurso}`), recurso).not.toMatch(/^juego\./);
    }
    expect(iconoDeRecurso('petroleo')).toBe('petroleo');
    expect(iconoDeRecurso('uranio')).toBe('uranio');
    expect(iconoDeRecurso('diamantes')).toBe('gema');
    expect(iconoDeRecurso('oro')).toBe('lingote');
    expect(iconoDeRecurso('cobre')).toBe('pico');
    expect(iconoDeRecurso('litio')).toBe('bateria');
    expect(iconoDeRecurso('potasa')).toBe('cristales');
  });

  it('la ficha muestra el icono de cada recurso', () => {
    const economia = abrir(ficha('USA-texas'), 'Economía');
    const primero = economia.querySelector('.ficha-recursos__recurso')!;
    expect(primero.querySelector('.ficha-recursos__marca--energia svg')).not.toBeNull();
    document.body.replaceChildren();
  });

  it('al llegar desde el buscador: varios latidos y un sonido con nombre en la galería', () => {
    expect(LATIDOS_RESALTADO).toBeGreaterThan(1);
    expect(EFECTOS.resaltar.length).toBeGreaterThan(0);
    expect(t('galeria.sonidos.resaltar')).not.toMatch(/^galeria\./);
  });
});
