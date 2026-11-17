/**
 * Aviso de la pausa automática (tareas f13-t3 y f13-t4, decisión del jugador: una ventana en el
 * centro). Cuando un suceso importante para la partida, dice qué ha pasado y cuándo, con
 * «Seguir» (vuelve a la velocidad de antes) y «Quedarse en pausa». Intro sigue; Escape se queda.
 */
import { icono } from '../av/iconos';
import { formatearFechaLarga } from '../compartido/fechas';
import { t } from '../i18n';
import type { Suceso } from '../sim/sucesos';
import { textoHora } from '../sim/reloj';
import { animar, DURACIONES, FOTOGRAMAS, retirar } from './componentes/animacion';
import { el } from './dom';
import './estilos/aviso-suceso.css';

export interface OpcionesAviso {
  suceso: Suceso;
  /** «Seguir»: la partida vuelve a correr. */
  alSeguir: () => void;
  /** «Quedarse en pausa» (o Escape). */
  alCerrar?: () => void;
}

export interface AvisoSuceso {
  elemento: HTMLElement;
  cerrar(): void;
}

let abierto: AvisoSuceso | null = null;

/** Dos latidos del anillo que rodea el aviso: crece un poco y se desvanece. */
const DURACION_LATIDO = 1400;
const FOTOGRAMAS_LATIDO: readonly Keyframe[] = [
  { opacity: 0, scale: '1', offset: 0 },
  { opacity: 0.9, scale: '1', offset: 0.08 },
  { opacity: 0, scale: '1.045', offset: 0.46 },
  { opacity: 0.9, scale: '1', offset: 0.54 },
  { opacity: 0, scale: '1.045', offset: 1 },
];
/** El icono de la pausa parpadea con el anillo. */
const FOTOGRAMAS_PARPADEO: readonly Keyframe[] = [
  { opacity: 1 },
  { opacity: 0.35 },
  { opacity: 1 },
  { opacity: 0.35 },
  { opacity: 1 },
];

/** ¿Hay un aviso a la vista? */
export function avisoAbierto(): boolean {
  return abierto !== null;
}

/** Cierra el aviso que haya, sin seguir ni hacer nada más (al salir de la partida). */
export function cerrarAviso(): void {
  abierto?.cerrar();
}

export function mostrarAvisoSuceso(opciones: OpcionesAviso): AvisoSuceso {
  abierto?.cerrar();
  const { suceso } = opciones;
  // Al cerrarse, el foco vuelve a donde estaba (el mapa, o el botón de la galería).
  const focoAntes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const seguir = el(
    'button',
    { class: 'boton boton--principal aviso-suceso__seguir', type: 'button' },
    icono('seguir'),
    t('juego.sucesos.seguir'),
  );
  const quedarse = el(
    'button',
    { class: 'boton aviso-suceso__cerrar', type: 'button' },
    t('juego.sucesos.cerrar'),
  );
  const caja = el(
    'div',
    { class: 'aviso-suceso__caja', role: 'alertdialog', 'aria-modal': 'true' },
    el(
      'p',
      { class: 'aviso-suceso__etiqueta' },
      icono('pausa'),
      t('juego.sucesos.aviso'),
      suceso.origen === 'prueba'
        ? el('span', { class: 'aviso-suceso__prueba' }, t('juego.efectos.prueba'))
        : null,
    ),
    el('h2', { class: 'aviso-suceso__titulo', id: `aviso-${suceso.id}` }, suceso.titulo),
    el(
      'p',
      { class: 'aviso-suceso__cuando' },
      el(
        'time',
        { datetime: `${suceso.fecha}T${textoHora(suceso.hora)}` },
        t('juego.sucesos.cuando', {
          fecha: formatearFechaLarga(suceso.fecha),
          hora: textoHora(suceso.hora),
        }),
      ),
    ),
    el('p', { class: 'aviso-suceso__texto' }, suceso.texto),
    el('div', { class: 'aviso-suceso__botones' }, quedarse, seguir),
    el('p', { class: 'aviso-suceso__ayuda' }, t('juego.sucesos.ayuda')),
  );
  caja.setAttribute('aria-labelledby', `aviso-${suceso.id}`);
  const anillo = el('div', { class: 'aviso-suceso__anillo', 'aria-hidden': 'true' });
  caja.prepend(anillo);
  const fondo = el('div', { class: 'aviso-suceso__fondo' });
  const elemento = el('div', { class: 'aviso-suceso', 'data-suceso': suceso.id }, fondo, caja);

  const alTeclear = (evento: KeyboardEvent): void => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      cerrarCon(opciones.alCerrar);
    } else if (evento.key === 'Enter' && evento.target === document.body) {
      evento.preventDefault();
      evento.stopPropagation();
      cerrarCon(opciones.alSeguir);
    } else if (!elemento.contains(evento.target as Node)) {
      // Las teclas del mapa (espacio, velocidades, atajos) no actúan detrás del aviso.
      evento.stopPropagation();
    }
  };
  let cerrado = false;
  const cerrarCon = (accion?: () => void): void => {
    if (cerrado) return;
    cerrado = true;
    document.removeEventListener('keydown', alTeclear, true);
    if (abierto === aviso) abierto = null;
    retirar(elemento, [{ opacity: 1 }, { opacity: 0 }], DURACIONES.cerrarVentana);
    if (focoAntes?.isConnected && focoAntes !== document.body)
      focoAntes.focus({ preventScroll: true });
    accion?.();
  };
  seguir.addEventListener('click', () => cerrarCon(opciones.alSeguir));
  // Lo que se teclea dentro del aviso tampoco llega a los atajos de la pantalla.
  elemento.addEventListener('keydown', (evento) => evento.stopPropagation());
  quedarse.addEventListener('click', () => cerrarCon(opciones.alCerrar));
  document.addEventListener('keydown', alTeclear, true);
  document.body.appendChild(elemento);
  // Aparece como las ventanas y después late dos veces (el anillo dorado y el icono de la pausa),
  // a la vez que la campanada, para llevar la mirada al centro (tarea f13-t4). Con «reducir
  // movimiento» aparece sin más.
  void animar(fondo, [{ opacity: 0 }, { opacity: 1 }], DURACIONES.abrirVentana * 2);
  void animar(caja, FOTOGRAMAS.ventana, DURACIONES.abrirVentana).then(() => {
    void animar(anillo, FOTOGRAMAS_LATIDO, DURACION_LATIDO, 'ease-out');
    const pausa = caja.querySelector('.aviso-suceso__etiqueta .icono');
    if (pausa) void animar(pausa, FOTOGRAMAS_PARPADEO, DURACION_LATIDO, 'ease-in-out');
  });
  seguir.focus({ preventScroll: true });

  const aviso: AvisoSuceso = { elemento, cerrar: () => cerrarCon() };
  abierto = aviso;
  return aviso;
}
