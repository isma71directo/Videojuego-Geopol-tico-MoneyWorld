/**
 * Negociar con los acreedores y pedir ayuda, en la pestaña «Deuda y Tesoro» de Economía y Hacienda
 * (tarea f20-t3; decisiones del jugador: por rondas de oferta y contraoferta; ayuda del FMI, del
 * fondo de la zona euro y de países con superávit).
 *
 * - Negociar: más plazo, menos interés o una quita, con lo que les costaría a los acreedores; su
 *   respuesta (acepta, rechaza o contraoferta) y, con una contraoferta, aceptarla, volver a ofertar
 *   o romper. Hay tres rondas en el mes.
 * - Pedir ayuda: lo que ofrece cada uno (dinero, tipo, plazo y condiciones) o la ayuda que está
 *   llegando, con su objetivo de déficit.
 */
import { dolares, porcentaje, puntos } from '../compartido/formato';
import { formatearFechaLarga } from '../compartido/fechas';
import { t } from '../i18n';
import {
  ayudaActiva,
  costeParaAcreedores,
  LIMITES_PROPUESTA,
  propuestaDe,
  proximaNegociacion,
  puedeNegociar,
  RONDAS,
  TIPOS_PROPUESTA,
  toleranciaAcreedores,
  type AccionNegociacion,
  type OfertaAyuda,
  type TipoPropuesta,
} from '../sim/acreedores';
import type { MercadoDeuda } from '../sim/deuda';
import { pibNominal, type EconomiaPais } from '../sim/economia';
import { saldo, type PresupuestoPais } from '../sim/presupuesto';
import { textoFuente, textoPropuesta } from './cambios-presupuesto';
import { crearDeslizador } from './componentes/deslizador';
import { el } from './dom';

/** Lo que se prepara para proponer (se conserva al cambiar de mes). */
export interface BorradorNegociacion {
  tipo: TipoPropuesta;
  valor: number;
}

export const borradorNegociacionInicial = (): BorradorNegociacion => ({ tipo: 'plazo', valor: 5 });

/** El paso de cada deslizador de la propuesta. */
const PASO: Readonly<Record<TipoPropuesta, number>> = { plazo: 1, interes: 0.25, quita: 1 };

export interface ContextoAcreedores {
  presupuesto: PresupuestoPais;
  economia: EconomiaPais;
  mercado: MercadoDeuda;
  fecha: string;
  borrador: BorradorNegociacion;
  /** Una acción en la negociación (la pestaña la aplica y la manda al motor). */
  negociar: (accion: AccionNegociacion) => void;
  /** Lo que le ofrecen hoy (null: no se sabe, p. ej. sin el resto del mundo). */
  ofertas: readonly OfertaAyuda[];
  /** Pide una ayuda (vale el mes siguiente). */
  pedir: (oferta: OfertaAyuda) => void;
}

/** «No ven riesgo», «ven algo de riesgo» o «temen un impago», según lo que aguantan. */
function animoDeLosAcreedores(mercado: MercadoDeuda): string {
  const tolerancia = toleranciaAcreedores(mercado);
  const clave = tolerancia <= 0 ? 'sinRiesgo' : tolerancia < 0.1 ? 'algoDeRiesgo' : 'temenImpago';
  return t(`juego.acreedores.animo.${clave}`, { prima: puntos(mercado.prima) });
}

