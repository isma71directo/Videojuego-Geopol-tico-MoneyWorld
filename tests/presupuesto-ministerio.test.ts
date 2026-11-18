// @vitest-environment happy-dom
/** La pestaña «Presupuesto» de cada ministerio (ajuste f19-a3). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import type { CambioPresupuesto, Ministerio } from '../src/sim/presupuesto';
import { cerrarVentanas } from '../src/ui/componentes/ventana';
import { presupuestoMinisterio } from '../src/ui/presupuesto-ministerio';
import { abrirElemento, elementoDeMinisterio, ponerContenidoPestana } from '../src/ui/secciones';
import { paisCompleto } from './ayudas/pais-completo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;

/** La pestaña de un ministerio de España y lo que ordena. */
function pestana(ministerio: Ministerio, fecha = '2010-01-15') {
  const espana = paisCompleto(paises, 'ESP', 1, { jugador: true });
  const ordenados: CambioPresupuesto[][] = [];
  const vista = presupuestoMinisterio({
    ministerio,
    fuente: () => ({ presupuesto: espana.presupuesto, economia: espana.economia, fecha }),
    ordenar: (cambios) => ordenados.push(cambios),
  });
  document.body.replaceChildren(vista.elemento);
  return { espana, vista, ordenados };
}
const boton = (raiz: Element, texto: string): HTMLButtonElement =>
  [...raiz.querySelectorAll('button')].find((b) => b.textContent!.trim() === texto)!;
const mover = (control: HTMLInputElement, valor: number): void => {
  control.value = String(valor);
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
};
/** El deslizador cuya etiqueta empieza por `texto`. */
const deslizador = (raiz: Element, texto: string): HTMLInputElement =>
  [...raiz.querySelectorAll('.deslizador')]
    .find((d) => d.querySelector('label')!.textContent!.startsWith(texto))!
    .querySelector('input')!;

afterEach(() => cerrarVentanas());

