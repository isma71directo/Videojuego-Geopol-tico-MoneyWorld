/**
 * Animaciones de los componentes (tarea f7-t4, GDD 7.1): ventanas, paneles, menús y pestañas
 * aparecen y se van con un movimiento corto, sin hacer esperar al jugador.
 *
 * - Usan la API de animaciones del navegador sobre `opacity`, `scale` y `translate`, que no
 *   tocan el `transform` con el que se colocan las ventanas y los menús.
 * - Con «reducir movimiento» activado en el sistema, o si el navegador no sabe animar, todo
 *   aparece y desaparece al instante.
 * - Lo que se cierra deja de contar en el acto (no recibe clics ni foco): solo su imagen se
 *   queda un momento mientras se va.
 */

/** Duraciones en milisegundos: cortas, para que la interfaz no se note lenta. */
export const DURACIONES = {
  abrirVentana: 170,
  cerrarVentana: 130,
  abrirPanel: 200,
  cerrarPanel: 150,
  abrirMenu: 110,
  cerrarMenu: 90,
  pestana: 160,
} as const;

/** Curva de salida suave: arranca deprisa y frena al llegar. */
export const CURVA = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** Margen extra para quitar un elemento aunque el navegador no avise del final. */
const MARGEN_RETIRADA_MS = 80;

export function reducirMovimiento(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function puedeAnimar(elemento: Element): boolean {
  return typeof elemento.animate === 'function' && !reducirMovimiento();
}

/** Anima un elemento (si se puede). La promesa se cumple al terminar, también si no anima. */
export function animar(
  elemento: Element,
  fotogramas: readonly Keyframe[],
  duracion: number,
  curva: string = CURVA,
): Promise<void> {
  if (!puedeAnimar(elemento)) return Promise.resolve();
  try {
    return elemento.animate([...fotogramas], { duration: duracion, easing: curva }).finished.then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return Promise.resolve();
  }
}

/**
 * Hace salir un elemento con una animación y después lo quita del documento. Mientras se va
 * queda inerte. Sin animación (o con `alInstante`), se quita en el acto.
 */
export function retirar(
  elemento: HTMLElement,
  fotogramas: readonly Keyframe[],
  duracion: number,
  alInstante = false,
): void {
  if (alInstante || !puedeAnimar(elemento)) {
    elemento.remove();
    return;
  }
  elemento.inert = true;
  elemento.setAttribute('aria-hidden', 'true');
  elemento.classList.add('retirandose');
  let quitado = false;
  const quitar = (): void => {
    if (quitado) return;
    quitado = true;
    elemento.remove();
  };
  // Los fotogramas acaban en el estado final y se mantienen hasta quitarlo (sin parpadeo).
  try {
    elemento
      .animate([...fotogramas], { duration: duracion, easing: 'ease-in', fill: 'forwards' })
      .finished.then(quitar, quitar);
  } catch {
    quitar();
    return;
  }
  setTimeout(quitar, duracion + MARGEN_RETIRADA_MS);
}

/** Fotogramas de cada componente (el cierre es la apertura al revés). */
export const FOTOGRAMAS: {
  ventana: readonly Keyframe[];
  panel: (lado: 'izquierda' | 'derecha') => Keyframe[];
  menu: readonly Keyframe[];
  pestana: (sentido: 1 | -1) => Keyframe[];
} = {
  ventana: [
    { opacity: 0, scale: '0.96' },
    { opacity: 1, scale: '1' },
  ],
  panel: (lado: 'izquierda' | 'derecha'): Keyframe[] => [
    { opacity: 0, translate: lado === 'izquierda' ? '-28px 0' : '28px 0' },
    { opacity: 1, translate: '0 0' },
  ],
  menu: [
    { opacity: 0, scale: '0.97', translate: '0 -4px' },
    { opacity: 1, scale: '1', translate: '0 0' },
  ],
  /** Contenido de una pestaña: entra desde el lado hacia el que se ha ido. */
  pestana: (sentido: 1 | -1): Keyframe[] => [
    { opacity: 0, translate: `${sentido * 10}px 0` },
    { opacity: 1, translate: '0 0' },
  ],
};

/** Los mismos fotogramas al revés (para cerrar). */
export function alReves(fotogramas: readonly Keyframe[]): Keyframe[] {
  return [...fotogramas].reverse();
}
