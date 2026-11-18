/**
 * Negociar con los acreedores y pedir ayuda (tarea f20-t3; decisiones del jugador: por rondas de
 * oferta y contraoferta; ayuda del FMI, del fondo de la zona euro y de países con superávit).
 *
 * - **Negociar:** se propone más plazo, menos interés o una quita; los acreedores aceptan, rechazan
 *   o contraofertan según el riesgo de impago que ven (la prima). Un acuerdo vale desde el mes
 *   siguiente y sube la prima de después; una negociación rota, también. La IA negocia más plazo
 *   cuando la prima se acerca al cierre.
 * - **Ayuda:** la línea preventiva del FMI, el fondo de rescate del euro o un préstamo de un país
 *   con superávit, cada uno con su dinero, su tipo, su plazo y sus condiciones. Mientras llega,
 *   respalda al país (baja la prima); si no se cumple el objetivo de déficit, se retira.
 *
 * Motor puro, sin interfaz; parámetros en src/sim/config/deuda.json.
 */
import config from './config/deuda.json';
import { RATINGS, UMBRAL_CIERRE, type MercadoDeuda } from './deuda';
import { pibNominal, type EconomiaPais } from './economia';
import type { Sistema } from './motor';
import type { EstadoPais } from './partida';
import { emitirA, saldo, vidaMediaRestante, type PresupuestoPais } from './presupuesto';

const a = config.acreedores;
const ay = config.ayudas;
const ia = config.iaAcreedores;
const ZONA_EURO: Readonly<Record<string, string>> = config.zonaEuro;

// ── Negociar con los acreedores ──

/** Lo que se propone: más plazo (años), menos interés (puntos) o una quita (tanto por uno). */
export type Propuesta =
  | { tipo: 'plazo'; anios: number }
  | { tipo: 'interes'; puntos: number }
  | { tipo: 'quita'; parte: number };
export type TipoPropuesta = Propuesta['tipo'];
export const TIPOS_PROPUESTA: readonly TipoPropuesta[] = ['plazo', 'interes', 'quita'];
/** Hasta dónde se puede proponer de cada cosa. */
export const LIMITES_PROPUESTA: Readonly<Record<TipoPropuesta, readonly [number, number]>> = {
  plazo: a.limites.plazo as [number, number],
  interes: a.limites.interes as [number, number],
  quita: a.limites.quita as [number, number],
};
export const RONDAS = a.rondas;

export type RespuestaAcreedores = 'acepta' | 'contraoferta' | 'rechaza';

/** Una negociación con los acreedores (la última: también sirve para no repetirla enseguida). */
export interface NegociacionDeuda {
  /** El día en que empezó. */
  desde: string;
  /** Rondas hechas (como mucho RONDAS). */
  ronda: number;
  propuesta: Propuesta | null;
  respuesta: RespuestaAcreedores | null;
  contraoferta: Propuesta | null;
  /** Abierta mientras se negocia; luego, con acuerdo o rota. */
  estado: 'abierta' | 'acuerdo' | 'ruptura';
  /** Lo acordado (vale desde el mes siguiente). */
  acuerdo: Propuesta | null;
}

export type AccionNegociacion =
  { tipo: 'proponer'; propuesta: Propuesta } | { tipo: 'aceptar' } | { tipo: 'abandonar' };

/** El día 1 del mes que sigue a `fecha`. */
function diaUnoSiguiente(fecha: string): string {
  const anio = Number(fecha.slice(0, 4));
  const mes = Number(fecha.slice(5, 7));
  return mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
}

/** Meses entre dos fechas «AAAA-MM-DD» (por meses del calendario). */
function mesesEntre(desde: string, hasta: string): number {
  const mes = (f: string) => Number(f.slice(0, 4)) * 12 + Number(f.slice(5, 7));
  return mes(hasta) - mes(desde);
}

/** El valor de una propuesta (sus años, sus puntos o su parte). */
export const valorDe = (p: Propuesta): number =>
  p.tipo === 'plazo' ? p.anios : p.tipo === 'interes' ? p.puntos : p.parte;

