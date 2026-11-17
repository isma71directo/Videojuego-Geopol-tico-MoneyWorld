/** Pantalla del mapa del mundo a pantalla completa (Fases 3 y 4). */
import type { ConjuntoGobiernos } from '../datos/gobiernos';
import type { ConjuntoPaises } from '../datos/paises';
import type { ConjuntoEconomiaRegiones } from '../datos/regiones-economia';
import { t } from '../i18n';
import { capaPorId, colorearCapa, colorearRegiones, type CapaDatos } from '../map/capas';
import type { MapaMundo, Objetivo, RegionSenalada } from '../map/mapa';
import type { Partida } from '../sim/partida';
import { conectarGestos } from '../map/gestos';
import { guardarAjuste, leerAjuste, medidorFpsActivo } from './ajustes';
import { el, reemplazar } from './dom';
import { contenidoPanelCiudad, contenidoRecuadroCiudad } from './ficha-ciudad';
import {
  contenidoPanelRegion,
  contenidoRecuadroRegion,
  type ConjuntoRegiones,
  type DatosRegion,
} from './ficha-region';
import { contenidoPanel, contenidoRecuadro } from './ficha-pais';
import { contenidoLeyenda } from './leyenda';
import { crearSelectorCapas, POLITICA } from './selector-capas';
import { abrirMenuContextual, menuAbierto, SEPARADOR, type OpcionMenu } from './componentes/menu';
import { cerrarVentanas } from './componentes/ventana';
import { crearBarraSecciones } from './secciones';
import { confirmarSalidaDePartida, crearBarraPartida } from './barra-partida';
import { crearControlTiempo } from './tiempo';
import { msPorHora } from '../sim/reloj';
import { conectarMotor } from './conexion-motor';
import { solDelJuego } from '../map/noche';
import { crearBuscador } from './buscador';
import { crearMapaDelJuego } from './mapa-del-juego';
import type { EntradaBusqueda } from './busqueda';
import { icono } from '../av/iconos';
import { atenuarMusica, reproducir, silenciar, sonido } from './sonido';
import './estilos/mapa.css';

/**
 * Carga de prueba del motor (tarea f12-t1): «?carga=50» en la dirección hace que cada día de
 * juego cueste 50 ms de cálculo en el worker, para comprobar que la pantalla no se bloquea.
 */
function cargaDePrueba(): number {
  const valor = Number(new URLSearchParams(location.search).get('carga'));
  return Number.isFinite(valor) && valor > 0 ? valor : 0;
}

function medidorActivo(): boolean {
  return medidorFpsActivo(location.search, import.meta.env.DEV, leerAjuste('medidorFps'));
}

export interface PantallaMapa {
  elemento: HTMLElement;
  mapa: MapaMundo;
  /** Partida que se juega en esta pantalla (null en el mapa libre). */
  partida: Partida | null;
  /**
   * Pregunta antes de salir de la partida, con el tiempo en pausa mientras tanto (tarea
   * f11-t3); si se cancela, sigue a la velocidad que llevaba. En el mapa libre, sí sin más.
   */
  pedirSalida(): Promise<boolean>;
  cerrar(): void;
}

export interface OpcionesPantallaMapa {
  /** Partida empezada (tarea f10-t1): el mapa abre en el país del jugador. */
  partida?: Partida | null;
}

