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

export type Efecto =
  | 'seleccionar'
  | 'deseleccionar'
  | 'abrirPanel'
  | 'boton'
  | 'capa'
  | 'abrirVentana'
  | 'cerrar'
  | 'pestana'
  | 'menu'
  | 'resaltar'
  | 'comenzar'
  | 'pausa'
  | 'seguir'
  | 'velocidad'
  | 'aviso'
  | 'guardado'
  | 'alertaRecesion'
  | 'alertaParo'
  | 'alertaInflacion'
  | 'alertaInflacionGrave'
  | 'alertaDeflacion'
  | 'alertaCrisisDeuda'
  | 'alertaRatingBaja'
  | 'alertaRatingSube';

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
  // Navegación (tarea f7-t4). Abrir una ventana: un tono que sube con un soplo breve.
  abrirVentana: [
    {
      forma: 'ruido',
      inicio: 0,
      duracion: 0.12,
      frecuencia: 1200,
      frecuenciaFinal: 3000,
      volumen: 0.05,
    },
    {
      forma: 'sine',
      inicio: 0,
      duracion: 0.12,
      frecuencia: 440,
      frecuenciaFinal: 660,
      volumen: 0.12,
    },
    { forma: 'triangle', inicio: 0.06, duracion: 0.14, frecuencia: 987.8, volumen: 0.06 },
  ],
  // Cerrar una ventana o un panel: lo mismo al revés, más corto y más bajo.
  cerrar: [
    {
      forma: 'ruido',
      inicio: 0,
      duracion: 0.13,
      frecuencia: 2400,
      frecuenciaFinal: 700,
      volumen: 0.05,
    },
    {
      forma: 'sine',
      inicio: 0.01,
      duracion: 0.11,
      frecuencia: 660,
      frecuenciaFinal: 440,
      volumen: 0.09,
    },
  ],
  // Cambiar de pestaña: un clic suave, más bajo que el de un botón (se oye a menudo).
  pestana: [
    {
      forma: 'triangle',
      inicio: 0,
      duracion: 0.04,
      frecuencia: 1568,
      frecuenciaFinal: 1318.5,
      volumen: 0.07,
    },
    { forma: 'sine', inicio: 0.012, duracion: 0.05, frecuencia: 2637, volumen: 0.025 },
  ],
  // Abrir el menú contextual: dos golpecitos rápidos que suben.
  menu: [
    { forma: 'triangle', inicio: 0, duracion: 0.035, frecuencia: 880, volumen: 0.08 },
    { forma: 'triangle', inicio: 0.035, duracion: 0.05, frecuencia: 1174.7, volumen: 0.07 },
  ],
  // Llegar a un resultado del buscador (tarea f9-t4): tres notas que suben y brillan, a la vez
  // que el contorno late en el mapa.
  resaltar: [
    { forma: 'sine', inicio: 0, duracion: 0.1, frecuencia: 784, volumen: 0.12 },
    { forma: 'sine', inicio: 0.07, duracion: 0.11, frecuencia: 1046.5, volumen: 0.11 },
    { forma: 'triangle', inicio: 0.14, duracion: 0.15, frecuencia: 1568, volumen: 0.08 },
  ],
  // Fanfarria corta al empezar una partida (tarea f10-t4): sol, do, mi y un acorde de sol.
  comenzar: [
    { forma: 'triangle', inicio: 0, duracion: 0.1, frecuencia: 392, volumen: 0.14 },
    { forma: 'triangle', inicio: 0.06, duracion: 0.1, frecuencia: 523.25, volumen: 0.14 },
    { forma: 'triangle', inicio: 0.12, duracion: 0.1, frecuencia: 659.3, volumen: 0.13 },
    { forma: 'sine', inicio: 0.17, duracion: 0.12, frecuencia: 784, volumen: 0.13 },
    { forma: 'sine', inicio: 0.17, duracion: 0.12, frecuencia: 392, volumen: 0.07 },
  ],
  // Reloj de la partida (tarea f11-t4). Pausa: dos notas que bajan, como un freno suave.
  pausa: [
    { forma: 'triangle', inicio: 0, duracion: 0.09, frecuencia: 587.3, volumen: 0.15 },
    { forma: 'triangle', inicio: 0.08, duracion: 0.14, frecuencia: 392, volumen: 0.14 },
  ],
  // Seguir: las mismas dos notas al revés, que suben.
  seguir: [
    { forma: 'triangle', inicio: 0, duracion: 0.09, frecuencia: 392, volumen: 0.14 },
    { forma: 'triangle', inicio: 0.08, duracion: 0.14, frecuencia: 587.3, volumen: 0.15 },
  ],
  // Cambio de velocidad: un «tic» corto con un soplo de ruido, como un engranaje.
  velocidad: [
    { forma: 'square', inicio: 0, duracion: 0.035, frecuencia: 1318.5, volumen: 0.06 },
    { forma: 'ruido', inicio: 0, duracion: 0.05, frecuencia: 3200, volumen: 0.05 },
    { forma: 'sine', inicio: 0.03, duracion: 0.08, frecuencia: 880, volumen: 0.12 },
  ],
  // Aviso de la pausa automática (tarea f13-t4): una campanada de dos notas que bajan (do y sol),
  // más aguda que la pausa y con un armónico suave, para que el jugador mire la ventana del centro.
  aviso: [
    { forma: 'sine', inicio: 0, duracion: 0.13, frecuencia: 1046.5, volumen: 0.16 },
    { forma: 'sine', inicio: 0, duracion: 0.1, frecuencia: 2093, volumen: 0.04 },
    { forma: 'triangle', inicio: 0.11, duracion: 0.19, frecuencia: 784, volumen: 0.15 },
    { forma: 'sine', inicio: 0.11, duracion: 0.19, frecuencia: 392, volumen: 0.06 },
  ],
  // Partida guardada (tarea f14-t4): el «clic» de un cierre y dos notas que suben (re y sol),
  // breves y suaves, porque se oye cada vez que el jugador guarda.
  guardado: [
    { forma: 'ruido', inicio: 0, duracion: 0.035, frecuencia: 2400, volumen: 0.05 },
    { forma: 'triangle', inicio: 0.01, duracion: 0.07, frecuencia: 1174.7, volumen: 0.1 },
    { forma: 'sine', inicio: 0.07, duracion: 0.17, frecuencia: 1568, volumen: 0.12 },
  ],
  // Alertas económicas (tarea f16-t4), cada una con su sonido. Recesión: tres notas graves que
  // bajan despacio (la, fa y re), como una caída.
  alertaRecesion: [
    { forma: 'triangle', inicio: 0, duracion: 0.22, frecuencia: 440, volumen: 0.15 },
    { forma: 'triangle', inicio: 0.2, duracion: 0.22, frecuencia: 349.2, volumen: 0.15 },
    { forma: 'triangle', inicio: 0.4, duracion: 0.42, frecuencia: 293.7, volumen: 0.16 },
    { forma: 'sine', inicio: 0.4, duracion: 0.42, frecuencia: 146.8, volumen: 0.08 },
  ],
  // Paro que se dispara: dos golpes sordos y graves, como una puerta que se cierra.
  alertaParo: [
    { forma: 'ruido', inicio: 0, duracion: 0.06, frecuencia: 500, volumen: 0.08 },
    { forma: 'sine', inicio: 0, duracion: 0.18, frecuencia: 196, volumen: 0.18 },
    { forma: 'ruido', inicio: 0.22, duracion: 0.06, frecuencia: 450, volumen: 0.08 },
    { forma: 'sine', inicio: 0.22, duracion: 0.26, frecuencia: 164.8, volumen: 0.18 },
  ],
  // Inflación alta: tres notas cortas que suben (do, mi y sol), como precios que suben.
  alertaInflacion: [
    { forma: 'square', inicio: 0, duracion: 0.07, frecuencia: 523.3, volumen: 0.06 },
    { forma: 'square', inicio: 0.08, duracion: 0.07, frecuencia: 659.3, volumen: 0.06 },
    { forma: 'triangle', inicio: 0.16, duracion: 0.2, frecuencia: 784, volumen: 0.13 },
  ],
  // Inflación desbocada: la misma subida, más rápida y aguda, que acaba en un intervalo tenso.
  alertaInflacionGrave: [
    { forma: 'square', inicio: 0, duracion: 0.05, frecuencia: 659.3, volumen: 0.06 },
    { forma: 'square', inicio: 0.05, duracion: 0.05, frecuencia: 784, volumen: 0.06 },
    { forma: 'square', inicio: 0.1, duracion: 0.05, frecuencia: 987.8, volumen: 0.06 },
    { forma: 'triangle', inicio: 0.15, duracion: 0.3, frecuencia: 1046.5, volumen: 0.12 },
    { forma: 'triangle', inicio: 0.15, duracion: 0.3, frecuencia: 1480, volumen: 0.07 },
  ],
  // Crisis de deuda (tarea f18-t3): un golpe seco y dos campanadas graves y disonantes (la contra
  // si bemol, y sol sostenido contra la), como una alarma que suena en el banco.
  alertaCrisisDeuda: [
    { forma: 'ruido', inicio: 0, duracion: 0.05, frecuencia: 300, volumen: 0.08 },
    { forma: 'triangle', inicio: 0, duracion: 0.3, frecuencia: 220, volumen: 0.16 },
    { forma: 'triangle', inicio: 0, duracion: 0.3, frecuencia: 233.1, volumen: 0.08 },
    { forma: 'ruido', inicio: 0.32, duracion: 0.05, frecuencia: 260, volumen: 0.08 },
    { forma: 'triangle', inicio: 0.32, duracion: 0.5, frecuencia: 207.7, volumen: 0.16 },
    { forma: 'triangle', inicio: 0.32, duracion: 0.5, frecuencia: 220, volumen: 0.07 },
    { forma: 'sine', inicio: 0.32, duracion: 0.5, frecuencia: 103.8, volumen: 0.08 },
  ],
  // Rating rebajado (tarea f18-t4): un sello que golpea y dos notas que bajan un tono (mi y re).
  alertaRatingBaja: [
    { forma: 'ruido', inicio: 0, duracion: 0.04, frecuencia: 900, volumen: 0.07 },
    { forma: 'triangle', inicio: 0.02, duracion: 0.16, frecuencia: 659.3, volumen: 0.12 },
    { forma: 'triangle', inicio: 0.18, duracion: 0.32, frecuencia: 587.3, volumen: 0.12 },
    { forma: 'sine', inicio: 0.18, duracion: 0.32, frecuencia: 293.7, volumen: 0.06 },
  ],
  // Rating mejorado: el mismo sello y dos notas claras que suben una cuarta (sol y do).
  alertaRatingSube: [
    { forma: 'ruido', inicio: 0, duracion: 0.04, frecuencia: 1200, volumen: 0.06 },
    { forma: 'sine', inicio: 0.02, duracion: 0.14, frecuencia: 784, volumen: 0.12 },
    { forma: 'sine', inicio: 0.16, duracion: 0.3, frecuencia: 1046.5, volumen: 0.12 },
    { forma: 'triangle', inicio: 0.16, duracion: 0.3, frecuencia: 523.3, volumen: 0.05 },
  ],
  // Deflación: un tono suave que se desinfla, bajando una octava.
  alertaDeflacion: [
    {
      forma: 'sine',
      inicio: 0,
      duracion: 0.45,
      frecuencia: 784,
      frecuenciaFinal: 392,
      volumen: 0.15,
    },
    {
      forma: 'sine',
      inicio: 0.05,
      duracion: 0.4,
      frecuencia: 392,
      frecuenciaFinal: 196,
      volumen: 0.06,
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
  /** Volumen de la música, de 0 a 1 (tarea f12-t3). */
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

  get volumenMusica(): number {
    return this.opciones.volumenMusica;
  }

  set volumenMusica(valor: number) {
    this.opciones.volumenMusica = limitar(valor);
    this.aplicarVolumenes();
  }

  /** Contexto y salida de la música (tarea f12-t3), o null si el sonido aún no está activo. */
  salidaMusica(): { contexto: AudioContext; salida: GainNode } | null {
    if (!this.contexto || !this.musica) return null;
    return { contexto: this.contexto as AudioContext, salida: this.musica };
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
