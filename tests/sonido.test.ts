/** Motor de sonido (Fase 4, tarea f4-t4). Se prueba con un contexto de audio simulado. */
import { describe, expect, it } from 'vitest';
import { EFECTOS, MotorSonido, type ContextoAudio } from '../src/av/sonido';

/** Contexto falso que solo cuenta lo que se crea y lo que suena. */
function contextoFalso() {
  const registro = {
    creados: 0,
    osciladores: 0,
    ruidos: 0,
    inicios: 0,
    ganancias: [] as { value: number }[],
  };
  const parametro = () => ({
    value: 1,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  const nodo = () => ({ connect() {}, disconnect() {} });
  const fuente = () => ({
    ...nodo(),
    start() {
      registro.inicios++;
    },
    stop() {},
  });
  const contexto = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'running' as AudioContextState,
    destination: nodo(),
    resume: () => Promise.resolve(),
    createGain() {
      const ganancia = { ...nodo(), gain: parametro() };
      registro.ganancias.push(ganancia.gain);
      return ganancia;
    },
    createOscillator() {
      registro.osciladores++;
      return { ...fuente(), type: 'sine', frequency: parametro() };
    },
    createBiquadFilter() {
      return { ...nodo(), type: 'lowpass', Q: parametro(), frequency: parametro() };
    },
    createBuffer(_canales: number, muestras: number) {
      const datos = new Float32Array(muestras);
      return { getChannelData: () => datos };
    },
    createBufferSource() {
      registro.ruidos++;
      return { ...fuente(), buffer: null };
    },
  };
  return {
    registro,
    crear: () => {
      registro.creados++;
      return contexto as unknown as ContextoAudio;
    },
  };
}

const opciones = { silenciado: false, volumenEfectos: 0.7, volumenMusica: 0.5 };

describe('motor de sonido', () => {
  it('no crea el audio hasta la primera interacción del jugador', () => {
    const falso = contextoFalso();
    const motor = new MotorSonido(opciones, falso.crear);
    motor.reproducir('seleccionar');
    expect(falso.registro.creados).toBe(0);
    expect(motor.activo).toBe(false);
    motor.activar();
    motor.activar();
    expect(falso.registro.creados).toBe(1);
    expect(motor.activo).toBe(true);
  });

  it('reproduce cada efecto con sus notas', () => {
    const falso = contextoFalso();
    const motor = new MotorSonido(opciones, falso.crear);
    motor.activar();
    motor.reproducir('seleccionar');
    expect(falso.registro.osciladores).toBe(EFECTOS.seleccionar.length);
    motor.reproducir('abrirPanel');
    expect(falso.registro.ruidos).toBe(1);
    expect(falso.registro.inicios).toBe(EFECTOS.seleccionar.length + 1);
  });

  it('silenciado no suena nada, y al quitar el silencio vuelve a sonar', () => {
    const falso = contextoFalso();
    const motor = new MotorSonido({ ...opciones, silenciado: true }, falso.crear);
    motor.activar();
    motor.reproducir('seleccionar');
    expect(falso.registro.inicios).toBe(0);
    motor.silenciado = false;
    motor.reproducir('seleccionar');
    expect(falso.registro.inicios).toBeGreaterThan(0);
  });

  it('música y efectos tienen volúmenes separados, siempre entre 0 y 1', () => {
    const falso = contextoFalso();
    const motor = new MotorSonido(opciones, falso.crear);
    motor.activar();
    // Ganancias: general, efectos y música.
    const [general, efectos, musica] = falso.registro.ganancias;
    expect(general!.value).toBe(1);
    expect(efectos!.value).toBe(0.7);
    expect(musica!.value).toBe(0.5);
    motor.volumenEfectos = 3;
    expect(motor.volumenEfectos).toBe(1);
    motor.volumenEfectos = -1;
    expect(efectos!.value).toBe(0);
    motor.silenciado = true;
    expect(general!.value).toBe(0);
  });

  it('sin Web Audio en el navegador, el juego sigue funcionando en silencio', () => {
    const motor = new MotorSonido(opciones, () => null);
    expect(() => {
      motor.activar();
      motor.reproducir('boton');
    }).not.toThrow();
    expect(motor.activo).toBe(false);
  });

  it('los efectos de interfaz son cortos y suaves', () => {
    for (const [nombre, notas] of Object.entries(EFECTOS)) {
      for (const nota of notas) {
        expect(nota.inicio + nota.duracion, nombre).toBeLessThanOrEqual(0.3);
        expect(nota.volumen, nombre).toBeLessThanOrEqual(0.25);
        expect(nota.frecuencia, nombre).toBeGreaterThan(100);
      }
    }
  });
});
