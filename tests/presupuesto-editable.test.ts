// @vitest-environment happy-dom
/** Gobierno › Presupuesto, la vista general (tareas f19-t2 a f19-t4 y ajuste f19-a2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { MINISTERIOS, type CambioPresupuesto, type Ministerio } from '../src/sim/presupuesto';
import { sonidosDeComponentes } from '../src/ui/componentes/sonidos';
import { diaQueSeAplica, editorPresupuesto } from '../src/ui/presupuesto-editable';
import { contenidoVentanaPresupuesto } from '../src/ui/presupuesto-en-vivo';
import { paisCompleto } from './ayudas/pais-completo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;

/** La vista general con España y lo que se ordena. */
function conEspana(fecha = '2010-01-15') {
  const espana = paisCompleto(paises, 'ESP', 1, { jugador: true });
  const ordenados: CambioPresupuesto[][] = [];
  const abiertos: Ministerio[] = [];
  const editor = editorPresupuesto({
    fuente: () => ({
      id: 'ESP',
      presupuesto: espana.presupuesto,
      economia: espana.economia,
      fecha,
      mercado: espana.mercado,
      tesoreria: espana.estado.tesoreria,
    }),
    ordenar: (cambios) => ordenados.push(cambios),
    abrirMinisterio: (m) => abiertos.push(m),
  });
  document.body.replaceChildren(editor.elemento);
  return { espana, editor, ordenados, abiertos };
}
const mover = (control: HTMLInputElement, valor: number): void => {
  control.value = String(valor);
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
};
const boton = (raiz: Element, texto: string): HTMLButtonElement =>
  [...raiz.querySelectorAll('button')].find((b) => b.textContent!.includes(texto))!;
const deslizador = (raiz: Element) => raiz.querySelector<HTMLInputElement>('input[type=range]')!;

