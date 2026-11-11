/** Utilidades mínimas para construir la interfaz sin framework. */

export type Hijo = Node | string | number | null | undefined | false;

/**
 * Crea un elemento HTML. Los textos se insertan siempre como texto (nunca
 * como HTML), así que es seguro pasarle contenido que venga de archivos.
 * Un atributo con valor `true` se añade vacío; con `false` o `undefined` se omite.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  atributos: Record<string, string | number | boolean | undefined> = {},
  ...hijos: Hijo[]
): HTMLElementTagNameMap[K] {
  const elemento = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    if (valor === false || valor === undefined) continue;
    elemento.setAttribute(nombre, valor === true ? '' : String(valor));
  }
  anadir(elemento, ...hijos);
  return elemento;
}

/** Añade hijos a un elemento, ignorando los valores vacíos. */
export function anadir(padre: Node, ...hijos: Hijo[]): void {
  for (const hijo of hijos) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    padre.appendChild(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
}

/** Sustituye todo el contenido de un elemento. */
export function reemplazar(padre: Element, ...hijos: Hijo[]): void {
  padre.replaceChildren();
  anadir(padre, ...hijos);
}

/** Barra de progreso accesible (0–100). */
export function barraProgreso(porcentaje: number, etiqueta: string): HTMLElement {
  const relleno = el('div', { class: 'barra__relleno' });
  relleno.style.width = `${porcentaje}%`;
  return el(
    'div',
    {
      class: 'barra',
      role: 'progressbar',
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': porcentaje,
      'aria-label': etiqueta,
    },
    relleno,
  );
}