/** Una propuesta del tipo dado con ese valor. */
export const propuestaDe = (tipo: TipoPropuesta, valor: number): Propuesta =>
  tipo === 'plazo'
    ? { tipo, anios: valor }
    : tipo === 'interes'
      ? { tipo, puntos: valor }
      : { tipo, parte: valor };

/** La propuesta dentro de sus límites (o null si no es una propuesta). */
export function propuestaValida(propuesta: unknown): Propuesta | null {
  const p = propuesta as Partial<Record<string, unknown>> | null;
  const tipo = p?.tipo as TipoPropuesta;
  if (!TIPOS_PROPUESTA.includes(tipo)) return null;
  const valor = valorDe(p as Propuesta);
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
  const [min, max] = LIMITES_PROPUESTA[tipo];
  return propuestaDe(tipo, Math.min(max, Math.max(min, valor)));
}

/**
 * Lo que aguantan perder los acreedores (en quita equivalente): nada si no ven riesgo de impago y
 * hasta «toleranciaMaxima» con la prima en el umbral del cierre.
 */
export function toleranciaAcreedores(mercado: Pick<MercadoDeuda, 'prima'>): number {
  const riesgo = (mercado.prima - a.primaSinRiesgo) / (UMBRAL_CIERRE - a.primaSinRiesgo);
  return a.toleranciaMaxima * Math.min(1, Math.max(0, riesgo));
}

/** La parte de la deuda que vence en los meses que se pueden retrasar. */
function parteAlargable(presupuesto: Pick<PresupuestoPais, 'vencimientos' | 'deuda'>): number {
  if (!(presupuesto.deuda > 0)) return 0;
  const cerca = presupuesto.vencimientos.slice(0, a.mesesAlargables).reduce((s, v) => s + v, 0);
  return Math.min(1, cerca / presupuesto.deuda);
}

/** Lo que pierden los acreedores con una propuesta (en quita equivalente). */
export function costeParaAcreedores(
  propuesta: Propuesta,
  presupuesto: Pick<PresupuestoPais, 'vencimientos' | 'deuda' | 'tipoInteres'>,
  mercado: Pick<MercadoDeuda, 'tipoMercado'>,
): number {
  if (propuesta.tipo === 'quita') return propuesta.parte;
  if (propuesta.tipo === 'interes') {
    return (propuesta.puntos / 100) * vidaMediaRestante(presupuesto);
  }
  const deMas = Math.max(a.costeMinimoPlazo, mercado.tipoMercado / 100 - presupuesto.tipoInteres);
  return parteAlargable(presupuesto) * propuesta.anios * deMas;
}

/** La propuesta del mismo tipo que les cuesta `coste` (redondeada a la baja), o null si no cabe. */
function propuestaConCoste(
  propuesta: Propuesta,
  coste: number,
  presupuesto: Pick<PresupuestoPais, 'vencimientos' | 'deuda' | 'tipoInteres'>,
  mercado: Pick<MercadoDeuda, 'tipoMercado'>,
): Propuesta | null {
  const actual = costeParaAcreedores(propuesta, presupuesto, mercado);
  if (!(actual > 0)) return null;
  const crudo = valorDe(propuesta) * (coste / actual);
  const paso = propuesta.tipo === 'plazo' ? 1 : propuesta.tipo === 'interes' ? 0.25 : 0.01;
  const valor = Math.floor(crudo / paso + 1e-9) * paso;
  const [min] = LIMITES_PROPUESTA[propuesta.tipo];
  if (valor < min - 1e-9) return null;
  return propuestaDe(propuesta.tipo, Number(valor.toFixed(2)));
}

/** La respuesta de los acreedores a una propuesta (y su contraoferta, si la hay). */
export function responder(
  propuesta: Propuesta,
  mercado: Pick<MercadoDeuda, 'prima' | 'tipoMercado'>,
  presupuesto: Pick<PresupuestoPais, 'vencimientos' | 'deuda' | 'tipoInteres'>,
): { respuesta: RespuestaAcreedores; contraoferta: Propuesta | null } {
  const tolerancia = toleranciaAcreedores(mercado);
  const coste = costeParaAcreedores(propuesta, presupuesto, mercado);
  if (tolerancia > 0 && coste <= tolerancia + 1e-12) {
    return { respuesta: 'acepta', contraoferta: null };
  }
  if (tolerancia > 0 && coste <= tolerancia * a.factorContraoferta) {
    const contraoferta = propuestaConCoste(propuesta, tolerancia, presupuesto, mercado);
    if (contraoferta) return { respuesta: 'contraoferta', contraoferta };
  }
  return { respuesta: 'rechaza', contraoferta: null };
}

