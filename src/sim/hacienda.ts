/**
 * Hacienda (Fase 19; decisiones del jugador): el presupuesto se decide en dinero y no cambia hasta
 * que se decide otro.
 *
 * - Es anual, con cambios a mitad de año que valen desde el mes siguiente. Si llega enero sin
 *   presupuesto nuevo, se prorroga el anterior (preparado para cuando exista el parlamento).
 * - Se deciden el gasto de cada ministerio por partidas, la subida de las pensiones de cada enero
 *   (por defecto, el IPC) y la prestación de cada parado.
 * - Los gobiernos de la IA aprueban el suyo cada enero, según su situación.
 *
 * El jugador manda su presupuesto con la orden «presupuesto» del motor; este sistema lo aplica en
 * el paso del mes siguiente. Va después del presupuesto y del mercado de la deuda. Motor puro.
 *
 * Con el ajuste f19-a1 (decisiones del jugador), cada ministerio decide el suyo con cambios
 * concretos (orden «cambiosPresupuesto»), y cada uno vale cuando le toca: una subida anual, el 1 de
 * enero; una extraordinaria, el mes siguiente; los puestos nuevos, cuando acaba la oposición (y
 * sacan gente del paro); los despidos, el mes siguiente (vuelven al paro, con indemnización).
 */
import config from './config/presupuesto.json';
import { ALERTAS_GRAVES } from './alertas';
import { empezarSalida, UMBRAL_CIERRE, type MercadoDeuda } from './deuda';
import { horaAbsoluta, momentoDe } from './reloj';
import { programar } from './sucesos';
import { crecimientoPotencial, pibNominal, type EconomiaPais, type NivelRenta } from './economia';
import type { Sistema } from './motor';
import {
  MINISTERIOS,
  PARTIDAS,
  emitirDeuda,
  recomprarDeuda,
  repartoValido,
  saldo,
  sueldoMedio,
  totalGastos,
  type CambioPresupuesto,
  type Ministerio,
  type Partida,
  type PresupuestoPais,
} from './presupuesto';

/** Lo que se decide de un presupuesto (todo en dólares al año, salvo la subida de las pensiones). */
export interface PresupuestoDecidido {
  ministerios: Record<Ministerio, Record<Partida, number>>;
  /** Subida de las pensiones cada enero (tanto por uno); null: el IPC. */
  revalorizacion: number | null;
  /** Prestación media al año de cada parado. */
  prestacionParado: number;
}

const h = config.hacienda;

/** Límites de la subida de las pensiones que se puede decidir (tanto por uno). */
export const LIMITES_REVALORIZACION = [-0.2, 0.2] as const;

/** El presupuesto en vigor como decisión (para empezar a cambiarlo). */
export function presupuestoEnVigor(presupuesto: PresupuestoPais): PresupuestoDecidido {
  return {
    ministerios: structuredClone(presupuesto.ministerios),
    revalorizacion: presupuesto.revalorizacion,
    prestacionParado: presupuesto.prestacionParado,
  };
}

/** Un número de dinero válido (finito y no negativo), o el que había. */
const dinero = (valor: unknown, siNo: number): number =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : siNo;

/**
 * Aprueba un presupuesto (del jugador o de la IA) en `anio`. Lo que no sea válido se queda como
 * estaba; la subida de las pensiones, entre sus límites.
 */
export function aprobarPresupuesto(
  presupuesto: PresupuestoPais,
  decidido: PresupuestoDecidido,
  anio: number,
): void {
  for (const m of MINISTERIOS) {
    for (const p of PARTIDAS) {
      presupuesto.ministerios[m][p] = dinero(
        decidido.ministerios?.[m]?.[p],
        presupuesto.ministerios[m][p],
      );
    }
  }
  const subida = decidido.revalorizacion;
  presupuesto.revalorizacion =
    typeof subida === 'number' && Number.isFinite(subida)
      ? Math.min(LIMITES_REVALORIZACION[1], Math.max(LIMITES_REVALORIZACION[0], subida))
      : null;
  presupuesto.prestacionParado = dinero(decidido.prestacionParado, presupuesto.prestacionParado);
  presupuesto.aprobado = { anio, prorrogado: false };
}

/**
 * El presupuesto que aprueba la IA cada enero, según su situación:
 * - con la prima cerca del cierre de los mercados, recorta y congela las pensiones;
 * - con un déficit alto, congela el gasto;
 * - con un déficit moderado, lo sube con la inflación;
 * - con margen, lo sube con la economía (inflación y crecimiento: mantiene su peso);
 * - con superávit, con la economía y algo más.
 */