describe('la pestaña «Presupuesto» de cada ministerio (ajuste f19-a3)', () => {
  it('enseña su presupuesto, sus empleados y su sueldo medio, en cifras', () => {
    const { vista } = pestana('sanidad');
    const texto = vista.elemento.textContent!;
    expect(texto).toMatch(/Presupuesto del ministerio · [\d.]+ M\$ al año · \d+,\d % del gasto/);
    expect(texto).toMatch(/[\d.]+ empleados públicos\* · sueldo medio de [\d.]+ \$ al año/);
    expect(texto).toContain('Puestos nuevos');
    expect(texto).toContain('Subida de los sueldos');
    expect(texto).toContain('Inversión');
    expect(texto).toContain('Compras y mantenimiento');
    expect(texto).toContain('Programas y ayudas');
    // Las pensiones y el paro, solo en Trabajo y Seguridad Social.
    expect(texto).not.toContain('Subida de las pensiones');
    expect(pestana('trabajo').vista.elemento.textContent).toContain('Subida de las pensiones');
  });

  it('puestos nuevos: lo que cuestan y cuándo empiezan (tras la oposición); y se ordenan', () => {
    const { vista, ordenados } = pestana('educacion');
    for (let i = 0; i < 3; i++) boton(vista.elemento, '+1.000').click();
    expect(vista.elemento.textContent).toMatch(
      /Cuestan [\d.]+ M\$ al año\. Empiezan el 1 de noviembre de 2010, cuando acabe la oposición/,
    );
    boton(vista.elemento, 'Aplicar los cambios').click();
    expect(ordenados).toEqual([[{ tipo: 'puestos', ministerio: 'educacion', cantidad: 3000 }]]);
    // Ya ordenado: pendiente, con su día; y la pestaña vuelve a empezar.
    expect(vista.elemento.textContent).toContain('Cambios pendientes');
    expect(vista.elemento.textContent).toContain('Educación: 3.000 puestos nuevos');
    expect(vista.elemento.textContent).toContain('desde el 1 de noviembre de 2010');
    expect(vista.elemento.querySelector<HTMLInputElement>('input[type=number]')!.value).toBe('0');
  });

  it('despidos: ahorran, pero cuestan su indemnización y vuelven al paro', () => {
    const { vista, ordenados } = pestana('interior');
    const campo = vista.elemento.querySelector<HTMLInputElement>('input[type=number]')!;
    campo.value = '-2000';
    campo.dispatchEvent(new Event('input'));
    expect(vista.elemento.textContent).toMatch(
      /Ahorran .* indemnización cuesta .* Desde el 1 de febrero de 2010/,
    );
    boton(vista.elemento, 'Aplicar los cambios').click();
    expect(ordenados[0]).toEqual([{ tipo: 'puestos', ministerio: 'interior', cantidad: -2000 }]);
  });

  it('sueldos y partidas en %: para el año que viene o extraordinario', () => {
    const { vista, ordenados } = pestana('defensa');
    mover(deslizador(vista.elemento, 'Subida de los sueldos'), 2);
    mover(deslizador(vista.elemento, 'Programas y ayudas'), -10);
    expect(vista.elemento.textContent).toMatch(/Con estos cambios: [\d.]+ M\$ al año/);
    const extraordinario = vista.elemento.querySelector<HTMLInputElement>(
      '.presupuesto-ministerio__cuando[value="mes"]',
    )!;
    extraordinario.checked = true;
    extraordinario.dispatchEvent(new Event('change'));
    boton(vista.elemento, 'Aplicar los cambios').click();
    expect(ordenados[0]).toEqual([
      { tipo: 'sueldos', ministerio: 'defensa', subida: 0.02, cuando: 'mes' },
      { tipo: 'partida', ministerio: 'defensa', partida: 'programas', factor: 0.9, cuando: 'mes' },
    ]);
    // Sin cambios, no se ordena nada.
    boton(vista.elemento, 'Aplicar los cambios').click();
    expect(ordenados).toHaveLength(1);
  });

  it('Trabajo y Seguridad Social: la subida de las pensiones y la prestación por parado', () => {
    const { espana, vista, ordenados } = pestana('trabajo');
    mover(deslizador(vista.elemento, 'Subida de las pensiones'), 0);
    expect(
      vista.elemento.querySelector<HTMLInputElement>('.presupuesto-ministerio__ipc')!.checked,
    ).toBe(false);
    mover(deslizador(vista.elemento, 'Prestación de cada parado'), 80);
    boton(vista.elemento, 'Aplicar los cambios').click();
    const [pensiones, prestacion] = ordenados[0]!;
    expect(pensiones).toEqual({ tipo: 'pensiones', revalorizacion: 0 });
    expect(prestacion).toMatchObject({ tipo: 'prestacion' });
    expect((prestacion as { prestacionParado: number }).prestacionParado).toBeCloseTo(
      espana.presupuesto.prestacionParado * 0.8,
      6,
    );
  });

  it('en la ventana del ministerio, la pestaña «Presupuesto» tiene su contenido de verdad', () => {
    const espana = paisCompleto(paises, 'ESP', 1, { jugador: true });
    const elemento = elementoDeMinisterio('sanidad');
    ponerContenidoPestana(
      elemento,
      'presupuesto',
      () =>
        presupuestoMinisterio({
          ministerio: 'sanidad',
          fuente: () => ({
            presupuesto: espana.presupuesto,
            economia: espana.economia,
            fecha: '2010-01-15',
          }),
          ordenar: () => undefined,
        }).elemento,
    );
    try {
      const ventana = abrirElemento(elemento)!;
      const pestanaPresupuesto = [
        ...ventana.elemento.querySelectorAll<HTMLButtonElement>('[role=tab]'),
      ].find((p) => p.textContent!.includes('Presupuesto'))!;
      pestanaPresupuesto.click();
      expect(ventana.elemento.textContent).toContain('Presupuesto del ministerio');
      // Presidencia también tiene la suya.
      expect(elementoDeMinisterio('presidencia')).toBe('presidencia');
    } finally {
      ponerContenidoPestana(elemento, 'presupuesto', null);
    }
  });
});
