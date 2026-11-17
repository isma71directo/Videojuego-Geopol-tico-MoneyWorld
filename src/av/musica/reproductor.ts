/**
 * Reproductor de la música (tareas f12-t3 y f12-t4, decisiones del jugador): piezas fijas que se
 * reparten sin repetirse, en el menú y en la partida, con su propio volumen.
 *
 * - Programa las notas con un poco de adelanto sobre el reloj del audio (así no se nota si la
 *   pantalla va cargada) y entre pieza y pieza deja unos segundos de silencio.
 * - Ambientes: «tranquila» y «tensa» (la tensa sonará con las crisis, guerras y elecciones de las
 *   próximas fases); al cambiar, la pieza actual se apaga con un fundido y empieza una del otro.
 * - En pausa la música baja un poco.
 */
import { crearAzar, semillaNueva } from '../../sim/azar';
import { arreglar, type Ambiente, type Partitura, type PlanPieza } from './arreglista';
import { crearReverberacion, tocar } from './instrumentos';
import { ListaPiezas } from './lista';

/** Segundos de adelanto con que se programan las notas. */
export const ADELANTO = 1.5;
/** Cada cuánto se programan más notas (milisegundos). */
const INTERVALO_MS = 250;
/** Silencio entre pieza y pieza (segundos). */
export const SILENCIO_ENTRE_PIEZAS = 5;
/** Volumen en pausa (respecto al normal). */
export const VOLUMEN_EN_PAUSA = 0.55;
/** Duración del fundido al cambiar de ambiente (segundos). */
export const FUNDIDO = 3;

/** Notas de una partitura que empiezan en [desde, hasta) (segundos desde su comienzo). */
export function notasEntre(partitura: Partitura, desde: number, hasta: number, indice = 0) {
  const notas = partitura.notas;
  let i = indice;
  while (i < notas.length && notas[i]!.inicio < desde) i++;
  const inicio = i;
  while (i < notas.length && notas[i]!.inicio < hasta) i++;
  return { notas: notas.slice(inicio, i), siguiente: i };
}

/** Lo que el reproductor necesita del motor de sonido. */
export interface SalidaMusica {
  contexto: AudioContext;
  salida: AudioNode;
}

interface PiezaSonando {
  partitura: Partitura;
  /** Tiempo del contexto en que empieza. */
  comienzo: number;
  /** Primera nota aún sin programar. */
  indice: number;
  /** Fundido propio (para apagarla al cambiar de ambiente). */
  ganancia: GainNode;
}

export class ReproductorMusica {
  private listas: Record<Ambiente, ListaPiezas<PlanPieza> | null>;
  private cache = new Map<string, Partitura>();
  private ambiente: Ambiente = 'tranquila';
  private sonando: PiezaSonando | null = null;
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private mezcla: GainNode | null = null;
  private atenuada = false;

  constructor(
    piezas: Record<Ambiente, readonly PlanPieza[]>,
    private readonly obtenerSalida: () => SalidaMusica | null,
  ) {
    const azar = crearAzar(semillaNueva());
    this.listas = {
      tranquila: piezas.tranquila.length ? new ListaPiezas(piezas.tranquila, azar) : null,
      tensa: piezas.tensa.length ? new ListaPiezas(piezas.tensa, azar) : null,
    };
  }

  get enMarcha(): boolean {
    return this.temporizador !== null;
  }

  get ambienteActual(): Ambiente {
    return this.ambiente;
  }

  /** Título de la pieza que suena (o null). */
  get tituloActual(): string | null {
    return this.sonando?.partitura.titulo ?? null;
  }

  /** Empieza a sonar (tras la primera interacción del jugador, cuando ya hay audio). */
  empezar(): void {
    if (this.temporizador !== null) return;
    if (!this.prepararMezcla()) return;
    this.programar();
    this.temporizador = setInterval(() => this.programar(), INTERVALO_MS);
  }

  /** Para la música en el acto (sin fundido). */
  parar(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
    this.temporizador = null;
    this.sonando?.ganancia.disconnect();
    this.sonando = null;
  }

  /** Cambia de ambiente: la pieza actual se apaga con un fundido y sigue una del nuevo. */
  ponerAmbiente(ambiente: Ambiente): void {
    if (ambiente === this.ambiente || !this.listas[ambiente]) return;
    this.ambiente = ambiente;
    const salida = this.obtenerSalida();
    if (this.sonando && salida) {
      const ahora = salida.contexto.currentTime;
      this.apagar(this.sonando, ahora, FUNDIDO);
      // La nueva entra mientras la otra se apaga.
      this.sonando = this.nuevaPieza(salida, ahora + FUNDIDO * 0.6);
    }
  }

