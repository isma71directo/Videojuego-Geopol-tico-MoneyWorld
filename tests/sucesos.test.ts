// @vitest-environment happy-dom
/** Sucesos y pausa automática (tarea f13-t3). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import { crearMotor, type MensajeMotor, type SucesoMotor } from '../src/sim/motor';
import { crearPartida } from '../src/sim/partida';
import { horaDe, horasHastaSiguiente, programar, type Suceso } from '../src/sim/sucesos';
import { leerAjuste } from '../src/ui/ajustes';
import { avisoAbierto, cerrarAviso, mostrarAvisoSuceso } from '../src/ui/aviso-suceso';
import { t } from '../src/i18n';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;

const suceso = (cambios: Partial<Suceso> = {}): Omit<Suceso, 'id'> => ({
  titulo: 'Moción de censura',
  texto: 'La oposición presenta una moción de censura.',
  fecha: '2010-01-03',
  hora: 8,
  importante: true,
  origen: 'politica',
  ...cambios,
});

/** Motor con una partida empezada, a ×64, que avanza hasta parar o hasta el día dado. */
function motorCon(pausaAutomatica: boolean, ...sucesos: Omit<Suceso, 'id'>[]) {
  const motor = crearMotor();
  motor.atender({
    tipo: 'empezar',
    partida: crearPartida(
      { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 1 },
      paises.paises,
    ),
    pausaAutomatica,
  });
  for (const s of sucesos) motor.atender({ tipo: 'programar', suceso: s });
  motor.atender({ tipo: 'velocidad', velocidad: 64 });
  const recibidos: MensajeMotor[] = [];
  const correrHasta = (fecha: string) => {
    // Vueltas de 250 ms: a ×64, ocho horas cada una.
    while (motor.velocidad > 0 && motor.partida!.fecha < fecha)
      recibidos.push(...motor.avanzar(250));
  };
  return { motor, recibidos, correrHasta };
}

afterEach(() => {
  cerrarAviso();
  document.body.replaceChildren();
});

describe('agenda de sucesos (tarea f13-t3)', () => {
  it('se ordena por su momento y dice cuánto falta para el siguiente', () => {
    const a = { ...suceso({ fecha: '2010-02-01', hora: 0 }), id: 'a' };
    const b = { ...suceso({ fecha: '2010-01-05', hora: 12 }), id: 'b' };
    const c = { ...suceso({ fecha: '2010-01-05', hora: 12 }), id: 'c' };
    const agenda = programar(programar(programar([], a), b), c);
    expect(agenda.map((s) => s.id)).toEqual(['b', 'c', 'a']);
    const ahora = horaDe({ fecha: '2010-01-05', hora: 2 });
    expect(horasHastaSiguiente(agenda, ahora)).toBe(10);
    expect(horasHastaSiguiente([], ahora)).toBeNull();
  });
});

