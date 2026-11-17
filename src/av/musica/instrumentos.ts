/**
 * Instrumentos de la música (tarea f12-t3): sintetizados con Web Audio, sin archivos de audio
 * (GDD 7.1). Cada nota se crea, suena y se apaga sola; las envolventes son suaves para que no
 * haya chasquidos.
 */
import type { NotaMusical } from './arreglista';
import { frecuencia } from './teoria';

/** Volumen de cada instrumento (para que la mezcla quede equilibrada). */
const NIVEL: Record<NotaMusical['instrumento'], number> = {
  pad: 0.045,
  bajo: 0.16,
  piano: 0.07,
  cuerdas: 0.07,
  campana: 0.05,
  dron: 0.09,
  pulso: 0.05,
  golpe: 0.22,
};

/** Un oscilador con su forma, frecuencia y desafinación (en cents). */
function oscilador(
  contexto: BaseAudioContext,
  tipo: OscillatorType,
  hz: number,
  desafinar = 0,
): OscillatorNode {
  const osc = contexto.createOscillator();
  osc.type = tipo;
  osc.frequency.value = hz;
  osc.detune.value = desafinar;
  return osc;
}

/** Envolvente: sube en `ataque`, se mantiene y se apaga en `caida` tras `duracion`. */
function envolvente(
  contexto: BaseAudioContext,
  inicio: number,
  duracion: number,
  volumen: number,
  ataque: number,
  caida: number,
): GainNode {
  const ganancia = contexto.createGain();
  ganancia.gain.setValueAtTime(0, inicio);
  ganancia.gain.linearRampToValueAtTime(volumen, inicio + ataque);
  ganancia.gain.setValueAtTime(volumen, inicio + Math.max(ataque, duracion));
  ganancia.gain.setTargetAtTime(0, inicio + Math.max(ataque, duracion), caida / 3);
  return ganancia;
}

/** Envolvente de golpe (piano, campana): ataque instantáneo y caída natural. */
function golpeado(
  contexto: BaseAudioContext,
  inicio: number,
  volumen: number,
  caida: number,
): GainNode {
  const ganancia = contexto.createGain();
  ganancia.gain.setValueAtTime(0, inicio);
  ganancia.gain.linearRampToValueAtTime(volumen, inicio + 0.006);
  ganancia.gain.setTargetAtTime(0, inicio + 0.006, caida / 4);
  return ganancia;
}