  /** Toca ya una pieza concreta (la galería); después sigue la lista de su ambiente. */
  reproducirPieza(plan: PlanPieza): void {
    this.empezar();
    const salida = this.obtenerSalida();
    if (!salida || !this.mezcla) return;
    this.ambiente = plan.ambiente;
    const ahora = salida.contexto.currentTime;
    if (this.sonando) this.apagar(this.sonando, ahora, 1.2);
    const ganancia = salida.contexto.createGain();
    ganancia.connect(this.mezcla);
    this.sonando = { partitura: this.partitura(plan), comienzo: ahora + 0.4, indice: 0, ganancia };
    this.programar();
  }

  /** Apaga una pieza con un fundido de `segundos` y la desconecta después. */
  private apagar(pieza: PiezaSonando, ahora: number, segundos: number): void {
    pieza.ganancia.gain.cancelScheduledValues(ahora);
    pieza.ganancia.gain.setValueAtTime(pieza.ganancia.gain.value, ahora);
    pieza.ganancia.gain.linearRampToValueAtTime(0, ahora + segundos);
    setTimeout(() => pieza.ganancia.disconnect(), (segundos + 4) * 1000);
  }

  /** En pausa, la música baja un poco. */
  atenuar(atenuada: boolean): void {
    this.atenuada = atenuada;
    const salida = this.obtenerSalida();
    if (!salida || !this.mezcla) return;
    const ahora = salida.contexto.currentTime;
    this.mezcla.gain.cancelScheduledValues(ahora);
    this.mezcla.gain.setValueAtTime(this.mezcla.gain.value, ahora);
    this.mezcla.gain.linearRampToValueAtTime(atenuada ? VOLUMEN_EN_PAUSA : 1, ahora + 0.6);
  }

  /** Partitura de una pieza (se arregla una sola vez). */
  partitura(plan: PlanPieza): Partitura {
    let partitura = this.cache.get(plan.id);
    if (!partitura) {
      partitura = arreglar(plan);
      this.cache.set(plan.id, partitura);
    }
    return partitura;
  }

  private prepararMezcla(): boolean {
    if (this.mezcla) return true;
    const salida = this.obtenerSalida();
    if (!salida) return false;
    const { contexto } = salida;
    // Mezcla (para la pausa) → seco + reverberación → salida de la música.
    this.mezcla = contexto.createGain();
    this.mezcla.gain.value = this.atenuada ? VOLUMEN_EN_PAUSA : 1;
    const seco = contexto.createGain();
    seco.gain.value = 0.85;
    const humedo = contexto.createGain();
    humedo.gain.value = 0.35;
    const reverberacion = crearReverberacion(contexto);
    this.mezcla.connect(seco).connect(salida.salida);
    this.mezcla.connect(reverberacion).connect(humedo).connect(salida.salida);
    return true;
  }

  private nuevaPieza(salida: SalidaMusica, comienzo: number): PiezaSonando | null {
    const lista = this.listas[this.ambiente];
    if (!lista || !this.mezcla) return null;
    const ganancia = salida.contexto.createGain();
    ganancia.connect(this.mezcla);
    return { partitura: this.partitura(lista.siguiente()), comienzo, indice: 0, ganancia };
  }

  /** Programa las notas que empiezan en los próximos segundos. */
  private programar(): void {
    const salida = this.obtenerSalida();
    if (!salida || !this.mezcla) return;
    const ahora = salida.contexto.currentTime;
    if (!this.sonando) this.sonando = this.nuevaPieza(salida, ahora + 0.3);
    const pieza = this.sonando;
    if (!pieza) return;
    const hasta = ahora + ADELANTO - pieza.comienzo;
    const { notas, siguiente } = notasEntre(pieza.partitura, -Infinity, hasta, pieza.indice);
    for (const nota of notas) {
      tocar(salida.contexto, pieza.ganancia, nota, Math.max(ahora, pieza.comienzo + nota.inicio));
    }
    pieza.indice = siguiente;
    // Al acabar, unos segundos de silencio y la siguiente.
    const fin = pieza.comienzo + pieza.partitura.duracion;
    if (pieza.indice >= pieza.partitura.notas.length && ahora > fin - ADELANTO) {
      this.sonando = this.nuevaPieza(salida, fin + SILENCIO_ENTRE_PIEZAS);
    }
  }
}
