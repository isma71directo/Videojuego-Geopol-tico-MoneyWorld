/**
 * Ventanas «Guardar partida» y «Cargar partida» (tarea f14-t2; la tarea f14-t4 las usa también
 * en el inicio). Cada guardado se ve con la bandera y el nombre del país, la fecha y la hora de
 * la partida y cuándo se guardó (decisión del jugador). Guardar en una ranura ocupada pregunta
 * antes de sobrescribirla.
 */
import { urlBandera } from '../av/banderas';
import { formatearFechaHora, formatearFechaLarga } from '../compartido/fechas';
import { t } from '../i18n';
import { ordenarResumenes, RANURAS_MANUALES, type ResumenGuardado } from '../sim/guardado';
import { textoHora } from '../sim/reloj';
import type { AlmacenPartidas } from './almacen-partidas';
import { pedirConfirmacion } from './componentes/confirmacion';
import { abrirVentana, type Ventana } from './componentes/ventana';
import { el } from './dom';
import './estilos/guardar-cargar.css';

export interface OpcionesGuardados {
  almacen: AlmacenPartidas;
  /** Nombre del país a partir de su código (de los datos de 2010). */
  nombreDe: (paisId: string) => string;
  /** Ruta hasta la raíz del juego, para las banderas. */
  raiz?: string;
}

/** «España · 3 de marzo de 2011, 08:00». */
export function textoPartida(
  resumen: Pick<ResumenGuardado, 'paisId' | 'fecha' | 'hora'>,
  nombreDe: (paisId: string) => string,
): string {
  return t('juego.guardado.partida', {
    pais: nombreDe(resumen.paisId),
    fecha: formatearFechaLarga(resumen.fecha),
    hora: textoHora(resumen.hora),
  });
}

/** «Ranura 2», «Automático» o «Inicio de 2012». */
export function etiquetaGuardado(
  resumen: Pick<ResumenGuardado, 'tipo' | 'ranura' | 'fecha'>,
): string {
  if (resumen.tipo === 'manual') return t('juego.guardado.ranura', { n: resumen.ranura ?? 0 });
  if (resumen.tipo === 'automatico') return t('juego.guardado.automatico');
  return t('juego.guardado.anual', { ano: resumen.fecha.slice(0, 4) });
}

/** Una fila de la lista: un botón con la bandera, qué guardado es y de qué partida. */
export function filaGuardado(
  resumen: ResumenGuardado | null,
  opciones: OpcionesGuardados & { etiqueta: string; alElegir: () => void },
): HTMLButtonElement {
  const fila = el(
    'button',
    {
      class: `guardados__fila${resumen ? '' : ' guardados__fila--vacia'}`,
      type: 'button',
      'data-guardado': resumen?.id,
    },
    resumen
      ? el('img', {
          class: 'guardados__bandera',
          src: urlBandera(resumen.paisId, opciones.raiz),
          alt: '',
          width: 48,
          height: 32,
          loading: 'lazy',
        })
      : el('span', {
          class: 'guardados__bandera guardados__bandera--vacia',
          'aria-hidden': 'true',
        }),
    el(
      'span',
      { class: 'guardados__textos' },
      el('strong', { class: 'guardados__etiqueta' }, opciones.etiqueta),
      el(
        'span',
        { class: 'guardados__partida' },
        resumen ? textoPartida(resumen, opciones.nombreDe) : t('juego.guardado.vacia'),
      ),
      resumen
        ? el(
            'small',
            { class: 'guardados__cuando' },
            t('juego.guardado.guardadaEl', { momento: formatearFechaHora(resumen.guardadoEn) }),
          )
        : null,
    ),
  );
  fila.addEventListener('click', opciones.alElegir);
  return fila;
}

const avisoSoloMemoria = (almacen: AlmacenPartidas): HTMLElement | null =>
  almacen.persistente
    ? null
    : el('p', { class: 'guardados__aviso', role: 'note' }, t('juego.guardado.soloMemoria'));