export function presupuestoDeLaIa(
  presupuesto: PresupuestoPais,
  economia: EconomiaPais,
  mercado: MercadoDeuda | null,
): PresupuestoDecidido {
  const pib = pibNominal(economia);
  const deficit = pib > 0 ? -saldo(presupuesto) / pib : 0;
  const inflacion = Math.max(0, economia.inflacion);
  const conLaEconomia = (1 + inflacion) * (1 + Math.max(0, crecimientoPotencial(economia)));
  let factor = conLaEconomia;
  let revalorizacion: number | null = null;
  if (mercado && mercado.prima >= h.ia.cercaDelCierre * UMBRAL_CIERRE) {
    factor = 1 - h.ia.recorte;
    revalorizacion = 0;
  } else if (deficit >= h.ia.deficitAlto) {
    factor = 1;
  } else if (deficit >= h.ia.deficitMargen) {
    factor = 1 + inflacion;
  } else if (deficit < 0) {
    factor = conLaEconomia + h.ia.extraSuperavit;
  }
  const decidido = presupuestoEnVigor(presupuesto);
  for (const m of MINISTERIOS) {
    for (const p of PARTIDAS) decidido.ministerios[m][p] *= factor;
  }
  decidido.revalorizacion = revalorizacion;
  // La prestación por parado no baja: si sube el gasto, sube con él.
  decidido.prestacionParado *= Math.max(1, factor);
  return decidido;
}

/** Cada enero, las pensiones suben lo decidido; por defecto, el IPC (y no bajan por ley). */
export function revalorizarPensiones(presupuesto: PresupuestoPais, economia: EconomiaPais): void {
  const subida = presupuesto.revalorizacion ?? Math.max(0, economia.inflacion);
  presupuesto.transversales.pensiones *= 1 + subida;
}

/** El día 1 del mes que sigue a `fecha` («AAAA-MM-DD»). */
export function diaUnoSiguiente(fecha: string): string {
  const anio = Number(fecha.slice(0, 4));
  const mes = Number(fecha.slice(5, 7));
  return mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
}

