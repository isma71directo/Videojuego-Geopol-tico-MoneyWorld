/**
 * Motor de la partida (tarea f12-t1): guarda la partida y el reloj, y atiende las órdenes de la
 * pantalla. Es puro y síncrono: no sabe de hilos, de mensajes ni de temporizadores (de eso se
 * ocupan bucle.ts y el Web Worker de trabajador.ts), así que se prueba sin navegador.
 *
 * - `atender(orden)`: empezar una partida, cambiar la velocidad o terminar. Devuelve los mensajes
 *   para la pantalla (el estado nuevo).
 * - `avanzar(ms)`: han pasado `ms` milisegundos reales; avanza las horas que tocan (con el tope de
 *   cada fotograma del reloj: si un paso tarda en calcularse, el tiempo del juego va más despacio
 *   en lugar de dar saltos) y da los pasos de la simulación a los sistemas.
 * - Guardar (tarea f14-t2): con la orden «instantanea» manda una copia de la partida, y al empezar
 *   cada mes (el día 1 a las 00:00 en punto) manda otra para el guardado automático.
 */
import { crearAzar, type Azar } from './azar';
import {
  crearEfecto,
  revisarEfectos,
  sumarMeses,
  type DefinicionEfecto,
  type Efecto,
} from './efectos';
import { avanzarPartida, type Partida } from './partida';
import {
  horaAbsoluta,
  horasQueTocan,
  msPorHora,
  VELOCIDADES,
  type Paso,
  type Velocidad,
} from './reloj';
import { horasHastaSiguiente, programar, type Suceso } from './sucesos';

/** Órdenes que la pantalla manda al motor. */
export type OrdenMotor =
  | {
      tipo: 'empezar';
      partida: Partida;
      /**
       * Solo para pruebas en desarrollo: milisegundos de cálculo inútil en cada paso diario, para
       * comprobar que la pantalla no se bloquea aunque el motor vaya cargado.
       */
      cargaPruebaMs?: number;
      /** Pausa automática ante sucesos importantes (tarea f13-t3); activada por defecto. */
      pausaAutomatica?: boolean;
    }
  | { tipo: 'velocidad'; velocidad: Velocidad }
  /** Añade un efecto (tarea f13-t1): lo usarán leyes, tecnologías, eventos y edificios. */
  | { tipo: 'efecto'; definicion: DefinicionEfecto }
  /** Programa un suceso en la agenda (tarea f13-t3). */
  | { tipo: 'programar'; suceso: Omit<Suceso, 'id'> }
  /** Cambia la pausa automática a mitad de partida. */
  | { tipo: 'ajustes'; pausaAutomatica: boolean }
  /** Pide una copia de la partida para guardarla (tarea f14-t2); `peticion` vuelve con ella. */
  | { tipo: 'instantanea'; peticion: number }
  /** Lo que decide el jugador ante un suceso (p. ej. una crisis de deuda, tarea f18-t3). */
  | { tipo: 'decidir'; clave: string; opcion: string }
  | { tipo: 'terminar' };

/** El estado de la partida que necesita la pantalla. */
export interface EstadoMotor {
  tipo: 'estado';
  fecha: string;
  hora: number;
  /** Parte de la hora en curso que ya ha pasado (0 a 1), para mover el reloj sin saltos. */
  fraccion: number;
  velocidad: Velocidad;
  /** Efectos en curso o por empezar (tarea f13-t1). */
  efectos: Efecto[];
}

/** Ha llegado un suceso; `pausado` si el motor ha parado el tiempo por él (tarea f13-t3). */
export interface SucesoMotor {
  tipo: 'suceso';
  suceso: Suceso;
  pausado: boolean;
}

/**
 * Una copia de la partida (tarea f14-t2): la pedida con «instantanea» o la de cada mes, el día 1
 * a las 00:00, para el guardado automático.
 */
export interface PartidaMotor {
  tipo: 'partida';
  partida: Partida;
  motivo: 'peticion' | 'mes';
  peticion?: number;
}

/** Lo que el motor cuenta a la pantalla. */
export type MensajeMotor = EstadoMotor | SucesoMotor | PartidaMotor;

/** Horas que faltan para que empiece el mes siguiente (el día 1 a las 00:00). */
export function horasHastaElMesSiguiente(partida: Pick<Partida, 'fecha' | 'hora'>): number {
  const siguiente = sumarMeses(`${partida.fecha.slice(0, 7)}-01`, 1);
  return horaAbsoluta({ fecha: siguiente, hora: 0 }) - horaAbsoluta(partida);
}

/**
 * Un sistema de la simulación: recibe los pasos de cada avance y el azar de la partida (tarea
 * f12-t2), y cambia la partida.
 */
export type Sistema = (pasos: readonly Paso[], partida: Partida, azar: Azar) => void;

export interface Motor {
  readonly partida: Partida | null;
  readonly velocidad: Velocidad;
  atender(orden: OrdenMotor): MensajeMotor[];
  avanzar(ms: number): MensajeMotor[];
}

export interface OpcionesMotor {
  /** Sistemas que atienden los pasos (llegan con las próximas fases). */
  sistemas?: Sistema[];
  /** Reloj para la carga de prueba (por defecto, Date.now). */
  ahora?: () => number;
}

/** Tope de la carga de prueba por paso diario (milisegundos). */
export const CARGA_PRUEBA_MAXIMA = 500;