export function abrirPantallaMapa(
  alCerrar: () => void,
  opciones: OpcionesPantallaMapa = {},
): PantallaMapa {
  const partida = opciones.partida ?? null;
  // En una partida, «Menú» sale al inicio después de confirmarlo (tarea f10-t3).
  const volver = partida
    ? el(
        'button',
        {
          class: 'boton mapa__volver mapa__menu',
          type: 'button',
          'aria-label': t('juego.partida.menuAyuda'),
          title: t('juego.partida.menuAyuda'),
        },
        icono('salir'),
        t('juego.partida.menu'),
      )
    : el(
        'button',
        { class: 'boton mapa__volver', type: 'button', 'aria-label': t('juego.mapa.volver') },
        '← ',
        t('juego.mapa.volver'),
      );
  // Botón de silencio, siempre a mano (GDD 7.1); también con la tecla M.
  const botonSonido = el('button', { class: 'boton mapa__sonido', type: 'button' });
  const pintarBotonSonido = (): void => {
    const texto = t(sonido.silenciado ? 'juego.mapa.activarSonido' : 'juego.mapa.silenciar');
    botonSonido.replaceChildren(icono(sonido.silenciado ? 'silencio' : 'sonido'));
    botonSonido.setAttribute('aria-label', texto);
    botonSonido.setAttribute('aria-pressed', String(sonido.silenciado));
    botonSonido.title = texto;
  };
  const alternarSonido = (): void => {
    silenciar(!sonido.silenciado);
    pintarBotonSonido();
    reproducir('boton');
  };
  pintarBotonSonido();
  botonSonido.addEventListener('click', alternarSonido);
  // Desplegable de capas (tarea f6-t2): un clic o la tecla C lo abren; al elegir, cambia el mapa.
  const selector = crearSelectorCapas(
    POLITICA,
    (id) => {
      capa = capaPorId(id);
      guardarAjuste('capaMapa', capa?.id ?? POLITICA);
      reproducir('capa');
      pintarCapa();
      // La leyenda nueva entra con una animación corta.
      leyenda.classList.remove('leyenda--cambio');
      void leyenda.offsetWidth;
      leyenda.classList.add('leyenda--cambio');
      lienzo.focus({ preventScroll: true });
    },
    () => reproducir('boton'),
  );
  // Buscador (tarea f9-t2): lupa y tecla B, en una ventana en el centro (decisión del jugador).
  /** Punto y caja (en grados) de cada región, para ir hasta ella antes de cargar sus fronteras. */
  /** Mientras el mapa viaja a un resultado, la selección no suena (suena al llegar). */
  let llegandoDeBusqueda = false;
  const lugaresRegion = new Map<
    string,
    { etiqueta: [number, number]; caja: [number, number, number, number] }
  >();
  const buscador = crearBuscador({
    entradas: async () => {
      const respuesta = await fetch('./data/buscador-2010.json');
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      const indice = (await respuesta.json()) as {
        regiones: [
          string,
          string,
          string,
          number | null,
          [number, number],
          [number, number, number, number],
        ][];
      };
      const enIngles = new Intl.DisplayNames(['en'], { type: 'region' });
      const paises: EntradaBusqueda[] = Object.values(conjunto?.paises ?? {}).map((pais) => {
        let ingles: string | undefined;
        try {
          ingles = pais.iso2 ? enIngles.of(pais.iso2) : undefined;
        } catch {
          ingles = undefined;
        }
        return {
          tipo: 'pais',
          id: pais.id,
          nombre: pais.nombre,
          pais: pais.id,
          alias: [pais.id, ...(ingles ? [ingles] : [])],
          peso: pais.datos.poblacion ?? 0,
        };
      });
      const regiones: EntradaBusqueda[] = indice.regiones
        // Las de los países de una sola región se llaman como el país: ya están.
        .filter(([, nombre, pais]) => conjunto?.paises[pais]?.nombre !== nombre)
        .map(([id, nombre, pais, poblacion, etiqueta, caja]) => {
          lugaresRegion.set(id, { etiqueta, caja });
          return { tipo: 'region', id, nombre, pais, peso: poblacion ?? 0 };
        });
      const ciudades: EntradaBusqueda[] = mapa.listaCiudades.map((ciudad) => ({
        tipo: 'ciudad',
        id: `${ciudad.pais}|${ciudad.nombre}`,
        nombre: ciudad.nombre,
        pais: ciudad.pais,
        peso: ciudad.poblacion ?? 0,
      }));
      return [...paises, ...regiones, ...ciudades];
    },
    nombrePais: (id) => conjunto?.paises[id]?.nombre ?? id,
    regionDelMundo: (id) => conjunto?.paises[id]?.regionNombre ?? '',
    esCapital: (entrada) =>
      mapa.listaCiudades.some(
        (c) => c.capital && c.pais === entrada.pais && c.nombre === entrada.nombre,
      ),
    alElegir: (entrada) => {
      reproducir('boton');
      // Al llegar, el contorno late y suena un tintineo (tarea f9-t4), en lugar del sonido de
      // seleccionar.
      llegandoDeBusqueda = true;
      const alLlegar = (): void => {
        llegandoDeBusqueda = false;
        reproducir('resaltar');
      };
      if (entrada.tipo === 'pais') mapa.irA({ tipo: 'pais', id: entrada.id }, alLlegar);
      else if (entrada.tipo === 'ciudad') {
        mapa.irA({ tipo: 'ciudad', nombre: entrada.nombre, pais: entrada.pais }, alLlegar);
      } else {
        const lugar = lugaresRegion.get(entrada.id);
        if (lugar) mapa.irA({ tipo: 'region', id: entrada.id, ...lugar }, alLlegar);
      }
      lienzo.focus({ preventScroll: true });
    },
  });
  const alTeclearBuscador = (evento: KeyboardEvent): void => {
    buscador.alTeclear(evento);
  };
  document.addEventListener('keydown', alTeclearBuscador);
  // El motor de la partida (tarea f12-t1): la partida y el reloj viven en un Web Worker; la
  // pantalla le manda la velocidad y recibe el estado. La partida de aquí (el mismo objeto que
  // guarda main.ts) es una copia que se pone al día con cada mensaje.
  const motor = partida ? conectarMotor() : null;
  /** Último estado del motor: fracción de la hora, cuándo llegó y a qué velocidad. */
  let ultimaFraccion = 0;
  let recibidoEn = 0;
  let velocidadMotor = 0;
  let animacion: number | null = null;
  /** Parte de la hora en curso ahora mismo, contando desde el último mensaje del motor. */
  const fraccionActual = (): number =>
    velocidadMotor > 0
      ? Math.min(
          0.999,
          ultimaFraccion + (performance.now() - recibidoEn) / msPorHora(velocidadMotor),
        )
      : ultimaFraccion;
  /** Manecillas y noche sin saltos entre mensaje y mensaje (tarea f11-t4). */
  const animar = (): void => {
    animacion = null;
    const fraccion = fraccionActual();
    barraPartida?.ponerFraccion(fraccion, velocidadMotor <= 2);
    moverNoche(fraccion);
    if (velocidadMotor > 0) animacion = requestAnimationFrame(animar);
  };
  if (motor && partida) {
    motor.alRecibir = (mensaje) => {
      partida.fecha = mensaje.fecha;
      partida.hora = mensaje.hora;
      partida.efectos = mensaje.efectos;
      ultimaFraccion = mensaje.fraccion;
      recibidoEn = performance.now();
      velocidadMotor = mensaje.velocidad;
      barraPartida?.actualizar(partida);
      if (animacion === null) animar();
    };
    motor.enviar({ tipo: 'empezar', partida, cargaPruebaMs: cargaDePrueba() });
  }
  // Los controles del tiempo (tarea f11-t3): la partida empieza en pausa.
  const tiempo = partida
    ? crearControlTiempo({
        alCambiarVelocidad: (velocidad, antes) => {
          motor?.enviar({ tipo: 'velocidad', velocidad });
          reproducir(velocidad === 0 ? 'pausa' : antes === 0 ? 'seguir' : 'velocidad');
          barraPartida?.marcarPausa(velocidad === 0);
          // En pausa la música baja un poco (tarea f12-t3).
          atenuarMusica(velocidad === 0);
        },
      })
    : null;
  /** Capital del jugador (para la noche): llega con las ciudades del mapa. */
  let capitalPropia: { lat: number; lon: number } | null = null;
  /**
   * La sombra de la noche a la hora de la partida (si el jugador la quiere ver): en su capital,
   * de las 20:00 a las 7:00 todo el año (ajuste f11-a1).
   */
  const moverNoche = (fraccion = 0): void => {
    if (!partida || !leerAjuste('nocheMapa')) return;
    capitalPropia ??=
      mapa.listaCiudades.find(
        (c) => c.pais === partida.jugador.paisId && c.capital && c.capitalDe === null,
      ) ??
      mapa.listaCiudades.find((c) => c.pais === partida.jugador.paisId && c.capital) ??
      null;
    if (!capitalPropia) return;
    mapa.solDelJuego = solDelJuego(partida.hora + fraccion, capitalPropia);
  };
  const alTeclearTiempo = (evento: KeyboardEvent): void => {
    tiempo?.alTeclear(evento);
  };
  if (tiempo) document.addEventListener('keydown', alTeclearTiempo);
  // Barra superior de la partida (tarea f10-t3): menú, país, fecha y hora con los controles del
  // tiempo, tesorería y popularidad. Las herramientas del mapa van en una fila debajo, a la
  // izquierda (en el mapa libre, arriba, junto a «Volver»).
  const barraPartida = partida
    ? crearBarraPartida({
        partida,
        alIrAlPais: () => {
          reproducir('boton');
          mapa.irA({ tipo: 'pais', id: partida.jugador.paisId });
          lienzo.focus({ preventScroll: true });
        },
        ...(tiempo ? { controles: tiempo.elemento } : {}),
      })
    : null;
  const herramientas = [botonSonido, selector.elemento, buscador.boton];
  const barra = barraPartida
    ? el('header', { class: 'mapa__barra mapa__barra--partida' }, volver, barraPartida.elemento)
    : el('div', { class: 'mapa__barra' }, volver, ...herramientas);
  const filaHerramientas = barraPartida
    ? el('div', { class: 'mapa__herramientas mapa__herramientas--partida' }, ...herramientas)
    : null;
  const estado = el('p', { class: 'mapa__estado', role: 'status' }, t('juego.mapa.cargando'));
  const lienzo = el('div', {
    class: 'mapa__contenedor',
    role: 'application',
    tabindex: 0,
    'aria-label': t('juego.mapa.etiqueta'),
  });
  // El medidor siempre existe; se muestra u oculta (Ajustes, «?fps» o la tecla F).
  const medidor = el(
    'p',
    { class: 'mapa__fps', 'aria-hidden': 'true', hidden: !medidorActivo() },
    '— fps',
  );
  // Recuadro que sigue al ratón y panel del país seleccionado (tarea f4-t1).
  const recuadro = el('div', { class: 'ficha', 'aria-hidden': 'true', hidden: true });
  const panel = el('aside', {
    class: 'panel-pais',
    'aria-labelledby': 'panel-pais-titulo',
    'aria-live': 'polite',
    hidden: true,
  });
  // Leyenda de la capa de datos activa (Fase 6); la capa política no la necesita.
  const leyenda = el('aside', {
    class: 'leyenda',
    'aria-labelledby': 'leyenda-titulo',
    hidden: true,
  });
  // Brillo suave del agua (tarea f6-t4): una capa CSS animada encima del mapa, que no obliga a
  // redibujarlo. Con «reducir movimiento» no se ve (mapa.css).
  const brillo = el('div', {
    class: 'mapa__brillo',
    'aria-hidden': 'true',
    hidden: !leerAjuste('brilloAgua'),
  });
  // Barra de secciones (ajuste f7-a2): Gobierno · Economía · Política · Mundo · Ejército · Más.
  const secciones = crearBarraSecciones();
  const alTeclearSecciones = (evento: KeyboardEvent): void => {
    secciones.alTeclear(evento);
  };
  document.addEventListener('keydown', alTeclearSecciones);
  const elemento = el(
    'section',
    { class: partida ? 'mapa mapa--partida' : 'mapa' },
    lienzo,
    brillo,
    barra,
    filaHerramientas,
    estado,
    medidor,
    leyenda,
    secciones.elemento,
    recuadro,
    panel,
  );
  document.body.appendChild(elemento);

  const mapa = crearMapaDelJuego(lienzo);
  if (partida) mapa.paisJugador = partida.jugador.paisId;
  moverNoche(fraccionActual());
  if (tiempo) {
    barraPartida?.marcarPausa(tiempo.velocidad === 0);
    atenuarMusica(tiempo.velocidad === 0);
  }
  mapa.alDibujar = ({ fps, msUltimo, nivel }) => {
    if (!medidor.hidden) medidor.textContent = `${fps} fps · ${msUltimo.toFixed(1)} ms · ${nivel}`;
  };
  const alternarMedidor = (evento: KeyboardEvent): void => {
    if (evento.key === 'm' || evento.key === 'M') {
      alternarSonido();
      return;
    }
    if (evento.key === 'c' || evento.key === 'C') {
      // Desplegable de capas (decisión del jugador: una tecla para abrirlo, no una por capa).
      evento.preventDefault();
      selector.alternar();
      return;
    }
    if (evento.key !== 'f' && evento.key !== 'F') return;
    medidor.hidden = !medidor.hidden;
    guardarAjuste('medidorFps', !medidor.hidden);
    mapa.pedirDibujo();
  };
  lienzo.addEventListener('keydown', alternarMedidor);

  let conjunto: ConjuntoPaises | null = null;
  // Régimen y cargos de 2010 (tarea f8-t1) y la última pestaña de ficha que miró el jugador.
  let gobiernos: ConjuntoGobiernos | null = null;
  let pestanaFicha = 'resumen';
  let recuadroDe: unknown = null;
  /**
   * Capa de datos activa; null es la capa política. Se recuerda la última elegida; «?capa=paro»
   * en la dirección elige otra al abrir.
   */
  let capa: CapaDatos | null = capaPorId(
    new URLSearchParams(location.search).get('capa') ?? leerAjuste('capaMapa'),
  );
  selector.marcar(capa?.id ?? POLITICA);
  const pintarCapa = (): void => {
    if (!capa || !conjunto) {
      mapa.capa = null;
      leyenda.hidden = true;
      leyenda.replaceChildren();
      recuadroDe = null;
      if (senalado) mostrarRecuadro(senalado.objetivo, senalado.x, senalado.y);
      return;
    }
    // Las capas por región necesitan los datos de las regiones; al llegar, se vuelve a pintar.
    if (capa.porRegion) cargarDatosRegiones();
    const coloreado = colorearCapa(capa, conjunto.paises);
    if (datosRegiones) coloreado.region = colorearRegiones(capa, datosRegiones.regiones);
    mapa.capa = coloreado;
    reemplazar(
      leyenda,
      ...contenidoLeyenda(
        capa,
        coloreado.rayados.size > 0,
        mapa.hayPaisesSinDatos(coloreado),
        coloreado.sinDatos,
      ),
    );
    leyenda.hidden = false;
    // La ficha que está a la vista cambia de dato.
    recuadroDe = null;
    if (senalado) mostrarRecuadro(senalado.objetivo, senalado.x, senalado.y);
  };

  // Datos de las regiones (Fase 5): se descargan la primera vez que se señala una región.
  let datosRegiones: ConjuntoRegiones | null = null;
  let cargandoDatosRegiones = false;
  let senalado: { objetivo: Objetivo; x: number; y: number } | null = null;
  let seleccion: Objetivo | null = null;
  const datosDe = (region: RegionSenalada): DatosRegion | null =>
    datosRegiones?.regiones[region.id] ?? null;
  const cargarDatosRegiones = (): void => {
    if (datosRegiones || cargandoDatosRegiones) return;
    cargandoDatosRegiones = true;
    fetch('./data/regiones-2010-datos.json')
      .then((r) => (r.ok ? (r.json() as Promise<ConjuntoRegiones>) : Promise.reject(new Error())))
      .then((datos) => {
        datosRegiones = datos;
        if (capa?.porRegion) pintarCapa();
        // Se repintan la ficha y el panel que esperaban los datos.
        recuadroDe = null;
        if (senalado?.objetivo.tipo === 'region') {
          mostrarRecuadro(senalado.objetivo, senalado.x, senalado.y);
        }
        if (seleccion?.tipo === 'region') pintarPanel(seleccion);
      })
      .catch(() => {
        cargandoDatosRegiones = false;
      });
  };

  // Economía, recursos y ciudades de las regiones (tarea f9-t3): al abrir la ficha de una región.
  let economiaRegiones: ConjuntoEconomiaRegiones | null = null;
  let cargandoEconomia = false;
  let pestanaRegion: string | undefined;
  const cargarEconomiaRegiones = (): void => {
    if (economiaRegiones || cargandoEconomia) return;
    cargandoEconomia = true;
    fetch('./data/regiones-2010-economia.json')
      .then((r) =>
        r.ok ? (r.json() as Promise<ConjuntoEconomiaRegiones>) : Promise.reject(new Error()),
      )
      .then((datos) => {
        economiaRegiones = datos;
        if (seleccion?.tipo === 'region') pintarPanel(seleccion);
      })
      .catch(() => {
        cargandoEconomia = false;
      });
  };

  /** Recuadro al lado del ratón con la ficha breve de lo señalado (país, región o ciudad). */
  const mostrarRecuadro = (objetivo: Objetivo | null, x: number, y: number): void => {
    // Lo que se señala: el código del país, la región o la propia ciudad.
    const clave =
      objetivo?.tipo === 'ciudad'
        ? objetivo.ciudad
        : objetivo?.tipo === 'region'
          ? objetivo.region.id
          : (objetivo?.id ?? null);
    const pais = objetivo?.tipo === 'pais' && conjunto ? conjunto.paises[objetivo.id] : undefined;
    if (objetivo === null || (objetivo.tipo === 'pais' && (!pais || !conjunto))) {
      recuadro.hidden = true;
      recuadroDe = null;
      return;
    }
    if (objetivo.tipo === 'region') cargarDatosRegiones();
    if (recuadroDe !== clave) {
      reemplazar(
        recuadro,
        ...(objetivo.tipo === 'ciudad'
          ? contenidoRecuadroCiudad(objetivo.ciudad, conjunto)
          : objetivo.tipo === 'region'
            ? contenidoRecuadroRegion(objetivo.region, conjunto, datosDe(objetivo.region), capa)
            : contenidoRecuadro(pais!, conjunto!, capa)),
      );
      recuadroDe = clave;
    }
    recuadro.hidden = false;
    // Al lado del ratón, sin salirse de la pantalla.
    const margen = 16;
    const ancho = recuadro.offsetWidth;
    const alto = recuadro.offsetHeight;
    const izquierda = x + margen + ancho > elemento.clientWidth ? x - margen - ancho : x + margen;
    const arriba = Math.min(y + margen, elemento.clientHeight - alto - 8);
    recuadro.style.transform = `translate(${Math.max(8, izquierda)}px, ${Math.max(8, arriba)}px)`;
  };
  mapa.alSenalar = (objetivo, x, y) => {
    senalado = objetivo ? { objetivo, x, y } : null;
    mostrarRecuadro(objetivo, x, y);
  };

  /** Panel de la derecha con la ficha de lo seleccionado; devuelve si hay algo que mostrar. */
  const pintarPanel = (objetivo: Objetivo): boolean => {
    const pais = objetivo.tipo === 'pais' && conjunto ? conjunto.paises[objetivo.id] : undefined;
    if (objetivo.tipo === 'pais' && (!pais || !conjunto)) return false;
    const quitar = (): void => mapa.seleccionar(null);
    if (objetivo.tipo === 'region') {
      cargarDatosRegiones();
      cargarEconomiaRegiones();
    }
    reemplazar(
      panel,
      ...(objetivo.tipo === 'ciudad'
        ? contenidoPanelCiudad(objetivo.ciudad, conjunto, quitar, () =>
            mapa.seleccionar(objetivo.ciudad.pais),
          )
        : objetivo.tipo === 'region'
          ? contenidoPanelRegion(
              objetivo.region,
              conjunto,
              datosDe(objetivo.region),
              quitar,
              () => mapa.seleccionar(objetivo.region.pais),
              {
                economia: economiaRegiones
                  ? (economiaRegiones.regiones[objetivo.region.id] ?? null)
                  : undefined,
                ...(pestanaRegion ? { pestana: pestanaRegion } : {}),
                alCambiarPestana: (id) => {
                  pestanaRegion = id;
                },
                alIrACiudad: (nombre) =>
                  mapa.irA({ tipo: 'ciudad', nombre, pais: objetivo.region.pais }),
              },
            )
          : contenidoPanel(pais!, conjunto!, quitar, {
              gobiernos,
              colorPais: mapa.colorDePais(pais!.id),
              pestana: pestanaFicha,
              alCambiarPestana: (id) => {
                pestanaFicha = id;
              },
            })),
    );
    return true;
  };
  mapa.alSeleccionar = (objetivo) => {
    seleccion = objetivo;
    if (objetivo === null || !pintarPanel(objetivo)) {
      if (!panel.hidden) reproducir('deseleccionar');
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }
    if (panel.hidden) reproducir('abrirPanel');
    if (!llegandoDeBusqueda) reproducir('seleccionar');
    panel.hidden = false;
  };
  const alPulsarEscape = (evento: KeyboardEvent): void => {
    if (evento.key === 'Escape' && mapa.haySeleccion && !evento.defaultPrevented) {
      evento.preventDefault();
      mapa.seleccionar(null);
      lienzo.focus({ preventScroll: true });
    }
  };
  document.addEventListener('keydown', alPulsarEscape);
  fetch('./data/paises-2010.json')
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error(String(respuesta.status));
      return respuesta.json() as Promise<ConjuntoPaises>;
    })
    .then((datos) => {
      conjunto = datos;
      mapa.nombres = new Map(Object.values(datos.paises).map((pais) => [pais.id, pais.nombre]));
      mapa.nombresAbreviados = new Map(
        Object.keys(datos.paises).flatMap((id) => {
          const clave = `juego.mapa.nombresCortos.${id}`;
          const corto = t(clave);
          return corto === clave ? [] : [[id, corto] as [string, string]];
        }),
      );
      pintarCapa();
      const propio = partida ? datos.paises[partida.jugador.paisId] : undefined;
      if (propio) barraPartida?.ponerNombrePais(propio.nombre, propio.capital);
    })
    .catch(() => {
      // Sin datos el mapa sigue funcionando; solo faltan las fichas.
    });
  fetch('./data/gobiernos-2010.json')
    .then((respuesta) =>
      respuesta.ok
        ? (respuesta.json() as Promise<ConjuntoGobiernos>)
        : Promise.reject(new Error(String(respuesta.status))),
    )
    .then((datos) => {
      gobiernos = datos;
      // Si ya había un país abierto, su ficha se completa con el gobierno.
      if (seleccion?.tipo === 'pais') pintarPanel(seleccion);
    })
    .catch(() => {
      // Sin este archivo la ficha sale sin cargos.
    });
  mapa
    .iniciar()
    .then(() => {
      estado.remove();
      // Con los países del mapa ya cargados, la leyenda sabe si alguno se queda sin dato.
      pintarCapa();
      // En una partida, el mapa va al país del jugador y abre su ficha.
      if (partida) mapa.irA({ tipo: 'pais', id: partida.jugador.paisId });
      // Con las ciudades ya cargadas se sabe dónde está la capital: la noche, en su sitio.
      moverNoche(fraccionActual());
    })
    .catch(() => {
      estado.textContent = t('juego.mapa.error');
    });

  /**
   * Menú contextual del mapa (tarea f7-t2, decisión del jugador): con el clic derecho sobre un
   * país, una región o una ciudad, o con la tecla de menú (o Mayús + F10) sobre lo
   * seleccionado. De momento, lo que ya se puede hacer: ver la ficha, centrar y acercar.
   */
  const nombrePais = (id: string): string => conjunto?.paises[id]?.nombre ?? id;
  const abrirMenuMapa = (objetivo: Objetivo | null, x: number, y: number): void => {
    const opciones: (OpcionMenu | typeof SEPARADOR)[] = [];
    let titulo: string | undefined;
    if (objetivo?.tipo === 'ciudad') {
      const { ciudad } = objetivo;
      titulo = ciudad.nombre;
      opciones.push(
        {
          etiqueta: t('juego.mapa.menu.verCiudad'),
          icono: 'poblacion',
          accion: () => mapa.seleccionarCiudad(ciudad),
        },
        {
          etiqueta: t('juego.mapa.menu.verFichaDe', { pais: nombrePais(ciudad.pais) }),
          icono: 'politica',
          accion: () => mapa.seleccionar(ciudad.pais),
        },
      );
    } else if (objetivo?.tipo === 'region') {
      const { region } = objetivo;
      titulo = region.nombre;
      opciones.push(
        {
          etiqueta: t('juego.mapa.menu.verRegion'),
          icono: 'capas',
          accion: () => mapa.seleccionarRegion(region.id),
        },
        {
          etiqueta: t('juego.mapa.menu.verFichaDe', { pais: nombrePais(region.pais) }),
          icono: 'politica',
          accion: () => mapa.seleccionar(region.pais),
        },
      );
    } else if (objetivo?.tipo === 'pais') {
      titulo = nombrePais(objetivo.id);
      opciones.push({
        etiqueta: t('juego.mapa.menu.verFicha'),
        icono: 'politica',
        accion: () => mapa.seleccionar(objetivo.id),
      });
    }
    if (opciones.length > 0) opciones.push(SEPARADOR);
    opciones.push(
      { etiqueta: t('juego.mapa.menu.centrar'), accion: () => mapa.centrarEn(x, y) },
      {
        etiqueta: t('juego.mapa.menu.acercar'),
        atajo: '+',
        accion: () => mapa.alPedirZoom(2, x, y),
      },
      { etiqueta: t('juego.mapa.menu.verMundo'), accion: () => mapa.verMundo() },
    );
    const caja = lienzo.getBoundingClientRect();
    abrirMenuContextual({
      etiqueta: t('juego.mapa.menu.etiqueta'),
      ...(titulo ? { titulo } : {}),
      opciones,
      x: caja.left + x,
      y: caja.top + y,
    });
  };
  lienzo.addEventListener('contextmenu', (evento) => {
    evento.preventDefault();
    const caja = lienzo.getBoundingClientRect();
    const x = evento.clientX - caja.left;
    const y = evento.clientY - caja.top;
    // Abierto desde el teclado, el navegador no da un punto del mapa: se usa lo seleccionado.
    if (evento.clientX === 0 && evento.clientY === 0) abrirMenuTeclado();
    else abrirMenuMapa(mapa.objetivoEn(x, y), x, y);
  });
  const abrirMenuTeclado = (): void => {
    if (menuAbierto()) return;
    abrirMenuMapa(seleccion, lienzo.clientWidth / 2, lienzo.clientHeight / 2);
  };
  lienzo.addEventListener('keydown', (evento) => {
    if (evento.key === 'ContextMenu' || (evento.key === 'F10' && evento.shiftKey)) {
      evento.preventDefault();
      abrirMenuTeclado();
    }
  });

  const desconectar = conectarGestos(lienzo, mapa);
  // El mapa recibe el teclado nada más abrirse (flechas y +/−).
  lienzo.focus({ preventScroll: true });

  const cerrar = (): void => {
    menuAbierto()?.cerrar(false);
    lienzo.removeEventListener('keydown', alternarMedidor);
    document.removeEventListener('keydown', alPulsarEscape);
    document.removeEventListener('keydown', alTeclearSecciones);
    document.removeEventListener('keydown', alTeclearBuscador);
    document.removeEventListener('keydown', alTeclearTiempo);
    tiempo?.destruir();
    atenuarMusica(false);
    if (animacion !== null) cancelAnimationFrame(animacion);
    motor?.enviar({ tipo: 'terminar' });
    motor?.cerrar();
    buscador.cerrar(false);
    barraPartida?.destruir();
    secciones.destruir();
    // Las ventanas de las secciones no siguen abiertas fuera del mapa.
    cerrarVentanas();
    desconectar();
    mapa.destruir();
    elemento.remove();
  };
  const pedirSalida = async (): Promise<boolean> => {
    if (!tiempo) return true;
    const velocidad = tiempo.velocidad;
    tiempo.ponerVelocidad(0);
    const salir = await confirmarSalidaDePartida();
    if (!salir) tiempo.ponerVelocidad(velocidad);
    return salir;
  };
  volver.addEventListener('click', () => {
    reproducir('boton');
    if (!partida) {
      alCerrar();
      return;
    }
    void pedirSalida().then((salir) => {
      if (salir) alCerrar();
    });
  });
  return { elemento, mapa, partida, pedirSalida, cerrar };
}
