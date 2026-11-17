// @vitest-environment happy-dom
/** Ficha de país con pestañas (tarea f8-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ConjuntoGobiernos } from '../src/datos/gobiernos';
import type { ConjuntoPaises } from '../src/datos/paises';
import { contenidoPanel, textoOrigen } from '../src/ui/ficha-pais';
import { el } from '../src/ui/dom';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(resolve(ruta), 'utf8')) as T;
const conjunto = leer<ConjuntoPaises>('public/data/paises-2010.json');
const gobiernos = leer<ConjuntoGobiernos>('public/data/gobiernos-2010.json');

function ficha(id: string, opciones = {}): HTMLElement {
  const contenedor = el('aside', { class: 'panel-pais' });
  contenedor.append(
    ...contenidoPanel(conjunto.paises[id]!, conjunto, () => undefined, {
      gobiernos,
      ...opciones,
    }).filter((h): h is HTMLElement => h instanceof HTMLElement),
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

describe('ficha de país (tarea f8-t2)', () => {
  afterEach(() => document.body.replaceChildren());

  it('tiene cuatro pestañas: Resumen, Economía, Sociedad y Fuentes', () => {
    const f = ficha('ESP');
    expect(pestanas(f).map((p) => p.textContent?.trim())).toEqual([
      'Resumen',
      'Economía',
      'Sociedad',
      'Fuentes',
    ]);
    expect(f.querySelector('#panel-pais-titulo')!.textContent).toBe('España');
  });

  it('el resumen da el régimen y los cargos de 2010', () => {
    const resumen = ficha('ESP').querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')!;
    expect(resumen.textContent).toContain('Monarquía parlamentaria');
    const cargos = [...resumen.querySelectorAll('.ficha-cargo')].map((c) => c.textContent);
    expect(cargos).toHaveLength(2);
    expect(cargos[0]).toContain('Juan Carlos I');
    expect(cargos[0]).toContain('desde 1975');
    expect(cargos[1]).toContain('Zapatero');
    expect(resumen.textContent).toContain('Madrid');
  });

  it('un presidente que gobierna sale una vez; un dependiente, con el jefe de su soberano', () => {
    const usa = ficha('USA');
    const tarjetas = usa.querySelectorAll('.ficha-cargo');
    expect(tarjetas).toHaveLength(1);
    expect(tarjetas[0]!.textContent).toContain('Jefe de Estado y de Gobierno');
    document.body.replaceChildren();
    const pri = ficha('PRI').textContent!;
    expect(pri).toContain('Barack Obama');
    expect(pri).toContain('Como territorio de Estados Unidos');
    expect(pri).toContain('Fortuño');
  });

  it('sin Estado (Sáhara Occidental) lo dice, y sin datos de gobierno avisa de la carga', () => {
    expect(ficha('ESH').textContent).toContain('Sin Estado propio');
    document.body.replaceChildren();
    expect(ficha('ESP', { gobiernos: null }).textContent).toContain('Cargando el gobierno');
  });

  it('economía y sociedad muestran sus datos y los estimados llevan asterisco', () => {
    const f = ficha('SOL');
    const economia = abrir(f, 'Economía');
    expect(economia.textContent).toContain('Paro');
    expect(economia.querySelectorAll('.es-estimado').length).toBeGreaterThan(0);
    // La nota de estimados aparece al haberlos.
    expect(f.querySelector<HTMLElement>('.panel-pais__pie[hidden]')).toBeNull();
    const sociedad = abrir(f, 'Sociedad');
    expect(sociedad.textContent).toContain('Esperanza de vida');
    // España: sectores y mix eléctrico con su barra de partes.
    document.body.replaceChildren();
    const espana = abrir(ficha('ESP'), 'Economía');
    expect(espana.textContent).toContain('PIB por sectores');
    expect(espana.textContent).toContain('Electricidad por fuente');
    // Ingresos y gasto públicos del FMI (tarea f10-t2).
    expect(espana.textContent).toMatch(/Ingresos públicos36,4 %/);
    expect(espana.textContent).toMatch(/Gasto público45,8 %/);
  });

  it('la pestaña de fuentes dice de dónde sale cada dato, los cargos y el régimen', () => {
    const fuentes = abrir(ficha('TUR'), 'Fuentes');
    expect(fuentes.textContent).toContain('Banco Mundial');
    expect(fuentes.textContent).toContain('Jefes de Estado y de Gobierno');
    expect(fuentes.textContent).toContain('Corrección a mano');
  });

  it('recuerda la pestaña elegida', () => {
    let elegida = '';
    const f = ficha('JPN', {
      pestana: 'sociedad',
      alCambiarPestana: (id: string) => (elegida = id),
    });
    expect(f.querySelector('[aria-selected="true"]')!.textContent?.trim()).toBe('Sociedad');
    abrir(f, 'Fuentes');
    expect(elegida).toBe('fuentes');
  });

  it('textos de las fuentes', () => {
    expect(textoOrigen('BM:2010', conjunto)).toContain('(2010)');
    expect(textoOrigen('EST:mediana-grupo', conjunto)).toMatch(/^Estimación/);
    expect(textoOrigen('EST:anio-2022', conjunto)).toContain('2022');
    expect(textoOrigen(undefined, conjunto)).toBe('Sin dato');
  });

  // Recorre los 223 países con sus cuatro pestañas: tarda unos 5 s, así que tiene un límite propio
  // más amplio (con el ordenador cargado se pasaba de los 5 s por defecto).
  it('todos los países tienen ficha sin errores', { timeout: 30_000 }, () => {
    for (const id of Object.keys(conjunto.paises)) {
      const f = ficha(id);
      for (const titulo of ['Economía', 'Sociedad', 'Fuentes']) abrir(f, titulo);
      expect(f.textContent, id).not.toMatch(/juego\.mapa\./);
      document.body.replaceChildren();
    }
  });
});
