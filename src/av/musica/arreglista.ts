/**
 * Arreglista de la música del juego (tarea f12-t3, decisión del jugador: piezas fijas pero
 * abundantes). Convierte el plan de una pieza (tonalidad, modo, tempo, secciones con sus acordes
 * y sus capas) en la lista de notas que suenan: fondo de acordes, bajo, arpegios, melodía y
 * campanas. Es determinista: cada pieza tiene su semilla y suena siempre igual.
 */
import { crearAzar, type Azar } from '../../sim/azar';
import { acordeDeGrado, clase, enRango, escala, notaCercana, type Modo } from './teoria';

export type Ambiente = 'tranquila' | 'tensa';

export type Instrumento =
  'pad' | 'bajo' | 'piano' | 'cuerdas' | 'campana' | 'dron' | 'pulso' | 'golpe';

/** Capas que puede tener una sección. */
export type Capa =
  'pad' | 'bajo' | 'arpegio' | 'melodia' | 'campanas' | 'dron' | 'pulso' | 'golpes';

export interface Seccion {
  /** Grados de la escala, uno por compás. */
  progresion: number[];
  /** Cuántas veces se toca la progresión. */
  veces: number;
  capas: Capa[];
}

export interface PlanPieza {
  id: string;
  titulo: string;
  ambiente: Ambiente;
  /** Tónica (MIDI): 62 es re. */
  tonica: number;
  modo: Modo;
  /** Negras por minuto. */
  tempo: number;
  /** Tiempos por compás. */
  compas: 3 | 4;
  /** Acordes con séptima (más suaves y abiertos). */
  septimas?: boolean;
  /** Instrumento de la melodía. */
  melodia: 'piano' | 'cuerdas' | 'campana';
  /** Figura del arpegio: corcheas o negras. */
  arpegio: 'corcheas' | 'negras';
  secciones: Seccion[];
  semilla: number;
}

export interface NotaMusical {
  instrumento: Instrumento;
  /** Segundos desde el principio de la pieza. */
  inicio: number;
  duracion: number;
  midi: number;
  /** 0 a 1, antes del volumen general de la música. */
  volumen: number;
}

export interface Partitura {
  id: string;
  titulo: string;
  ambiente: Ambiente;
  /** Duración total, con la cola del último acorde. */
  duracion: number;
  /** Notas ordenadas por su inicio. */
  notas: NotaMusical[];
}

/** Alturas de cada parte (MIDI). */
export const RANGOS = {
  bajo: [33, 47],
  pad: [52, 69],
  arpegio: [60, 79],
  melodia: [67, 86],
  campanas: [84, 98],
} as const;

/** Segundos que suena el último acorde después del último compás. */
const COLA = 4;

/** Figuras rítmicas de la melodía (en tiempos) para un compás de 4 y de 3. */
const RITMOS: Record<3 | 4, number[][]> = {
  4: [
    [2, 1, 1],
    [1, 1, 2],
    [3, 1],
    [1.5, 0.5, 2],
    [1, 0.5, 0.5, 2],
    [2, 2],
    [1, 1, 1, 1],
  ],
  3: [[2, 1], [1, 1, 1], [1.5, 0.5, 1], [3]],
};

/** Escoge las notas del acorde más cercanas a las del acorde anterior (voces que se mueven poco). */
function voces(acorde: number[], anterior: number[] | null): number[] {
  const [minimo, maximo] = RANGOS.pad;
  const clases = acorde.map(clase);
  if (!anterior) return acorde.map((n) => enRango(n, minimo, maximo)).sort((a, b) => a - b);
  const centro = anterior.reduce((s, n) => s + n, 0) / anterior.length;
  return clases.map((c) => enRango(notaCercana(c, centro), minimo, maximo)).sort((a, b) => a - b);
}

/** Motivo de la melodía de una pieza: dos compases de ritmo y un contorno de pasos de escala. */
function motivo(azar: Azar, compas: 3 | 4): { ritmos: number[][]; pasos: number[][] } {
  const ritmos = [azar.elegir(RITMOS[compas]), azar.elegir(RITMOS[compas])];
  const pasos = ritmos.map((r) =>
    r.map((_, i) => (i === 0 ? 0 : azar.elegir([-2, -1, -1, 1, 1, 2, 3]))),
  );
  return { ritmos, pasos };
}

