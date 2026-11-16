// @vitest-environment happy-dom
/** Barra de secciones del mapa, sub-barras y ventanas (ajustes f7-a2 y f7-a4). */
import { afterEach, describe, expect, it } from 'vitest';
import roadmapJson from '../roadmap.json';
import { NOMBRES_ICONOS } from '../src/av/iconos';
import { t } from '../src/i18n';
import { cerrarVentanas, ventanasAbiertas } from '../src/ui/componentes/ventana';
import {
  APARTADOS,
  MINISTERIOS,
  NOMBRES_FASES,
  PREFIJO_MINISTERIO,
  SECCIONES,
  abrirElemento,
  contenidoPestana,
  crearBarraSecciones,
  etiquetaConAtajo,
  iconoElemento,
  ministerioDe,
  nombreElemento,
  pestanasDe,
  tituloElemento,
  versionDeFase,
} from '../src/ui/secciones';

interface FaseRoadmap {
  id: string;
  nombre: string;
  version: string;
}
const roadmap = roadmapJson as unknown as { fases: FaseRoadmap[] };
const fase = (n: number): FaseRoadmap | undefined =>
  roadmap.fases.find((f) => f.id === `fase-${n}`);

/** Un texto existe si t() no devuelve la propia clave ni deja marcas sin sustituir. */
const existe = (texto: string, clave: string): boolean => texto !== clave && !/\{\w+\}/.test(texto);

function tecla(destino: EventTarget, key: string, extra: KeyboardEventInit = {}): KeyboardEvent {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
  destino.dispatchEvent(evento);
  return evento;
}

const todosLosElementos = (): string[] => APARTADOS.flatMap((a) => a.elementos);

