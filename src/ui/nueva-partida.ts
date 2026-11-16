/**
 * Pantalla «Nueva partida» (tarea f10-t1, decisión del jugador: mapa grande y panel). El mapa
 * ocupa toda la pantalla; a la izquierda, la lista de países jugables (con filtro y orden); a la
 * derecha, el país elegido con su líder y las opciones de la partida (dificultad, eventos
 * históricos y semilla). Un país se elige con un clic en el mapa o en la lista.
 */
import { urlBandera } from '../av/banderas';
import { icono } from '../av/iconos';
import { rasgosDe, svgRetrato, tono } from '../av/retratos';
import {
  dolares,
  dolaresPorPersona,
  enteros,
  personas,
  porcentaje,
  puntosConSigno,
} from '../compartido/formato';
import { edadEn2010, jefeGobierno, type ConjuntoGobiernos } from '../datos/gobiernos';
import type { ConjuntoHusos } from '../datos/husos';
import type { ConjuntoPaises, PaisDatos } from '../datos/paises';
import { t } from '../i18n';
import { conectarGestos } from '../map/gestos';
import type { MapaMundo, Objetivo } from '../map/mapa';
import {
  crearPartida,
  DIFICULTADES,
  FECHA_INICIO,
  OPCIONES_POR_DEFECTO,
  semillaAlAzar,
  semillaDeTexto,
  type Dificultad,
  type Partida,
} from '../sim/partida';
import { etiquetaHuso } from '../sim/reloj';
import { popularidadInicial, tesoreriaInicial } from '../sim/valores-iniciales';
import { normalizarBusqueda } from './busqueda';
import { animar, DURACIONES, FOTOGRAMAS } from './componentes/animacion';
import { transicionAPartida } from './transicion-partida';
import { el, reemplazar } from './dom';
import { crearMapaDelJuego } from './mapa-del-juego';
import { reproducir } from './sonido';
import './estilos/mapa.css';
import './estilos/nueva-partida.css';

export const CRITERIOS = ['nombre', 'poblacion', 'pib', 'pibPerCapita', 'region'] as const;
export type CriterioOrden = (typeof CRITERIOS)[number];

const porNombre = (a: PaisDatos, b: PaisDatos): number => a.nombre.localeCompare(b.nombre, 'es');

/** Países ordenados: por nombre o región (A-Z) o por población, PIB o PIB por habitante (de más a menos). */
export function ordenarPaises(paises: readonly PaisDatos[], criterio: CriterioOrden): PaisDatos[] {
  const lista = [...paises];
  if (criterio === 'nombre') return lista.sort(porNombre);
  if (criterio === 'region') {
    return lista.sort(
      (a, b) => a.regionNombre.localeCompare(b.regionNombre, 'es') || porNombre(a, b),
    );
  }
  return lista.sort(
    (a, b) =>
      (b.datos[criterio] ?? -Infinity) - (a.datos[criterio] ?? -Infinity) || porNombre(a, b),
  );
}

/** Países cuyo nombre (o código) contiene lo escrito, con o sin tildes. */
export function filtrarPaises(paises: readonly PaisDatos[], texto: string): PaisDatos[] {
  const consulta = normalizarBusqueda(texto);
  if (consulta === '') return [...paises];
  return paises.filter(
    (p) => normalizarBusqueda(p.nombre).includes(consulta) || p.id.toLowerCase() === consulta,
  );
}

/** Dato que acompaña a cada país en la lista según el orden elegido. */
export function datoDeLista(pais: PaisDatos, criterio: CriterioOrden): string {
  const valor = (campo: string): number | null => pais.datos[campo] ?? null;
  // Con el orden por nombre, la población: es corta y deja sitio al nombre.
  if (criterio === 'poblacion' || criterio === 'nombre') {
    return valor('poblacion') === null ? '—' : personas(valor('poblacion')!);
  }
  if (criterio === 'pib') return valor('pib') === null ? '—' : dolares(valor('pib')!);
  if (criterio === 'pibPerCapita') {
    return valor('pibPerCapita') === null ? '—' : dolaresPorPersona(valor('pibPerCapita')!);
  }
  return pais.regionNombre;
}

export interface PantallaNuevaPartida {
  elemento: HTMLElement;
  /** El mapa (null en las pruebas sin lienzo). */
  mapa: MapaMundo | null;
  /** Elige un país como si se hubiera hecho clic en él. */
  elegir(id: string): void;
  cerrar(): void;
}