/** El apartado «Negociar con los acreedores». */
export function apartadoNegociar(c: ContextoAcreedores): HTMLElement[] {
  const { mercado, presupuesto } = c;
  const negociacion = mercado.negociacion;
  const abierta = negociacion?.estado === 'abierta' ? negociacion : null;
  const elementos: HTMLElement[] = [
    el('h3', { class: 'panel-pais__apartado' }, t('juego.acreedores.negociarTitulo')),
    el('p', { class: 'presupuesto-ministerio__nota' }, t('juego.acreedores.negociarAyuda')),
    el('p', { class: 'deuda-tesoro__animo' }, animoDeLosAcreedores(mercado)),
  ];
  // El resultado de la última negociación (la de este mes, o la que impide negociar).
  if (negociacion && negociacion.estado !== 'abierta') {
    const desde = proximaNegociacion(mercado);
    elementos.push(
      el(
        'p',
        { class: 'deuda-tesoro__resultado', 'data-estado': negociacion.estado },
        negociacion.estado === 'acuerdo' && negociacion.acuerdo
          ? t('juego.acreedores.acuerdo', { propuesta: textoPropuesta(negociacion.acuerdo) })
          : t('juego.acreedores.ruptura'),
        ' ',
        desde && c.fecha < desde
          ? t('juego.acreedores.hasta', { fecha: formatearFechaLarga(desde) })
          : '',
      ),
    );
  }
  if (!puedeNegociar(mercado, c.fecha)) {
    if (mercado.programa) {
      elementos.push(
        el('p', { class: 'presupuesto-ministerio__nota' }, t('juego.acreedores.enCrisis')),
      );
    }
    return elementos;
  }
  // Lo que se propone: tipo y cuánto.
  const tipos = el(
    'div',
    { class: 'deuda-tesoro__tipos-propuesta', role: 'radiogroup' },
    ...TIPOS_PROPUESTA.map((tipo) => {
      const radio = el('input', {
        type: 'radio',
        name: 'propuesta-acreedores',
        value: tipo,
        class: 'deuda-tesoro__tipo-propuesta',
      });
      radio.checked = c.borrador.tipo === tipo;
      radio.addEventListener('change', () => {
        const [min, max] = LIMITES_PROPUESTA[tipo];
        c.borrador.tipo = tipo;
        c.borrador.valor = Math.min(max, Math.max(min, valorInicial(tipo)));
        pintarDeslizador();
      });
      return el(
        'label',
        { class: 'presupuesto-editable__casilla' },
        radio,
        t(`juego.acreedores.tipos.${tipo}`),
      );
    }),
  );
  const coste = el('p', { class: 'presupuesto-ministerio__nota' });
  const hueco = el('div');
  const enUnidades = (tipo: TipoPropuesta, v: number): number => (tipo === 'quita' ? v / 100 : v);
  const pintarCoste = (): void => {
    const propuesta = propuestaDe(c.borrador.tipo, enUnidades(c.borrador.tipo, c.borrador.valor));
    coste.textContent = t('juego.acreedores.coste', {
      propuesta: textoPropuesta(propuesta),
      coste: porcentaje(costeParaAcreedores(propuesta, presupuesto, mercado) * 100),
    });
  };
  function pintarDeslizador(): void {
    const tipo = c.borrador.tipo;
    const [min, max] = LIMITES_PROPUESTA[tipo];
    const escala = tipo === 'quita' ? 100 : 1;
    const deslizador = crearDeslizador({
      etiqueta: t(`juego.acreedores.tipos.${tipo}`),
      min: min * escala,
      max: max * escala,
      paso: PASO[tipo],
      valor: c.borrador.valor,
      formato: (v) => textoPropuesta(propuestaDe(tipo, enUnidades(tipo, v))),
      alCambiar: (v) => {
        c.borrador.valor = v;
        pintarCoste();
      },
    });
    hueco.replaceChildren(deslizador.elemento);
    pintarCoste();
  }
  pintarDeslizador();
  const proponer = el(
    'button',
    { class: 'boton boton--principal', type: 'button' },
    t('juego.acreedores.proponer', { ronda: (abierta?.ronda ?? 0) + 1, rondas: RONDAS }),
  );
  proponer.addEventListener('click', () =>
    c.negociar({
      tipo: 'proponer',
      propuesta: propuestaDe(c.borrador.tipo, enUnidades(c.borrador.tipo, c.borrador.valor)),
    }),
  );
  elementos.push(tipos, hueco, coste);
  // La respuesta de los acreedores en esta ronda.
  if (abierta && abierta.propuesta && abierta.respuesta) {
    const respuesta = el(
      'p',
      { class: 'deuda-tesoro__respuesta', 'data-respuesta': abierta.respuesta, role: 'status' },
      t(`juego.acreedores.respuestas.${abierta.respuesta}`, {
        ronda: abierta.ronda,
        rondas: RONDAS,
        propuesta: textoPropuesta(abierta.propuesta),
        contraoferta: abierta.contraoferta ? textoPropuesta(abierta.contraoferta) : '',
      }),
    );
    elementos.push(respuesta);
  }
  const acciones = el('div', { class: 'deuda-tesoro__acciones' }, proponer);
  if (abierta?.contraoferta) {
    const aceptar = el(
      'button',
      { class: 'boton boton--principal', type: 'button' },
      t('juego.acreedores.aceptar'),
    );
    aceptar.addEventListener('click', () => c.negociar({ tipo: 'aceptar' }));
    acciones.prepend(aceptar);
    proponer.classList.remove('boton--principal');
  }
  if (abierta) {
    const romper = el(
      'button',
      { class: 'boton boton--peligro', type: 'button' },
      t('juego.acreedores.romper'),
    );
    romper.addEventListener('click', () => c.negociar({ tipo: 'abandonar' }));
    acciones.append(romper);
  }
  elementos.push(acciones);
  return elementos;
}