describe('pausa automática en el motor (tarea f13-t3)', () => {
  it('un suceso importante para la partida justo a su hora, aunque vaya a ×64', () => {
    const { motor, recibidos, correrHasta } = motorCon(true, suceso());
    correrHasta('2010-02-01');
    expect(motor.velocidad).toBe(0);
    expect(motor.partida).toMatchObject({ fecha: '2010-01-03', hora: 8, agenda: [] });
    const aviso = recibidos.find((m): m is SucesoMotor => m.tipo === 'suceso')!;
    expect(aviso).toMatchObject({ pausado: true, suceso: { titulo: 'Moción de censura' } });
    // El estado que llega justo antes ya está en pausa y a esa hora, y el último mensaje es un estado.
    const posicion = recibidos.indexOf(aviso);
    expect(recibidos[posicion - 1]).toMatchObject({ tipo: 'estado', hora: 8, velocidad: 0 });
    expect(recibidos.at(-1)).toMatchObject({ tipo: 'estado', hora: 8, velocidad: 0 });
    // Al seguir, la partida continúa.
    motor.atender({ tipo: 'velocidad', velocidad: 8 });
    motor.avanzar(250);
    expect(motor.partida!.hora).toBe(9);
  });

  it('con la pausa automática desactivada, avisa pero no para', () => {
    const { motor, recibidos, correrHasta } = motorCon(false, suceso());
    correrHasta('2010-01-05');
    expect(motor.velocidad).toBe(64);
    expect(motor.partida!.fecha >= '2010-01-05').toBe(true);
    expect(recibidos.find((m) => m.tipo === 'suceso')).toMatchObject({ pausado: false });
  });

  it('los sucesos que no son importantes no paran; se puede cambiar la opción a mitad de partida', () => {
    const { motor, correrHasta } = motorCon(true, suceso({ importante: false }));
    correrHasta('2010-01-05');
    expect(motor.velocidad).toBe(64);
    // Ahora se desactiva y llega uno importante: tampoco para.
    motor.atender({ tipo: 'ajustes', pausaAutomatica: false });
    motor.atender({ tipo: 'programar', suceso: suceso({ fecha: '2010-01-08' }) });
    correrHasta('2010-01-10');
    expect(motor.velocidad).toBe(64);
  });

  it('un suceso que ya ha pasado no se programa', () => {
    const { motor } = motorCon(true);
    motor.atender({ tipo: 'velocidad', velocidad: 0 });
    motor.atender({ tipo: 'programar', suceso: suceso({ fecha: '2010-01-01', hora: 0 }) });
    expect(motor.partida!.agenda).toEqual([]);
  });

  it('dos sucesos en el mismo avance: para en el primero y el segundo queda en la agenda', () => {
    const { motor, correrHasta } = motorCon(
      true,
      suceso({ hora: 2, titulo: 'Primero' }),
      suceso({ hora: 5, titulo: 'Segundo' }),
    );
    correrHasta('2010-02-01');
    expect(motor.partida).toMatchObject({ fecha: '2010-01-03', hora: 2 });
    expect(motor.partida!.agenda.map((s) => s.titulo)).toEqual(['Segundo']);
  });

  it('la opción de Ajustes está activada por defecto y tiene su texto', () => {
    expect(leerAjuste('pausaSucesos')).toBe(true);
    expect(t('juego.ajustes.pausaSucesos')).toBe('Pausar ante sucesos importantes');
  });
});

describe('aviso de la pausa automática (tarea f13-t3)', () => {
  const conId = { ...suceso(), id: 's1' };

  it('dice qué ha pasado y cuándo; «Seguir» sigue y se cierra', () => {
    const alSeguir = vi.fn();
    const alCerrar = vi.fn();
    const aviso = mostrarAvisoSuceso({ suceso: conId, alSeguir, alCerrar });
    expect(avisoAbierto()).toBe(true);
    expect(aviso.elemento.textContent).toContain('Moción de censura');
    expect(aviso.elemento.textContent).toContain('3 de enero de 2010, 08:00');
    expect(aviso.elemento.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toContain('Seguir');
    aviso.elemento.querySelector<HTMLButtonElement>('.aviso-suceso__seguir')!.click();
    expect(alSeguir).toHaveBeenCalledOnce();
    expect(alCerrar).not.toHaveBeenCalled();
    expect(avisoAbierto()).toBe(false);
  });

  it('Escape lo cierra dejando la partida en pausa, y las teclas del mapa no pasan', () => {
    const alSeguir = vi.fn();
    const alCerrar = vi.fn();
    mostrarAvisoSuceso({ suceso: conId, alSeguir, alCerrar });
    const atajos = vi.fn();
    document.addEventListener('keydown', atajos);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '6', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(atajos).not.toHaveBeenCalled();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.removeEventListener('keydown', atajos);
    expect(alCerrar).toHaveBeenCalledOnce();
    expect(alSeguir).not.toHaveBeenCalled();
    expect(avisoAbierto()).toBe(false);
  });

  it('el de prueba lo dice', () => {
    const aviso = mostrarAvisoSuceso({
      suceso: { ...conId, origen: 'prueba', titulo: t('juego.sucesos.prueba.titulo') },
      alSeguir: () => undefined,
    });
    expect(aviso.elemento.querySelector('.aviso-suceso__prueba')!.textContent).toBe('prueba');
    expect(aviso.elemento.textContent).toContain('Suceso de prueba');
  });
});