/** ¿Se puede empezar (o seguir) una negociación hoy? No en una crisis ni poco después de otra. */
export function puedeNegociar(mercado: MercadoDeuda, fecha: string): boolean {
  if (mercado.programa) return false;
  const ultima = mercado.negociacion;
  if (!ultima || ultima.estado === 'abierta') return true;
  return mesesEntre(ultima.desde, fecha) >= a.mesesEntreNegociaciones;
}

/** La fecha desde la que se podrá volver a negociar (tras la última). */
export function proximaNegociacion(mercado: MercadoDeuda): string | null {
  const ultima = mercado.negociacion;
  if (!ultima || ultima.estado === 'abierta') return null;
  const total = Number(ultima.desde.slice(0, 4)) * 12 + Number(ultima.desde.slice(5, 7)) - 1;
  const mes = total + a.mesesEntreNegociaciones;
  return `${Math.floor(mes / 12)}-${String((mes % 12) + 1).padStart(2, '0')}-01`;
}

function cerrarConAcuerdo(
  negociacion: NegociacionDeuda,
  acuerdo: Propuesta,
  presupuesto: PresupuestoPais,
  fecha: string,
): void {
  negociacion.estado = 'acuerdo';
  negociacion.acuerdo = acuerdo;
  // Vale desde el mes siguiente, como los demás cambios de Hacienda.
  presupuesto.pendientes.push({
    cambio: { tipo: 'acuerdo', propuesta: acuerdo },
    desde: diaUnoSiguiente(fecha),
  });
}

function romper(negociacion: NegociacionDeuda, mercado: MercadoDeuda): void {
  negociacion.estado = 'ruptura';
  // Los mercados ven a un país que ha intentado no pagar lo que debe.
  mercado.recargo += a.recargoRuptura;
}

/**
 * Una acción del país en la negociación con sus acreedores (la misma función en el motor y en la
 * pantalla: la respuesta es la misma con el mismo estado). Devuelve la negociación (o null).
 */
export function negociar(
  mercado: MercadoDeuda,
  presupuesto: PresupuestoPais,
  accion: AccionNegociacion,
  fecha: string,
): NegociacionDeuda | null {
  let negociacion = mercado.negociacion?.estado === 'abierta' ? mercado.negociacion : null;
  if (accion.tipo === 'proponer') {
    const propuesta = propuestaValida(accion.propuesta);
    if (!propuesta) return mercado.negociacion;
    if (!negociacion) {
      if (!puedeNegociar(mercado, fecha)) return mercado.negociacion;
      negociacion = {
        desde: fecha,
        ronda: 0,
        propuesta: null,
        respuesta: null,
        contraoferta: null,
        estado: 'abierta',
        acuerdo: null,
      };
      mercado.negociacion = negociacion;
    }
    negociacion.ronda += 1;
    negociacion.propuesta = propuesta;
    const { respuesta, contraoferta } = responder(propuesta, mercado, presupuesto);
    negociacion.respuesta = respuesta;
    negociacion.contraoferta = contraoferta;
    if (respuesta === 'acepta') cerrarConAcuerdo(negociacion, propuesta, presupuesto, fecha);
    else if (respuesta === 'rechaza' && negociacion.ronda >= RONDAS) romper(negociacion, mercado);
    return negociacion;
  }
  if (!negociacion) return mercado.negociacion;
  if (accion.tipo === 'aceptar') {
    if (negociacion.contraoferta) {
      cerrarConAcuerdo(negociacion, negociacion.contraoferta, presupuesto, fecha);
    }
    return negociacion;
  }
  romper(negociacion, mercado);
  return negociacion;
}

/** Al empezar el mes, la negociación que siga abierta se rompe (los acreedores se cansan). */
export function cerrarNegociacionDelMes(mercado: MercadoDeuda): boolean {
  if (mercado.negociacion?.estado !== 'abierta') return false;
  romper(mercado.negociacion, mercado);
  return true;
}