/** «línea preventiva del FMI» → «Línea preventiva del FMI». */
const mayuscula = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Valor de partida de cada tipo de propuesta (en las unidades del deslizador). */
function valorInicial(tipo: TipoPropuesta): number {
  return tipo === 'plazo' ? 5 : tipo === 'interes' ? 1 : 10;
}

/** El apartado «Pedir ayuda». */
export function apartadoAyuda(c: ContextoAcreedores): HTMLElement[] {
  const { mercado, economia, presupuesto } = c;
  const elementos: HTMLElement[] = [
    el('h3', { class: 'panel-pais__apartado' }, t('juego.acreedores.ayudaTitulo')),
  ];
  const pib = pibNominal(economia);
  const ayuda = mercado.ayuda;
  if (ayuda && ayudaActiva(ayuda)) {
    const deficit = pib > 0 ? -saldo(presupuesto) / pib : 0;
    elementos.push(
      el(
        'p',
        { class: 'deuda-tesoro__ayuda-activa' },
        t('juego.acreedores.llegando', {
          fuente: mayuscula(textoFuente(ayuda.fuente, ayuda.prestamista)),
          entregado: dolares(ayuda.entregado),
          total: dolares(ayuda.importe),
          tramos: ayuda.tramosRestantes,
          tipo: porcentaje(ayuda.tipoInteres * 100),
        }),
      ),
      el(
        'p',
        { class: 'presupuesto-ministerio__nota' },
        ayuda.objetivoDeficit === null
          ? t('juego.acreedores.sinObjetivo')
          : t('juego.acreedores.objetivo', {
              objetivo: dolares(ayuda.objetivoDeficit * pib),
              objetivoPib: porcentaje(ayuda.objetivoDeficit * 100),
              ahora: dolares(Math.max(0, deficit * pib)),
              ahoraPib: porcentaje(Math.max(0, deficit) * 100),
            }),
      ),
    );
    return elementos;
  }
  if (ayuda?.retirada) {
    elementos.push(
      el(
        'p',
        { class: 'deuda-tesoro__resultado', 'data-estado': 'ruptura' },
        t('juego.acreedores.retirada', {
          fuente: textoFuente(ayuda.fuente, ayuda.prestamista),
          fecha: formatearFechaLarga(ayuda.retirada),
        }),
      ),
    );
  }
  if (c.ofertas.length === 0) {
    elementos.push(
      el('p', { class: 'presupuesto-ministerio__nota' }, t('juego.acreedores.sinOfertas')),
    );
    return elementos;
  }
  elementos.push(
    el('p', { class: 'presupuesto-ministerio__nota' }, t('juego.acreedores.ayudaAyuda')),
    el(
      'ul',
      { class: 'deuda-tesoro__ofertas' },
      ...c.ofertas.map((oferta) => {
        const pedir = el('button', { class: 'boton', type: 'button' }, t('juego.acreedores.pedir'));
        pedir.addEventListener('click', () => c.pedir(oferta));
        return el(
          'li',
          { 'data-fuente': oferta.fuente },
          el('strong', {}, mayuscula(textoFuente(oferta.fuente, oferta.prestamista))),
          el(
            'span',
            {},
            t('juego.acreedores.oferta', {
              importe: dolares(oferta.importe),
              tipo: porcentaje(oferta.tipoInteres * 100),
              anios: oferta.plazoMeses / 12,
              meses: oferta.tramos,
            }),
          ),
          el(
            'span',
            { class: 'presupuesto-ministerio__nota' },
            oferta.recorteAnual === null
              ? t('juego.acreedores.condicionNinguna', {
                  respaldo: porcentaje(oferta.respaldo * 100),
                })
              : t('juego.acreedores.condicion', {
                  recorte: puntos(oferta.recorteAnual * 100),
                  respaldo: porcentaje(oferta.respaldo * 100),
                }),
          ),
          pedir,
        );
      }),
    ),
  );
  return elementos;
}
