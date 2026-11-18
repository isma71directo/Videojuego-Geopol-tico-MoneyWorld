/**
 * Galería audiovisual: muestra el contenido gráfico del juego para poder revisarlo en el
 * móvil al cerrar cada fase (GDD, sección 7.1): mapa de 2010, paleta, iconos, sonidos, componentes
 * de interfaz (Fase 7) y banderas.
 */
import '../src/ui/estilos/base.css';
import './estilos.css';

import { urlBandera } from '../src/av/banderas';
import { NOMBRES_ICONOS, icono } from '../src/av/iconos';
import { EFECTOS, MotorSonido, type Efecto } from '../src/av/sonido';
import { PIEZAS_TENSAS } from '../src/av/musica/piezas-tensas';
import { PIEZAS_TRANQUILAS } from '../src/av/musica/piezas-tranquilas';
import { ReproductorMusica } from '../src/av/musica/reproductor';
import type { PlanPieza } from '../src/av/musica/arreglista';
import { capaPorId, COLOR_SIN_RESERVAS } from '../src/map/capas';
import { etiquetaCapa, opcionesCapas, POLITICA } from '../src/ui/selector-capas';
import { preferenciasDeColor } from '../src/map/colores';
import tablaColores from '../src/map/config/colores-pais.json';
import { rasgosDe, svgRetrato, tieneHomenaje, tono } from '../src/av/retratos';
import { edadEn2010, jefeGobierno, type ConjuntoGobiernos } from '../src/datos/gobiernos';

/** Color de cada país en el mapa político (fondo de los retratos). */
let coloresPais: Record<string, string> = {};
import type { ConjuntoPaises, PaisDatos } from '../src/datos/paises';
import { vistaPreviaMapa, type TopologiaMapa } from '../src/map/vista-previa';
import { t } from '../src/i18n';
import { el, reemplazar, type Hijo } from '../src/ui/dom';
import { sonidosDeComponentes } from '../src/ui/componentes/sonidos';
import { muestrario } from './muestrario';
import { mostrarAvisoSuceso } from '../src/ui/aviso-suceso';
import { ICONO_ALERTA, mostrarAlertaEconomica, SONIDO_ALERTA } from '../src/ui/alerta-economica';
import { ALERTAS_GRAVES, TIPOS_ALERTA, type TipoAlerta } from '../src/sim/alertas';
import { filaGuardado, etiquetaGuardado } from '../src/ui/guardar-cargar';
import { crearIndicadorGuardado } from '../src/ui/indicador-guardado';
import { bloqueEconomia } from '../src/ui/economia-en-vivo';
import { bloquePresupuesto } from '../src/ui/presupuesto-en-vivo';
import { distintivoRating } from '../src/ui/rating';
import { editorPresupuesto } from '../src/ui/presupuesto-editable';
import { presupuestoMinisterio } from '../src/ui/presupuesto-ministerio';
import { fechaDelMes, haciendaDelMes } from '../src/sim/hacienda';
import type { CambioPresupuesto } from '../src/sim/presupuesto';
import {
  avanzarMercado,
  gestionarCrisis,
  mercadoInicial,
  RATINGS,
  type MercadoDeuda,
} from '../src/sim/deuda';
import {
  avanzarPresupuesto,
  presupuestoInicial,
  type PresupuestoPais,
} from '../src/sim/presupuesto';
import { avanzarMes, economiaInicial, nivelDe, type EconomiaPais } from '../src/sim/economia';
import { almacenEnMemoria } from '../src/ui/almacen-partidas';
import type { ResumenGuardado } from '../src/sim/guardado';
import { FORMATO_PARTIDA } from '../src/sim/partida';
import { VERSION } from '../src/compartido/version';
import { RECURSOS_POR_TIPO, type TipoRecurso } from '../src/datos/regiones-economia';
import { iconoDeRecurso } from '../src/ui/ficha-region';

/** Ruta desde /galeria/ hasta la raíz del juego. */
const RAIZ = '../';

const raiz = document.querySelector<HTMLElement>('#galeria')!;

