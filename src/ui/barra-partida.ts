/**
 * Barra superior de la partida (tarea f10-t3, GDD 7: «barra superior: fecha, controles de
 * tiempo, tesorería, popularidad, alertas»). Por ahora: el país del jugador, la fecha, la
 * tesorería y la popularidad (estas dos, estimaciones provisionales de la tarea f10-t2). Los
 * controles de tiempo llegan con el reloj (Fase 11) y las alertas, con los sistemas que las dan.
 */
import { urlBandera } from '../av/banderas';
import { icono, type NombreIcono } from '../av/iconos';
import { formatearFechaLarga } from '../compartido/fechas';
import { dolares, enteros } from '../compartido/formato';
import { t } from '../i18n';
import type { Partida } from '../sim/partida';
import { etiquetaHuso, textoHora } from '../sim/reloj';
import { pedirConfirmacion } from './componentes/confirmacion';
import { conInformacion } from './componentes/info';
import { crearRelojAnalogico } from './reloj-analogico';
import { el } from './dom';

/** Popularidad por debajo de la cual se avisa en rojo, y por encima de la cual va en verde. */
export const POPULARIDAD_BAJA = 35;
export const POPULARIDAD_ALTA = 55;

export type NivelPopularidad = 'baja' | 'media' | 'alta';

export function nivelPopularidad(popularidad: number): NivelPopularidad {
  if (popularidad < POPULARIDAD_BAJA) return 'baja';
  return popularidad > POPULARIDAD_ALTA ? 'alta' : 'media';
}

/**
 * Pregunta antes de salir de la partida, que aún no se puede guardar (llega en la Fase 14).
 * Se usa con el botón «Menú» y con el botón «atrás» del navegador.
 */
export function confirmarSalidaDePartida(): Promise<boolean> {
  return pedirConfirmacion({
    titulo: t('juego.partida.salir.titulo'),
    texto: t('juego.partida.salir.texto'),
    aceptar: t('juego.partida.salir.aceptar'),
    cancelar: t('juego.partida.salir.cancelar'),
    peligro: true,
  });
}

export interface OpcionesBarraPartida {
  partida: Partida;
  /** Un clic en el país lleva el mapa hasta él. */
  alIrAlPais: () => void;
  /** Controles del tiempo (tarea f11-t3): van justo después de la fecha y la hora. */
  controles?: HTMLElement;
}

export interface BarraPartida {
  elemento: HTMLElement;
  /**
   * Pone el nombre del país y su capital (llegan con los datos, después de abrir la pantalla):
   * la hora es la local de la capital.
   */
  ponerNombrePais(nombre: string, capital?: string): void;
  /** Vuelve a pintar la fecha, la tesorería y la popularidad. */
  actualizar(partida: Partida): void;
  /**
   * Mueve las manecillas dentro de la hora en curso (tarea f11-t4): `fraccion` va de 0 a 1;
   * sin minutero a las velocidades altas.
   */
  ponerFraccion(fraccion: number, conMinutero: boolean): void;
  /** El reloj en pausa parpadea despacio (tarea f11-t4). */
  marcarPausa(enPausa: boolean): void;
  destruir(): void;
}