/** Grado de escala (índice) de una nota dentro de la escala, o el más cercano por debajo. */
function moverPorEscala(nota: number, pasos: number, notasEscala: number[]): number {
  // Lista de alturas de la escala en todo el registro, para andar por ella.
  const indice = notasEscala.findIndex((n) => n >= nota);
  const desde = indice < 0 ? notasEscala.length - 1 : indice;
  const destino = Math.min(notasEscala.length - 1, Math.max(0, desde + pasos));
  return notasEscala[destino]!;
}

export function arreglar(plan: PlanPieza): Partitura {
  const azar = crearAzar(plan.semilla);
  const tiempo = 60 / plan.tempo;
  const compas = plan.compas * tiempo;
  const clasesEscala = new Set(escala(plan.tonica, plan.modo));
  const notasEscala: number[] = [];
  for (let n = 24; n <= 108; n++) if (clasesEscala.has(clase(n))) notasEscala.push(n);
  const { ritmos, pasos } = motivo(azar, plan.compas);
  const notas: NotaMusical[] = [];
  /** Un poco de vida: volumen y momento ligeramente distintos en cada nota. */
  const humano = (volumen: number): number => volumen * (0.9 + 0.2 * azar.siguiente());
  const empuje = (): number => (azar.siguiente() - 0.5) * 0.02;

  let numeroCompas = 0;
  let vocesAnteriores: number[] | null = null;
  let notaMelodia = enRango(plan.tonica + 12, RANGOS.melodia[0], RANGOS.melodia[1]);
  const totalCompases = plan.secciones.reduce((s, sec) => s + sec.progresion.length * sec.veces, 0);

  for (const seccion of plan.secciones) {
    for (let vez = 0; vez < seccion.veces; vez++) {
      for (let i = 0; i < seccion.progresion.length; i++) {
        const grado = seccion.progresion[i]!;
        const inicio = numeroCompas * compas;
        const ultimo = numeroCompas === totalCompases - 1;
        const acorde = acordeDeGrado(plan.tonica, plan.modo, grado, plan.septimas);
        const clasesAcorde = acorde.map(clase);
        const capas = new Set(seccion.capas);
        const largo = ultimo ? compas + COLA : compas;

        if (capas.has('pad')) {
          const v = voces(acorde, vocesAnteriores);
          vocesAnteriores = v;
          for (const midi of v) {
            notas.push({ instrumento: 'pad', inicio, duracion: largo, midi, volumen: 0.5 });
          }
        }
        if (capas.has('bajo')) {
          const raiz = enRango(acorde[0]!, RANGOS.bajo[0], RANGOS.bajo[1]);
          const mitad = plan.compas === 4 ? 2 * tiempo : compas;
          notas.push({
            instrumento: 'bajo',
            inicio,
            duracion: ultimo ? largo : mitad,
            midi: raiz,
            volumen: humano(0.6),
          });
          if (!ultimo && plan.compas === 4) {
            // La quinta en el tercer tiempo, o la fundamental otra vez.
            const quinta = enRango(acorde[2]!, RANGOS.bajo[0], RANGOS.bajo[1]);
            notas.push({
              instrumento: 'bajo',
              inicio: inicio + mitad,
              duracion: mitad,
              midi: azar.probabilidad(0.5) ? quinta : raiz,
              volumen: humano(0.45),
            });
          }
        }
        if (capas.has('arpegio') && !ultimo) {
          const base = enRango(acorde[0]!, RANGOS.arpegio[0], RANGOS.arpegio[0] + 11);
          const subida = [...acorde.map((n) => base + (n - acorde[0]!)), base + 12];
          const figura = plan.arpegio === 'corcheas' ? tiempo / 2 : tiempo;
          const cuantas = Math.round(compas / figura);
          const orden = [...subida, ...subida.slice(1, -1).reverse()];
          for (let k = 0; k < cuantas; k++) {
            notas.push({
              instrumento: 'piano',
              inicio: inicio + k * figura + empuje(),
              duracion: figura * 1.6,
              midi: enRango(orden[k % orden.length]!, RANGOS.arpegio[0], RANGOS.arpegio[1]),
              volumen: humano(k === 0 ? 0.55 : 0.4),
            });
          }
        }
        if (capas.has('melodia')) {
          if (ultimo) {
            notaMelodia = enRango(
              notaCercana(clase(plan.tonica), notaMelodia),
              RANGOS.melodia[0],
              RANGOS.melodia[1],
            );
            notas.push({
              instrumento: plan.melodia,
              inicio,
              duracion: largo,
              midi: notaMelodia,
              volumen: humano(0.55),
            });
          } else {
            // El motivo, compás a compás; en la segunda vuelta, contestado (contorno al revés).
            const cual = numeroCompas % 2;
            const ritmo = ritmos[cual]!;
            const contorno = pasos[cual]!.map((p) => (vez % 2 === 1 ? -p : p));
            let momento = inicio;
            // El final de cada frase de cuatro compases descansa en una nota larga.
            const finDeFrase = numeroCompas % 4 === 3;
            const figuras = finDeFrase ? [plan.compas] : ritmo;
            for (let k = 0; k < figuras.length; k++) {
              if (k === 0) {
                // En el tiempo fuerte, una nota del acorde.
                const objetivo = clasesAcorde.reduce(
                  (mejor, c) => {
                    const n = notaCercana(c, notaMelodia);
                    return Math.abs(n - notaMelodia) < Math.abs(mejor - notaMelodia) ? n : mejor;
                  },
                  notaCercana(clasesAcorde[0]!, notaMelodia),
                );
                notaMelodia = objetivo;
              } else {
                notaMelodia = moverPorEscala(notaMelodia, contorno[k] ?? 1, notasEscala);
              }
              notaMelodia = enRango(notaMelodia, RANGOS.melodia[0], RANGOS.melodia[1]);
              const duracion = figuras[k]! * tiempo;
              notas.push({
                instrumento: plan.melodia,
                inicio: momento + (k === 0 ? 0 : empuje()),
                duracion: duracion * 0.95,
                midi: notaMelodia,
                volumen: humano(k === 0 ? 0.6 : 0.5),
              });
              momento += duracion;
            }
          }
        }
        if (capas.has('campanas') && numeroCompas % 2 === 0) {
          const midi = enRango(acorde[azar.entero(0, 2)]!, RANGOS.campanas[0], RANGOS.campanas[1]);
          notas.push({
            instrumento: 'campana',
            inicio: inicio + (azar.probabilidad(0.5) ? 0 : tiempo),
            duracion: 3,
            midi,
            volumen: humano(0.35),
          });
        }
        if (capas.has('dron')) {
          const raiz = enRango(acorde[0]!, 26, 38);
          notas.push({ instrumento: 'dron', inicio, duracion: largo, midi: raiz, volumen: 0.5 });
        }
        if (capas.has('pulso') && !ultimo) {
          const figura = tiempo / 2;
          const cuantas = Math.round(compas / figura);
          for (let k = 0; k < cuantas; k++) {
            notas.push({
              instrumento: 'pulso',
              inicio: inicio + k * figura,
              duracion: figura * 0.6,
              midi: enRango(acorde[k % 4 === 3 ? 2 : 0]!, 45, 57),
              volumen: humano(k % 2 === 0 ? 0.5 : 0.32),
            });
          }
        }
        if (capas.has('golpes') && numeroCompas % 2 === 0) {
          notas.push({
            instrumento: 'golpe',
            inicio,
            duracion: 1.5,
            midi: enRango(acorde[0]!, 31, 43),
            volumen: humano(0.6),
          });
        }
        numeroCompas++;
      }
    }
  }

  notas.sort((a, b) => a.inicio - b.inicio);
  for (const nota of notas) nota.inicio = Math.max(0, nota.inicio);
  return {
    id: plan.id,
    titulo: plan.titulo,
    ambiente: plan.ambiente,
    duracion: totalCompases * compas + COLA,
    notas,
  };
}