function cabecera(): HTMLElement {
  return el(
    'header',
    { class: 'galeria__cabecera' },
    el('p', { class: 'galeria__juego' }, t('comun.titulo')),
    el('h1', {}, t('galeria.titulo')),
    el('p', { class: 'galeria__nota' }, t('galeria.subtitulo')),
    el(
      'nav',
      { class: 'galeria__enlaces' },
      el('a', { class: 'boton', href: RAIZ }, t('galeria.juego')),
      el('a', { class: 'boton', href: `${RAIZ}hoja-de-ruta/` }, t('galeria.hojaDeRuta')),
    ),
  );
}

function seccion(titulo: string, nota: string, ...hijos: Hijo[]): HTMLElement {
  return el(
    'section',
    { class: 'galeria__seccion' },
    el('h2', {}, titulo),
    el('p', { class: 'galeria__nota' }, nota),
    ...hijos,
  );
}

function iconos(): HTMLElement {
  return seccion(
    t('galeria.iconos.titulo'),
    t('galeria.iconos.nota'),
    el(
      'ul',
      { class: 'galeria__iconos' },
      ...NOMBRES_ICONOS.map((nombre) =>
        el('li', {}, icono(nombre), el('span', {}, t(`galeria.iconos.${nombre}`))),
      ),
    ),
  );
}

const sonido = new MotorSonido({ silenciado: false, volumenEfectos: 0.8, volumenMusica: 0.5 });
// Los componentes del muestrario suenan al usarlos (siempre son acciones del jugador).
sonidosDeComponentes((efecto) => {
  sonido.activar();
  sonido.reproducir(efecto);
});

function sonidos(): HTMLElement {
  return seccion(
    t('galeria.sonidos.titulo'),
    t('galeria.sonidos.nota'),
    el(
      'ul',
      { class: 'galeria__sonidos' },
      ...(Object.keys(EFECTOS) as Efecto[]).map((efecto) => {
        const nombre = t(`galeria.sonidos.${efecto}`);
        const boton = el(
          'button',
          {
            class: 'boton',
            type: 'button',
            'aria-label': t('galeria.sonidos.escuchar', { efecto: nombre }),
          },
          icono('sonido'),
          nombre,
        );
        boton.addEventListener('click', () => {
          // El clic es la interacción que el navegador pide para poder sonar.
          sonido.activar();
          sonido.reproducir(efecto);
        });
        return el('li', {}, boton);
      }),
    ),
  );
}

/** Música ambiental (tareas f12-t3 y f12-t4): cada pieza, y el cambio de ambiente con fundido. */
const musica = new ReproductorMusica({ tranquila: PIEZAS_TRANQUILAS, tensa: PIEZAS_TENSAS }, () =>
  sonido.salidaMusica(),
);

