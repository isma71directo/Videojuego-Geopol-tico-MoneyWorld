/**
 * Motor de sonido (tarea f4-t4, GDD 7.1): efectos de interfaz sintetizados con Web Audio, sin
 * archivos de audio. Reglas del GDD:
 *  - Empieza tras la primera interacción del jugador (un clic o una tecla).
 *  - Botón de silencio siempre a mano y volúmenes separados de música y efectos.
 *  - Ningún aviso se da solo con sonido: estos efectos acompañan a algo que ya se ve.
 */

/** Una nota o un soplo de ruido de un efecto. Tiempos en segundos; volumen de 0 a 1. */
export interface Nota {
  forma: OscillatorType | 'ruido';
  inicio: number;
  duracion: number;
  /** Frecuencia del tono (Hz); en el ruido, la del filtro. */
  frecuencia: number;
  /** Si cambia a lo largo de la nota (barrido). */
  frecuenciaFinal?: number;
  volumen: number;
}

export type Efecto = 'seleccionar' | 'deseleccionar' | 'abrirPanel' | 'boton' | 'capa';

/** Efectos de interfaz: cortos, suaves y en tonos que no cansan. */
export const EFECTOS: Record<Efecto, readonly Nota[]> = {
  // Dos notas que suben (mi y si): «elegido».
  seleccionar: [
    { forma: 'sine', inicio: 0, duracion: 0.09, frecuencia: 659.3, volumen: 0.22 },
    { forma: 'triangle', inicio: 0.06, duracion: 0.14, frecuencia: 987.8, volumen: 0.16 },
  ],
  // Las mismas notas, bajando: «quitado».
  deseleccionar: [
    { forma: 'sine', inicio: 0, duracion: 0.08, frecuencia: 880, volumen: 0.16 },
    { forma: 'sine', inicio: 0.05, duracion: 0.12, frecuencia: 587.3, volumen: 0.14 },
  ],
  // Un soplo de aire que se abre, como una hoja de papel.
  abrirPanel: [
    {
      forma: 'ruido',
      inicio: 0,
      duracion: 0.22,
      frecuencia: 700,
      frecuenciaFinal: 2600,
      volumen: 0.1,
    },
  ],
  // Cambiar la capa del mapa (tarea f6-t4): una hoja de atlas que pasa y una nota suave.
  capa: [
    {
      forma: 'ruido',
      inicio: 0,
      duracion: 0.16,
      frecuencia: 1800,
      frecuenciaFinal: 600,
      volumen: 0.06,
    },
    { forma: 'sine', inicio: 0.05, duracion: 0.2, frecuencia: 784, volumen: 0.11 },
    { forma: 'sine', inicio: 0.09, duracion: 0.19, frecuencia: 1174.7, volumen: 0.06 },
  ],
  // Un toque seco y corto.
  boton: [
    {
      forma: 'triangle',
      inicio: 0,
      duracion: 0.05,
      frecuencia: 1320,
      frecuenciaFinal: 990,
      volumen: 0.12,
    },
  ],
};

/** Lo que el motor usa de un AudioContext (para poder probarlo sin navegador). */
export type ContextoAudio = Pick<
  AudioContext,
  | 'createGain'
  | 'createOscillator'
  | 'createBiquadFilter'
  | 'createBuffer'
  | 'createBufferSource'
  | 'currentTime'
  | 'sampleRate'
  | 'destination'
  | 'state'
  | 'resume'
>;

export interface OpcionesSonido {
  silenciado: boolean;
  /** Volumen de los efectos, de 0 a 1. */
  volumenEfectos: number;
  /** Volumen de la música, de 0 a 1 (la música llegará en fases posteriores). */
  volumenMusica: number;
}

const limitar = (valor: number): number => Math.min(1, Math.max(0, valor));

export class MotorSonido {
  private contexto: ContextoAudio | null = null;
  private general: GainNode | null = null;
  private efectos: GainNode | null = null;
  private musica: GainNode | null = null;
  private ruido: AudioBuffer | null = null;
  private opciones: OpcionesSonido;

  constructor(
    opciones: OpcionesSonido,
    private readonly crearContexto: () => ContextoAudio | null = () =>
      typeof AudioContext === 'undefined' ? null : new AudioContext(),
  ) {
    this.opciones = { ...opciones, volumenEfectos: limitar(opciones.volumenEfectos) };
  }

