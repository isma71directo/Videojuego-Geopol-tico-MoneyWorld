// @vitest-environment happy-dom
/** Menú de la partida: guardar, cargar, guardado mensual y Ajustes en la partida (tarea f14-t2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { crearMotor, horasHastaElMesSiguiente, type PartidaMotor } from '../src/sim/motor';
import { crearPartida, type Partida } from '../src/sim/partida';
import { alCambiarAjuste, guardarAjuste, leerAjuste } from '../src/ui/ajustes';
import { almacenEnMemoria, guardarPartida } from '../src/ui/almacen-partidas';
import { pedirEleccion } from '../src/ui/componentes/confirmacion';
import { cerrarVentanas } from '../src/ui/componentes/ventana';
import {
  abrirCargar,
  abrirGuardar,
  etiquetaGuardado,
  textoPartida,
} from '../src/ui/guardar-cargar';
import { t } from '../src/i18n';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const nuevaPartida = (pais = 'ESP'): Partida =>
  crearPartida(
    { paisId: pais, dificultad: 'normal', eventosHistoricos: true, semilla: 99 },
    paises.paises,
  );
const nombreDe = (id: string): string => paises.paises[id]?.nombre ?? id;
/** Espera a que se cumplan las promesas pendientes. */
const esperar = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  cerrarVentanas();
  document.body.replaceChildren();
});

describe('el motor y el guardado (tarea f14-t2)', () => {
  it('da una copia de la partida cuando se le pide, que no cambia aunque la partida siga', () => {
    const motor = crearMotor();
    motor.atender({ tipo: 'empezar', partida: nuevaPartida() });
    const [mensaje] = motor.atender({ tipo: 'instantanea', peticion: 7 }) as PartidaMotor[];
    expect(mensaje).toMatchObject({ tipo: 'partida', motivo: 'peticion', peticion: 7 });
    expect(mensaje!.partida).toEqual(motor.partida);
    expect(mensaje!.partida).not.toBe(motor.partida);
    motor.atender({ tipo: 'velocidad', velocidad: 8 });
    motor.avanzar(250);
    expect(mensaje!.partida.hora).toBe(0);
  });

  it('al empezar cada mes manda la partida justo el día 1 a las 00:00, sin pararse', () => {
    const motor = crearMotor();
    motor.atender({ tipo: 'empezar', partida: nuevaPartida(), pausaAutomatica: true });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    const meses: PartidaMotor[] = [];
    while (motor.partida!.fecha < '2010-03-15') {
      meses.push(...motor.avanzar(250).filter((m): m is PartidaMotor => m.tipo === 'partida'));
    }
    expect(meses.map((m) => [m.motivo, m.partida.fecha, m.partida.hora])).toEqual([
      ['mes', '2010-02-01', 0],
      ['mes', '2010-03-01', 0],
    ]);
    expect(motor.velocidad).toBe(64);
  });

  it('sabe cuánto falta para el mes siguiente', () => {
    expect(horasHastaElMesSiguiente({ fecha: '2010-01-31', hora: 23 })).toBe(1);
    expect(horasHastaElMesSiguiente({ fecha: '2010-02-15', hora: 0 })).toBe(14 * 24);
    expect(horasHastaElMesSiguiente({ fecha: '2010-12-01', hora: 0 })).toBe(31 * 24);
  });
});

describe('preguntar con varias respuestas (tarea f14-t2)', () => {
  const opciones = {
    titulo: '¿Guardar antes de salir?',
    texto: 'Se perderá lo no guardado.',
    respuestas: [
      { id: 'cancelar', texto: 'Seguir jugando' },
      { id: 'sinGuardar', texto: 'Salir sin guardar', estilo: 'peligro' },
      { id: 'guardar', texto: 'Guardar y salir', estilo: 'principal' },
    ] as const,
  };

  it('devuelve la respuesta elegida; empieza en la segura y Tab pasa por todas', async () => {
    const respuesta = pedirEleccion(opciones);
    const botones = [...document.querySelectorAll<HTMLButtonElement>('.confirmacion button')];
    expect(botones.map((b) => b.textContent)).toEqual([
      'Seguir jugando',
      'Salir sin guardar',
      'Guardar y salir',
    ]);
    expect(document.querySelector('.confirmacion__caja--ancha')).not.toBeNull();
    expect(document.activeElement).toBe(botones[0]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(botones[1]);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    );
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    );
    expect(document.activeElement).toBe(botones[2]);
    expect(botones[1]!.classList.contains('boton--peligro')).toBe(true);
    botones[2]!.click();
    expect(await respuesta).toBe('guardar');
  });

  it('Escape no elige nada', async () => {
    const respuesta = pedirEleccion(opciones);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(await respuesta).toBeNull();
  });
});