/**
 * Aplica un acuerdo con los acreedores (el mes siguiente): más plazo, menos interés o la quita. Lo
 * que pierden los acreedores sube la prima de después y baja la confianza de las empresas.
 */
export function aplicarAcuerdo(
  propuesta: Propuesta,
  mercado: MercadoDeuda,
  economia: EconomiaPais,
  presupuesto: PresupuestoPais,
): void {
  const valida = propuestaValida(propuesta);
  if (!valida) return;
  const coste = costeParaAcreedores(valida, presupuesto, mercado);
  if (valida.tipo === 'plazo') {
    const meses = valida.anios * 12;
    const v = presupuesto.vencimientos;
    const ultimo = v.length - 1;
    const movido = v.slice(0, a.mesesAlargables);
    for (let i = 0; i < movido.length; i++) v[i] = 0;
    movido.forEach((importe, i) => {
      const destino = Math.min(ultimo, i + meses);
      v[destino] = (v[destino] ?? 0) + importe;
    });
  } else if (valida.tipo === 'interes') {
    presupuesto.tipoInteres = Math.max(
      a.tipoMinimo / 100,
      presupuesto.tipoInteres - valida.puntos / 100,
    );
  } else {
    presupuesto.deuda *= 1 - valida.parte;
    presupuesto.vencimientos = presupuesto.vencimientos.map((v) => v * (1 - valida.parte));
  }
  presupuesto.transversales.intereses = presupuesto.deuda * presupuesto.tipoInteres;
  mercado.recargo += a.recargoPorCoste * coste;
  economia.confianzaEmpresas -= a.confianzaPorCoste * coste;
}

// ── Pedir ayuda ──

export type FuenteAyuda = 'fmi' | 'eurozona' | 'pais';
export const FUENTES_AYUDA: readonly FuenteAyuda[] = ['fmi', 'eurozona', 'pais'];

/** Lo que ofrece quien presta. */
export interface OfertaAyuda {
  fuente: FuenteAyuda;
  /** El país que presta (en la de un país). */
  prestamista: string | null;
  /** Cuánto presta en total (dólares). */
  importe: number;
  /** A qué tipo (tanto por uno). */
  tipoInteres: number;
  plazoMeses: number;
  /** En cuántos tramos mensuales. */
  tramos: number;
  /** Cuánto hay que bajar el déficit (del PIB) cada enero, o null si no pide nada. */
  recorteAnual: number | null;
  /** Cuánto baja la prima que pide el mercado mientras llega el dinero (tanto por uno). */
  respaldo: number;
}

/** Una ayuda pedida: lo que se ha entregado, lo que falta y su objetivo de déficit. */
export interface AyudaDeuda extends OfertaAyuda {
  desde: string;
  entregado: number;
  tramosRestantes: number;
  /** El déficit (del PIB) que hay que tener el próximo enero, o null si no pide nada. */
  objetivoDeficit: number | null;
  /** Retirada por no cumplir (con su día). */
  retirada: string | null;
}

/** ¿Está llegando el dinero de la ayuda? */
export const ayudaActiva = (ayuda: AyudaDeuda | null | undefined): boolean =>
  Boolean(ayuda && ayuda.retirada === null && ayuda.tramosRestantes > 0);

/** ¿Es del euro el país en esa fecha? */
export const esDelEuro = (id: string, fecha: string): boolean => {
  const desde = ZONA_EURO[id];
  return desde !== undefined && fecha >= desde;
};

const indiceRating = (rating: string): number =>
  RATINGS.indexOf(rating as (typeof RATINGS)[number]);

/**
 * Lo que le ofrecen hoy a un país (en orden: el FMI, el fondo del euro y los países con más
 * superávit). Nada durante una crisis ni con otra ayuda llegando; quien retiró la suya no vuelve
 * a prestar hasta pasados «mesesVeto» meses.
 */
