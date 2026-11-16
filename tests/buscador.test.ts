// @vitest-environment happy-dom
/** Buscador de países, regiones y ciudades (tarea f9-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConjuntoCiudades } from '../src/map/ciudades';
import type { ConjuntoPaises } from '../src/datos/paises';
import { camaraInicial, encuadrar, interpolarCamara, zoomRelativo } from '../src/map/camara';
import { ANCHO_MUNDO } from '../src/map/proyeccion';
import {
  buscar,
  crearIndice,
  normalizarBusqueda,
  resaltar,
  type EntradaBusqueda,
} from '../src/ui/busqueda';
import { crearBuscador } from '../src/ui/buscador';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(resolve(ruta), 'utf8')) as T;
const paises = leer<ConjuntoPaises>('public/data/paises-2010.json').paises;
const ciudades = leer<ConjuntoCiudades>('public/data/ciudades-2010.json').ciudades;
const indiceRegiones = leer<{ regiones: [string, string, string, number | null][] }>(
  'public/data/buscador-2010.json',
).regiones;

/** Las mismas entradas que arma la pantalla del mapa. */
const entradas: EntradaBusqueda[] = [
  ...Object.values(paises).map((p): EntradaBusqueda => ({
    tipo: 'pais',
    id: p.id,
    nombre: p.nombre,
    pais: p.id,
    alias: [
      p.id,
      ...(p.iso2 ? [new Intl.DisplayNames(['en'], { type: 'region' }).of(p.iso2)!] : []),
    ],
    peso: p.datos.poblacion ?? 0,
  })),
  ...indiceRegiones
    .filter(([, nombre, pais]) => paises[pais]?.nombre !== nombre)
    .map(([id, nombre, pais, poblacion]): EntradaBusqueda => ({
      tipo: 'region',
      id,
      nombre,
      pais,
      peso: poblacion ?? 0,
    })),
  ...ciudades.map((c): EntradaBusqueda => ({
    tipo: 'ciudad',
    id: `${c.pais}|${c.nombre}`,
    nombre: c.nombre,
    pais: c.pais,
    peso: c.poblacion ?? 0,
  })),
];
const indice = crearIndice(entradas);
const primero = (texto: string): EntradaBusqueda | undefined => buscar(indice, texto)[0]?.entrada;