/** `dia` (el 1 de un mes) más `meses` meses. */
function sumarMesesA(dia: string, meses: number): string {
  const total = Number(dia.slice(0, 4)) * 12 + Number(dia.slice(5, 7)) - 1 + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

/**
 * El día en que empieza a valer un cambio cuyo primer mes posible es `base` (el 1 del mes
 * siguiente a la orden): una subida anual, el siguiente 1 de enero; los puestos nuevos, cuando
 * acaba la oposición; lo demás, ese mismo día.
 */
export function desdeCuando(cambio: CambioPresupuesto, base: string, nivel: NivelRenta): string {
  if ((cambio.tipo === 'partida' || cambio.tipo === 'sueldos') && cambio.cuando === 'anio') {
    return base.slice(5, 7) === '01' ? base : `${Number(base.slice(0, 4)) + 1}-01-01`;
  }
  if (cambio.tipo === 'puestos' && cambio.cantidad > 0) {
    return sumarMesesA(base, h.mesesOposicion[nivel]);
  }
  return base;
}

/** El día en que valdrá un cambio que se ordena hoy (`fecha`), para enseñarlo. */
export function fechaDeAplicacion(
  cambio: CambioPresupuesto,
  fecha: string,
  nivel: NivelRenta,
): string {
  return desdeCuando(cambio, diaUnoSiguiente(fecha), nivel);
}

/** Los ministerios a los que toca un cambio. */
const ministeriosDe = (ministerio: Ministerio | 'todos'): readonly Ministerio[] =>
  ministerio === 'todos' ? MINISTERIOS : [ministerio];

/** Un número entre sus límites, o null si no es un número. */
const cifra = (valor: unknown, [minimo, maximo]: readonly [number, number]): number | null =>
  typeof valor === 'number' && Number.isFinite(valor)
    ? Math.min(maximo, Math.max(minimo, valor))
    : null;

/**
 * Aplica un cambio que ya vale (ajuste f19-a1). Los puestos nuevos sacan del paro a los parados
 * que los ocupan; los despidos vuelven al paro y su indemnización sale de la tesorería.
 */
export function aplicarCambio(
  presupuesto: PresupuestoPais,
  economia: EconomiaPais,
  estado: { tesoreria: number } | null,
  cambio: CambioPresupuesto,
): void {
  if (cambio.tipo === 'partida') {
    const factor = cifra(cambio.factor, [0, h.limiteFactor]);
    if (factor === null) return;
    const partidas = cambio.partida === 'todas' ? PARTIDAS : [cambio.partida];
    for (const m of ministeriosDe(cambio.ministerio)) {
      for (const p of partidas) presupuesto.ministerios[m][p] *= factor;
    }
    return;
  }
  if (cambio.tipo === 'sueldos') {
    const subida = cifra(cambio.subida, [-h.limiteSubidaSueldos, h.limiteSubidaSueldos]);
    if (subida === null) return;
    for (const m of ministeriosDe(cambio.ministerio)) {
      presupuesto.ministerios[m].personal *= 1 + subida;
    }
    return;
  }
  if (cambio.tipo === 'puestos') {
    const m = cambio.ministerio;
    const empleados = presupuesto.empleados[m] ?? 0;
    const cantidad = cifra(Math.round(cambio.cantidad), [-empleados, Math.max(empleados, 1e6)]);
    if (cantidad === null || cantidad === 0 || !(presupuesto.activos > 0)) return;
    const sueldo = sueldoMedio(presupuesto, m);
    presupuesto.empleados[m] = empleados + cantidad;
    presupuesto.ministerios[m].personal = Math.max(
      0,
      presupuesto.ministerios[m].personal + cantidad * sueldo,
    );
    // Contratados: salen del paro los parados que ocupan los puestos. Despedidos: vuelven todos.
    const alParo = (cantidad > 0 ? -h.parteParados * cantidad : -cantidad) / presupuesto.activos;
    economia.paro = Math.max(0, economia.paro + alParo);
    economia.paroEstructural = Math.max(0, economia.paroEstructural + alParo);
    if (cantidad < 0 && estado) estado.tesoreria -= -cantidad * sueldo * h.indemnizacion;
    return;
  }
  if (cambio.tipo === 'pensiones') {
    presupuesto.revalorizacion =
      cambio.revalorizacion === null ? null : cifra(cambio.revalorizacion, LIMITES_REVALORIZACION);
    return;
  }
  if (cambio.tipo === 'prestacion') {
    const prestacion = cifra(cambio.prestacionParado, [0, Number.MAX_VALUE]);
    if (prestacion !== null) presupuesto.prestacionParado = prestacion;
    return;
  }
  // El Tesoro (tarea f20-t1): emitir solo si los mercados prestan; recomprar con la tesorería.
  const importe = cifra((cambio as { importe?: unknown }).importe, [0, Number.MAX_VALUE]);
  if (cambio.tipo === 'emision') {
    if (importe && estado && presupuesto.tesoro.abierto) {
      const reparto = cambio.reparto ? repartoValido(cambio.reparto) : presupuesto.tesoro.reparto;
      emitirDeuda(presupuesto, estado, importe, reparto);
    }
    return;
  }
  if (cambio.tipo === 'recompra') {
    if (importe && estado) recomprarDeuda(presupuesto, estado, importe);
    return;
  }
  presupuesto.tesoro.automatico = cambio.automatico !== false;
  if (cambio.reparto) presupuesto.tesoro.reparto = repartoValido(cambio.reparto);
}

/** Lo que ha pasado en el Tesoro este mes (para avisar al jugador). */
export interface AvisoTesoro {
  /** Se ha acabado la tesorería y el país ha dejado de pagar. */
  impago: boolean;
  /** Con el Tesoro automático apagado, queda menos de un mes de gasto. */
  tesoreriaBaja: boolean;
}

/**
 * Un mes de Hacienda de un país (el día 1, con su `fecha`): aplica lo que haya decidido el
 * jugador (el presupuesto entero o los cambios de sus ministerios, cada uno cuando le toca) y, en
 * enero, el presupuesto del año (la IA aprueba el suyo; el del jugador se prorroga
 * si no ha aprobado otro este año) y la subida de las pensiones. En una crisis de deuda, la IA no
 * aprueba presupuesto (manda el rescate o el impago) y las pensiones se congelan.
 */
export function haciendaDelMes(
  presupuesto: PresupuestoPais,
  economia: EconomiaPais,
  mercado: MercadoDeuda | null,
  opciones: {
    esJugador: boolean;
    fecha: string;
    decidido?: PresupuestoDecidido;
    /** Los cambios que ha ordenado el jugador el mes pasado (ajuste f19-a1). */
    cambios?: readonly CambioPresupuesto[];
    /** Su tesorería (de ella salen las indemnizaciones). */
    estado?: { tesoreria: number };
  },
): AvisoTesoro {
  const aviso: AvisoTesoro = { impago: false, tesoreriaBaja: false };
  const { fecha } = opciones;
  const anio = Number(fecha.slice(0, 4));
  if (opciones.decidido) aprobarPresupuesto(presupuesto, opciones.decidido, anio);
  // Los cambios nuevos, con su día; y los que ya valen, aplicados (por orden).
  for (const cambio of opciones.cambios ?? []) {
    presupuesto.pendientes.push({
      cambio: structuredClone(cambio),
      desde: desdeCuando(cambio, fecha, economia.nivelRenta),
    });
  }
  const ahora = presupuesto.pendientes.filter((p) => p.desde <= fecha);
  presupuesto.pendientes = presupuesto.pendientes.filter((p) => p.desde > fecha);
  for (const { cambio } of ahora) {
    aplicarCambio(presupuesto, economia, opciones.estado ?? null, cambio);
  }
  // Si la tesorería se ha acabado (con el Tesoro apagado, o sin poder emitir), el país deja de
  // pagar (tarea f20-t1). Con poco dinero y el Tesoro apagado, un aviso.
  const estado = opciones.estado;
  if (estado && mercado && !mercado.programa) {
    if (estado.tesoreria < 0) {
      empezarSalida('impago', mercado, economia, presupuesto);
      aviso.impago = true;
    } else {
      const baja =
        !presupuesto.tesoro.automatico && estado.tesoreria < totalGastos(presupuesto) / 12;
      aviso.tesoreriaBaja = baja && !presupuesto.tesoro.bajo;
      presupuesto.tesoro.bajo = baja;
    }
  }
  if (fecha.slice(5, 7) !== '01') return aviso;
  const enCrisis = Boolean(mercado?.programa);
  // Las subidas anuales que valen hoy son el presupuesto del año.
  const anual = ahora.some(
    ({ cambio }) =>
      (cambio.tipo === 'partida' || cambio.tipo === 'sueldos') && cambio.cuando === 'anio',
  );
  if (!opciones.esJugador && !enCrisis) {
    aprobarPresupuesto(presupuesto, presupuestoDeLaIa(presupuesto, economia, mercado), anio);
  } else if (anual) {
    presupuesto.aprobado = { anio, prorrogado: false };
  } else if (presupuesto.aprobado.anio < anio) {
    presupuesto.aprobado.prorrogado = true;
  }
  if (!enCrisis) revalorizarPensiones(presupuesto, economia);
  return aviso;
}

/** La fecha del paso mensual de una economía que lleva `meses` meses desde enero de 2010. */
export function fechaDelMes(meses: number): string {
  const anio = 2010 + Math.floor(meses / 12);
  const mes = (meses % 12) + 1;
  return `${anio}-${String(mes).padStart(2, '0')}-01`;
}

/**
 * Sistema de Hacienda (Fase 19): cada mes, después del presupuesto y del mercado de la deuda, en
 * todos los países. El presupuesto que ha mandado el jugador se aplica a su país y se quita.
 */
export const sistemaHacienda: Sistema = (pasos, partida) => {
  for (const paso of pasos) {
    if (paso.ritmo !== 'mensual') continue;
    const decidido = partida.presupuestoDecidido;
    if (decidido) delete partida.presupuestoDecidido;
    const cambios = partida.cambiosPresupuesto;
    if (cambios) delete partida.cambiosPresupuesto;
    for (const [id, estado] of Object.entries(partida.paises)) {
      const { presupuesto, economia } = estado;
      if (!presupuesto || !economia) continue;
      const esJugador = id === partida.jugador.paisId;
      const aviso = haciendaDelMes(presupuesto, economia, estado.mercado ?? null, {
        esJugador,
        fecha: paso.fecha,
        decidido: esJugador ? decidido : undefined,
        cambios: esJugador ? cambios : undefined,
        estado,
      });
      // Al jugador se le avisa (tarea f20-t1): sin tesorería (grave) o con poca.
      if (!esJugador || !(aviso.impago || aviso.tesoreriaBaja)) continue;
      const { fecha, hora } = momentoDe(horaAbsoluta(partida) + 1);
      const tipo = aviso.impago ? 'sinTesoreria' : 'tesoreriaBaja';
      partida.agenda = programar(partida.agenda, {
        id: `t${partida.fecha}-${tipo}`,
        titulo: '',
        texto: '',
        fecha,
        hora,
        importante: ALERTAS_GRAVES.has(tipo),
        origen: 'economia',
        alerta: { tipo, valor: estado.tesoreria },
      });
    }
  }
};