describe('Ajustes en la partida (tarea f14-t2)', () => {
  it('avisa de cada ajuste que cambia, hasta dejar de escuchar', () => {
    const escucha = vi.fn();
    const dejar = alCambiarAjuste(escucha);
    guardarAjuste('pausaSucesos', false);
    expect(escucha).toHaveBeenCalledWith('pausaSucesos', false);
    expect(leerAjuste('pausaSucesos')).toBe(false);
    dejar();
    guardarAjuste('pausaSucesos', true);
    expect(escucha).toHaveBeenCalledOnce();
  });

  it('la ayuda de la pausa automática vale para cualquier suceso importante', () => {
    const ayuda = t('juego.ajustes.pausaSucesosAyuda');
    for (const ejemplo of ['elecciones', 'golpes de Estado', 'catástrofes', 'tratados']) {
      expect(ayuda).toContain(ejemplo);
    }
  });
});

describe('ventanas Guardar y Cargar (tarea f14-t2)', () => {
  it('cómo se cuenta cada guardado', () => {
    const resumen = { paisId: 'FRA', fecha: '2011-03-01', hora: 8 };
    expect(textoPartida(resumen, nombreDe)).toBe('Francia · 1 de marzo de 2011, 08:00');
    expect(etiquetaGuardado({ tipo: 'manual', ranura: 3, fecha: '2011-03-01' })).toBe('Ranura 3');
    expect(etiquetaGuardado({ tipo: 'automatico', ranura: null, fecha: '2011-03-01' })).toBe(
      'Automático',
    );
    expect(etiquetaGuardado({ tipo: 'anual', ranura: null, fecha: '2012-01-01' })).toBe(
      'Inicio de 2012',
    );
  });

  it('Guardar: cinco ranuras; una vacía se elige sin preguntar', async () => {
    const almacen = almacenEnMemoria();
    const alElegir = vi.fn();
    const ventana = await abrirGuardar({ almacen, nombreDe, alElegir });
    const filas = ventana.cuerpo.querySelectorAll<HTMLButtonElement>('.guardados__fila');
    expect(filas).toHaveLength(5);
    expect([...filas].every((f) => f.textContent!.includes('Vacía'))).toBe(true);
    // Este navegador (de los tests) no tiene IndexedDB: lo avisa.
    expect(ventana.cuerpo.querySelector('.guardados__aviso')).not.toBeNull();
    filas[1]!.click();
    await esperar();
    expect(alElegir).toHaveBeenCalledWith(2);
    expect(ventana.abierta).toBe(false);
  });

  it('Guardar: una ranura ocupada pregunta antes de sobrescribirla', async () => {
    const almacen = almacenEnMemoria();
    await guardarPartida(almacen, nuevaPartida('FRA'), { tipo: 'manual', ranura: 1 }, '0.15.0');
    const alElegir = vi.fn();
    const alCerrar = vi.fn();
    const ventana = await abrirGuardar({ almacen, nombreDe, alElegir, alCerrar });
    const primera = ventana.cuerpo.querySelector<HTMLButtonElement>('.guardados__fila')!;
    expect(primera.textContent).toContain('Francia · 1 de enero de 2010, 00:00');
    expect(primera.querySelector('img')!.getAttribute('src')).toBe('./av/banderas/FRA.svg');
    // Cancelar no guarda.
    primera.click();
    await esperar();
    expect(document.querySelector('.confirmacion')!.textContent).toContain(
      '¿Sobrescribir la ranura 1?',
    );
    document.querySelector<HTMLButtonElement>('.confirmacion__cancelar')!.click();
    await esperar();
    expect(alElegir).not.toHaveBeenCalled();
    // Aceptar, sí.
    primera.click();
    await esperar();
    document
      .querySelector<HTMLButtonElement>('.confirmacion:not(.retirandose) .confirmacion__aceptar')!
      .click();
    await esperar();
    expect(alElegir).toHaveBeenCalledWith(1);
    // Al elegir, la ventana se cierra sin contar como «cerrar sin guardar».
    expect(alCerrar).not.toHaveBeenCalled();
  });

  it('Cargar: ranuras, automáticos y anuales en orden; sin guardados, lo dice', async () => {
    const almacen = almacenEnMemoria();
    const vacia = await abrirCargar({ almacen, nombreDe, alElegir: () => undefined });
    expect(vacia.cuerpo.textContent).toContain('Todavía no hay partidas guardadas');
    vacia.cerrar(true);
    const partida = { ...nuevaPartida(), fecha: '2011-01-01' };
    await guardarPartida(almacen, partida, { tipo: 'anual' }, '0.15.0', new Date(1000));
    await guardarPartida(almacen, partida, { tipo: 'automatico' }, '0.15.0', new Date(2000));
    await guardarPartida(almacen, partida, { tipo: 'manual', ranura: 4 }, '0.15.0', new Date(3000));
    const alElegir = vi.fn();
    const ventana = await abrirCargar({ almacen, nombreDe, alElegir });
    const etiquetas = [...ventana.cuerpo.querySelectorAll('.guardados__etiqueta')].map(
      (e) => e.textContent,
    );
    expect(etiquetas).toEqual(['Ranura 4', 'Automático', 'Inicio de 2011']);
    ventana.cuerpo.querySelectorAll<HTMLButtonElement>('.guardados__fila')[1]!.click();
    expect(alElegir).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'automatico' }));
  });
});
