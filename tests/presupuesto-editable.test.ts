// @vitest-environment happy-dom
/** La Pantalla «Presupuesto» editable (tarea f19-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import type { PresupuestoDecidido } from '../src/sim/hacienda';
import { gastoMinisterio, MINISTERIOS, PARTIDAS } from '../src/sim/presupuesto';
import { sonidosDeComponentes } from '../src/ui/componentes/sonidos';
import { diaQueSeAplica, editorPresupuesto } from '../src/ui/presupuesto-editable';
import { contenidoVentanaPresupuesto } from '../src/ui/presupuesto-en-vivo';
import { paisCompleto } from './ayudas/pais-completo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;

/** Un editor con España y lo que se aprueba. */
function conEspana(fecha = '2010-01-15') {
  const espana = paisCompleto(paises, 'ESP', 1, { jugador: true });
  const aprobados: PresupuestoDecidido[] = [];
  let dia = fecha;
  const editor = editorPresupuesto({
    fuente: () => ({ presupuesto: espana.presupuesto, economia: espana.economia, fecha: dia }),
    aprobar: (decidido) => aprobados.push(decidido),
  });
  document.body.replaceChildren(editor.elemento);
  return {
    espana,
    editor,
    aprobados,
    irA: (nueva: string) => {
      dia = nueva;
    },
  };
}
const mover = (control: HTMLInputElement, valor: number): void => {
  control.value = String(valor);
  control.dispatchEvent(new Event('input', { bubbles: true }));
};
const deslizadorDe = (raiz: Element, ministerio: string, indice = 0): HTMLInputElement =>
  raiz.querySelectorAll<HTMLInputElement>(`[data-ministerio="${ministerio}"] input[type=range]`)[
    indice
  ]!;
const boton = (raiz: Element, texto: string): HTMLButtonElement =>
  [...raiz.querySelectorAll('button')].find((b) => b.textContent!.includes(texto))!;

