// @vitest-environment happy-dom
/** Motor de la partida en segundo plano: motor, bucle y conexión (tarea f12-t1). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ConjuntoPaises } from '../src/datos/paises';
import config from '../src/sim/config/tiempo.json';
import { arrancarBucle, INTERVALO_BUCLE_MS } from '../src/sim/bucle';
import { crearMotor, type MensajeMotor } from '../src/sim/motor';
import { crearPartida, type Partida } from '../src/sim/partida';
import { msPorHora, type Paso } from '../src/sim/reloj';
import { conectarMotor } from '../src/ui/conexion-motor';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;
const nuevaPartida = (): Partida =>
  crearPartida(
    { paisId: 'ESP', dificultad: 'normal', eventosHistoricos: true, semilla: 1 },
    paises.paises,
  );

describe('motor (tarea f12-t1)', () => {
  it('empieza en pausa y en pausa no avanza', () => {
    const motor = crearMotor();
    expect(motor.atender({ tipo: 'empezar', partida: nuevaPartida() })).toEqual<MensajeMotor[]>([
      { tipo: 'estado', fecha: '2010-01-01', hora: 0, fraccion: 0, velocidad: 0 },
    ]);
    expect(motor.avanzar(10_000)).toEqual([]);
    expect(motor.partida!.hora).toBe(0);
  });

  it('cuenta las horas a cada velocidad y guarda la parte de la hora en curso', () => {
    const motor = crearMotor();
    motor.atender({ tipo: 'empezar', partida: nuevaPartida() });
    motor.atender({ tipo: 'velocidad', velocidad: 1 });
    // A ×1, una hora cada 2 s: en fotogramas de 250 ms, a las 8 vueltas, una hora.
    const mensajes: MensajeMotor[] = [];
    for (let i = 0; i < 8; i++) mensajes.push(...motor.avanzar(250));
    expect(mensajes).toHaveLength(1);
    expect(mensajes[0]).toMatchObject({ hora: 1, fraccion: 0, velocidad: 1 });
    // Media hora más: la fracción lo dice al cambiar de velocidad.
    for (let i = 0; i < 4; i++) motor.avanzar(250);
    expect(motor.atender({ tipo: 'velocidad', velocidad: 64 })[0]).toMatchObject({
      hora: 1,
      fraccion: 0.5,
      velocidad: 64,
    });
    // A ×64 un día pasa en 0,75 s.
    for (let i = 0; i < 75; i++) motor.avanzar(10);
    expect(motor.partida).toMatchObject({ fecha: '2010-01-02', hora: 1 });
    // Una velocidad que no existe no cambia nada.
    expect(motor.atender({ tipo: 'velocidad', velocidad: 4 })).toEqual([]);
    expect(motor.velocidad).toBe(64);
  });

  it('si una vuelta tarda mucho, el tiempo va más despacio en lugar de saltar', () => {
    const motor = crearMotor();
    motor.atender({ tipo: 'empezar', partida: nuevaPartida() });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    // Una vuelta de 10 s (el ordenador parado) solo cuenta lo que da el tope de un fotograma.
    motor.avanzar(10_000);
    expect(motor.partida!.hora).toBe(config.maxMsPorFotograma / msPorHora(64));
  });

  it('da los pasos a los sistemas y aplica la carga de prueba cada día', () => {
    let reloj = 0;
    const pasos: Paso[] = [];
    const motor = crearMotor({
      sistemas: [(nuevos) => pasos.push(...nuevos)],
      // Un reloj falso que avanza 1 ms cada vez que se mira.
      ahora: () => reloj++,
    });
    motor.atender({ tipo: 'empezar', partida: nuevaPartida(), cargaPruebaMs: 30 });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    for (let i = 0; i < 300; i++) motor.avanzar(10);
    // 3 s a ×64: 4 días; cada día, 30 ms de carga.
    expect(pasos.filter((p) => p.ritmo === 'diario')).toHaveLength(4);
    expect(reloj).toBeGreaterThanOrEqual(4 * 30);
  });

  it('al terminar se olvida de la partida', () => {
    const motor = crearMotor();
    motor.atender({ tipo: 'empezar', partida: nuevaPartida() });
    motor.atender({ tipo: 'terminar' });
    expect(motor.partida).toBeNull();
    expect(motor.avanzar(1000)).toEqual([]);
  });
});

describe('bucle del motor (tarea f12-t1)', () => {
  function crear() {
    let ahora = 0;
    const programados = new Map<number, () => void>();
    let siguiente = 1;
    const enviar = vi.fn();
    const bucle = arrancarBucle(crearMotor(), {
      enviar,
      ahora: () => ahora,
      programar: (accion) => {
        const id = siguiente++;
        programados.set(id, accion);
        return id;
      },
      cancelar: (id) => programados.delete(id as number),
    });
    /** Avanza el reloj falso dando las vueltas programadas. */
    const correr = (ms: number) => {
      for (let hecho = 0; hecho < ms; hecho += INTERVALO_BUCLE_MS) {
        ahora += INTERVALO_BUCLE_MS;
        const ahoraMismo = [...programados.values()];
        programados.clear();
        for (const accion of ahoraMismo) accion();
      }
    };
    return { bucle, enviar, correr, programados };
  }

  it('en pausa no programa nada; en marcha manda el estado al cambiar de hora', () => {
    const { bucle, enviar, correr, programados } = crear();
    bucle.atender({ tipo: 'empezar', partida: nuevaPartida() });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(bucle.enMarcha).toBe(false);
    correr(5000);
    expect(enviar).toHaveBeenCalledTimes(1);
    bucle.atender({ tipo: 'velocidad', velocidad: 8 });
    expect(bucle.enMarcha).toBe(true);
    // A ×8 una hora son 250 ms: en un segundo, cuatro horas.
    correr(1008);
    const ultimo = enviar.mock.calls.at(-1)![0] as MensajeMotor;
    expect(ultimo.hora).toBe(4);
    bucle.atender({ tipo: 'velocidad', velocidad: 0 });
    expect(bucle.enMarcha).toBe(false);
    expect(programados.size).toBe(0);
    bucle.atender({ tipo: 'terminar' });
    expect(bucle.enMarcha).toBe(false);
  });
});

describe('conexión de la pantalla con el motor (tarea f12-t1)', () => {
  it('sin worker, el motor corre en este hilo y los mensajes llegan después', async () => {
    const conexion = conectarMotor({ sinTrabajador: true });
    expect(conexion.enOtroHilo).toBe(false);
    const recibidos: MensajeMotor[] = [];
    conexion.alRecibir = (mensaje) => recibidos.push(mensaje);
    conexion.enviar({ tipo: 'empezar', partida: nuevaPartida() });
    // Como con un worker, no llega en mitad de la orden.
    expect(recibidos).toHaveLength(0);
    await Promise.resolve();
    expect(recibidos[0]).toMatchObject({ tipo: 'estado', fecha: '2010-01-01', hora: 0 });
    conexion.cerrar();
    conexion.enviar({ tipo: 'velocidad', velocidad: 1 });
    await Promise.resolve();
    expect(recibidos).toHaveLength(1);
  });

  it('el worker solo une el motor con los mensajes del navegador', () => {
    const codigo = readFileSync(resolve('src/sim/trabajador.ts'), 'utf8');
    expect(codigo).toContain('arrancarBucle(crearMotor(');
    expect(codigo).toContain('onmessage');
    expect(codigo).not.toMatch(/document|window/);
  });
});
