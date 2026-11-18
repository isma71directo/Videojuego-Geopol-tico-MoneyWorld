// @vitest-environment happy-dom
/** La pestaña «Deuda y Tesoro» de Economía y Hacienda (tarea f20-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { ofertasDeAyuda, pedirAyuda, type AccionNegociacion } from '../src/sim/acreedores';
import type { CambioPresupuesto } from '../src/sim/presupuesto';
import { cerrarVentanas } from '../src/ui/componentes/ventana';
import { EFECTOS } from '../src/av/sonido';
import { sonidosDeComponentes } from '../src/ui/componentes/sonidos';
import {
  deudaTesoro,
  emisionCon,
  sonidoDeNegociacion,
  vencimientosPorAnio,
} from '../src/ui/deuda-tesoro';
import {
  abrirElemento,
  elementoDeMinisterio,
  pestanasDe,
  ponerContenidoPestana,
} from '../src/ui/secciones';
import { paisCompleto } from './ayudas/pais-completo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;

/** La pestaña de un país y lo que ordena. */
function pestana(id = 'ESP', fecha = '2010-11-15') {
  const pais = paisCompleto(paises, id, 1, { jugador: true });
  const ordenados: CambioPresupuesto[][] = [];
  const vista = deudaTesoro({
    fuente: () => ({
      presupuesto: pais.presupuesto,
      economia: pais.economia,
      mercado: pais.mercado,
      tesoreria: pais.estado.tesoreria,
      fecha,
    }),
    ordenar: (cambios) => ordenados.push(cambios),
  });
  document.body.replaceChildren(vista.elemento);
  return { pais, vista, ordenados };
}
const boton = (raiz: Element, texto: string): HTMLButtonElement =>
  [...raiz.querySelectorAll('button')].find((b) => b.textContent!.trim() === texto)!;
const campo = (raiz: Element, etiqueta: string): HTMLInputElement =>
  raiz.querySelector<HTMLInputElement>(`input[aria-label="${etiqueta}"]`)!;
const escribir = (control: HTMLInputElement, valor: number): void => {
  control.value = String(valor);
  control.dispatchEvent(new Event('input', { bubbles: true }));
};
const deslizador = (raiz: Element, texto: string): HTMLInputElement =>
  [...raiz.querySelectorAll('.deslizador')]
    .find((d) => d.querySelector('label')!.textContent!.startsWith(texto))!
    .querySelector('input')!;

afterEach(() => cerrarVentanas());