export function crearBarraPartida(opciones: OpcionesBarraPartida): BarraPartida {
  const { partida } = opciones;
  const id = partida.jugador.paisId;
  let capital: string = id;
  const nombre = el('strong', { class: 'partida-barra__nombre' }, id);
  const pais = el(
    'button',
    {
      class: 'partida-barra__pais',
      type: 'button',
      'aria-label': t('juego.partida.pais', { pais: id }),
      title: t('juego.partida.pais', { pais: id }),
    },
    el('img', {
      class: 'partida-barra__bandera',
      src: urlBandera(id),
      alt: '',
      width: 30,
      height: 22,
    }),
    nombre,
  );
  pais.addEventListener('click', opciones.alIrAlPais);

  const desconectar: (() => void)[] = [];
  /** Un dato de la barra: icono, valor y su explicación al pasar el ratón o con el foco. */
  const dato = (
    clase: string,
    nombreIcono: NombreIcono,
    titulo: string,
    ayuda: string | (() => string),
    ...valor: HTMLElement[]
  ): HTMLElement => {
    const caja = el(
      'div',
      { class: `partida-barra__dato partida-barra__dato--${clase}`, tabindex: 0 },
      icono(nombreIcono),
      el('span', { class: 'oculto-visual' }, `${titulo}: `),
      ...valor,
    );
    desconectar.push(
      conInformacion(caja, () => [
        el('strong', {}, titulo),
        el('br'),
        typeof ayuda === 'string' ? ayuda : ayuda(),
      ]),
    );
    return caja;
  };

  const fecha = el('time', { class: 'partida-barra__valor' });
  // La hora (tarea f11-t2): la local de la capital del jugador.
  const reloj = crearRelojAnalogico();
  const textoDeHora = el('span', {});
  const hora = el(
    'span',
    { class: 'partida-barra__valor partida-barra__hora' },
    reloj.elemento,
    textoDeHora,
  );
  let horaActual = partida.hora;
  const tesoreria = el('span', { class: 'partida-barra__valor' });
  const popularidad = el('span', { class: 'partida-barra__valor' });
  const relleno = el('span', { class: 'partida-barra__relleno' });
  const medidor = el('span', { class: 'partida-barra__medidor', 'aria-hidden': 'true' }, relleno);
  const datos = el(
    'div',
    { class: 'partida-barra__datos' },
    dato(
      'fecha',
      'calendario',
      t('juego.partida.fecha'),
      () =>
        t('juego.partida.fechaAyuda', {
          capital,
          huso: etiquetaHuso(partida.huso.minutos),
        }),
      fecha,
      hora,
    ),
    opciones.controles ?? null,
    dato(
      'tesoreria',
      'hacienda',
      t('juego.partida.tesoreria'),
      t('juego.partida.tesoreriaAyuda'),
      tesoreria,
    ),
    dato(
      'popularidad',
      'popularidad',
      t('juego.partida.popularidad'),
      t('juego.partida.popularidadAyuda'),
      popularidad,
      medidor,
    ),
  );
  const elemento = el(
    'div',
    { class: 'partida-barra', role: 'group', 'aria-label': t('juego.partida.barra') },
    pais,
    datos,
  );

  const actualizar = (estado: Partida): void => {
    fecha.setAttribute('datetime', `${estado.fecha}T${textoHora(estado.hora)}`);
    fecha.textContent = formatearFechaLarga(estado.fecha);
    textoDeHora.textContent = textoHora(estado.hora);
    if (estado.hora !== horaActual) {
      horaActual = estado.hora;
      reloj.poner(horaActual, 0, true);
    }
    const propio = estado.paises[estado.jugador.paisId];
    tesoreria.textContent = propio ? dolares(propio.tesoreria) : '—';
    if (propio) {
      popularidad.textContent = `${enteros(propio.popularidad)} %`;
      relleno.style.width = `${Math.max(0, Math.min(100, propio.popularidad))}%`;
      medidor.dataset.nivel = nivelPopularidad(propio.popularidad);
    } else {
      popularidad.textContent = '—';
      relleno.style.width = '0%';
    }
  };
  actualizar(partida);
  reloj.poner(horaActual, 0, true);

  return {
    elemento,
    ponerNombrePais(texto, deCapital) {
      if (deCapital) capital = deCapital;
      nombre.textContent = texto;
      pais.setAttribute('aria-label', t('juego.partida.pais', { pais: texto }));
      pais.title = t('juego.partida.pais', { pais: texto });
    },
    actualizar,
    ponerFraccion(fraccion, conMinutero) {
      reloj.poner(horaActual, fraccion, conMinutero);
    },
    marcarPausa(enPausa) {
      elemento.classList.toggle('partida-barra--pausa', enPausa);
    },
    destruir() {
      for (const quitar of desconectar) quitar();
    },
  };
}