export function ofertasDeAyuda(
  id: string,
  paises: Readonly<Record<string, Pick<EstadoPais, 'economia' | 'presupuesto' | 'mercado'>>>,
  fecha: string,
): OfertaAyuda[] {
  const estado = paises[id];
  const mercado = estado?.mercado;
  const economia = estado?.economia;
  if (!mercado || !economia || !estado.presupuesto || mercado.programa) return [];
  if (ayudaActiva(mercado.ayuda)) return [];
  const pib = pibNominal(economia);
  const vetada = (fuente: FuenteAyuda, prestamista: string | null = null): boolean => {
    const ultima = mercado.ayuda;
    return Boolean(
      ultima?.retirada &&
      ultima.fuente === fuente &&
      ultima.prestamista === prestamista &&
      mesesEntre(ultima.retirada, fecha) < ay.mesesVeto,
    );
  };
  const ofertas: OfertaAyuda[] = [];
  // La línea preventiva del FMI: con los mercados abiertos (antes de la crisis).
  if (mercado.prima <= UMBRAL_CIERRE && !vetada('fmi')) {
    ofertas.push({
      fuente: 'fmi',
      prestamista: null,
      importe: pib * ay.fmi.importePib,
      tipoInteres: ay.fmi.tipo / 100,
      plazoMeses: ay.fmi.plazoMeses,
      tramos: ay.fmi.tramos,
      recorteAnual: ay.fmi.recorteAnual,
      respaldo: ay.fmi.respaldo,
    });
  }
  // El fondo de rescate del euro, para sus miembros desde mayo de 2010.
  if (fecha >= ay.eurozona.desde && esDelEuro(id, fecha) && !vetada('eurozona')) {
    ofertas.push({
      fuente: 'eurozona',
      prestamista: null,
      importe: pib * ay.eurozona.importePib,
      tipoInteres: ay.eurozona.tipo / 100,
      plazoMeses: ay.eurozona.plazoMeses,
      tramos: ay.eurozona.tramos,
      recorteAnual: ay.eurozona.recorteAnual,
      respaldo: ay.eurozona.respaldo,
    });
  }
  // Los países con superávit y buen rating (los que más superávit tienen), con los mercados
  // abiertos para quien pide.
  if (mercado.prima <= UMBRAL_CIERRE) {
    const minimo = indiceRating(ay.pais.ratingMinimo);
    const prestamistas = Object.entries(paises)
      .filter(([otro, e]) => otro !== id && e.presupuesto && e.mercado && e.economia)
      .map(([otro, e]) => ({ otro, e, superavit: saldo(e.presupuesto!) }))
      .filter(
        ({ e, superavit }) =>
          superavit > 0 &&
          !e.mercado!.programa &&
          indiceRating(e.mercado!.rating) >= 0 &&
          indiceRating(e.mercado!.rating) <= minimo,
      )
      .sort((x, y) => y.superavit - x.superavit)
      .slice(0, ay.pais.prestamistas);
    for (const { otro, e, superavit } of prestamistas) {
      if (vetada('pais', otro)) continue;
      ofertas.push({
        fuente: 'pais',
        prestamista: otro,
        importe: Math.min(pib * ay.pais.importePib, superavit * ay.pais.parteSuperavit),
        tipoInteres: (e.mercado!.tipoMercado + ay.pais.diferencial) / 100,
        plazoMeses: ay.pais.plazoMeses,
        tramos: ay.pais.tramos,
        recorteAnual: null,
        respaldo: ay.pais.respaldo,
      });
    }
  }
  return ofertas;
}

/** Empieza una ayuda: el dinero llega en tramos desde este mes; el objetivo, el próximo enero. */
export function pedirAyuda(
  oferta: OfertaAyuda,
  mercado: MercadoDeuda,
  economia: EconomiaPais,
  presupuesto: PresupuestoPais,
  fecha: string,
): void {
  const pib = pibNominal(economia);
  const deficit = pib > 0 ? -saldo(presupuesto) / pib : 0;
  mercado.ayuda = {
    ...oferta,
    desde: fecha,
    entregado: 0,
    tramosRestantes: oferta.tramos,
    objetivoDeficit:
      oferta.recorteAnual === null
        ? null
        : Math.max(ay.deficitFinal, deficit - oferta.recorteAnual),
    retirada: null,
  };
}

