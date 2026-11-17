// @vitest-environment happy-dom
/** Pantalla de partida: barra superior y salida con confirmación (tarea f10-t3). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOMBRES_ICONOS } from '../src/av/iconos';
import { formatearFechaLarga } from '../src/compartido/fechas';
import type { ConjuntoGobiernos } from '../src/datos/gobiernos';
import type { ConjuntoPaises } from '../src/datos/paises';
import { t } from '../src/i18n';
import { COLOR_JUGADOR } from '../src/map/mapa';
import { crearPartida } from '../src/sim/partida';
import {
  confirmarSalidaDePartida,
  crearBarraPartida,
  nivelPopularidad,
  POPULARIDAD_ALTA,
  POPULARIDAD_BAJA,
} from '../src/ui/barra-partida';
import { confirmacionAbierta, pedirConfirmacion } from '../src/ui/componentes/confirmacion';

const leer = <T>(ruta: string): T => JSON.parse(readFileSync(resolve(ruta), 'utf8')) as T;
const paises = leer<ConjuntoPaises>('public/data/paises-2010.json');
const gobiernos = leer<ConjuntoGobiernos>('public/data/gobiernos-2010.json');
const partidaCon = (paisId: string) =>
  crearPartida(
    { paisId, dificultad: 'normal', eventosHistoricos: true, semilla: 1 },
    paises.paises,
    gobiernos.paises,
  );

/** La ventana de confirmación que está a la vista (no la que se va con su animación). */
const ventana = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.confirmacion:not(.retirandose)');
const tecla = (key: string, opciones: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opciones });

afterEach(() => document.body.replaceChildren());

describe('fecha larga (tarea f10-t3)', () => {
  it('«2010-01-01» es «1 de enero de 2010»', () => {
    expect(formatearFechaLarga('2010-01-01')).toBe('1 de enero de 2010');
    expect(formatearFechaLarga('2010-12-31')).toBe('31 de diciembre de 2010');
    expect(formatearFechaLarga('mañana')).toBe('mañana');
  });
});