describe('búsqueda (tarea f9-t2)', () => {
  it('normaliza tildes, mayúsculas y signos', () => {
    expect(normalizarBusqueda('  Cataluña ')).toBe('cataluna');
    expect(normalizarBusqueda("Côte d'Ivoire")).toBe('cote d ivoire');
    expect(normalizarBusqueda('São Paulo')).toBe('sao paulo');
    expect(normalizarBusqueda('Baden-Württemberg')).toBe('baden wurttemberg');
  });

  it('encuentra regiones con y sin tildes (prueba del GDD: Cataluña y Texas)', () => {
    for (const texto of ['Cataluña', 'cataluna', 'CATALUÑA', 'catal']) {
      expect(primero(texto), texto).toMatchObject({ tipo: 'region', id: 'ESP-cataluna' });
    }
    expect(primero('Texas')).toMatchObject({ tipo: 'region', id: 'USA-texas' });
    expect(primero('tex')?.id).toBe('USA-texas');
  });

  it('países primero, también por su nombre en inglés o su código', () => {
    expect(primero('España')).toMatchObject({ tipo: 'pais', id: 'ESP' });
    expect(primero('espana')).toMatchObject({ tipo: 'pais', id: 'ESP' });
    expect(primero('Germany')).toMatchObject({ tipo: 'pais', id: 'DEU' });
    expect(primero('Japon')).toMatchObject({ tipo: 'pais', id: 'JPN' });
    expect(primero('Somalilandia')).toMatchObject({ tipo: 'pais', id: 'SOL' });
  });

  it('ciudades, ordenadas por población a igualdad de parecido', () => {
    expect(primero('Lagos')?.tipo).not.toBe('ciudad');
    const lagos = buscar(indice, 'Lagos').map((r) => r.entrada);
    expect(lagos.some((e) => e.tipo === 'ciudad' && e.pais === 'NGA')).toBe(true);
    expect(primero('Houston')).toMatchObject({ tipo: 'ciudad', pais: 'USA' });
    // «Barcelona»: primero la ciudad española (más poblada) que la venezolana.
    const barcelonas = buscar(indice, 'Barcelona').filter((r) => r.entrada.tipo === 'ciudad');
    expect(barcelonas[0]!.entrada.pais).toBe('ESP');
  });

  it('por cualquier palabra, varias palabras y con una errata', () => {
    expect(primero('york')?.nombre).toMatch(/York/);
    expect(primero('nueva gales')?.nombre).toBe('Nueva Gales del Sur');
    expect(primero('Catalunya')?.id).toBe('ESP-cataluna');
    expect(primero('Alemana')?.id).toBe('DEU');
    expect(buscar(indice, '')).toEqual([]);
    expect(buscar(indice, 'zzzzqqq')).toEqual([]);
  });

  it('una errata no trae nombres que no se parecen', () => {
    const tipos = buscar(indice, 'cataluna').map((r) => r.entrada.nombre);
    expect(tipos).not.toContain('Natal');
  });

  it('como mucho 8 resultados y sin repetir', () => {
    const resultados = buscar(indice, 'san');
    expect(resultados.length).toBeLessThanOrEqual(8);
    const claves = resultados.map((r) => `${r.entrada.tipo}|${r.entrada.id}`);
    expect(new Set(claves).size).toBe(claves.length);
    // Las dos Natal de Brasil son una sola entrada.
    const natal = buscar(indice, 'Natal').filter((r) => r.entrada.nombre === 'Natal');
    expect(natal).toHaveLength(1);
  });

  it('resalta la coincidencia en el nombre original, con sus tildes', () => {
    expect(resaltar('Cataluña', 'catalu')).toEqual(['', 'Catalu', 'ña']);
    expect(resaltar('Cataluña', 'luna')).toEqual(['Cata', 'luña', '']);
    expect(resaltar("Côte d'Ivoire", 'ivo')).toEqual(["Côte d'", 'Ivo', 'ire']);
    expect(resaltar('Nueva York', 'york')).toEqual(['Nueva ', 'York', '']);
    expect(resaltar('Texas', 'zz')).toBeNull();
  });
});

describe('ir al resultado: la cámara (tarea f9-t2)', () => {
  const inicial = camaraInicial(1280, 720);

  it('encuadra una caja con margen y la centra', () => {
    const c = encuadrar(inicial, [500, 300, 600, 350], 0.2);
    expect(c.cx).toBeCloseTo(550);
    expect(c.cy).toBeCloseTo(325);
    // La caja ocupa como mucho el 60 % de la pantalla.
    expect(100 * c.k).toBeLessThanOrEqual(1280 * 0.6 + 1e-6);
    expect(50 * c.k).toBeLessThanOrEqual(720 * 0.6 + 1e-6);
    expect(zoomRelativo(c)).toBeGreaterThan(1);
  });

  it('el viaje empieza y acaba donde debe, se aleja a mitad y va por el camino corto', () => {
    const a = { ...inicial, cx: 100, cy: 400, k: inicial.k * 20 };
    const b = { ...inicial, cx: ANCHO_MUNDO - 100, cy: 420, k: inicial.k * 16 };
    expect(interpolarCamara(a, b, 0)).toMatchObject({ cx: 100, cy: 400 });
    const fin = interpolarCamara(a, b, 1);
    expect(fin.cx).toBeCloseTo(ANCHO_MUNDO - 100);
    expect(fin.k).toBeCloseTo(b.k);
    const medio = interpolarCamara(a, b, 0.5);
    expect(medio.k).toBeLessThan(Math.min(a.k, b.k));
    // Por el antimeridiano (200 unidades), no dando la vuelta al mundo.
    const cuarto = interpolarCamara(a, b, 0.25);
    expect(Math.min(cuarto.cx, ANCHO_MUNDO - cuarto.cx)).toBeLessThan(100);
  });
});