export interface OpcionesPantallaNuevaPartida {
  alVolver: () => void;
  alEmpezar: (partida: Partida) => void;
  /** Datos ya cargados (en las pruebas); si no, se descargan. */
  datos?: {
    paises: ConjuntoPaises;
    gobiernos: ConjuntoGobiernos | null;
    husos?: ConjuntoHusos | null;
  };
  /** Sin mapa (en las pruebas). */
  sinMapa?: boolean;
}

export function abrirPantallaNuevaPartida(
  opciones: OpcionesPantallaNuevaPartida,
): PantallaNuevaPartida {
  let conjunto: ConjuntoPaises | null = null;
  let gobiernos: ConjuntoGobiernos | null = null;
  /** Huso horario de cada país (tarea f11-t2): el reloj marca la hora de la capital. */
  let husos: ConjuntoHusos | null = null;
  let elegido: string | null = null;
  let criterio: CriterioOrden = 'nombre';
  let dificultad: Dificultad = OPCIONES_POR_DEFECTO.dificultad;
  let eventos = OPCIONES_POR_DEFECTO.eventosHistoricos;
  let semilla: number | null = semillaAlAzar();
  let empezada = false;

  // ── Panel izquierdo: la lista ─────────────────────────────────────────────────────────────
  const volver = el(
    'button',
    { class: 'boton nueva-partida__volver', type: 'button' },
    '← ',
    t('juego.nuevaPartida.volver'),
  );
  const filtro = el('input', {
    class: 'nueva-partida__filtro',
    type: 'search',
    placeholder: t('juego.nuevaPartida.filtrarMarcador'),
    'aria-label': t('juego.nuevaPartida.filtrar'),
    autocomplete: 'off',
  });
  const orden = el(
    'select',
    { class: 'nueva-partida__orden', 'aria-label': t('juego.nuevaPartida.ordenar') },
    ...CRITERIOS.map((c) => el('option', { value: c }, t(`juego.nuevaPartida.criterios.${c}`))),
  );
  const lista = el('ul', {
    class: 'nueva-partida__paises',
    role: 'listbox',
    tabindex: 0,
    'aria-label': t('juego.nuevaPartida.lista'),
  });
  const ayuda = el('p', { class: 'nueva-partida__ayuda' }, t('juego.mapa.cargando'));
  const panelLista = el(
    'aside',
    { class: 'nueva-partida__panel nueva-partida__panel--lista' },
    el(
      'header',
      { class: 'nueva-partida__cabecera' },
      volver,
      el(
        'div',
        {},
        el('h1', { class: 'nueva-partida__titulo' }, t('juego.nuevaPartida.titulo')),
        el('p', { class: 'nueva-partida__fecha' }, t('juego.nuevaPartida.fecha')),
      ),
    ),
    el('h2', { class: 'nueva-partida__paso' }, t('juego.nuevaPartida.elige')),
    ayuda,
    el(
      'div',
      { class: 'nueva-partida__controles' },
      filtro,
      el('label', { class: 'nueva-partida__etiqueta' }, t('juego.nuevaPartida.ordenar'), orden),
    ),
    lista,
  );

  // ── Panel derecho: el país elegido y las opciones ────────────────────────────────────────
  const resumen = el('section', { class: 'nueva-partida__resumen', 'aria-live': 'polite' });
  const aviso = el('p', { class: 'nueva-partida__aviso', role: 'status' });
  const descripcionDificultad = el(
    'p',
    { class: 'nueva-partida__nota' },
    t(`juego.nuevaPartida.opciones.dificultades.${dificultad}.descripcion`),
  );
  const radios = DIFICULTADES.map((d) => {
    const radio = el('input', {
      type: 'radio',
      name: 'dificultad',
      value: d,
      checked: d === dificultad,
    });
    radio.addEventListener('change', () => {
      dificultad = d;
      descripcionDificultad.textContent = t(
        `juego.nuevaPartida.opciones.dificultades.${d}.descripcion`,
      );
      reproducir('boton');
    });
    return el(
      'label',
      { class: 'nueva-partida__segmento' },
      radio,
      el('span', {}, t(`juego.nuevaPartida.opciones.dificultades.${d}.nombre`)),
    );
  });
  const casillaEventos = el('input', { type: 'checkbox', checked: eventos });
  casillaEventos.addEventListener('change', () => {
    eventos = casillaEventos.checked;
    reproducir('boton');
  });
  const campoSemilla = el('input', {
    class: 'nueva-partida__semilla',
    type: 'text',
    inputmode: 'text',
    value: String(semilla),
    'aria-label': t('juego.nuevaPartida.opciones.semilla'),
    spellcheck: 'false',
  });
  const errorSemilla = el(
    'p',
    { class: 'nueva-partida__error', hidden: true },
    t('juego.nuevaPartida.opciones.semillaNoValida'),
  );
  campoSemilla.addEventListener('input', () => {
    semilla = semillaDeTexto(campoSemilla.value);
    errorSemilla.hidden = semilla !== null;
    campoSemilla.setAttribute('aria-invalid', String(semilla === null));
    pintarEmpezar();
  });
  const otraSemilla = el(
    'button',
    {
      class: 'boton nueva-partida__dado',
      type: 'button',
      'aria-label': t('juego.nuevaPartida.opciones.semillaOtra'),
      title: t('juego.nuevaPartida.opciones.semillaOtra'),
    },
    '⟳',
  );
  otraSemilla.addEventListener('click', () => {
    semilla = semillaAlAzar();
    campoSemilla.value = String(semilla);
    errorSemilla.hidden = true;
    campoSemilla.setAttribute('aria-invalid', 'false');
    reproducir('boton');
    pintarEmpezar();
  });
  const empezar = el('button', {
    class: 'boton boton--principal nueva-partida__empezar',
    type: 'button',
  });
  empezar.addEventListener('click', () => {
    if (!conjunto || !elegido || semilla === null || empezada) return;
    const partida = crearPartida(
      { paisId: elegido, dificultad, eventosHistoricos: eventos, semilla },
      conjunto.paises,
      gobiernos?.paises ?? {},
      husos?.paises ?? {},
    );
    // Una sola partida aunque se pulse dos veces.
    empezada = true;
    empezar.disabled = true;
    // Transición con la bandera y la fecha (tarea f10-t4); la partida se abre debajo.
    transicionAPartida({
      pais: { id: elegido, nombre: conjunto.paises[elegido]!.nombre },
      fecha: partida.fecha,
      alCubrir: () => opciones.alEmpezar(partida),
    });
  });
  const panelEleccion = el(
    'aside',
    { class: 'nueva-partida__panel nueva-partida__panel--eleccion' },
    el(
      'div',
      { class: 'nueva-partida__desplazable' },
      el('h2', { class: 'nueva-partida__paso' }, t('juego.nuevaPartida.resumen.titulo')),
      resumen,
      aviso,
      el(
        'section',
        { class: 'nueva-partida__opciones' },
        el('h2', { class: 'nueva-partida__paso' }, t('juego.nuevaPartida.opciones.titulo')),
        el(
          'fieldset',
          { class: 'nueva-partida__grupo' },
          el('legend', {}, t('juego.nuevaPartida.opciones.dificultad')),
          el('div', { class: 'nueva-partida__segmentos' }, ...radios),
          descripcionDificultad,
          el(
            'p',
            { class: 'nueva-partida__nota' },
            t('juego.nuevaPartida.opciones.dificultadAviso'),
          ),
        ),
        el(
          'label',
          { class: 'nueva-partida__opcion nueva-partida__opcion--casilla' },
          casillaEventos,
          el(
            'span',
            {},
            el('strong', {}, t('juego.nuevaPartida.opciones.eventos')),
            el('small', {}, t('juego.nuevaPartida.opciones.eventosDescripcion')),
          ),
        ),
        el(
          'div',
          { class: 'nueva-partida__grupo' },
          el('span', { class: 'nueva-partida__legenda' }, t('juego.nuevaPartida.opciones.semilla')),
          el('div', { class: 'nueva-partida__fila-semilla' }, campoSemilla, otraSemilla),
          errorSemilla,
          el(
            'p',
            { class: 'nueva-partida__nota' },
            t('juego.nuevaPartida.opciones.semillaDescripcion'),
          ),
        ),
      ),
    ),
    empezar,
  );

  // ── Mapa ──────────────────────────────────────────────────────────────────────────────────
  const contenedorMapa = el('div', {
    class: 'mapa__contenedor nueva-partida__mapa',
    role: 'application',
    tabindex: 0,
    'aria-label': t('juego.mapa.etiqueta'),
  });
  const elemento = el(
    'section',
    { class: 'nueva-partida', 'aria-labelledby': 'nueva-partida-titulo' },
    contenedorMapa,
    panelLista,
    panelEleccion,
  );
  elemento.querySelector('h1')!.id = 'nueva-partida-titulo';
  document.body.appendChild(elemento);

  const mapa = opciones.sinMapa ? null : crearMapaDelJuego(contenedorMapa);
  const desconectar = mapa ? conectarGestos(contenedorMapa, mapa) : () => undefined;

  function pintarEmpezar(): void {
    const pais = elegido ? conjunto?.paises[elegido] : undefined;
    empezar.textContent = pais
      ? t('juego.nuevaPartida.empezar', { pais: pais.nombre })
      : t('juego.nuevaPartida.empezarSin');
    empezar.disabled = !pais || semilla === null || empezada;
  }

  function retratoLider(pais: PaisDatos): HTMLElement | null {
    const gobierno = gobiernos?.paises[pais.id];
    const cargo = gobierno ? jefeGobierno(gobierno) : null;
    if (!gobierno || !cargo) return null;
    const persona = gobiernos!.personas[cargo.persona];
    const imagen = el('span', { class: 'nueva-partida__retrato', 'aria-hidden': 'true' });
    imagen.innerHTML = svgRetrato(
      rasgosDe({
        pais: pais.id,
        region: pais.region,
        regimen: gobierno.regimen,
        sexo: persona?.sexo ?? null,
        edad: edadEn2010(persona),
        persona: cargo.persona,
      }),
      tono(mapa?.colorDePais(pais.id) ?? '#3a4a66', 0.7),
    );
    return el(
      'div',
      { class: 'nueva-partida__lider' },
      imagen,
      el(
        'span',
        {},
        el('small', {}, t('juego.nuevaPartida.resumen.lider')),
        el('strong', {}, persona?.nombre ?? cargo.persona),
        el('span', {}, cargo.cargo),
      ),
    );
  }

  /** Tesorería y popularidad iniciales (provisionales), con el desglose de la popularidad. */
  function valoresDeInicio(pais: PaisDatos): HTMLElement[] {
    const gobierno = gobiernos?.paises[pais.id];
    const popularidad = popularidadInicial(pais.datos, gobierno, FECHA_INICIO);
    const ingresos = pais.datos.ingresosPublicosPib;
    const fila = (clase: string, titulo: string, valor: string, nota?: string): HTMLElement =>
      el(
        'div',
        { class: `panel-pais__fila nueva-partida__inicio nueva-partida__inicio--${clase}` },
        el('dt', {}, titulo),
        el('dd', { class: 'es-estimado', title: nota }, `${valor}*`),
      );
    return [
      el(
        'dl',
        { class: 'panel-pais__datos nueva-partida__iniciales' },
        fila(
          'tesoreria',
          t('juego.nuevaPartida.resumen.tesoreria'),
          dolares(tesoreriaInicial(pais.datos)),
          typeof ingresos === 'number'
            ? t('juego.nuevaPartida.resumen.ingresos', { porcentaje: porcentaje(ingresos) })
            : undefined,
        ),
        fila(
          'popularidad',
          t('juego.nuevaPartida.resumen.popularidad'),
          `${enteros(popularidad.valor)} %`,
        ),
      ),
      el(
        'details',
        { class: 'nueva-partida__desglose' },
        el('summary', {}, t('juego.nuevaPartida.resumen.desglose')),
        el(
          'ul',
          {},
          ...popularidad.desglose.map((aporte) =>
            el(
              'li',
              { 'data-factor': aporte.factor },
              el('span', {}, t(`juego.nuevaPartida.resumen.factores.${aporte.factor}`)),
              el(
                'span',
                { class: 'nueva-partida__puntos' },
                aporte.factor === 'base' ? enteros(aporte.puntos) : puntosConSigno(aporte.puntos),
              ),
            ),
          ),
        ),
        el('p', { class: 'nueva-partida__nota' }, t('juego.nuevaPartida.resumen.provisional')),
      ),
    ];
  }

  function pintarResumen(): void {
    const pais = elegido ? conjunto?.paises[elegido] : undefined;
    if (!pais) {
      reemplazar(
        resumen,
        el('p', { class: 'nueva-partida__nota' }, t('juego.nuevaPartida.sinElegir')),
      );
      return;
    }
    const regimen = gobiernos?.paises[pais.id]?.regimen ?? null;
    const fila = (titulo: string, valor: string): HTMLElement =>
      el('div', { class: 'panel-pais__fila' }, el('dt', {}, titulo), el('dd', {}, valor));
    const valor = (campo: string, formato: (v: number) => string): string => {
      const v = pais.datos[campo];
      return v === null || v === undefined ? '—' : formato(v);
    };
    reemplazar(
      resumen,
      el(
        'header',
        { class: 'nueva-partida__pais' },
        el('img', {
          class: 'nueva-partida__bandera',
          src: urlBandera(pais.id),
          alt: '',
          width: 54,
          height: 40,
        }),
        el(
          'span',
          {},
          el('strong', { class: 'nueva-partida__nombre' }, pais.nombre),
          el('small', {}, `${t('juego.nuevaPartida.resumen.capital')}: ${pais.capital}`),
        ),
      ),
      retratoLider(pais),
      el(
        'dl',
        { class: 'panel-pais__datos' },
        regimen
          ? el(
              'div',
              { class: 'panel-pais__fila' },
              el('dt', {}, t('juego.nuevaPartida.resumen.regimen')),
              el(
                'dd',
                { class: 'ficha-regimen' },
                icono(`regimen-${regimen}`),
                t(`juego.mapa.pais.regimenes.${regimen}`),
              ),
            )
          : null,
        fila(t('juego.nuevaPartida.resumen.poblacion'), valor('poblacion', personas)),
        fila(t('juego.nuevaPartida.resumen.pib'), valor('pib', dolares)),
        fila(
          t('juego.nuevaPartida.resumen.pibPerCapita'),
          valor('pibPerCapita', dolaresPorPersona),
        ),
        husos?.paises[pais.id]
          ? fila(t('juego.nuevaPartida.resumen.huso'), etiquetaHuso(husos.paises[pais.id]![1]))
          : null,
      ),
      ...valoresDeInicio(pais),
    );
  }

  function pintarLista(): void {
    if (!conjunto) return;
    const jugables = Object.values(conjunto.paises).filter((p) => p.jugable);
    const visibles = ordenarPaises(filtrarPaises(jugables, filtro.value), criterio);
    reemplazar(
      lista,
      ...visibles.map((pais) => {
        const opcion = el(
          'li',
          {
            id: `nueva-partida-${pais.id}`,
            class: 'nueva-partida__pais-opcion',
            role: 'option',
            'aria-selected': String(pais.id === elegido),
            'data-pais': pais.id,
          },
          el('img', { src: urlBandera(pais.id), alt: '', width: 24, height: 18, loading: 'lazy' }),
          el('span', { class: 'nueva-partida__pais-nombre' }, pais.nombre),
          el('span', { class: 'nueva-partida__pais-dato' }, datoDeLista(pais, criterio)),
        );
        opcion.addEventListener('click', () => elegir(pais.id, true));
        return opcion;
      }),
    );
    if (visibles.length === 0)
      lista.append(el('li', { class: 'nueva-partida__vacia' }, t('juego.nuevaPartida.ninguno')));
    if (elegido) lista.setAttribute('aria-activedescendant', `nueva-partida-${elegido}`);
  }

  function marcarEnLista(): void {
    for (const opcion of lista.querySelectorAll<HTMLElement>('[role="option"]')) {
      const es = opcion.dataset.pais === elegido;
      opcion.setAttribute('aria-selected', String(es));
      if (es) opcion.scrollIntoView?.({ block: 'nearest' });
    }
    if (elegido) lista.setAttribute('aria-activedescendant', `nueva-partida-${elegido}`);
  }

  /** Elige un país (si es jugable): lista, resumen, mapa y botón de empezar. */
  function elegir(id: string, volar = false): void {
    const pais = conjunto?.paises[id];
    if (!pais) return;
    if (!pais.jugable) {
      aviso.textContent = t('juego.nuevaPartida.noJugable', {
        pais: pais.nombre,
        motivo: t(`juego.nuevaPartida.motivos.${pais.tipo}`),
      });
      if (mapa && elegido) mapa.seleccionar(elegido);
      return;
    }
    aviso.textContent = '';
    const cambia = id !== elegido;
    elegido = id;
    marcarEnLista();
    pintarResumen();
    pintarEmpezar();
    if (mapa) {
      if (volar) mapa.irA({ tipo: 'pais', id });
      else mapa.seleccionar(id);
    }
    if (cambia) {
      reproducir('seleccionar');
      // El país elegido entra con una animación corta y su bandera «salta» (tarea f10-t4).
      void animar(resumen, FOTOGRAMAS.pestana(1), DURACIONES.pestana);
      const bandera = resumen.querySelector('.nueva-partida__bandera');
      if (bandera) {
        void animar(
          bandera,
          [
            { opacity: 0, scale: '0.5', rotate: '-6deg' },
            { opacity: 1, scale: '1.12', rotate: '2deg', offset: 0.6 },
            { opacity: 1, scale: '1', rotate: '0deg' },
          ],
          320,
        );
      }
    }
  }

  // Desde el mapa: un país, o el país de la región o la ciudad que se toque.
  if (mapa) {
    mapa.alSeleccionar = (objetivo: Objetivo | null) => {
      if (!objetivo) {
        // Un clic en el mar no quita la elección.
        if (elegido) mapa.seleccionar(elegido);
        return;
      }
      const id =
        objetivo.tipo === 'pais'
          ? objetivo.id
          : objetivo.tipo === 'region'
            ? objetivo.region.pais
            : objetivo.ciudad.pais;
      if (objetivo.tipo !== 'pais') mapa.seleccionar(id);
      else elegir(id);
    };
  }

  // Teclado en la lista: flechas, Inicio y Fin eligen; Intro lleva el mapa al país.
  lista.addEventListener('keydown', (evento) => {
    const opcionesVisibles = [...lista.querySelectorAll<HTMLElement>('[role="option"]')];
    if (opcionesVisibles.length === 0) return;
    const actual = opcionesVisibles.findIndex((o) => o.dataset.pais === elegido);
    let siguiente: number | null = null;
    if (evento.key === 'ArrowDown') siguiente = Math.min(opcionesVisibles.length - 1, actual + 1);
    else if (evento.key === 'ArrowUp') siguiente = Math.max(0, actual - 1);
    else if (evento.key === 'Home') siguiente = 0;
    else if (evento.key === 'End') siguiente = opcionesVisibles.length - 1;
    else if (evento.key === 'Enter' && elegido) {
      evento.preventDefault();
      mapa?.irA({ tipo: 'pais', id: elegido });
      return;
    }
    if (siguiente === null) return;
    evento.preventDefault();
    elegir(opcionesVisibles[siguiente]!.dataset.pais!);
  });
  filtro.addEventListener('input', pintarLista);
  orden.addEventListener('change', () => {
    criterio = orden.value as CriterioOrden;
    reproducir('boton');
    pintarLista();
  });
  volver.addEventListener('click', () => {
    reproducir('boton');
    opciones.alVolver();
  });

  const listo = (
    paises: ConjuntoPaises,
    gob: ConjuntoGobiernos | null,
    hus: ConjuntoHusos | null,
  ): void => {
    conjunto = paises;
    gobiernos = gob;
    husos = hus;
    const jugables = Object.values(paises.paises).filter((p) => p.jugable).length;
    ayuda.textContent = t('juego.nuevaPartida.eligeAyuda', { n: jugables });
    if (mapa) mapa.nombres = new Map(Object.values(paises.paises).map((p) => [p.id, p.nombre]));
    pintarLista();
    pintarResumen();
    pintarEmpezar();
  };
  pintarResumen();
  pintarEmpezar();
  if (opciones.datos) {
    listo(opciones.datos.paises, opciones.datos.gobiernos, opciones.datos.husos ?? null);
  } else {
    Promise.all([
      fetch('./data/paises-2010.json').then((r) =>
        r.ok ? (r.json() as Promise<ConjuntoPaises>) : Promise.reject(new Error(String(r.status))),
      ),
      fetch('./data/gobiernos-2010.json')
        .then((r) => (r.ok ? (r.json() as Promise<ConjuntoGobiernos>) : null))
        .catch(() => null),
      fetch('./data/husos-2010.json')
        .then((r) => (r.ok ? (r.json() as Promise<ConjuntoHusos>) : null))
        .catch(() => null),
    ])
      .then(([paises, gob, hus]) => listo(paises, gob, hus))
      .catch(() => {
        ayuda.textContent = t('juego.mapa.error');
      });
  }
  mapa?.iniciar().catch(() => undefined);
  if (mapa) contenedorMapa.focus({ preventScroll: true });

  return {
    elemento,
    mapa,
    elegir: (id) => elegir(id, true),
    cerrar() {
      desconectar();
      mapa?.destruir();
      elemento.remove();
    },
  };
}
