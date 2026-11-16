/**
 * Información al pasar el ratón (tarea f7-t2, GDD 7: «tooltips que explican cada indicador y
 * qué lo afecta»). Aparece tras un instante con el ratón encima o en cuanto el elemento
 * recibe el foco con el teclado, y se va al salir, al perder el foco o con Escape. Nunca es
 * la única forma de ver un dato: solo lo explica.
 */
import { anadir, el, type Hijo } from '../dom';
import { posicionInformacion } from './escalas';
import '../estilos/componentes.css';

/** Espera con el ratón encima antes de mostrar la información (ms). */
export const ESPERA_INFORMACION_MS = 350;

let recuadro: HTMLElement | null = null;
let duenoActual: Element | null = null;

function recuadroCompartido(): HTMLElement {
  if (!recuadro || !recuadro.isConnected) {
    recuadro = el('div', { class: 'info', role: 'tooltip', id: 'info-emergente', hidden: true });
    document.body.appendChild(recuadro);
  }
  return recuadro;
}

/** Muestra la información de un elemento junto a él. */
export function mostrarInformacion(dueno: Element, contenido: Hijo[]): void {
  const caja = recuadroCompartido();
  caja.replaceChildren();
  anadir(caja, ...contenido);
  caja.hidden = false;
  duenoActual = dueno;
  const r = dueno.getBoundingClientRect();
  const { x, y, lado } = posicionInformacion(
    { x: r.left, y: r.top, ancho: r.width, alto: r.height },
    { ancho: caja.offsetWidth || 220, alto: caja.offsetHeight || 40 },
    { ancho: window.innerWidth, alto: window.innerHeight },
  );
  caja.dataset.lado = lado;
  caja.style.transform = `translate(${x}px, ${y}px)`;
}

export function ocultarInformacion(dueno?: Element): void {
  if (!recuadro || (dueno && dueno !== duenoActual)) return;
  recuadro.hidden = true;
  duenoActual = null;
}

/**
 * Da a un elemento su información al pasar el ratón y al recibir el foco. El contenido se pide
 * cada vez que se muestra (así puede cambiar). Devuelve una función que lo deshace.
 */
export function conInformacion(objetivo: HTMLElement, contenido: () => Hijo[]): () => void {
  let espera: ReturnType<typeof setTimeout> | null = null;
  const describir = (): void => {
    objetivo.setAttribute('aria-describedby', 'info-emergente');
    mostrarInformacion(objetivo, contenido());
  };
  const cancelar = (): void => {
    if (espera !== null) clearTimeout(espera);
    espera = null;
  };
  const entrar = (): void => {
    cancelar();
    espera = setTimeout(describir, ESPERA_INFORMACION_MS);
  };
  const salir = (): void => {
    cancelar();
    objetivo.removeAttribute('aria-describedby');
    ocultarInformacion(objetivo);
  };
  const tecla = (evento: KeyboardEvent): void => {
    if (evento.key === 'Escape' && duenoActual === objetivo) {
      evento.stopPropagation();
      salir();
    }
  };
  objetivo.addEventListener('pointerenter', entrar);
  objetivo.addEventListener('pointerleave', salir);
  objetivo.addEventListener('focus', describir);
  objetivo.addEventListener('blur', salir);
  objetivo.addEventListener('keydown', tecla);
  return () => {
    salir();
    objetivo.removeEventListener('pointerenter', entrar);
    objetivo.removeEventListener('pointerleave', salir);
    objetivo.removeEventListener('focus', describir);
    objetivo.removeEventListener('blur', salir);
    objetivo.removeEventListener('keydown', tecla);
  };
}