describe('secciones: configuración (ajuste f7-a4)', () => {
  it('8 apartados sin «Más», cada uno con su tecla, que está en su nombre', () => {
    expect(APARTADOS.map((a) => a.id)).toEqual([
      'gobierno',
      'ministerios',
      'politica',
      'economia',
      'mundo',
      'ejercito',
      'investigacion',
      'informes',
    ]);
    const teclas = APARTADOS.map((a) => a.tecla);
    expect(new Set(teclas).size).toBe(teclas.length);
    // Teclas que ya usa el mapa: M (silencio), C (capas) y F (medidor).
    for (const ocupada of ['m', 'c', 'f']) expect(teclas).not.toContain(ocupada);
    for (const apartado of APARTADOS) {
      const nombre = t(`juego.secciones.apartados.${apartado.id}`);
      expect(nombre).not.toBe('Más');
      expect(nombre.toLowerCase(), apartado.id).toContain(apartado.tecla);
      expect(NOMBRES_ICONOS, apartado.id).toContain(apartado.icono);
    }
  });

  it('Gobierno y Ministerios van separados: 19 ministerios con su propia ventana', () => {
    const gobierno = APARTADOS.find((a) => a.id === 'gobierno')!;
    expect(gobierno.elementos).toEqual(['presidencia', 'consejo', 'presupuesto', 'impuestos']);
    const ministerios = APARTADOS.find((a) => a.id === 'ministerios')!;
    expect(ministerios.elementos).toHaveLength(19);
    expect(MINISTERIOS.size).toBe(20);
    for (const elemento of ministerios.elementos) {
      expect(elemento.startsWith(PREFIJO_MINISTERIO), elemento).toBe(true);
      expect(ministerioDe(elemento), elemento).not.toBeNull();
    }
    // Cada elemento está en un solo apartado.
    const todos = todosLosElementos();
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('cada elemento tiene icono, nombre, título y textos en todas sus pestañas', () => {
    for (const elemento of todosLosElementos()) {
      const icono = iconoElemento(elemento);
      expect(icono, elemento).not.toBeNull();
      expect(NOMBRES_ICONOS, elemento).toContain(icono);
      expect(existe(nombreElemento(elemento), elemento)).toBe(true);
      expect(existe(tituloElemento(elemento), elemento)).toBe(true);
      const pestanas = pestanasDe(elemento);
      expect(pestanas.length, elemento).toBeGreaterThan(0);
      for (const pestana of pestanas) {
        const texto = contenidoPestana(elemento, pestana).querySelector('.seccion__texto')!;
        expect(existe(texto.textContent!, pestana.id), `${elemento}.${pestana.id}`).toBe(true);
      }
    }
    expect(tituloElemento('ministerio-sanidad')).toBe('Ministerio de Sanidad');
  });

  it('cada ministerio: resumen, presupuesto, leyes, acciones e infraestructuras si las tiene', () => {
    expect(pestanasDe('ministerio-sanidad').map((p) => p.id)).toEqual([
      'resumen',
      'presupuesto',
      'leyes',
      'acciones',
      'infraestructuras',
    ]);
    expect(pestanasDe('ministerio-trabajo').map((p) => p.id)).not.toContain('infraestructuras');
    // Las acciones llegan en la fase de su sistema (Sanidad, en la 32).
    expect(pestanasDe('ministerio-sanidad').find((p) => p.id === 'acciones')!.fase).toBe(32);
    // Cultura y Deporte no tiene fase todavía: se dice así, sin inventar una.
    const cultura = pestanasDe('ministerio-cultura').find((p) => p.id === 'acciones')!;
    expect(cultura.fase).toBeNull();
    expect(contenidoPestana('ministerio-cultura', cultura).textContent).toContain(
      'Todavía no tiene fase',
    );
  });

  it('la fase de cada pestaña existe en la hoja de ruta, con su nombre y su versión', () => {
    for (const elemento of todosLosElementos()) {
      for (const pestana of pestanasDe(elemento)) {
        if (pestana.fase === null) continue;
        const enRoadmap = fase(pestana.fase);
        expect(enRoadmap, `${elemento}.${pestana.id}`).toBeDefined();
        expect(NOMBRES_FASES[String(pestana.fase)]).toBe(enRoadmap!.nombre);
        expect(versionDeFase(pestana.fase)).toBe(enRoadmap!.version);
        expect(pestana.fase).toBeGreaterThan(7);
      }
    }
  });

  it('subraya la letra del atajo en el nombre', () => {
    const [antes, letra, despues] = etiquetaConAtajo('Ministerios', 'i');
    expect(antes).toBe('M');
    expect((letra as HTMLElement).outerHTML).toBe('<u>i</u>');
    expect(despues).toBe('nisterios');
    expect(etiquetaConAtajo('Sin letra', 'z')).toEqual(['Sin letra']);
  });
});

describe('barra, sub-barras y ventanas (ajuste f7-a4)', () => {
  let barraActual: ReturnType<typeof crearBarraSecciones> | null = null;
  afterEach(() => {
    barraActual?.destruir();
    barraActual = null;
    cerrarVentanas();
    document.body.replaceChildren();
  });

  function barra(): ReturnType<typeof crearBarraSecciones> {
    barraActual = crearBarraSecciones();
    document.body.appendChild(barraActual.elemento);
    return barraActual;
  }
  const subbarra = (): HTMLElement => document.querySelector('.secciones__sub')!;
  const elementos = (): HTMLButtonElement[] => [
    ...document.querySelectorAll<HTMLButtonElement>('.secciones__elemento'),
  ];

  it('un clic en un apartado abre su sub-barra; otro clic la cierra', () => {
    const secciones = barra();
    const botones = document.querySelectorAll<HTMLButtonElement>('.secciones__apartado');
    expect(botones).toHaveLength(8);
    const ministerios = document.querySelector<HTMLButtonElement>('[data-apartado="ministerios"]')!;
    expect(subbarra().hidden).toBe(true);
    ministerios.click();
    expect(secciones.abierto).toBe('ministerios');
    expect(subbarra().hidden).toBe(false);
    expect(ministerios.getAttribute('aria-expanded')).toBe('true');
    expect(elementos()).toHaveLength(19);
    expect(subbarra().querySelector('.secciones__sub-titulo')!.textContent).toBe('Ministerios');
    ministerios.click();
    expect(secciones.abierto).toBeNull();
    expect(subbarra().hidden).toBe(true);
  });

  it('elegir un ministerio abre su ventana y la sub-barra sigue abierta para abrir más', () => {
    const secciones = barra();
    secciones.alternarApartado('ministerios', false);
    elementos()
      .find((b) => b.dataset.elemento === 'ministerio-sanidad')!
      .click();
    const ventana = ventanasAbiertas().find((v) => v.id === 'seccion-ministerio-sanidad')!;
    expect(ventana).toBeDefined();
    const pestanas = [...ventana.elemento.querySelectorAll('[role="tab"]')].map((p) =>
      p.textContent?.trim(),
    );
    expect(pestanas).toEqual(['Resumen', 'Presupuesto', 'Leyes', 'Acciones', 'Infraestructuras']);
    expect(ventana.elemento.querySelector('.seccion__fase')!.textContent).toBe(
      'Se llena en la Fase 26 · Consejo de Ministros (v0.27.0)',
    );
    expect(secciones.abierto).toBe('ministerios');
  });

  it('con el teclado: la letra abre la sub-barra, las flechas la recorren y Escape la cierra', () => {
    const secciones = barra();
    expect(secciones.alTeclear(tecla(document.body, 'g'))).toBe(true);
    expect(secciones.abierto).toBe('gobierno');
    expect(document.activeElement).toBe(elementos()[0]);
    tecla(document.activeElement!, 'ArrowRight');
    expect(document.activeElement).toBe(elementos()[1]);
    tecla(document.activeElement!, 'End');
    expect(document.activeElement).toBe(elementos()[3]);
    tecla(document.activeElement!, 'Escape');
    expect(secciones.abierto).toBeNull();
    expect(document.activeElement).toBe(document.querySelector('[data-apartado="gobierno"]'));
    // Otra letra cambia de apartado; la misma lo cierra.
    secciones.alTeclear(tecla(document.body, 'j'));
    expect(secciones.abierto).toBe('ejercito');
    secciones.alTeclear(tecla(document.body, 'J'));
    expect(secciones.abierto).toBeNull();
    // Con Ctrl, otra letra o escribiendo en un campo, no hace nada.
    expect(secciones.alTeclear(tecla(document.body, 'g', { ctrlKey: true }))).toBe(false);
    expect(secciones.alTeclear(tecla(document.body, 'x'))).toBe(false);
    const campo = document.createElement('input');
    document.body.appendChild(campo);
    expect(secciones.alTeclear(tecla(campo, 'g'))).toBe(false);
  });

  it('Investigación, que solo tiene un elemento, abre su ventana sin sub-barra', () => {
    const secciones = barra();
    secciones.alTeclear(tecla(document.body, 'v'));
    expect(secciones.abierto).toBeNull();
    expect(ventanasAbiertas().map((v) => v.id)).toContain('seccion-investigacion');
  });

  it('un clic en el mapa cierra la sub-barra; uno en una ventana, no', () => {
    const secciones = barra();
    secciones.alternarApartado('politica', false);
    const ventana = abrirElemento('leyes')!;
    ventana.elemento.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(secciones.abierto).toBe('politica');
    const mapa = document.createElement('div');
    document.body.appendChild(mapa);
    mapa.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(secciones.abierto).toBeNull();
  });

  it('cada elemento se abre una vez y el Consejo de Ministros enlaza con cada ministerio', () => {
    for (const elemento of todosLosElementos()) {
      const ventana = abrirElemento(elemento)!;
      expect(ventana, elemento).not.toBeNull();
      expect(abrirElemento(elemento)).toBe(ventana);
    }
    expect(ventanasAbiertas()).toHaveLength(todosLosElementos().length);
    expect(abrirElemento('no-existe')).toBeNull();
    cerrarVentanas();
    const consejo = contenidoPestana('consejo', { id: 'ministerios', fase: 26 });
    document.body.appendChild(consejo);
    const tarjetas = consejo.querySelectorAll<HTMLButtonElement>('.seccion__ministerios button');
    expect(tarjetas).toHaveLength(20);
    tarjetas[1]!.click();
    expect(ventanasAbiertas().map((v) => v.id)).toEqual(['seccion-ministerio-economia']);
    // Las secciones de una sola pestaña no llevan barra de pestañas.
    expect(abrirElemento('poblacion')!.elemento.querySelector('[role="tablist"]')).toBeNull();
    expect(SECCIONES.has('poblacion')).toBe(true);
  });
});
