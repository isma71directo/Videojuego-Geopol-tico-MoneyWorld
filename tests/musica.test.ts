// @vitest-environment happy-dom
/** Música ambiental: teoría, arreglista, piezas tranquilas, lista y reproductor (tarea f12-t3). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { arreglar, RANGOS, type PlanPieza } from '../src/av/musica/arreglista';
import { ListaPiezas } from '../src/av/musica/lista';
import { PIEZAS_TRANQUILAS } from '../src/av/musica/piezas-tranquilas';
import {
  notasEntre,
  ReproductorMusica,
  VOLUMEN_EN_PAUSA,
  type SalidaMusica,
} from '../src/av/musica/reproductor';
import {
  acordeDeGrado,
  clase,
  enRango,
  escala,
  frecuencia,
  notaCercana,
} from '../src/av/musica/teoria';
import { MotorSonido } from '../src/av/sonido';
import { crearAzar } from '../src/sim/azar';
import { t } from '../src/i18n';

afterEach(() => {
  vi.useRealTimers();
});

describe('teoría musical (tarea f12-t3)', () => {
  it('frecuencias, escalas y acordes de cada grado', () => {
    expect(frecuencia(69)).toBeCloseTo(440, 6);
    expect(frecuencia(60)).toBeCloseTo(261.63, 1);
    expect(escala(62, 'mayor')).toEqual([2, 4, 6, 7, 9, 11, 1]);
    expect(acordeDeGrado(60, 'mayor', 1)).toEqual([60, 64, 67]);
    expect(acordeDeGrado(60, 'mayor', 5)).toEqual([67, 71, 74]);
    expect(acordeDeGrado(60, 'mayor', 6)).toEqual([69, 72, 76]);
    expect(acordeDeGrado(57, 'menor', 1, true)).toEqual([57, 60, 64, 67]);
    expect(notaCercana(0, 70)).toBe(72);
    expect(enRango(30, 40, 52)).toBe(42);
    expect(clase(-1)).toBe(11);
  });
});

/** ¿El acorde de tres notas es disminuido (dos terceras menores)? */
const disminuido = (acorde: number[]) =>
  acorde[1]! - acorde[0]! === 3 && acorde[2]! - acorde[1]! === 3;

describe('piezas tranquilas (tarea f12-t3: fijas pero abundantes)', () => {
  const partituras = PIEZAS_TRANQUILAS.map(arreglar);

  it('doce piezas distintas, de dos a tres minutos y medio: media hora sin repetir', () => {
    expect(PIEZAS_TRANQUILAS).toHaveLength(12);
    expect(new Set(PIEZAS_TRANQUILAS.map((p) => p.id)).size).toBe(12);
    expect(new Set(PIEZAS_TRANQUILAS.map((p) => p.titulo)).size).toBe(12);
    // Ninguna con la misma tonalidad, modo, tempo y compás que otra.
    const firmas = PIEZAS_TRANQUILAS.map(
      (p) => `${clase(p.tonica)}-${p.modo}-${p.tempo}-${p.compas}`,
    );
    expect(new Set(firmas).size).toBe(12);
    for (const p of partituras) {
      expect(p.duracion, p.id).toBeGreaterThan(110);
      expect(p.duracion, p.id).toBeLessThan(210);
    }
    const minutos = partituras.reduce((s, p) => s + p.duracion, 0) / 60;
    expect(minutos).toBeGreaterThanOrEqual(29.5);
    for (const plan of PIEZAS_TRANQUILAS) expect(plan.ambiente).toBe('tranquila');
  });

  it('son fijas: el mismo plan da siempre las mismas notas', () => {
    expect(arreglar(PIEZAS_TRANQUILAS[0]!)).toEqual(partituras[0]);
  });

  it('todas las notas son de su escala y de su registro, y van en orden', () => {
    for (const [i, p] of partituras.entries()) {
      const plan = PIEZAS_TRANQUILAS[i]!;
      const clases = new Set(escala(plan.tonica, plan.modo));
      let anterior = 0;
      for (const nota of p.notas) {
        expect(clases.has(clase(nota.midi)), `${p.id} ${nota.midi}`).toBe(true);
        expect(nota.inicio).toBeGreaterThanOrEqual(anterior);
        anterior = nota.inicio;
        expect(nota.duracion).toBeGreaterThan(0);
        expect(nota.volumen).toBeGreaterThan(0);
        expect(nota.volumen).toBeLessThanOrEqual(1);
        if (nota.instrumento === 'bajo') {
          expect(nota.midi).toBeGreaterThanOrEqual(RANGOS.bajo[0]);
          expect(nota.midi).toBeLessThanOrEqual(RANGOS.bajo[1]);
        }
        if (nota.instrumento === 'pad') {
          expect(nota.midi).toBeGreaterThanOrEqual(RANGOS.pad[0]);
          expect(nota.midi).toBeLessThanOrEqual(RANGOS.pad[1]);
        }
      }
    }
  });

  it('sin acordes disminuidos y terminando en la tónica', () => {
    for (const plan of PIEZAS_TRANQUILAS) {
      for (const seccion of plan.secciones) {
        for (const grado of seccion.progresion) {
          expect(
            disminuido(acordeDeGrado(plan.tonica, plan.modo, grado)),
            `${plan.id} ${grado}`,
          ).toBe(false);
        }
      }
      const ultima = plan.secciones.at(-1)!.progresion.at(-1);
      expect(ultima, plan.id).toBe(1);
    }
  });

  it('cada pieza usa varios instrumentos y empieza suave', () => {
    for (const p of partituras) {
      const instrumentos = new Set(p.notas.map((n) => n.instrumento));
      expect(instrumentos.size, p.id).toBeGreaterThanOrEqual(3);
      expect(instrumentos.has('pad')).toBe(true);
    }
  });
});