/** Hace sonar una nota en `salida`, empezando en `inicio` (tiempo del contexto). */
export function tocar(
  contexto: BaseAudioContext,
  salida: AudioNode,
  nota: NotaMusical,
  inicio: number,
): void {
  const hz = frecuencia(nota.midi);
  const volumen = nota.volumen * NIVEL[nota.instrumento];
  const fin = inicio + nota.duracion;
  const fuentes: OscillatorNode[] = [];
  let parada = fin + 0.5;

  switch (nota.instrumento) {
    case 'pad': {
      // Dos dientes de sierra un poco desafinados, filtrados: un colchón cálido.
      const filtro = contexto.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 1100;
      filtro.Q.value = 0.5;
      const env = envolvente(contexto, inicio, nota.duracion, volumen, 1.4, 2.2);
      filtro.connect(env).connect(salida);
      fuentes.push(oscilador(contexto, 'sawtooth', hz, -7), oscilador(contexto, 'sawtooth', hz, 7));
      for (const f of fuentes) f.connect(filtro);
      parada = fin + 2.5;
      break;
    }
    case 'bajo': {
      const filtro = contexto.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 500;
      const env = envolvente(contexto, inicio, nota.duracion * 0.9, volumen, 0.04, 0.5);
      filtro.connect(env).connect(salida);
      fuentes.push(oscilador(contexto, 'triangle', hz), oscilador(contexto, 'sine', hz * 2));
      for (const f of fuentes) f.connect(filtro);
      parada = fin + 0.6;
      break;
    }
    case 'piano': {
      // Fundamental y dos armónicos que se apagan antes: un piano eléctrico suave.
      const caida = Math.min(3, 0.8 + nota.duracion);
      const env = golpeado(contexto, inicio, volumen, caida);
      env.connect(salida);
      const armonicos: [number, number][] = [
        [1, 1],
        [2, 0.3],
        [3, 0.12],
      ];
      for (const [multiplo, peso] of armonicos) {
        const osc = oscilador(contexto, 'sine', hz * multiplo);
        const g = contexto.createGain();
        g.gain.value = peso;
        osc.connect(g).connect(env);
        fuentes.push(osc);
      }
      parada = inicio + caida + 0.2;
      break;
    }
    case 'cuerdas': {
      // Triángulo y sierra filtrados, con un vibrato lento.
      const filtro = contexto.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 2200;
      const env = envolvente(contexto, inicio, nota.duracion, volumen, 0.3, 0.7);
      filtro.connect(env).connect(salida);
      const vibrato = oscilador(contexto, 'sine', 5.2);
      const profundidad = contexto.createGain();
      profundidad.gain.value = 6;
      vibrato.connect(profundidad);
      for (const tipo of ['triangle', 'sawtooth'] as const) {
        const osc = oscilador(contexto, tipo, hz);
        profundidad.connect(osc.detune);
        const g = contexto.createGain();
        g.gain.value = tipo === 'triangle' ? 1 : 0.25;
        osc.connect(g).connect(filtro);
        fuentes.push(osc);
      }
      fuentes.push(vibrato);
      parada = fin + 0.8;
      break;
    }
    case 'campana': {
      // Parciales que no son armónicos: suena a campana o a celesta.
      const env = golpeado(contexto, inicio, volumen, 3.5);
      env.connect(salida);
      for (const [multiplo, peso] of [
        [1, 1],
        [2.76, 0.35],
        [5.4, 0.12],
      ] as const) {
        const osc = oscilador(contexto, 'sine', hz * multiplo);
        const g = contexto.createGain();
        g.gain.value = peso;
        osc.connect(g).connect(env);
        fuentes.push(osc);
      }
      parada = inicio + 3.8;
      break;
    }
    case 'dron': {
      // Nota grave sostenida que respira: el filtro se abre y se cierra despacio.
      const filtro = contexto.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 320;
      filtro.Q.value = 2;
      const respiracion = oscilador(contexto, 'sine', 0.12);
      const amplitud = contexto.createGain();
      amplitud.gain.value = 180;
      respiracion.connect(amplitud).connect(filtro.frequency);
      const env = envolvente(contexto, inicio, nota.duracion, volumen, 2, 2.5);
      filtro.connect(env).connect(salida);
      fuentes.push(
        oscilador(contexto, 'sawtooth', hz, -5),
        oscilador(contexto, 'sawtooth', hz * 1.5, 4),
        oscilador(contexto, 'sine', hz / 2),
      );
      for (const f of fuentes) f.connect(filtro);
      fuentes.push(respiracion);
      parada = fin + 2.8;
      break;
    }
    case 'pulso': {
      const filtro = contexto.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 900;
      filtro.Q.value = 4;
      const env = golpeado(contexto, inicio, volumen, 0.35);
      filtro.connect(env).connect(salida);
      fuentes.push(oscilador(contexto, 'square', hz));
      fuentes[0]!.connect(filtro);
      parada = inicio + 0.5;
      break;
    }
    case 'golpe': {
      // Timbal: un seno grave que baja de tono al sonar.
      const env = golpeado(contexto, inicio, volumen, 1.6);
      env.connect(salida);
      const osc = oscilador(contexto, 'sine', hz * 1.5);
      osc.frequency.setValueAtTime(hz * 1.5, inicio);
      osc.frequency.exponentialRampToValueAtTime(hz, inicio + 0.25);
      osc.connect(env);
      fuentes.push(osc);
      parada = inicio + 1.8;
      break;
    }
  }
  for (const fuente of fuentes) {
    fuente.start(inicio);
    fuente.stop(parada);
  }
}

/** Respuesta de una sala (ruido que se apaga) para la reverberación, creada con código. */
export function crearReverberacion(contexto: BaseAudioContext, segundos = 2.8): ConvolverNode {
  const muestras = Math.floor(contexto.sampleRate * segundos);
  const impulso = contexto.createBuffer(2, muestras, contexto.sampleRate);
  for (let canal = 0; canal < 2; canal++) {
    const datos = impulso.getChannelData(canal);
    let semilla = 2010 + canal * 7;
    for (let i = 0; i < muestras; i++) {
      semilla = (semilla * 1664525 + 1013904223) >>> 0;
      const ruido = (semilla / 2 ** 32) * 2 - 1;
      datos[i] = ruido * Math.exp((-3 * i) / muestras);
    }
  }
  const convolver = contexto.createConvolver();
  convolver.buffer = impulso;
  return convolver;
}