describe('la Pantalla «Presupuesto» editable (tarea f19-t2)', () => {
  it('enseña el presupuesto en vigor, los 20 ministerios con sus partidas, las pensiones y el paro', () => {
    const { editor } = conEspana();
    const texto = editor.elemento.textContent!;
    expect(texto).toContain('Nuevo presupuesto');
    expect(texto).toContain('en vigor, el de 2010');
    expect(texto).toContain('Gasto de los ministerios');
    expect(texto).toMatch(/Déficit−\d{3}\.\d{3} M\$ \(26,\d % de los ingresos\)/);
    expect(editor.elemento.querySelectorAll('details[data-ministerio]')).toHaveLength(
      MINISTERIOS.length,
    );
    // Cada ministerio: uno para todo y uno por partida.
    expect(
      editor.elemento.querySelectorAll('[data-ministerio="sanidad"] input[type=range]'),
    ).toHaveLength(1 + PARTIDAS.length);
    expect(texto).toContain('Subida de las pensiones en enero');
    expect(texto).toContain('Prestación de cada parado');
    expect(texto).toContain('Lo que apruebes se aplica el 1 de febrero de 2010.');
  });

  it('al mover un ministerio cambian su dinero, sus partidas y el resumen; y se aprueba', () => {
    const { espana, editor, aprobados } = conEspana();
    const educacion = gastoMinisterio(espana.presupuesto, 'educacion');
    const deficitAntes = editor.elemento.querySelector(
      '.presupuesto-editable__resumen',
    )!.textContent!;
    mover(deslizadorDe(editor.elemento, 'educacion'), 120);
    const resumen = editor.elemento.querySelector('.presupuesto-editable__resumen')!.textContent!;
    expect(resumen).not.toBe(deficitAntes);
    expect(resumen).toMatch(/\+\d,\d % frente al que está en vigor/);
    // Sus partidas, al 120 % también.
    expect(deslizadorDe(editor.elemento, 'educacion', 1).value).toBe('120');
    // Una partida sola: el ministerio entero se ajusta a lo que suma.
    mover(deslizadorDe(editor.elemento, 'educacion', 1), 100);
    expect(Number(deslizadorDe(editor.elemento, 'educacion').value)).toBeLessThan(120);
    mover(deslizadorDe(editor.elemento, 'educacion'), 120);
    boton(editor.elemento, 'Aprobar el presupuesto').click();
    expect(aprobados).toHaveLength(1);
    const enEducacion = PARTIDAS.reduce((t, p) => t + aprobados[0]!.ministerios.educacion[p], 0);
    expect(enEducacion).toBeCloseTo(educacion * 1.2, -3);
    // El resto, como estaba.
    expect(aprobados[0]!.ministerios.defensa).toEqual(espana.presupuesto.ministerios.defensa);
    expect(editor.elemento.textContent).toContain('Aprobado: se aplica el 1 de febrero de 2010.');
  });

  it('los atajos: subir todo con el IPC, dejarlo como está y recortar un 5 %', () => {
    const { espana, editor, aprobados } = conEspana();
    const total = MINISTERIOS.reduce((t, m) => t + gastoMinisterio(espana.presupuesto, m), 0);
    const aprobado = () =>
      MINISTERIOS.reduce(
        (t, m) => t + PARTIDAS.reduce((s, p) => s + aprobados.at(-1)!.ministerios[m][p], 0),
        0,
      );
    boton(editor.elemento, 'Recortar un 5 %').click();
    boton(editor.elemento, 'Aprobar el presupuesto').click();
    expect(aprobado()).toBeCloseTo(total * 0.95, -3);
    boton(editor.elemento, 'Subir todo con el IPC').click();
    boton(editor.elemento, 'Aprobar el presupuesto').click();
    expect(aprobado()).toBeCloseTo(total * (1 + espana.economia.inflacion), -3);
    boton(editor.elemento, 'Dejarlo como está').click();
    boton(editor.elemento, 'Aprobar el presupuesto').click();
    expect(aprobado()).toBeCloseTo(total, -3);
  });

  it('las pensiones: con el IPC (por ley) o lo que se decida; y la prestación por parado', () => {
    const { espana, editor, aprobados } = conEspana();
    const casilla = editor.elemento.querySelector<HTMLInputElement>('.presupuesto-editable__ipc')!;
    expect(casilla.checked).toBe(true);
    const [pensiones, prestacion] = [
      ...editor.elemento.querySelectorAll<HTMLInputElement>(
        '.presupuesto-editable > .deslizador input[type=range]',
      ),
    ];
    mover(pensiones!, 0);
    expect(casilla.checked).toBe(false);
    mover(prestacion!, 80);
    boton(editor.elemento, 'Aprobar el presupuesto').click();
    expect(aprobados[0]!.revalorizacion).toBe(0);
    expect(aprobados[0]!.prestacionParado).toBeCloseTo(
      espana.presupuesto.prestacionParado * 0.8,
      0,
    );
    casilla.checked = true;
    casilla.dispatchEvent(new Event('change'));
    boton(editor.elemento, 'Aprobar el presupuesto').click();
    expect(aprobados[1]!.revalorizacion).toBeNull();
  });

  it('cada mes: a mitad de cambios no se pierde nada; aplicado lo aprobado, empieza de nuevo', () => {
    const { editor, irA } = conEspana();
    mover(deslizadorDe(editor.elemento, 'sanidad'), 90);
    const abierto = editor.elemento.querySelector<HTMLDetailsElement>(
      '[data-ministerio="sanidad"]',
    )!;
    abierto.open = true;
    irA('2010-01-20');
    editor.actualizar();
    // Lo tocado sigue ahí (y abierto).
    expect(deslizadorDe(editor.elemento, 'sanidad').value).toBe('90');
    expect(abierto.isConnected).toBe(true);
    boton(editor.elemento, 'Aprobar el presupuesto').click();
    irA('2010-02-01');
    editor.actualizar();
    expect(deslizadorDe(editor.elemento, 'sanidad').value).toBe('100');
    expect(editor.elemento.textContent).toContain(
      'Lo que apruebes se aplica el 1 de marzo de 2010.',
    );
  });

  it('la previsión a 12 meses: hace un año, ahora, sin cambios y con este presupuesto (tarea f19-t3)', () => {
    const { espana, editor } = conEspana();
    const tabla = () => editor.elemento.querySelector('.presupuesto-editable__tabla')!;
    expect([...tabla().querySelectorAll('thead th')].map((c) => c.textContent)).toEqual([
      '',
      'Hace un año',
      'Ahora',
      'En 12 meses, sin cambios',
      'En 12 meses, con este presupuesto',
    ]);
    // En enero de 2010 aún no hay año anterior.
    const filaDeDeuda = () =>
      [...tabla().querySelectorAll('tbody tr')].find((f) => f.textContent!.startsWith('Deuda'))!;
    expect(filaDeDeuda().querySelectorAll('td')[0]!.textContent).toBe('—');
    const conEste = () => filaDeDeuda().querySelectorAll('td')[3]!.textContent;
    expect(conEste()).toBe(filaDeDeuda().querySelectorAll('td')[2]!.textContent);
    // Gastar más: al soltar el deslizador, la columna de este presupuesto cambia.
    const sanidad = deslizadorDe(editor.elemento, 'sanidad');
    mover(sanidad, 160);
    sanidad.dispatchEvent(new Event('change', { bubbles: true }));
    expect(conEste()).not.toBe(filaDeDeuda().querySelectorAll('td')[2]!.textContent);
    // Pasado un año, hay año anterior.
    espana.avanzar(13);
    editor.actualizar();
    expect(filaDeDeuda().querySelectorAll('td')[0]!.textContent).toMatch(/M\$/);
  });

  it('suena y se ve (tarea f19-t4): un tono que sube o baja al soltar, y un sello al aprobar', () => {
    const sonidos: string[] = [];
    sonidosDeComponentes((efecto) => sonidos.push(efecto));
    try {
      const { editor } = conEspana();
      const cultura = deslizadorDe(editor.elemento, 'cultura');
      mover(cultura, 130);
      cultura.dispatchEvent(new Event('change', { bubbles: true }));
      mover(cultura, 90);
      cultura.dispatchEvent(new Event('change', { bubbles: true }));
      expect(sonidos).toEqual(['deslizadorSube', 'deslizadorBaja']);
      boton(editor.elemento, 'Aprobar el presupuesto').click();
      expect(sonidos.at(-1)).toBe('presupuestoAprobado');
      const sello = editor.elemento.querySelector('.presupuesto-editable__sello');
      expect(sello?.textContent).toBe('Aprobado');
    } finally {
      sonidosDeComponentes(null);
    }
  });

  it('el día en que se aplica: el 1 del mes siguiente', () => {
    expect(diaQueSeAplica('2010-01-15')).toBe('2010-02-01');
    expect(diaQueSeAplica('2010-12-31')).toBe('2011-01-01');
  });

  it('en Gobierno › Presupuesto: dos pestañas, «Nuevo presupuesto» y «En vigor»', () => {
    const espana = paisCompleto(paises, 'ESP');
    const fuente = () => ({
      presupuesto: espana.presupuesto,
      economia: espana.economia,
      tesoreria: espana.estado.tesoreria,
      fecha: '2010-01-01',
      mercado: espana.mercado,
    });
    const editor = vi.fn(() => editorPresupuesto({ fuente, aprobar: () => undefined }).elemento);
    const ventana = contenidoVentanaPresupuesto(fuente, 'España', editor);
    document.body.replaceChildren(ventana);
    const pestanas = [...ventana.querySelectorAll('[role=tab]')].map((p) => p.textContent!.trim());
    expect(pestanas).toHaveLength(2);
    expect(pestanas[0]).toContain('Nuevo presupuesto');
    expect(pestanas[1]).toContain('En vigor');
    expect(editor).toHaveBeenCalledTimes(1);
    expect(ventana.textContent).toContain('Aprobar el presupuesto');
  });
});