/**
 * Abre «Guardar partida»: las cinco ranuras, vacías u ocupadas. Al elegir una (y confirmar si
 * está ocupada), se cierra y llama a `alElegir` con su número.
 */
export async function abrirGuardar(
  opciones: OpcionesGuardados & { alElegir: (ranura: number) => void; alCerrar?: () => void },
): Promise<Ventana> {
  const resumenes = await opciones.almacen.listar();
  const deRanura = new Map(
    resumenes.filter((r) => r.tipo === 'manual').map((r) => [r.ranura ?? 0, r] as const),
  );
  let elegida = false;
  const ventana = abrirVentana({
    id: 'guardar-partida',
    titulo: t('juego.guardado.guardarTitulo'),
    icono: 'guardar',
    ancho: 460,
    contenido: [],
    alCerrar: () => {
      if (!elegida) opciones.alCerrar?.();
    },
  });
  const filas = Array.from({ length: RANURAS_MANUALES }, (_, i) => {
    const ranura = i + 1;
    const ocupada = deRanura.get(ranura) ?? null;
    return el(
      'li',
      {},
      filaGuardado(ocupada, {
        ...opciones,
        etiqueta: t('juego.guardado.ranura', { n: ranura }),
        alElegir: () => {
          void (async () => {
            if (ocupada) {
              const si = await pedirConfirmacion({
                titulo: t('juego.guardado.sobrescribir.titulo', { n: ranura }),
                texto: t('juego.guardado.sobrescribir.texto', {
                  partida: textoPartida(ocupada, opciones.nombreDe),
                }),
                aceptar: t('juego.guardado.sobrescribir.aceptar'),
                cancelar: t('juego.guardado.sobrescribir.cancelar'),
                peligro: true,
              });
              if (!si) return;
            }
            elegida = true;
            ventana.cerrar();
            opciones.alElegir(ranura);
          })();
        },
      }),
    );
  });
  ventana.cuerpo.replaceChildren(
    el('p', { class: 'guardados__nota' }, t('juego.guardado.guardarNota')),
    avisoSoloMemoria(opciones.almacen) ?? '',
    el('ol', { class: 'guardados' }, ...filas),
  );
  return ventana;
}

/**
 * Abre «Cargar partida»: las ranuras, los automáticos y los de cada año. Al elegir uno, se cierra
 * y llama a `alElegir` (quien carga pregunta antes si se pierde algo).
 */
export async function abrirCargar(
  opciones: OpcionesGuardados & {
    alElegir: (resumen: ResumenGuardado) => void;
    alCerrar?: () => void;
  },
): Promise<Ventana> {
  const resumenes = ordenarResumenes(await opciones.almacen.listar());
  let elegida = false;
  const ventana = abrirVentana({
    id: 'cargar-partida',
    titulo: t('juego.guardado.cargarTitulo'),
    icono: 'cargar',
    ancho: 460,
    contenido: [],
    alCerrar: () => {
      if (!elegida) opciones.alCerrar?.();
    },
  });
  const lista =
    resumenes.length === 0
      ? el('p', { class: 'guardados__vacio' }, t('juego.guardado.ninguno'))
      : el(
          'ol',
          { class: 'guardados' },
          ...resumenes.map((resumen) =>
            el(
              'li',
              {},
              filaGuardado(resumen, {
                ...opciones,
                etiqueta: etiquetaGuardado(resumen),
                alElegir: () => {
                  elegida = true;
                  ventana.cerrar();
                  opciones.alElegir(resumen);
                },
              }),
            ),
          ),
        );
  ventana.cuerpo.replaceChildren(
    el('p', { class: 'guardados__nota' }, t('juego.guardado.cargarNota')),
    avisoSoloMemoria(opciones.almacen) ?? '',
    lista,
  );
  return ventana;
}