describe('ventana del buscador (tarea f9-t2)', () => {
  afterEach(() => document.body.replaceChildren());

  const montar = () => {
    const alElegir = vi.fn();
    const buscador = crearBuscador({
      entradas: () => Promise.resolve(entradas),
      nombrePais: (id) => paises[id]?.nombre ?? id,
      regionDelMundo: (id) => paises[id]?.regionNombre ?? '',
      esCapital: () => false,
      alElegir,
    });
    document.body.appendChild(buscador.boton);
    return { buscador, alElegir };
  };
  const esperar = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
  const escribir = (campo: HTMLInputElement, texto: string): void => {
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
  };
  const tecla = (destino: EventTarget, key: string): KeyboardEvent => {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    destino.dispatchEvent(evento);
    return evento;
  };

  it('se abre con la lupa o con la B y cierra con Esc', async () => {
    const { buscador } = montar();
    buscador.boton.click();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const campo = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
    expect(document.activeElement).toBe(campo);
    tecla(campo, 'Escape');
    expect(buscador.abierto).toBe(false);
    // La B, fuera de un campo de texto.
    const evento = new KeyboardEvent('keydown', { key: 'b', cancelable: true });
    expect(buscador.alTeclear(evento)).toBe(true);
    expect(buscador.abierto).toBe(true);
    await esperar();
  });

  it('muestra los resultados al escribir y elige con las flechas e Intro', async () => {
    const { buscador, alElegir } = montar();
    buscador.abrir();
    await esperar();
    const campo = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
    escribir(campo, 'cataluna');
    const opciones = [...document.querySelectorAll('[role="option"]')];
    expect(opciones.length).toBeGreaterThan(0);
    expect(opciones[0]!.textContent).toContain('Cataluña');
    expect(opciones[0]!.textContent).toContain('España');
    expect(opciones[0]!.getAttribute('aria-selected')).toBe('true');
    expect(campo.getAttribute('aria-expanded')).toBe('true');
    expect(campo.getAttribute('aria-activedescendant')).toBe(opciones[0]!.id);
    tecla(campo, 'Enter');
    expect(alElegir).toHaveBeenCalledWith(expect.objectContaining({ id: 'ESP-cataluna' }));
    expect(buscador.abierto).toBe(false);
    // Con las flechas cambia el activo (la ventana anterior aún se está yendo: fuera).
    document.querySelectorAll('.retirandose').forEach((e) => e.remove());
    buscador.abrir();
    await esperar();
    const otro = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
    escribir(otro, 'san');
    tecla(otro, 'ArrowDown');
    expect(document.querySelectorAll('[role="option"]')[1]!.getAttribute('aria-selected')).toBe(
      'true',
    );
    tecla(otro, 'ArrowUp');
    tecla(otro, 'ArrowUp');
    const todas = document.querySelectorAll('[role="option"]');
    expect(todas[todas.length - 1]!.getAttribute('aria-selected')).toBe('true');
  });

  it('avisa si no hay nada', async () => {
    const { buscador } = montar();
    buscador.abrir();
    await esperar();
    const campo = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
    escribir(campo, 'zzzzqqq');
    expect(document.querySelector('[role="status"]')!.textContent).toContain('zzzzqqq');
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(0);
  });

  it('la B no abre el buscador mientras se escribe en un campo', () => {
    const { buscador } = montar();
    const campo = document.createElement('input');
    document.body.appendChild(campo);
    const evento = new KeyboardEvent('keydown', { key: 'b', cancelable: true });
    Object.defineProperty(evento, 'target', { value: campo });
    expect(buscador.alTeclear(evento)).toBe(false);
    expect(buscador.abierto).toBe(false);
  });
});