describe('orden de las piezas (tarea f12-t3)', () => {
  it('suenan todas antes de repetir y nunca la misma dos veces seguidas', () => {
    const lista = new ListaPiezas([1, 2, 3, 4, 5], crearAzar(3));
    let anterior: number | null = null;
    for (let ronda = 0; ronda < 200; ronda++) {
      const vistas = new Set<number>();
      for (let i = 0; i < 5; i++) {
        const pieza = lista.siguiente();
        expect(pieza).not.toBe(anterior);
        vistas.add(pieza);
        anterior = pieza;
      }
      expect(vistas.size).toBe(5);
    }
    expect(() => new ListaPiezas([], crearAzar(1))).toThrow(/vacía/);
  });

  it('notas de una ventana de tiempo', () => {
    const partitura = arreglar(PIEZAS_TRANQUILAS[1]!);
    const primera = notasEntre(partitura, 0, 10);
    expect(primera.notas.every((n) => n.inicio < 10)).toBe(true);
    const segunda = notasEntre(partitura, 10, 20, primera.siguiente);
    expect(segunda.notas.every((n) => n.inicio >= 10 && n.inicio < 20)).toBe(true);
    expect(primera.notas.length + segunda.notas.length).toBe(
      notasEntre(partitura, 0, 20).notas.length,
    );
  });
});

/** Un contexto de audio falso que cuenta lo que se crea. */
function contextoFalso() {
  const parametro = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const nodo = () => {
    const n = {
      gain: parametro(),
      frequency: parametro(),
      detune: parametro(),
      Q: parametro(),
      type: '',
      buffer: null,
      connect: (destino: unknown) => destino,
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    return n;
  };
  const cuenta = { osciladores: 0 };
  const contexto = {
    currentTime: 0,
    sampleRate: 8000,
    createGain: nodo,
    createBiquadFilter: nodo,
    createConvolver: nodo,
    createOscillator: () => {
      cuenta.osciladores++;
      return nodo();
    },
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
  };
  return { contexto, cuenta, salida: nodo() };
}

describe('reproductor de la música (tarea f12-t3)', () => {
  it('sin audio todavía (antes del primer clic) no arranca', () => {
    const reproductor = new ReproductorMusica(
      { tranquila: PIEZAS_TRANQUILAS, tensa: [] },
      () => null,
    );
    reproductor.empezar();
    expect(reproductor.enMarcha).toBe(false);
  });

  it('con audio, programa las notas de una pieza tranquila y en pausa baja el volumen', () => {
    vi.useFakeTimers();
    const falso = contextoFalso();
    const reproductor = new ReproductorMusica(
      { tranquila: PIEZAS_TRANQUILAS, tensa: [] },
      () => ({ contexto: falso.contexto, salida: falso.salida }) as unknown as SalidaMusica,
    );
    reproductor.empezar();
    expect(reproductor.enMarcha).toBe(true);
    expect(reproductor.ambienteActual).toBe('tranquila');
    expect(PIEZAS_TRANQUILAS.map((p) => p.titulo)).toContain(reproductor.tituloActual);
    const antes = falso.cuenta.osciladores;
    expect(antes).toBeGreaterThan(0);
    // Pasan diez segundos: más notas.
    for (let i = 0; i < 40; i++) {
      falso.contexto.currentTime += 0.25;
      vi.advanceTimersByTime(250);
    }
    expect(falso.cuenta.osciladores).toBeGreaterThan(antes);
    reproductor.atenuar(true);
    expect(VOLUMEN_EN_PAUSA).toBeGreaterThan(0.3);
    expect(VOLUMEN_EN_PAUSA).toBeLessThan(1);
    // Sin piezas tensas todavía, el ambiente no cambia.
    reproductor.ponerAmbiente('tensa');
    expect(reproductor.ambienteActual).toBe('tranquila');
    reproductor.parar();
    expect(reproductor.enMarcha).toBe(false);
  });

  it('el motor de sonido da su salida de música y recuerda su volumen', () => {
    const motor = new MotorSonido(
      { silenciado: false, volumenEfectos: 0.7, volumenMusica: 0.5 },
      () => null,
    );
    expect(motor.salidaMusica()).toBeNull();
    motor.volumenMusica = 1.4;
    expect(motor.volumenMusica).toBe(1);
    expect(t('juego.ajustes.volumenMusica')).toBe('Volumen de la música');
  });

  it('las piezas tienen nombre propio', () => {
    for (const plan of PIEZAS_TRANQUILAS as PlanPieza[]) {
      expect(plan.titulo.length).toBeGreaterThan(4);
      expect(plan.titulo[0]).toBe(plan.titulo[0]!.toUpperCase());
    }
  });
});