function duracionDe(plan: PlanPieza): string {
  const segundos = Math.round(musica.partitura(plan).duracion);
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

function musicaAmbiental(): HTMLElement {
  const sonando = el('p', { class: 'galeria__nota', role: 'status' }, t('galeria.musica.nada'));
  const decir = (): void => {
    sonando.textContent = musica.tituloActual
      ? t('galeria.musica.sonando', {
          titulo: musica.tituloActual,
          ambiente: t(`galeria.musica.${musica.ambienteActual}`),
        })
      : t('galeria.musica.nada');
  };
  const lista = (piezas: readonly PlanPieza[], titulo: string): HTMLElement =>
    el(
      'div',
      {},
      el('h3', {}, titulo),
      el(
        'ul',
        { class: 'galeria__sonidos' },
        ...piezas.map((plan) => {
          const boton = el(
            'button',
            {
              class: 'boton',
              type: 'button',
              'aria-label': t('galeria.musica.escuchar', { titulo: plan.titulo }),
            },
            icono('sonido'),
            `${plan.titulo} · ${duracionDe(plan)}`,
          );
          boton.addEventListener('click', () => {
            sonido.activar();
            musica.reproducirPieza(plan);
            decir();
          });
          return el('li', {}, boton);
        }),
      ),
    );
  const accion = (texto: string, hacer: () => void): HTMLButtonElement => {
    const boton = el('button', { class: 'boton', type: 'button' }, texto);
    boton.addEventListener('click', () => {
      sonido.activar();
      hacer();
      decir();
    });
    return boton;
  };
  return seccion(
    t('galeria.musica.titulo'),
    t('galeria.musica.nota'),
    el(
      'div',
      { class: 'galeria__botones' },
      accion(t('galeria.musica.aTranquila'), () => {
        musica.empezar();
        musica.ponerAmbiente('tranquila');
      }),
      accion(t('galeria.musica.aTensa'), () => {
        musica.empezar();
        musica.ponerAmbiente('tensa');
      }),
      accion(t('galeria.musica.parar'), () => musica.parar()),
    ),
    sonando,
    lista(PIEZAS_TRANQUILAS, t('galeria.musica.tranquilas')),
    lista(PIEZAS_TENSAS, t('galeria.musica.tensas')),
  );
}

/** Aviso de la pausa automática (tarea f13-t4): la ventana del centro con su campanada. */
function avisoPausa(): HTMLElement {
  const estado = el('p', { class: 'galeria__nota', role: 'status' }, t('galeria.aviso.nada'));
  const boton = el(
    'button',
    { class: 'boton', type: 'button' },
    icono('pausa'),
    t('galeria.aviso.ver'),
  );
  boton.addEventListener('click', () => {
    sonido.activar();
    sonido.reproducir('aviso');
    mostrarAvisoSuceso({
      suceso: {
        id: 'galeria',
        titulo: t('galeria.aviso.ejemploTitulo'),
        texto: t('galeria.aviso.ejemploTexto'),
        fecha: '2010-03-14',
        hora: 21,
        importante: true,
        origen: 'politica',
      },
      alSeguir: () => {
        sonido.reproducir('seguir');
        estado.textContent = t('galeria.aviso.seguido');
      },
      alCerrar: () => {
        sonido.reproducir('cerrar');
        estado.textContent = t('galeria.aviso.enPausa');
      },
    });
  });
  return seccion(
    t('galeria.aviso.titulo'),
    t('galeria.aviso.nota'),
    el('ul', { class: 'galeria__sonidos' }, el('li', {}, boton)),
    estado,
  );
}

/** Un dato de ejemplo para cada alerta (tanto por uno). */
const EJEMPLO_ALERTA: Record<TipoAlerta, number> = {
  recesion: -0.031,
  paro: 0.214,
  inflacion: 0.124,
  inflacionGrave: 0.27,
  deflacion: -0.008,
  // (La prima de riesgo, en puntos.)
  crisisDeuda: 16.4,
  ratingBaja: 6.3,
  ratingSube: 2.1,
  // (La tesorería, en dólares.)
  sinTesoreria: -4.2e9,
  tesoreriaBaja: 11.8e9,
};
/** La nota de ejemplo de las alertas del rating. */
const EJEMPLO_RATING: Partial<Record<TipoAlerta, string>> = { ratingBaja: 'BB-', ratingSube: 'A' };

/** Alertas económicas (tarea f16-t4): cada una con su icono, su sonido y su tarjeta. */
function alertasEconomicas(): HTMLElement {
  return seccion(
    t('galeria.alertas.titulo'),
    t('galeria.alertas.nota'),
    el(
      'ul',
      { class: 'galeria__sonidos' },
      ...TIPOS_ALERTA.map((tipo) => {
        const boton = el(
          'button',
          { class: 'boton', type: 'button' },
          icono(ICONO_ALERTA[tipo]),
          t(`juego.alertas.${tipo}.titulo`),
        );
        boton.addEventListener('click', () => {
          sonido.activar();
          sonido.reproducir(SONIDO_ALERTA[tipo]);
          mostrarAlertaEconomica({
            id: `galeria-${tipo}`,
            titulo: '',
            texto: '',
            fecha: '2011-06-01',
            hora: 1,
            importante: ALERTAS_GRAVES.has(tipo),
            origen: 'economia',
            alerta: { tipo, valor: EJEMPLO_ALERTA[tipo], rating: EJEMPLO_RATING[tipo] },
          });
        });
        return el('li', {}, boton);
      }),
    ),
  );
}

/**
 * El rating de la deuda (tarea f18-t4): todas las notas con el color de su escalón y un
 * distintivo de ejemplo que salta al bajar o subir, con el sonido de su alerta.
 */
function ratingDeuda(): HTMLElement {
  // (De AAA a D: la lista ya acaba en C y D.)
  const notas: string[] = [...RATINGS];
  let indice = notas.indexOf('BBB');
  const ejemplo = el('div', { class: 'galeria__rating' }, distintivoRating(notas[indice]!));
  const probar = (texto: string, hacer: () => void): HTMLButtonElement => {
    const boton = el('button', { class: 'boton', type: 'button' }, texto);
    boton.addEventListener('click', hacer);
    return boton;
  };
  const mover = (paso: 1 | -1): void => {
    const nuevo = Math.min(notas.length - 1, Math.max(0, indice + paso));
    if (nuevo === indice) return;
    const antes = notas[indice]!;
    indice = nuevo;
    sonido.activar();
    sonido.reproducir(paso > 0 ? 'alertaRatingBaja' : 'alertaRatingSube');
    ejemplo.replaceChildren(distintivoRating(notas[indice]!, antes));
  };
  return seccion(
    t('galeria.rating.titulo'),
    t('galeria.rating.nota'),
    el('p', { class: 'galeria__nota' }, t('galeria.rating.escala')),
    el(
      'ul',
      { class: 'rating-escala' },
      ...notas.map((nota) => el('li', {}, distintivoRating(nota))),
    ),
    el(
      'div',
      { class: 'galeria__botones' },
      probar(t('galeria.rating.bajar'), () => mover(1)),
      probar(t('galeria.rating.subir'), () => mover(-1)),
    ),
    ejemplo,
  );
}

/**
 * Guardar y cargar (tarea f14-t4): cómo se ve cada guardado en las ventanas «Guardar partida» y
 * «Cargar partida» (con datos de ejemplo) y el indicador que aparece al guardar, con su sonido.
 */
function guardarCargar(conjunto: ConjuntoPaises): HTMLElement {
  const nombreDe = (id: string): string => conjunto.paises[id]?.nombre ?? id;
  const ejemplo = (
    tipo: ResumenGuardado['tipo'],
    ranura: number | null,
    paisId: string,
    fecha: string,
    hora: number,
  ): ResumenGuardado => ({
    id: `ejemplo-${tipo}-${ranura ?? fecha}`,
    tipo,
    ranura,
    partidaId: 'ejemplo',
    paisId,
    fecha,
    hora,
    guardadoEn: new Date(Date.UTC(2026, 10, 17, 9, 30)).toISOString(),
    version: VERSION,
    formato: FORMATO_PARTIDA,
  });
  const opciones = { almacen: almacenEnMemoria(), nombreDe, raiz: RAIZ };
  const fila = (resumen: ResumenGuardado | null, etiqueta: string): HTMLElement =>
    el(
      'li',
      {},
      filaGuardado(resumen, {
        ...opciones,
        etiqueta,
        alElegir: () => {
          sonido.activar();
          sonido.reproducir('boton');
        },
      }),
    );
  const guardados = [
    { ...ejemplo('manual', 1, 'ESP', '2011-03-14', 9), nombre: t('galeria.guardado.nombre') },
    ejemplo('automatico', null, 'JPN', '2012-06-01', 0),
    ejemplo('anual', null, 'BRA', '2013-01-01', 0),
  ];
  const lista = el(
    'ol',
    { class: 'guardados galeria__guardados' },
    fila(guardados[0]!, etiquetaGuardado(guardados[0]!)),
    fila(null, t('juego.guardado.ranura', { n: 2 })),
    fila(guardados[1]!, etiquetaGuardado(guardados[1]!)),
    fila(guardados[2]!, etiquetaGuardado(guardados[2]!)),
  );
  const indicador = crearIndicadorGuardado({ alSonar: () => sonido.reproducir('guardado') });
  let espera: number | null = null;
  const probar = (texto: string, hacer: () => void): HTMLButtonElement => {
    const boton = el('button', { class: 'boton', type: 'button' }, texto);
    boton.addEventListener('click', () => {
      sonido.activar();
      if (espera !== null) clearTimeout(espera);
      hacer();
    });
    return boton;
  };
  /** Como en la partida: «Guardando…» un momento y después lo guardado. */
  const guardar = (texto: string, sonar: boolean): void => {
    indicador.guardando();
    espera = window.setTimeout(() => indicador.hecho(texto, sonar), 700);
  };
  return seccion(
    t('galeria.guardado.titulo'),
    t('galeria.guardado.nota'),
    lista,
    el(
      'div',
      { class: 'galeria__botones' },
      probar(t('galeria.guardado.aMano'), () => guardar(t('juego.guardado.hecho', { n: 1 }), true)),
      probar(t('galeria.guardado.automatico'), () =>
        guardar(t('juego.guardado.hechoAutomatico'), false),
      ),
      probar(t('galeria.guardado.error'), () => indicador.error(t('juego.guardado.error'))),
    ),
    el('div', { class: 'galeria__indicador' }, indicador.elemento),
  );
}

/**
 * La economía de un país (tarea f15-t4): el bloque que se ve en la ficha y en Economía ›
 * Economía, con los datos reales de 2010 de cuatro países, para verlo crecer año a año.
 */
function economia(conjunto: ConjuntoPaises): HTMLElement {
  const PAISES = ['ESP', 'CHN', 'GRC', 'USA'];
  let paisId = PAISES[0]!;
  let actual: EconomiaPais | null = null;
  // Y su presupuesto (tarea f17-t4), con la tesorería: un mes de ingresos, como en la partida, y
  // el mercado de su deuda (tarea f18-t4), con su crisis si llega (como la IA).
  let presupuesto: PresupuestoPais | null = null;
  let mercado: MercadoDeuda | null = null;
  const estado = { tesoreria: 0 };
  let fecha = '2010-01-01';
  const empezar = (): void => {
    const pais = conjunto.paises[paisId];
    actual = pais ? economiaInicial(pais.datos, pais.nivelRenta) : null;
    presupuesto = pais ? presupuestoInicial(pais.datos, nivelDe(pais.nivelRenta), actual) : null;
    estado.tesoreria = presupuesto
      ? Object.values(presupuesto.ingresos).reduce((a, b) => a + b, 0) / 12
      : 0;
    mercado =
      pais && actual && presupuesto
        ? mercadoInicial(paisId, pais.datos as never, pais.region, actual, presupuesto)
        : null;
    fecha = '2010-01-01';
  };
  empezar();
  const fuentePresupuesto = () => ({
    presupuesto,
    economia: actual,
    tesoreria: estado.tesoreria,
    fecha,
    mercado,
  });
  let bloque = bloqueEconomia(() => ({ economia: actual, fecha }), { anchoGrafico: 520 });
  let bloqueP = bloquePresupuesto(fuentePresupuesto, { completo: true, anchoGrafico: 520 });
  // Y el presupuesto nuevo (tarea f19-t2): lo aprobado se aplica al avanzar, como en la partida
  // (el día 1 del mes siguiente).
  let pendientes: CambioPresupuesto[] = [];
  const crearEditor = () =>
    editorPresupuesto({
      fuente: () => ({
        id: paisId,
        presupuesto,
        economia: actual,
        fecha,
        mercado,
        tesoreria: estado.tesoreria,
      }),
      ordenar: (cambios) => {
        pendientes.push(...cambios);
      },
    });
  let editor = crearEditor();
  // Y la pestaña «Presupuesto» de un ministerio (ajuste f19-a3): Trabajo y Seguridad Social, con
  // las pensiones y el paro.
  const crearMinisterio = () =>
    presupuestoMinisterio({
      ministerio: 'trabajo',
      fuente: () => ({ presupuesto, economia: actual, fecha }),
      ordenar: (cambios) => {
        pendientes.push(...cambios);
      },
    });
  let ministerio = crearMinisterio();
  const contenedor = el(
    'div',
    { class: 'galeria__economia' },
    bloque.elemento,
    bloqueP.elemento,
    editor.elemento,
    ministerio.elemento,
  );
  /** Rehace los bloques (con sus gráficos animados) al cambiar de país o volver a 2010. */
  const rehacer = (): void => {
    bloque = bloqueEconomia(() => ({ economia: actual, fecha }), { anchoGrafico: 520 });
    bloqueP = bloquePresupuesto(fuentePresupuesto, { completo: true, anchoGrafico: 520 });
    pendientes = [];
    editor = crearEditor();
    ministerio = crearMinisterio();
    contenedor.replaceChildren(
      bloque.elemento,
      bloqueP.elemento,
      editor.elemento,
      ministerio.elemento,
    );
  };
  const boton = (texto: string, hacer: () => void): HTMLButtonElement => {
    const b = el('button', { class: 'boton', type: 'button' }, texto);
    b.addEventListener('click', () => {
      sonido.activar();
      sonido.reproducir('boton');
      hacer();
    });
    return b;
  };
  return seccion(
    t('galeria.economia.titulo'),
    t('galeria.economia.nota'),
    el(
      'div',
      { class: 'galeria__botones' },
      ...PAISES.map((id) =>
        boton(conjunto.paises[id]?.nombre ?? id, () => {
          paisId = id;
          empezar();
          rehacer();
        }),
      ),
    ),
    el(
      'div',
      { class: 'galeria__botones' },
      boton(t('galeria.economia.avanzar'), () => {
        if (!actual) return;
        for (let mes = 0; mes < 12; mes++) {
          avanzarMes(actual);
          if (presupuesto) avanzarPresupuesto(presupuesto, actual, estado);
          if (presupuesto && mercado) {
            avanzarMercado(paisId, mercado, actual, presupuesto, 0);
            gestionarCrisis(mercado, actual, presupuesto, { esJugador: false });
          }
          if (presupuesto) {
            haciendaDelMes(presupuesto, actual, mercado, {
              esJugador: true,
              fecha: fechaDelMes(actual.meses),
              cambios: pendientes,
              estado,
            });
            pendientes = [];
          }
        }
        fecha = `${Number(fecha.slice(0, 4)) + 1}-01-01`;
        bloque.actualizar();
        bloqueP.actualizar();
        editor.actualizar();
        ministerio.actualizar();
      }),
      boton(t('galeria.economia.reiniciar'), () => {
        empezar();
        rehacer();
      }),
    ),
    contenedor,
  );
}

/** Colores de referencia de la tabla de colores representativos (ajuste f7-a3). */
function referencias(): HTMLElement {
  return seccion(
    t('galeria.paleta.titulo'),
    t('galeria.paleta.nota'),
    el(
      'ul',
      { class: 'galeria__paleta' },
      ...Object.entries(tablaColores.colores).map(([nombre, color]) => {
        const muestra = el('span', { class: 'galeria__color', 'aria-hidden': 'true' });
        muestra.style.background = color;
        return el('li', {}, muestra, el('span', {}, nombre));
      }),
    ),
  );
}

/**
 * Color de cada país en el mapa político (ajustes f7-a1 y f7-a3): para que el jugador revise si
 * cada uno lleva el que se le asocia. Son los mismos que usa el juego (data/colores-pais.json):
 * a la izquierda, el color pedido en la tabla (o el de la bandera); a la derecha, el del mapa.
 */
function coloresPaises(colores: Record<string, string>, conjunto: ConjuntoPaises): HTMLElement {
  const preferencias = preferenciasDeColor();
  const tabla = tablaColores.paises as Record<string, readonly string[]>;
  const paises = Object.keys(colores)
    .map((id) => ({ id, nombre: conjunto.paises[id]?.nombre ?? id }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return seccion(
    t('galeria.coloresPais.titulo'),
    t('galeria.coloresPais.nota'),
    el(
      'ul',
      { class: 'galeria__colores-pais' },
      ...paises.map(({ id, nombre }) => {
        const pedido = el('span', { class: 'galeria__color-pedido', 'aria-hidden': 'true' });
        pedido.style.background = preferencias.get(id)?.colores[0] ?? 'transparent';
        const muestra = el('span', { class: 'galeria__color-pais', 'aria-hidden': 'true' });
        muestra.style.background = colores[id]!;
        const deseado = tabla[id]?.join(', ') ?? t('galeria.coloresPais.bandera');
        return el(
          'li',
          { title: `${deseado} → ${colores[id]!}` },
          el('img', {
            src: urlBandera(id, RAIZ),
            alt: '',
            width: 32,
            height: 24,
            loading: 'lazy',
            decoding: 'async',
          }),
          pedido,
          muestra,
          el(
            'span',
            { class: 'galeria__color-nombre' },
            el('span', {}, nombre),
            el('small', {}, deseado),
          ),
        );
      }),
    ),
  );
}

/**
 * Retratos ilustrados de los jefes de Estado y de Gobierno de 2010 (tareas f8-t3 y f8-t4): los
 * homenajes primero y después todos los demás, para revisarlos.
 */
function retratos(gobiernos: ConjuntoGobiernos, conjunto: ConjuntoPaises): HTMLElement {
  const tarjetas: { orden: string; homenaje: boolean; elemento: HTMLElement }[] = [];
  const vistos = new Set<string>();
  for (const [id, gobierno] of Object.entries(gobiernos.paises)) {
    const pais = conjunto.paises[id];
    if (!pais || pais.tipo === 'dependiente') continue;
    for (const cargo of [gobierno.estado, jefeGobierno(gobierno)]) {
      if (!cargo || vistos.has(cargo.persona)) continue;
      vistos.add(cargo.persona);
      const persona = gobiernos.personas[cargo.persona];
      const rasgos = rasgosDe({
        pais: id,
        region: pais.region,
        regimen: gobierno.regimen,
        sexo: persona?.sexo ?? null,
        edad: edadEn2010(persona),
        persona: cargo.persona,
      });
      const imagen = el('span', { class: 'galeria__retrato', 'aria-hidden': 'true' });
      imagen.innerHTML = svgRetrato(rasgos, tono(coloresPais[id] ?? '#3a4a66', 0.7));
      tarjetas.push({
        orden: `${pais.nombre} ${cargo === gobierno.estado ? 1 : 2}`,
        homenaje: tieneHomenaje(cargo.persona),
        elemento: el(
          'li',
          {},
          imagen,
          el(
            'span',
            { class: 'galeria__color-nombre' },
            el('strong', {}, persona?.nombre ?? cargo.persona),
            el('small', {}, `${pais.nombre} · ${cargo.cargo}`),
          ),
        ),
      });
    }
  }
  tarjetas.sort(
    (a, b) => Number(b.homenaje) - Number(a.homenaje) || a.orden.localeCompare(b.orden, 'es'),
  );
  return seccion(
    t('galeria.retratos.titulo', { n: tarjetas.length }),
    t('galeria.retratos.nota', { homenajes: tarjetas.filter((x) => x.homenaje).length }),
    el('ul', { class: 'galeria__retratos' }, ...tarjetas.map((x) => x.elemento)),
  );
}

/** Recursos de las regiones con su icono y el color de su tipo (tarea f9-t4). */
function recursos(): HTMLElement {
  return seccion(
    t('galeria.recursos.titulo'),
    t('galeria.recursos.nota'),
    ...(Object.keys(RECURSOS_POR_TIPO) as TipoRecurso[]).map((tipo) =>
      el(
        'div',
        { class: 'galeria__recursos-grupo' },
        el('h3', {}, t(`juego.mapa.region.recursos.tipos.${tipo}`)),
        el(
          'ul',
          { class: 'galeria__recursos' },
          ...RECURSOS_POR_TIPO[tipo].map((recurso) =>
            el(
              'li',
              {},
              el(
                'span',
                { class: `galeria__recurso galeria__recurso--${tipo}` },
                icono(iconoDeRecurso(recurso)),
              ),
              t(`juego.mapa.region.recursos.nombres.${recurso}`),
            ),
          ),
        ),
      ),
    ),
  );
}

/** Rampas de color de las capas del mapa (tarea f6-t4). */
function capas(): HTMLElement {
  return seccion(
    t('galeria.capas.titulo'),
    t('galeria.capas.nota'),
    el(
      'ul',
      { class: 'galeria__capas' },
      ...opcionesCapas()
        .filter((opcion) => opcion.id !== POLITICA)
        .map((opcion) => {
          const capa = capaPorId(opcion.id)!;
          const colores = capa.cero ? [COLOR_SIN_RESERVAS, ...capa.colores] : [...capa.colores];
          return el(
            'li',
            {},
            el(
              'span',
              { class: 'galeria__capa-nombre' },
              icono(opcion.icono),
              etiquetaCapa(opcion.id),
            ),
            el(
              'span',
              { class: 'galeria__rampa', 'aria-hidden': 'true' },
              ...colores.map((color) => {
                const muestra = el('span', {});
                muestra.style.background = color;
                return muestra;
              }),
            ),
          );
        }),
    ),
  );
}

function bandera(pais: PaisDatos): HTMLElement {
  return el(
    'li',
    { class: 'galeria__bandera' },
    el('img', {
      src: urlBandera(pais.id, RAIZ),
      alt: t('galeria.banderas.alt', { pais: pais.nombre }),
      width: 96,
      height: 72,
      loading: 'lazy',
      decoding: 'async',
    }),
    el('span', {}, pais.nombre),
  );
}

function banderas(conjunto: ConjuntoPaises): HTMLElement[] {
  const orden = Object.values(conjunto.paises).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es'),
  );
  const estados = orden.filter((pais) => pais.tipo === 'pais');
  const especiales = orden.filter((pais) => pais.tipo === 'especial');
  const dependientes = orden.filter((pais) => pais.tipo === 'dependiente');
  return [
    seccion(
      t('galeria.banderas.titulo', { n: estados.length }),
      t('galeria.banderas.nota'),
      el('ul', { class: 'galeria__banderas' }, ...estados.map(bandera)),
    ),
    seccion(
      t('galeria.banderas.especiales', { n: especiales.length }),
      t('galeria.banderas.notaEspeciales'),
      el('ul', { class: 'galeria__banderas' }, ...especiales.map(bandera)),
    ),
    seccion(
      t('galeria.banderas.dependientes', { n: dependientes.length }),
      t('galeria.banderas.notaDependientes'),
      el('ul', { class: 'galeria__banderas' }, ...dependientes.map(bandera)),
    ),
  ];
}

function leyenda(): HTMLElement {
  const elemento = (clase: string, texto: string): HTMLElement =>
    el('li', {}, el('span', { class: `galeria__muestra ${clase}`, 'aria-hidden': 'true' }), texto);
  return el(
    'ul',
    { class: 'galeria__leyenda' },
    elemento('mapa-previo__pais--pais', t('galeria.mapa.estados')),
    elemento('mapa-previo__pais--especial', t('galeria.mapa.especiales')),
    elemento('mapa-previo__pais--dependiente', t('galeria.mapa.dependientes')),
    elemento('mapa-previo__zona', t('galeria.mapa.zonas')),
  );
}

function mapa(topo: TopologiaMapa, conjunto: ConjuntoPaises): HTMLElement {
  return seccion(
    t('galeria.mapa.titulo'),
    t('galeria.mapa.nota'),
    el(
      'figure',
      { class: 'galeria__mapa' },
      vistaPreviaMapa(topo, conjunto, t('galeria.mapa.alt')),
      leyenda(),
    ),
  );
}

async function descargar<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(`${RAIZ}${ruta}`);
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return (await respuesta.json()) as T;
}

async function iniciar(): Promise<void> {
  reemplazar(
    raiz,
    cabecera(),
    iconos(),
    el('p', { class: 'galeria__nota' }, t('galeria.cargando')),
  );
  try {
    const [conjunto, topo, coloresDelMapa, gobiernos] = await Promise.all([
      descargar<ConjuntoPaises>('data/paises-2010.json'),
      descargar<TopologiaMapa>('data/mapa-2010-mundo.json'),
      descargar<{ colores: Record<string, string> }>('data/colores-pais.json'),
      descargar<ConjuntoGobiernos>('data/gobiernos-2010.json'),
    ]);
    coloresPais = coloresDelMapa.colores;
    reemplazar(
      raiz,
      cabecera(),
      mapa(topo, conjunto),
      coloresPaises(coloresDelMapa.colores, conjunto),
      referencias(),
      capas(),
      iconos(),
      recursos(),
      sonidos(),
      musicaAmbiental(),
      avisoPausa(),
      alertasEconomicas(),
      ratingDeuda(),
      guardarCargar(conjunto),
      economia(conjunto),
      retratos(gobiernos, conjunto),
      ...muestrario(conjunto, seccion),
      ...banderas(conjunto),
    );
  } catch {
    reemplazar(
      raiz,
      cabecera(),
      iconos(),
      el('p', { class: 'galeria__nota', role: 'alert' }, t('galeria.error')),
    );
  }
}

void iniciar();
