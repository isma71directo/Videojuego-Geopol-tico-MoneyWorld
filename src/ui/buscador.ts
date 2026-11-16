/**
 * Buscador del mapa (tarea f9-t2, decisión del jugador): una lupa arriba y la tecla B abren una
 * ventana en el centro de la pantalla con un campo de búsqueda. Mientras se escribe aparecen
 * los países, las regiones y las ciudades que coinciden (con o sin tildes); con las flechas se
 * elige y con Intro (o un clic) el mapa va hasta el resultado. Esc cierra.
 */
import { urlBandera } from '../av/banderas';
import { icono } from '../av/iconos';
import { personas } from '../compartido/formato';
import { t } from '../i18n';
import { animar, FOTOGRAMAS, DURACIONES, retirar } from './componentes/animacion';
import { sonar } from './componentes/sonidos';
import {
  buscar,
  crearIndice,
  resaltar,
  type EntradaBusqueda,
  type IndiceBusqueda,
  type ResultadoBusqueda,
} from './busqueda';
import { el } from './dom';

export interface OpcionesBuscador {
  /** Entradas del índice; se piden la primera vez que se abre (y al cambiar los datos). */
  entradas: () => Promise<EntradaBusqueda[]>;
  /** Nombre de un país por su código (para el contexto de cada resultado). */
  nombrePais: (id: string) => string;
  /** Región del mundo de un país («Europa y Asia Central»). */
  regionDelMundo: (id: string) => string;
  /** ¿Es esta ciudad la capital de su país? */
  esCapital: (entrada: EntradaBusqueda) => boolean;
  alElegir: (entrada: EntradaBusqueda) => void;
}

export interface Buscador {
  /** Botón con la lupa para la barra de arriba. */
  boton: HTMLButtonElement;
  abrir(): void;
  cerrar(devolverFoco?: boolean): void;
  readonly abierto: boolean;
  /** Atajo del teclado (la tecla B): true si lo ha usado. */
  alTeclear(evento: KeyboardEvent): boolean;
  /** Vuelve a pedir las entradas la próxima vez que se abra. */
  renovar(): void;
}

/** ¿Se está escribiendo en un campo? Entonces la B no es un atajo. */
function escribiendo(destino: EventTarget | null): boolean {
  return (
    destino instanceof HTMLElement &&
    (destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName))
  );
}

let contador = 0;