describe('la pestaña «Deuda y Tesoro» (tarea f20-t2)', () => {
  it('va en Economía y Hacienda, detrás de su presupuesto (y en ningún otro ministerio)', () => {
    expect(pestanasDe('ministerio-economia').map((p) => p.id)).toEqual([
      'resumen',
      'presupuesto',
      'deuda',
      'leyes',
      'acciones',
    ]);
    expect(pestanasDe('ministerio-sanidad').map((p) => p.id)).not.toContain('deuda');
    // Gobierno › Presupuesto ya no la anuncia.
    expect(pestanasDe('presupuesto').map((p) => p.id)).not.toContain('deuda');
  });

  it('enseña la deuda, la tesorería, los tipos de cada plazo y el calendario de vencimientos', () => {
    const { vista, pais } = pestana();
    const texto = vista.elemento.textContent!;
    expect(texto).toMatch(/Deuda pública[\d.]+ M\$/);
    expect(texto).toMatch(/Tesorería[\d.]+ M\$ · [\d,]+ meses de gasto/);
    expect(texto).toContain('Letras a 1 año');
    expect(texto).toContain('Bonos a 10 años');
    expect(texto).toContain('Los mercados prestan');
    const anios = [...vista.elemento.querySelectorAll('.deuda-tesoro__calendario li')];
    // Diez años de vencimientos (más el trozo del año en curso).
    expect(anios.length).toBeGreaterThanOrEqual(10);
    expect(anios[0]!.textContent).toContain('2010');
    // Las barras, de la mayor (100 %) hacia abajo.
    const anchos = anios.map((a) =>
      parseFloat((a.querySelector('.deuda-tesoro__relleno') as HTMLElement).style.width),
    );
    expect(Math.max(...anchos)).toBeCloseTo(100, 0);
    const total = vencimientosPorAnio(pais.presupuesto.vencimientos, '2010-11-15').reduce(
      (s, a) => s + a.importe,
      0,
    );
    expect(total).toBeCloseTo(pais.presupuesto.deuda, -3);
  });

  it('el calendario agrupa por año desde el mes que viene', () => {
    const porAnio = vencimientosPorAnio([1, 2, 3, 4], '2010-11-15');
    // Diciembre de 2010 y enero a marzo de 2011.
    expect(porAnio).toEqual([
      { anio: 2010, importe: 1 },
      { anio: 2011, importe: 9 },
    ]);
  });

  it('emitir: cuánto, con qué reparto, sus intereses y el día de la subasta; y se ordena', () => {
    const { vista, ordenados, pais } = pestana();
    expect(vista.elemento.textContent).toContain('Elige cuánto emitir');
    escribir(campo(vista.elemento, 'Cuánto emitir'), 5000);
    expect(vista.elemento.textContent).toMatch(
      /de intereses al año\. La subasta se hace el 1 de diciembre de 2010/,
    );
    boton(vista.elemento, 'Emitir').click();
    expect(ordenados).toHaveLength(1);
    const [emision] = ordenados[0]!;
    expect(emision).toMatchObject({ tipo: 'emision', importe: 5e9 });
    const reparto = (emision as { reparto: Record<string, number> }).reparto;
    expect(reparto.letras! + reparto.bonos5! + reparto.bonos10!).toBeCloseTo(1, 10);
    expect(reparto).toEqual(pais.presupuesto.tesoro.reparto);
    // Ya ordenado: pendiente, con su día.
    expect(vista.elemento.textContent).toContain('Cambios pendientes');
    expect(vista.elemento.textContent).toContain('Tesoro: emitir 5.000 M$ de deuda');
  });

  it('el reparto se elige en %: más letras, más barato (y más corto)', () => {
    const { vista, pais } = pestana();
    const antes = emisionCon(pais.presupuesto, pais.presupuesto.tesoro.reparto);
    const control = deslizador(vista.elemento, 'Letras a 1 año');
    control.value = '100';
    control.dispatchEvent(new Event('input', { bubbles: true }));
    for (const plazo of ['Bonos a 5 años', 'Bonos a 10 años']) {
      const otro = deslizador(vista.elemento, plazo);
      otro.value = '0';
      otro.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const resumen = vista.elemento.querySelector('.presupuesto-ministerio__total')!.textContent!;
    expect(resumen).toContain('Reparto: 100,0 % letras');
    const ahora = emisionCon(pais.presupuesto, { letras: 1, bonos5: 0, bonos10: 0 });
    expect(ahora.tipo).toBeLessThan(antes.tipo);
    expect(ahora.vida).toBe(1);
  });

  it('apagar el Tesoro automático avisa del peligro y se ordena', () => {
    const { vista, ordenados } = pestana();
    const casilla = vista.elemento.querySelector<HTMLInputElement>('.deuda-tesoro__automatico')!;
    const peligro = vista.elemento.querySelector<HTMLElement>('.deuda-tesoro__peligro')!;
    expect(casilla.checked).toBe(true);
    expect(peligro.hidden).toBe(true);
    casilla.checked = false;
    casilla.dispatchEvent(new Event('change'));
    expect(peligro.hidden).toBe(false);
    expect(peligro.textContent).toContain('el país deja de pagar');
    boton(vista.elemento, 'Aplicar al Tesoro').click();
    expect(ordenados[0]).toEqual([{ tipo: 'tesoro', automatico: false, reparto: null }]);
    // Sin cambios, no se ordena nada.
    boton(vista.elemento, 'Aplicar al Tesoro').click();
    expect(ordenados).toHaveLength(1);
  });

  it('recomprar: no más de lo que hay en la tesorería, y avisa si se paga por encima de su valor', () => {
    const { vista, ordenados, pais } = pestana('DEU');
    const gastar = campo(vista.elemento, 'Cuánto gastar');
    escribir(gastar, 1e9);
    expect(Number(gastar.value) * 1e6).toBeLessThanOrEqual(pais.estado.tesoreria + 1e6);
    pais.presupuesto.tesoro.precioRecompra = 1.2;
    vista.actualizar();
    escribir(campo(vista.elemento, 'Cuánto gastar'), 1000);
    expect(vista.elemento.textContent).toContain('se paga por encima de lo que se debe');
    boton(vista.elemento, 'Recomprar').click();
    expect(ordenados[0]).toEqual([{ tipo: 'recompra', importe: 1e9 }]);
  });

  it('con los mercados cerrados no se puede emitir', () => {
    const { vista, pais } = pestana('GRC');
    pais.presupuesto.tesoro.abierto = false;
    vista.actualizar();
    expect(boton(vista.elemento, 'Emitir').disabled).toBe(true);
    expect(vista.elemento.textContent).toContain('Los mercados no prestan');
  });

  it('en la ventana del ministerio, la pestaña tiene su contenido de verdad', () => {
    const espana = paisCompleto(paises, 'ESP', 1, { jugador: true });
    const elemento = elementoDeMinisterio('economia');
    ponerContenidoPestana(
      elemento,
      'deuda',
      () =>
        deudaTesoro({
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
      const pestanaDeuda = [
        ...ventana.elemento.querySelectorAll<HTMLButtonElement>('[role=tab]'),
      ].find((p) => p.textContent!.includes('Deuda y Tesoro'))!;
      pestanaDeuda.click();
      expect(ventana.elemento.textContent).toContain('Calendario de vencimientos');
    } finally {
      ponerContenidoPestana(elemento, 'deuda', null);
    }
  });
});

describe('negociar y pedir ayuda en la pestaña (tarea f20-t3)', () => {
  /** La pestaña de un país con la prima en `prima`, con lo que ordena y lo que negocia. */
  function conAcreedores(id: string, prima: number, fecha = '2010-06-15') {
    const pais = paisCompleto(paises, id, 1, { jugador: true });
    pais.mercado.prima = prima;
    pais.mercado.tipoMercado = 2 + prima;
    const ordenados: CambioPresupuesto[][] = [];
    const acciones: AccionNegociacion[] = [];
    const vista = deudaTesoro({
      fuente: () => ({
        presupuesto: pais.presupuesto,
        economia: pais.economia,
        mercado: pais.mercado,
        tesoreria: pais.estado.tesoreria,
        fecha,
      }),
      ordenar: (cambios) => ordenados.push(cambios),
      enviarNegociacion: (accion) => acciones.push(accion),
      ofertas: () => ofertasDeAyuda(id, { [id]: pais }, fecha),
    });
    document.body.replaceChildren(vista.elemento);
    return { pais, vista, ordenados, acciones };
  }
  const elegirQuita = (raiz: Element, valor: number): void => {
    const radio = raiz.querySelector<HTMLInputElement>(
      '.deuda-tesoro__tipo-propuesta[value="quita"]',
    )!;
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    const control = deslizador(raiz, 'Quita');
    control.value = String(valor);
    control.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('con la prima alta: propuesta, contraoferta y acuerdo (también en el motor)', () => {
    const { vista, acciones, pais } = conAcreedores('GRC', 11);
    expect(vista.elemento.textContent).toContain('los acreedores temen un impago');
    elegirQuita(vista.elemento, 50);
    expect(vista.elemento.textContent).toMatch(
      /Propuesta: quita del 50,0 %\. A los acreedores les cuesta como una quita del 50,0 %/,
    );
    boton(vista.elemento, 'Proponer (ronda 1 de 3)').click();
    const respuesta = vista.elemento.querySelector('.deuda-tesoro__respuesta')!;
    expect(respuesta.getAttribute('data-respuesta')).toBe('contraoferta');
    expect(respuesta.textContent).toMatch(
      /no aceptan quita del 50,0 %, pero ofrecen quita del 2\d,0 %/,
    );
    boton(vista.elemento, 'Aceptar la contraoferta').click();
    expect(vista.elemento.textContent).toMatch(
      /Acuerdo con los acreedores: quita del 2\d,0 %\. Vale desde el mes que viene/,
    );
    expect(vista.elemento.textContent).toContain(
      'No se puede volver a negociar hasta el 1 de junio de 2011',
    );
    expect(acciones.map((a) => a.tipo)).toEqual(['proponer', 'aceptar']);
    // Pendiente para el día 1.
    expect(pais.presupuesto.pendientes.at(-1)!.cambio.tipo).toBe('acuerdo');
    expect(vista.elemento.querySelector('.cambios-pendientes')!.textContent).toContain(
      'Acuerdo con los acreedores: quita del',
    );
  });

  it('sin estar en apuros: lo rechazan todo y, a la tercera, se rompe', () => {
    const { vista, pais } = conAcreedores('DEU', 0.6);
    expect(vista.elemento.textContent).toContain('no aceptarán perder nada');
    for (let ronda = 1; ronda <= 3; ronda++) {
      boton(vista.elemento, `Proponer (ronda ${ronda} de 3)`).click();
      if (ronda < 3) {
        expect(
          vista.elemento.querySelector('.deuda-tesoro__respuesta')!.getAttribute('data-respuesta'),
        ).toBe('rechaza');
      }
    }
    expect(vista.elemento.textContent).toContain('acabó sin acuerdo y la prima subió');
    expect(pais.mercado.recargo).toBeGreaterThan(0);
    expect(boton(vista.elemento, 'Proponer (ronda 1 de 3)')).toBeUndefined();
  });

  it('pedir ayuda: lo que ofrece cada uno y sus condiciones; se ordena para el mes que viene', () => {
    const { vista, ordenados, pais } = conAcreedores('PRT', 8);
    const ofertas = [...vista.elemento.querySelectorAll('.deuda-tesoro__ofertas li')];
    expect(ofertas.map((o) => o.getAttribute('data-fuente'))).toEqual(['fmi', 'eurozona']);
    expect(ofertas[1]!.textContent).toContain('Fondo de rescate del euro');
    expect(ofertas[1]!.textContent).toMatch(/[\d.]+ M\$ al 4,5 %, a 10 años; llega en 24 meses/);
    expect(ofertas[0]!.textContent).toContain('bajar el déficit 1,5 puntos del PIB cada enero');
    boton(ofertas[1]!, 'Pedir').click();
    expect(ordenados[0]).toEqual([{ tipo: 'ayuda', fuente: 'eurozona', prestamista: null }]);
    expect(vista.elemento.querySelector('.cambios-pendientes')!.textContent).toContain(
      'Ayuda: fondo de rescate del euro',
    );
    // Ya llegando: lo entregado y el objetivo de déficit.
    pedirAyuda(
      ofertasDeAyuda('PRT', { PRT: pais }, '2010-07-01').find((o) => o.fuente === 'eurozona')!,
      pais.mercado,
      pais.economia,
      pais.presupuesto,
      '2010-07-01',
    );
    vista.actualizar();
    expect(vista.elemento.textContent).toMatch(
      /Fondo de rescate del euro: han llegado 0 \$ de [\d.]+ M\$/,
    );
    expect(vista.elemento.textContent).toMatch(
      /Objetivo para el próximo enero: un déficit de como mucho [\d.]+ M\$ \([\d,]+ % del PIB\)/,
    );
    expect(vista.elemento.querySelector('.deuda-tesoro__ofertas')).toBeNull();
  });
});

describe('audiovisual (tarea f20-t4)', () => {
  it('suena la subasta al emitir o recomprar, y cada respuesta de los acreedores tiene su sonido', () => {
    const sonidos: string[] = [];
    sonidosDeComponentes((efecto) => sonidos.push(efecto));
    try {
      const { vista } = pestana();
      escribir(campo(vista.elemento, 'Cuánto emitir'), 2000);
      boton(vista.elemento, 'Emitir').click();
      expect(sonidos).toContain('subasta');
      const base = { desde: '2010-06-01', ronda: 1, propuesta: null, acuerdo: null };
      expect(
        sonidoDeNegociacion({
          ...base,
          estado: 'abierta',
          respuesta: 'contraoferta',
          contraoferta: null,
        }),
      ).toBe('negociacionContraoferta');
      expect(
        sonidoDeNegociacion({
          ...base,
          estado: 'abierta',
          respuesta: 'rechaza',
          contraoferta: null,
        }),
      ).toBe('negociacionRechazo');
      expect(
        sonidoDeNegociacion({
          ...base,
          estado: 'acuerdo',
          respuesta: 'acepta',
          contraoferta: null,
        }),
      ).toBe('negociacionAcuerdo');
      expect(
        sonidoDeNegociacion({
          ...base,
          estado: 'ruptura',
          respuesta: 'rechaza',
          contraoferta: null,
        }),
      ).toBe('negociacionRuptura');
      for (const efecto of ['subasta', 'negociacionAcuerdo', 'negociacionRuptura'] as const) {
        expect(EFECTOS[efecto].length).toBeGreaterThan(0);
      }
    } finally {
      sonidosDeComponentes(null);
    }
  });
});