describe('barra superior de la partida (tarea f10-t3)', () => {
  it('enseña el país, la fecha, la tesorería y la popularidad', () => {
    const partida = partidaCon('ESP');
    const alIrAlPais = vi.fn();
    const barra = crearBarraPartida({ partida, alIrAlPais });
    document.body.appendChild(barra.elemento);
    const texto = barra.elemento.textContent!;
    expect(texto).toContain('1 de enero de 2010');
    expect(texto).toContain('43.265 M$');
    expect(texto).toContain(`${partida.paises.ESP!.popularidad} %`);
    expect(barra.elemento.querySelector('time')!.getAttribute('datetime')).toBe('2010-01-01T00:00');
    // El nombre llega con los datos; mientras, el código.
    const pais = barra.elemento.querySelector<HTMLButtonElement>('.partida-barra__pais')!;
    expect(pais.textContent).toBe('ESP');
    barra.ponerNombrePais('España');
    expect(pais.textContent).toBe('España');
    expect(pais.getAttribute('aria-label')).toContain('Tu país: España');
    expect(pais.querySelector('img')!.getAttribute('src')).toContain('ESP');
    pais.click();
    expect(alIrAlPais).toHaveBeenCalledOnce();
    barra.destruir();
  });

  it('el medidor de popularidad se llena y cambia de color según el valor', () => {
    expect(nivelPopularidad(POPULARIDAD_BAJA - 1)).toBe('baja');
    expect(nivelPopularidad(POPULARIDAD_BAJA)).toBe('media');
    expect(nivelPopularidad(POPULARIDAD_ALTA)).toBe('media');
    expect(nivelPopularidad(POPULARIDAD_ALTA + 1)).toBe('alta');
    const partida = partidaCon('ESP');
    const barra = crearBarraPartida({ partida, alIrAlPais: () => undefined });
    const medidor = barra.elemento.querySelector<HTMLElement>('.partida-barra__medidor')!;
    const relleno = medidor.querySelector<HTMLElement>('.partida-barra__relleno')!;
    expect(relleno.style.width).toBe(`${partida.paises.ESP!.popularidad}%`);
    expect(medidor.dataset.nivel).toBe('baja');
    // Al cambiar la partida (en las próximas fases), la barra se repinta.
    partida.paises.ESP!.popularidad = 70;
    partida.paises.ESP!.tesoreria = 1.5e12;
    barra.actualizar(partida);
    expect(medidor.dataset.nivel).toBe('alta');
    expect(barra.elemento.textContent).toContain('1,5 billones $');
  });

  it('cada dato se explica al recibir el foco (la tesorería, con el presupuesto: Fase 17)', () => {
    const barra = crearBarraPartida({ partida: partidaCon('FRA'), alIrAlPais: () => undefined });
    document.body.appendChild(barra.elemento);
    const tesoreria = barra.elemento.querySelector<HTMLElement>('.partida-barra__dato--tesoreria')!;
    expect(tesoreria.tabIndex).toBe(0);
    tesoreria.dispatchEvent(new FocusEvent('focus'));
    tesoreria.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    const info = document.querySelector<HTMLElement>('.info:not([hidden])');
    expect(info?.textContent).toContain('emite deuda');
    barra.destruir();
  });

  it('iconos nuevos registrados y con nombre en la galería; contorno del país propio', () => {
    for (const nombre of ['calendario', 'popularidad', 'salir']) {
      expect(NOMBRES_ICONOS as string[]).toContain(nombre);
      expect(t(`galeria.iconos.${nombre}`)).not.toMatch(/^galeria\./);
    }
    expect(COLOR_JUGADOR).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('ventana de confirmación (tarea f10-t3)', () => {
  it('salir de la partida pregunta; empieza en «Seguir jugando» y Escape cancela', async () => {
    const respuesta = confirmarSalidaDePartida();
    const caja = ventana()!;
    expect(caja.getAttribute('role')).toBe('alertdialog');
    expect(caja.textContent).toContain('¿Salir al menú?');
    expect(caja.textContent).toContain('No hay nada sin guardar');
    expect(document.activeElement?.textContent).toBe('Seguir jugando');
    expect(confirmacionAbierta()).toBe(true);
    // Escape no llega al mapa (que quitaría la selección).
    const delMapa = vi.fn();
    document.addEventListener('keydown', delMapa);
    document.activeElement!.dispatchEvent(tecla('Escape'));
    await expect(respuesta).resolves.toBe(false);
    expect(delMapa).not.toHaveBeenCalled();
    document.removeEventListener('keydown', delMapa);
    expect(ventana()).toBeNull();
    expect(confirmacionAbierta()).toBe(false);
  });

  it('«Salir al menú» confirma', async () => {
    const respuesta = confirmarSalidaDePartida();
    ventana()!.querySelector<HTMLButtonElement>('.confirmacion__aceptar')!.click();
    await expect(respuesta).resolves.toBe(true);
  });

  it('el foco no sale de la ventana y las teclas no llegan a los atajos de detrás', async () => {
    const respuesta = pedirConfirmacion({
      titulo: 'Prueba',
      texto: 'Texto',
      aceptar: 'Sí',
      cancelar: 'No',
    });
    const atajos = vi.fn();
    document.addEventListener('keydown', atajos);
    document.activeElement!.dispatchEvent(tecla('Tab'));
    expect(document.activeElement?.textContent).toBe('Sí');
    document.activeElement!.dispatchEvent(tecla('Tab', { shiftKey: true }));
    expect(document.activeElement?.textContent).toBe('No');
    document.activeElement!.dispatchEvent(tecla('b'));
    document.body.dispatchEvent(tecla('c'));
    expect(atajos).not.toHaveBeenCalled();
    document.removeEventListener('keydown', atajos);
    // Un clic fuera cancela.
    ventana()!.querySelector<HTMLElement>('.confirmacion__fondo')!.click();
    await expect(respuesta).resolves.toBe(false);
  });

  it('si se abre otra, la anterior se cancela', async () => {
    const primera = pedirConfirmacion({ titulo: 'A', texto: '', aceptar: 'Sí', cancelar: 'No' });
    const segunda = pedirConfirmacion({ titulo: 'B', texto: '', aceptar: 'Sí', cancelar: 'No' });
    await expect(primera).resolves.toBe(false);
    expect(ventana()!.textContent).toContain('B');
    ventana()!.querySelector<HTMLButtonElement>('.confirmacion__aceptar')!.click();
    await expect(segunda).resolves.toBe(true);
  });
});