  /** ¿Ya se ha creado el contexto de audio (tras la primera interacción)? */
  get activo(): boolean {
    return this.contexto !== null;
  }

  get silenciado(): boolean {
    return this.opciones.silenciado;
  }

  set silenciado(valor: boolean) {
    this.opciones.silenciado = valor;
    this.aplicarVolumenes();
  }

  get volumenEfectos(): number {
    return this.opciones.volumenEfectos;
  }

  set volumenEfectos(valor: number) {
    this.opciones.volumenEfectos = limitar(valor);
    this.aplicarVolumenes();
  }

  /**
   * Crea el contexto de audio. Hay que llamarlo dentro de un clic o una tecla del jugador:
   * los navegadores no dejan sonar nada antes.
   */
  activar(): void {
    if (!this.contexto) {
      const contexto = this.crearContexto();
      if (!contexto) return;
      this.contexto = contexto;
      this.general = contexto.createGain();
      this.general.connect(contexto.destination);
      this.efectos = contexto.createGain();
      this.efectos.connect(this.general);
      this.musica = contexto.createGain();
      this.musica.connect(this.general);
      this.aplicarVolumenes();
    }
    if (this.contexto.state === 'suspended') void this.contexto.resume().catch(() => undefined);
  }

  /** Reproduce un efecto (nada si el sonido no está activo o está silenciado). */
  reproducir(efecto: Efecto): void {
    const { contexto, efectos } = this;
    if (!contexto || !efectos || this.opciones.silenciado || this.opciones.volumenEfectos === 0) {
      return;
    }
    const ahora = contexto.currentTime + 0.005;
    for (const nota of EFECTOS[efecto]) this.tocar(contexto, efectos, nota, ahora);
  }

  private tocar(contexto: ContextoAudio, salida: GainNode, nota: Nota, ahora: number): void {
    const inicio = ahora + nota.inicio;
    const fin = inicio + nota.duracion;
    // Envolvente: ataque rápido y caída exponencial, sin chasquidos.
    const volumen = contexto.createGain();
    volumen.gain.setValueAtTime(0.0001, inicio);
    volumen.gain.exponentialRampToValueAtTime(
      nota.volumen,
      inicio + Math.min(0.012, nota.duracion / 4),
    );
    volumen.gain.exponentialRampToValueAtTime(0.0001, fin);
    volumen.connect(salida);

    let fuente: AudioScheduledSourceNode;
    if (nota.forma === 'ruido') {
      const ruido = contexto.createBufferSource();
      ruido.buffer = this.bufferRuido(contexto);
      const filtro = contexto.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.Q.value = 1.2;
      filtro.frequency.setValueAtTime(nota.frecuencia, inicio);
      if (nota.frecuenciaFinal)
        filtro.frequency.exponentialRampToValueAtTime(nota.frecuenciaFinal, fin);
      ruido.connect(filtro);
      filtro.connect(volumen);
      fuente = ruido;
    } else {
      const oscilador = contexto.createOscillator();
      oscilador.type = nota.forma;
      oscilador.frequency.setValueAtTime(nota.frecuencia, inicio);
      if (nota.frecuenciaFinal) {
        oscilador.frequency.exponentialRampToValueAtTime(nota.frecuenciaFinal, fin);
      }
      oscilador.connect(volumen);
      fuente = oscilador;
    }
    fuente.start(inicio);
    fuente.stop(fin + 0.02);
  }

  /** Medio segundo de ruido blanco, creado una sola vez. */
  private bufferRuido(contexto: ContextoAudio): AudioBuffer {
    if (!this.ruido) {
      const muestras = Math.floor(contexto.sampleRate * 0.5);
      this.ruido = contexto.createBuffer(1, muestras, contexto.sampleRate);
      const datos = this.ruido.getChannelData(0);
      // Ruido pseudoaleatorio fijo: suena igual cada vez.
      let semilla = 2010;
      for (let i = 0; i < muestras; i++) {
        semilla = (semilla * 1664525 + 1013904223) >>> 0;
        datos[i] = (semilla / 2 ** 32) * 2 - 1;
      }
    }
    return this.ruido;
  }

  private aplicarVolumenes(): void {
    if (!this.general || !this.efectos || !this.musica) return;
    this.general.gain.value = this.opciones.silenciado ? 0 : 1;
    this.efectos.gain.value = this.opciones.volumenEfectos;
    this.musica.gain.value = limitar(this.opciones.volumenMusica);
  }
}
