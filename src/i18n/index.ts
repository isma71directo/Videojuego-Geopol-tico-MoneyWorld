import es from './es.json';

/**
 * Textos de la interfaz. De momento solo hay español; al estar todos en
 * es.json, traducir en el futuro consiste en añadir otro archivo.
 */
type Arbol = { [clave: string]: string | Arbol };

const textos: Arbol = es;

/**
 * Devuelve el texto de una clave con puntos, p. ej. `t('juego.titulo')`.
 * Los parámetros sustituyen a las marcas `{nombre}` del texto.
 * Si la clave no existe devuelve la propia clave, para que el fallo se vea.
 */
export function t(clave: string, parametros: Record<string, string | number> = {}): string {
  let nodo: string | Arbol | undefined = textos;
  for (const parte of clave.split('.')) {
    if (typeof nodo !== 'object') return clave;
    nodo = nodo[parte];
  }
  if (typeof nodo !== 'string') return clave;
  return nodo.replace(/\{(\w+)\}/g, (marca, nombre: string) =>
    nombre in parametros ? String(parametros[nombre]) : marca,
  );
}