/**
 * Un mes de la ayuda: llega un tramo (como deuda a su tipo y su plazo) y, cada enero, se mira el
 * objetivo de déficit: si no se cumple, se retira lo que falta y la prima sube. Devuelve si se ha
 * retirado este mes.
 */
export function avanzarAyuda(
  mercado: MercadoDeuda,
  economia: EconomiaPais,
  presupuesto: PresupuestoPais,
  estado: { tesoreria: number },
  fecha: string,
): boolean {
  const ayuda = mercado.ayuda;
  if (!ayuda || !ayudaActiva(ayuda)) return false;
  const revision =
    fecha.slice(5, 7) === '01' && mesesEntre(ayuda.desde, fecha) >= ay.mesesPrimeraRevision;
  if (revision && ayuda.objetivoDeficit !== null) {
    const pib = pibNominal(economia);
    const deficit = pib > 0 ? -saldo(presupuesto) / pib : 0;
    if (deficit > ayuda.objetivoDeficit + ay.margen) {
      ayuda.retirada = fecha;
      mercado.recargo += ay.recargoRetirada;
      return true;
    }
    ayuda.objetivoDeficit = Math.max(
      ay.deficitFinal,
      ayuda.objetivoDeficit - (ayuda.recorteAnual ?? 0),
    );
  }
  const tramo = ayuda.importe / ayuda.tramos;
  emitirA(presupuesto, estado, tramo, ayuda.tipoInteres, ayuda.plazoMeses);
  ayuda.entregado += tramo;
  ayuda.tramosRestantes -= 1;
  return false;
}

/** Cuánto baja la prima que pide el mercado por la ayuda que está llegando (tanto por uno). */
export const respaldoDe = (mercado: Pick<MercadoDeuda, 'ayuda'>): number =>
  ayudaActiva(mercado.ayuda) ? mercado.ayuda!.respaldo : 0;

// ── La IA ──

/** La ayuda que pide la IA: el fondo del euro si puede; si no, el FMI; si no, la más barata. */
export function ayudaDeLaIa(ofertas: readonly OfertaAyuda[]): OfertaAyuda | null {
  return (
    ofertas.find((o) => o.fuente === 'eurozona') ??
    ofertas.find((o) => o.fuente === 'fmi') ??
    [...ofertas].sort((x, y) => x.tipoInteres - y.tipoInteres)[0] ??
    null
  );
}

/**
 * Sistema de los acreedores (tarea f20-t3): cada mes, después del mercado de la deuda. La
 * negociación que siga abierta se rompe; la IA pide ayuda y negocia más plazo cuando la prima se
 * acerca al cierre.
 */
export const sistemaAcreedores: Sistema = (pasos, partida) => {
  const mensual = pasos.find((paso) => paso.ritmo === 'mensual');
  if (!mensual) return;
  const fecha = mensual.fecha;
  for (const [id, estado] of Object.entries(partida.paises)) {
    const { mercado, economia, presupuesto } = estado;
    if (!mercado || !economia || !presupuesto) continue;
    cerrarNegociacionDelMes(mercado);
    if (id === partida.jugador.paisId || mercado.programa) continue;
    if (mercado.prima >= ia.primaAyuda * UMBRAL_CIERRE && !ayudaActiva(mercado.ayuda)) {
      const oferta = ayudaDeLaIa(ofertasDeAyuda(id, partida.paises, fecha));
      if (oferta) pedirAyuda(oferta, mercado, economia, presupuesto, fecha);
    }
    const propuesta: Propuesta = { tipo: 'plazo', anios: ia.plazoNegociar };
    if (
      mercado.prima >= ia.primaNegociar * UMBRAL_CIERRE &&
      puedeNegociar(mercado, fecha) &&
      // (Solo si sabe que no se la rechazarán: romper sube la prima.)
      responder(propuesta, mercado, presupuesto).respuesta !== 'rechaza'
    ) {
      const negociacion = negociar(mercado, presupuesto, { tipo: 'proponer', propuesta }, fecha);
      if (negociacion?.estado === 'abierta') {
        negociar(
          mercado,
          presupuesto,
          { tipo: negociacion.contraoferta ? 'aceptar' : 'abandonar' },
          fecha,
        );
      }
    }
  }
};