export function crearBuscador(opciones: OpcionesBuscador): Buscador {
  const id = `buscador-${++contador}`;
  let indice: IndiceBusqueda | null = null;
  let cargando: Promise<void> | null = null;
  let resultados: ResultadoBusqueda[] = [];
  let activo = 0;
  let ventana: HTMLElement | null = null;
  let campo: HTMLInputElement | null = null;
  let lista: HTMLUListElement | null = null;
  let aviso: HTMLParagraphElement | null = null;
  let foco: HTMLElement | null = null;

  const boton = el(
    'button',
    {
      type: 'button',
      class: 'boton mapa__buscar',
      'aria-label': t('juego.buscador.atajo'),
      title: t('juego.buscador.atajo'),
      'aria-haspopup': 'dialog',
      'aria-keyshortcuts': 'B',
    },
    icono('buscar'),
    el('span', {}, t('juego.buscador.abrir')),
    el('kbd', { class: 'mapa__tecla' }, 'B'),
  );
  boton.addEventListener('click', () => abrir());

  const cargar = (): Promise<void> => {
    cargando ??= opciones
      .entradas()
      .then((entradas) => {
        indice = crearIndice(entradas);
        if (campo) actualizar();
      })
      .catch(() => {
        // Sin conexión, se reintenta la próxima vez que se abra.
        cargando = null;
      });
    return cargando;
  };

  const contexto = (entrada: EntradaBusqueda): string => {
    const partes: string[] = [];
    if (entrada.tipo === 'pais') {
      partes.push(
        t('juego.buscador.contexto.pais', { region: opciones.regionDelMundo(entrada.id) }),
      );
    } else if (entrada.tipo === 'region') {
      partes.push(t('juego.buscador.contexto.region', { pais: opciones.nombrePais(entrada.pais) }));
    } else {
      const pais = opciones.nombrePais(entrada.pais);
      partes.push(
        opciones.esCapital(entrada)
          ? t('juego.buscador.contexto.capital', { pais })
          : t('juego.buscador.contexto.ciudad', { pais }),
      );
    }
    if (entrada.peso > 0)
      partes.push(t('juego.buscador.habitantes', { n: personas(entrada.peso) }));
    return partes.join(' · ');
  };

  const imagen = (entrada: EntradaBusqueda): Element =>
    entrada.tipo === 'pais'
      ? el('img', {
          class: 'buscador__bandera',
          src: urlBandera(entrada.id),
          alt: '',
          width: 24,
          height: 18,
        })
      : el(
          'span',
          { class: 'buscador__icono' },
          icono(entrada.tipo === 'region' ? 'regiones' : 'ciudad'),
        );

  const nombreResaltado = (entrada: EntradaBusqueda, texto: string): HTMLElement => {
    const partes = resaltar(entrada.nombre, texto);
    return partes
      ? el('span', { class: 'buscador__nombre' }, partes[0], el('mark', {}, partes[1]), partes[2])
      : el('span', { class: 'buscador__nombre' }, entrada.nombre);
  };

  const marcarActivo = (): void => {
    if (!lista || !campo) return;
    [...lista.children].forEach((opcion, i) => {
      opcion.setAttribute('aria-selected', String(i === activo));
      if (i === activo) opcion.scrollIntoView?.({ block: 'nearest' });
    });
    if (resultados.length > 0)
      campo.setAttribute('aria-activedescendant', `${id}-opcion-${activo}`);
    else campo.removeAttribute('aria-activedescendant');
  };

  const actualizar = (): void => {
    if (!campo || !lista || !aviso) return;
    const texto = campo.value;
    if (!indice) {
      resultados = [];
      aviso.textContent = texto.trim() ? t('juego.buscador.cargando') : '';
    } else {
      resultados = buscar(indice, texto);
      aviso.textContent =
        texto.trim() && resultados.length === 0
          ? t('juego.buscador.vacio', { texto: texto.trim() })
          : '';
    }
    activo = 0;
    lista.replaceChildren(
      ...resultados.map(({ entrada }, i) => {
        const opcion = el(
          'li',
          {
            id: `${id}-opcion-${i}`,
            class: `buscador__opcion buscador__opcion--${entrada.tipo}`,
            role: 'option',
            'aria-selected': 'false',
          },
          imagen(entrada),
          el(
            'span',
            { class: 'buscador__texto' },
            nombreResaltado(entrada, texto),
            el('span', { class: 'buscador__contexto' }, contexto(entrada)),
          ),
          el('span', { class: 'buscador__tipo' }, t(`juego.buscador.tipos.${entrada.tipo}`)),
        );
        // Con el ratón: sin quitar el foco del campo.
        opcion.addEventListener('mousedown', (evento) => evento.preventDefault());
        opcion.addEventListener('mousemove', () => {
          if (activo !== i) {
            activo = i;
            marcarActivo();
          }
        });
        opcion.addEventListener('click', () => elegir(i));
        return opcion;
      }),
    );
    lista.hidden = resultados.length === 0;
    campo.setAttribute('aria-expanded', String(resultados.length > 0));
    marcarActivo();
  };

  const elegir = (i: number): void => {
    const resultado = resultados[i];
    if (!resultado) return;
    cerrar(false);
    opciones.alElegir(resultado.entrada);
  };

  const alTeclearCampo = (evento: KeyboardEvent): void => {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (resultados.length === 0) return;
      const paso = evento.key === 'ArrowDown' ? 1 : -1;
      activo = (activo + paso + resultados.length) % resultados.length;
      marcarActivo();
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      elegir(activo);
    } else if (evento.key === 'Escape') {
      // Solo cierra el buscador (no quita la selección del mapa ni cierra otras cosas).
      evento.preventDefault();
      evento.stopPropagation();
      cerrar();
    } else if (evento.key === 'Tab') {
      // El foco se queda en el campo: la lista se recorre con las flechas.
      evento.preventDefault();
    }
  };

  function abrir(): void {
    if (ventana) {
      campo?.focus();
      return;
    }
    foco = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    campo = el('input', {
      id: `${id}-campo`,
      class: 'buscador__campo',
      type: 'search',
      role: 'combobox',
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-autocomplete': 'list',
      'aria-expanded': 'false',
      'aria-controls': `${id}-lista`,
      'aria-labelledby': `${id}-titulo`,
      placeholder: t('juego.buscador.marcador'),
    });
    campo.addEventListener('input', actualizar);
    campo.addEventListener('keydown', alTeclearCampo);
    lista = el('ul', { id: `${id}-lista`, class: 'buscador__lista', role: 'listbox', hidden: '' });
    aviso = el('p', { class: 'buscador__aviso', role: 'status', 'aria-live': 'polite' });
    const fondo = el('div', { class: 'buscador__fondo' });
    fondo.addEventListener('click', () => cerrar());
    const caja = el(
      'div',
      { class: 'buscador__caja' },
      el('h2', { id: `${id}-titulo`, class: 'oculto-visual' }, t('juego.buscador.titulo')),
      el(
        'div',
        { class: 'buscador__fila' },
        el('span', { class: 'buscador__lupa' }, icono('buscar')),
        campo,
        el('kbd', { class: 'mapa__tecla' }, 'Esc'),
      ),
      lista,
      aviso,
      el('p', { class: 'buscador__ayuda' }, t('juego.buscador.ayuda')),
    );
    ventana = el(
      'div',
      {
        class: 'buscador',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': `${id}-titulo`,
      },
      fondo,
      caja,
    );
    document.body.appendChild(ventana);
    boton.setAttribute('aria-expanded', 'true');
    void animar(caja, FOTOGRAMAS.menu, DURACIONES.abrirVentana);
    void animar(fondo, [{ opacity: 0 }, { opacity: 1 }], DURACIONES.abrirVentana);
    sonar('abrirVentana');
    campo.focus();
    actualizar();
    void cargar();
  }

  function cerrar(devolverFoco = true): void {
    if (!ventana) return;
    const saliente = ventana;
    ventana = null;
    campo = null;
    lista = null;
    aviso = null;
    resultados = [];
    boton.setAttribute('aria-expanded', 'false');
    retirar(saliente, [{ opacity: 1 }, { opacity: 0 }], DURACIONES.cerrarVentana);
    if (devolverFoco) {
      sonar('cerrar');
      (foco ?? boton).focus?.();
    }
    foco = null;
  }

  return {
    boton,
    abrir,
    cerrar,
    get abierto() {
      return ventana !== null;
    },
    alTeclear(evento) {
      if (evento.ctrlKey || evento.altKey || evento.metaKey || evento.defaultPrevented)
        return false;
      if (escribiendo(evento.target) || evento.key.toLowerCase() !== 'b') return false;
      evento.preventDefault();
      abrir();
      return true;
    },
    renovar() {
      cargando = null;
      indice = null;
    },
  };
}