describe('Gobierno › Presupuesto, la vista general (ajuste f19-a2)', () => {
  it('se ve el presupuesto: resumen, previsión y los 20 ministerios (solo para ver)', () => {
    const { editor } = conEspana();
    const texto = editor.elemento.textContent!;
    expect(texto).toContain('en vigor, el de 2010');
    expect(texto).toMatch(/Déficit−\d{3}\.\d{3} M\$ \(26,\d % de los ingresos\)/);
    expect(texto).toContain('Previsión a 12 meses');
    // Un único deslizador: el ajuste general (los de cada ministerio, en su ventana).
    expect(editor.elemento.querySelectorAll('input[type=range]')).toHaveLength(1);
    expect(editor.elemento.querySelectorAll('[data-ministerio]')).toHaveLength(MINISTERIOS.length);
    expect(texto).toMatch(/empleados\*/);
  });

  it('un clic en un ministerio abre su ventana', () => {
    const { editor, abiertos } = conEspana();
    editor.elemento.querySelector<HTMLButtonElement>('[data-ministerio="sanidad"]')!.click();
    expect(abiertos).toEqual(['sanidad']);
  });

  it('el ajuste general: todo el gasto en un %, para el año que viene o extraordinario', () => {
    const { editor, ordenados } = conEspana();
    mover(deslizador(editor.elemento), -4);
    expect(editor.elemento.textContent).toMatch(/−4,0 %/);
    boton(editor.elemento, 'Aplicar el ajuste').click();
    expect(ordenados).toEqual([
      [{ tipo: 'partida', ministerio: 'todos', partida: 'todas', factor: 0.96, cuando: 'anio' }],
    ]);
    // Vale desde el 1 de enero y se ve como pendiente.
    expect(editor.elemento.textContent).toContain('Ordenado: vale desde el 1 de enero de 2011.');
    expect(editor.elemento.textContent).toContain('Cambios pendientes');
    expect(editor.elemento.textContent).toContain('Todos los ministerios: todo el gasto −4,0 %');
    // Extraordinario: desde el mes siguiente.
    const extraordinario = editor.elemento.querySelector<HTMLInputElement>(
      '.presupuesto-editable__cuando[value="mes"]',
    )!;
    extraordinario.checked = true;
    extraordinario.dispatchEvent(new Event('change'));
    mover(deslizador(editor.elemento), 3);
    boton(editor.elemento, 'Aplicar el ajuste').click();
    expect(ordenados[1]![0]).toMatchObject({ factor: 1.03, cuando: 'mes' });
    expect(editor.elemento.textContent).toContain('Ordenado: vale desde el 1 de febrero de 2010.');
    // Sin ajuste, no se ordena nada.
    boton(editor.elemento, 'Aplicar el ajuste').click();
    expect(ordenados).toHaveLength(2);
  });

  it('los atajos ponen el ajuste: con el IPC, recortar un 5 % o sin cambios', () => {
    const { espana, editor, ordenados } = conEspana();
    boton(editor.elemento, 'Recortar un 5 %').click();
    boton(editor.elemento, 'Aplicar el ajuste').click();
    expect(ordenados[0]![0]).toMatchObject({ factor: 0.95 });
    boton(editor.elemento, 'con el IPC').click();
    boton(editor.elemento, 'Aplicar el ajuste').click();
    const ipc = Math.round(espana.economia.inflacion * 200) / 2;
    expect((ordenados[1]![0] as { factor: number }).factor).toBeCloseTo(1 + ipc / 100, 6);
  });

  it('la previsión: hace un año, ahora, sin cambios y con este ajuste (tarea f19-t3)', () => {
    const { espana, editor } = conEspana();
    const tabla = () => editor.elemento.querySelector('.presupuesto-editable__tabla')!;
    expect([...tabla().querySelectorAll('thead th')].map((c) => c.textContent)).toEqual([
      '',
      'Hace un año',
      'Ahora',
      'En 12 meses, sin cambios',
      'En 12 meses, con este presupuesto',
    ]);
    const deuda = () =>
      [...tabla().querySelectorAll('tbody tr')].find((f) => f.textContent!.startsWith('Deuda'))!;
    expect(deuda().querySelectorAll('td')[0]!.textContent).toBe('—');
    expect(deuda().querySelectorAll('td')[3]!.textContent).toBe(
      deuda().querySelectorAll('td')[2]!.textContent,
    );
    // Con un ajuste extraordinario, la columna de este presupuesto cambia al soltar.
    const extraordinario = editor.elemento.querySelector<HTMLInputElement>(
      '.presupuesto-editable__cuando[value="mes"]',
    )!;
    extraordinario.checked = true;
    extraordinario.dispatchEvent(new Event('change'));
    mover(deslizador(editor.elemento), 15);
    expect(deuda().querySelectorAll('td')[3]!.textContent).not.toBe(
      deuda().querySelectorAll('td')[2]!.textContent,
    );
    // Pasado un año, hay año anterior.
    espana.avanzar(13);
    editor.actualizar();
    expect(deuda().querySelectorAll('td')[0]!.textContent).toMatch(/M\$|billones/);
  });

  it('suena y se ve (tarea f19-t4): un tono al soltar y un sello al aplicar', () => {
    const sonidos: string[] = [];
    sonidosDeComponentes((efecto) => sonidos.push(efecto));
    try {
      const { editor } = conEspana();
      mover(deslizador(editor.elemento), 5);
      mover(deslizador(editor.elemento), 2);
      expect(sonidos).toEqual(['deslizadorSube', 'deslizadorBaja']);
      boton(editor.elemento, 'Aplicar el ajuste').click();
      expect(sonidos.at(-1)).toBe('presupuestoAprobado');
      expect(editor.elemento.querySelector('.presupuesto-editable__sello')?.textContent).toBe(
        'Aprobado',
      );
    } finally {
      sonidosDeComponentes(null);
    }
  });

  it('el día en que se aplica: el 1 del mes siguiente', () => {
    expect(diaQueSeAplica('2010-01-15')).toBe('2010-02-01');
    expect(diaQueSeAplica('2010-12-31')).toBe('2011-01-01');
  });

  it('en Gobierno › Presupuesto: dos pestañas, «General» y «Cuentas y gráficos»', () => {
    const espana = paisCompleto(paises, 'ESP');
    const fuente = () => ({
      presupuesto: espana.presupuesto,
      economia: espana.economia,
      tesoreria: espana.estado.tesoreria,
      fecha: '2010-01-01',
      mercado: espana.mercado,
    });
    const editor = vi.fn(() => editorPresupuesto({ fuente, ordenar: () => undefined }).elemento);
    const ventana = contenidoVentanaPresupuesto(fuente, 'España', editor);
    document.body.replaceChildren(ventana);
    const pestanas = [...ventana.querySelectorAll('[role=tab]')].map((p) => p.textContent!.trim());
    expect(pestanas).toHaveLength(2);
    expect(pestanas[0]).toContain('General');
    expect(pestanas[1]).toContain('Cuentas y gráficos');
    expect(editor).toHaveBeenCalledTimes(1);
  });
});