export function crearMotor(opciones: OpcionesMotor = {}): Motor {
  const ahora = opciones.ahora ?? (() => Date.now());
  let partida: Partida | null = null;
  let velocidad: Velocidad = 0;
  let fraccion = 0;
  let cargaPruebaMs = 0;
  let pausaAutomatica = true;
  let contadorSucesos = 0;
  /**
   * Azar de la partida (tarea f12-t2): se siembra con la semilla de la partida, distinta en cada
   * una. Al cargar una partida guardada (Fase 14) se sembrará con una semilla nueva.
   */
  let azar: Azar | null = null;

  /** Para dar a cada efecto un identificador propio. */
  let contadorEfectos = 0;

  const estado = (): EstadoMotor[] =>
    partida
      ? [
          {
            tipo: 'estado',
            fecha: partida.fecha,
            hora: partida.hora,
            fraccion,
            velocidad,
            efectos: partida.efectos,
          },
        ]
      : [];

  /** Avanza la partida unas horas y atiende los pasos de la simulación. */
  const avanzarTramo = (horas: number): void => {
    if (!partida || horas <= 0) return;
    const { partida: nueva, pasos } = avanzarPartida(partida, horas);
    partida = nueva;
    // Cada día, los efectos que han terminado se quitan (tarea f13-t1).
    for (const paso of pasos) {
      if (paso.ritmo !== 'diario') continue;
      const { quedan } = revisarEfectos(partida.efectos, paso.fecha);
      if (quedan.length !== partida.efectos.length) partida = { ...partida, efectos: quedan };
    }
    for (const sistema of opciones.sistemas ?? []) sistema(pasos, partida, azar!);
    if (cargaPruebaMs > 0) {
      for (const paso of pasos) if (paso.ritmo === 'diario') ocupar(cargaPruebaMs);
    }
  };

  /** Cálculo inútil que ocupa el hilo (solo con la carga de prueba). */
  const ocupar = (ms: number): void => {
    const fin = ahora() + ms;
    while (ahora() < fin) {
      // Nada: solo pasa el tiempo.
    }
  };

  return {
    get partida() {
      return partida;
    },
    get velocidad() {
      return velocidad;
    },
    atender(orden) {
      if (orden.tipo === 'empezar') {
        partida = orden.partida;
        azar = crearAzar(orden.partida.semilla);
        velocidad = 0;
        fraccion = 0;
        cargaPruebaMs = Math.min(CARGA_PRUEBA_MAXIMA, Math.max(0, orden.cargaPruebaMs ?? 0));
        pausaAutomatica = orden.pausaAutomatica ?? true;
        return estado();
      }
      if (orden.tipo === 'ajustes') {
        pausaAutomatica = orden.pausaAutomatica;
        return [];
      }
      if (orden.tipo === 'instantanea') {
        if (!partida) return [];
        return [
          {
            tipo: 'partida',
            partida: structuredClone(partida),
            motivo: 'peticion',
            peticion: orden.peticion,
          },
        ];
      }
      if (orden.tipo === 'decidir') {
        if (!partida) return [];
        // Los sistemas la leen en el siguiente paso (y la quitan al usarla).
        partida = {
          ...partida,
          decisiones: { ...partida.decisiones, [orden.clave]: orden.opcion },
        };
        return [];
      }
      if (orden.tipo === 'programar') {
        if (!partida) return [];
        const suceso: Suceso = { ...orden.suceso, id: `s${++contadorSucesos}` };
        // Uno que ya ha pasado no se programa.
        if (horaAbsoluta(suceso) <= horaAbsoluta(partida)) return [];
        partida = { ...partida, agenda: programar(partida.agenda, suceso) };
        return [];
      }
      if (orden.tipo === 'velocidad') {
        if (!VELOCIDADES.includes(orden.velocidad)) return [];
        velocidad = orden.velocidad;
        return estado();
      }
      if (orden.tipo === 'efecto') {
        if (!partida) return [];
        const efecto = crearEfecto(orden.definicion, partida.fecha, `e${++contadorEfectos}`);
        partida = { ...partida, efectos: [...partida.efectos, efecto] };
        return estado();
      }
      partida = null;
      azar = null;
      velocidad = 0;
      return [];
    },
    avanzar(ms) {
      if (!partida || velocidad === 0) return [];
      const porHora = msPorHora(velocidad);
      const { horas, restoMs } = horasQueTocan(velocidad, ms, fraccion * porHora);
      fraccion = restoMs / porHora;
      if (horas === 0) return [];
      const mensajes: MensajeMotor[] = [];
      let quedan = horas;
      while (quedan > 0 && partida) {
        // Hasta el siguiente suceso, si llega antes de acabar estas horas (tarea f13-t3), o hasta
        // que empiece el mes, para guardarlo justo a las 00:00 del día 1 (tarea f14-t2).
        const hastaSuceso = horasHastaSiguiente(partida.agenda, horaAbsoluta(partida));
        const hastaMes = horasHastaElMesSiguiente(partida);
        let tramo = hastaSuceso !== null && hastaSuceso <= quedan ? hastaSuceso : quedan;
        if (hastaMes <= tramo) tramo = hastaMes;
        avanzarTramo(tramo);
        quedan -= tramo;
        if (tramo === hastaMes) {
          mensajes.push({ tipo: 'partida', partida: structuredClone(partida), motivo: 'mes' });
        }
        if (tramo === hastaSuceso) {
          const [suceso, ...resto] = partida.agenda;
          partida = { ...partida, agenda: resto };
          // Los que piden una decisión del jugador paran siempre (tarea f18-t3).
          const pausado = (suceso!.importante && pausaAutomatica) || Boolean(suceso!.decision);
          if (pausado) {
            // Se para justo a la hora del suceso: lo que sobra de este avance no cuenta.
            velocidad = 0;
            fraccion = 0;
            quedan = 0;
          }
          mensajes.push(...estado(), { tipo: 'suceso', suceso: suceso!, pausado });
        }
      }
      if (mensajes.length === 0 || mensajes.at(-1)!.tipo !== 'estado') mensajes.push(...estado());
      return mensajes;
    },
  };
}
