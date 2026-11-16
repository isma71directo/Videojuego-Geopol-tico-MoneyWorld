// @vitest-environment happy-dom
/** Barra de secciones del mapa y ventanas de cada sección (ajuste f7-a2). */
import { afterEach, describe, expect, it } from 'vitest';
import roadmapJson from '../roadmap.json';
import { NOMBRES_ICONOS } from '../src/av/iconos';
import { t } from '../src/i18n';
import { menuAbierto } from '../src/ui/componentes/menu';
import { cerrarVentanas, ventanasAbiertas } from '../src/ui/componentes/ventana';
import {
  GRUPOS,
  MINISTERIOS,
  NOMBRES_FASES,
  SECCIONES,
  abrirSeccion,
  contenidoPestana,
  crearBarraSecciones,
  etiquetaConAtajo,
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

/** Un texto existe si t() no devuelve la propia clave. */
const existe = (clave: string): boolean => t(clave) !== clave;

function tecla(destino: EventTarget, key: string, extra: KeyboardEventInit = {}): KeyboardEvent {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra });
  destino.dispatchEvent(evento);
  return evento;
}

describe('secciones del juego: configuración (ajuste f7-a2)', () => {
  it('seis grupos como en el GDD, cada uno con una tecla propia que está en su nombre', () => {
    expect(GRUPOS.map((g) => g.id)).toEqual([
      'gobierno',
      'economia',
      'politica',
      'mundo',
      'ejercito',
      'mas',
    ]);
    const teclas = GRUPOS.map((g) => g.tecla);
    expect(new Set(teclas).size).toBe(teclas.length);
    // Teclas que ya usa el mapa: M (silencio), C (capas) y F (medidor).
    for (const ocupada of ['m', 'c', 'f']) expect(teclas).not.toContain(ocupada);
    for (const grupo of GRUPOS) {
      const nombre = t(`juego.secciones.grupos.${grupo.id}`);
      expect(nombre.toLowerCase(), grupo.id).toContain(grupo.tecla);
      expect(NOMBRES_ICONOS, grupo.id).toContain(grupo.icono);
    }
  });

  it('cada sección está en un solo grupo y tiene textos, icono y pestañas', () => {
    const enGrupos = GRUPOS.flatMap((g) => g.secciones);
    expect(new Set(enGrupos).size).toBe(enGrupos.length);
    expect([...SECCIONES.keys()].sort()).toEqual([...enGrupos].sort());
    // Las del GDD (sección 7) y las que piden sus fases: 17 ventanas.
    expect(SECCIONES.size).toBe(17);
    for (const seccion of SECCIONES.values()) {
      expect(existe(`juego.secciones.${seccion.id}.titulo`), seccion.id).toBe(true);
      expect(NOMBRES_ICONOS, seccion.id).toContain(seccion.icono);
      expect(seccion.pestanas.length, seccion.id).toBeGreaterThan(0);
      for (const pestana of seccion.pestanas) {
        const base = `juego.secciones.${seccion.id}.pestanas.${pestana.id}`;
        expect(existe(`${base}.titulo`), base).toBe(true);
        expect(existe(`${base}.texto`), base).toBe(true);
      }
    }
    // Lo que pidió el jugador: departamentos, comercio, diplomacia, parlamento e historial de leyes.
    expect(SECCIONES.get('parlamento')!.pestanas.map((p) => p.id)).toContain('historial');
    for (const id of ['consejo', 'comercio', 'diplomacia', 'parlamento']) {
      expect(SECCIONES.has(id), id).toBe(true);
    }
  });

  it('la fase de cada pestaña existe en la hoja de ruta, con su nombre y su versión', () => {
    for (const seccion of SECCIONES.values()) {
      for (const pestana of seccion.pestanas) {
        const enRoadmap = fase(pestana.fase);
        expect(enRoadmap, `${seccion.id}.${pestana.id}`).toBeDefined();
        expect(NOMBRES_FASES[String(pestana.fase)]).toBe(enRoadmap!.nombre);
        expect(versionDeFase(pestana.fase)).toBe(enRoadmap!.version);
        // Las secciones aún no se han hecho: todas sus fases están por llegar.
        expect(pestana.fase).toBeGreaterThan(7);
      }
    }
  });

  it('los 20 ministerios del GDD (6.4), con nombre e indicadores', () => {
    expect(MINISTERIOS).toHaveLength(20);
    for (const id of MINISTERIOS) {
      expect(existe(`juego.secciones.ministerios.${id}.nombre`), id).toBe(true);
      expect(existe(`juego.secciones.ministerios.${id}.indicadores`), id).toBe(true);
    }
  });

  it('subraya la letra del atajo en el nombre', () => {
    const [antes, letra, despues] = etiquetaConAtajo('Mundo', 'u');
    expect(antes).toBe('M');
    expect((letra as HTMLElement).outerHTML).toBe('<u>u</u>');
    expect(despues).toBe('ndo');
    expect(etiquetaConAtajo('Gobierno', 'g')[0]).toBe('');
    expect(etiquetaConAtajo('Sin letra', 'z')).toEqual(['Sin letra']);
  });
});

describe('barra de secciones y ventanas (ajuste f7-a2)', () => {
  afterEach(() => {
    menuAbierto()?.cerrar(false, true);
    cerrarVentanas();
    document.body.replaceChildren();
  });

  function barra(): ReturnType<typeof crearBarraSecciones> {
    const creada = crearBarraSecciones();
    document.body.appendChild(creada.elemento);
    return creada;
  }

  it('dibuja un botón por grupo, con su atajo para los lectores de pantalla', () => {
    const { elemento } = barra();
    const botones = [...elemento.querySelectorAll<HTMLButtonElement>('.secciones__grupo')];
    expect(botones).toHaveLength(6);
    expect(botones[0]!.getAttribute('aria-keyshortcuts')).toBe('G');
    expect(botones[0]!.querySelector('u')!.textContent).toBe('G');
    // Ejército solo tiene una sección: abre su ventana directamente, sin menú.
    const ejercito = elemento.querySelector('[data-grupo="ejercito"]')!;
    expect(ejercito.hasAttribute('aria-haspopup')).toBe(false);
  });

  it('un clic en un grupo abre el menú con sus secciones y elegir una abre su ventana', () => {
    const { elemento } = barra();
    const gobierno = elemento.querySelector<HTMLButtonElement>('[data-grupo="gobierno"]')!;
    gobierno.click();
    const menu = menuAbierto();
    expect(menu).not.toBeNull();
    expect(gobierno.getAttribute('aria-expanded')).toBe('true');
    const opciones = [...menu!.elemento.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    expect(opciones.map((o) => o.querySelector('.menu__texto')!.textContent)).toEqual([
      'Consejo de Ministros',
      'Presupuesto',
      'Impuestos',
      'Parlamento y leyes',
    ]);
    opciones[3]!.click();
    expect(menuAbierto()).toBeNull();
    const ventana = ventanasAbiertas().find((v) => v.id === 'seccion-parlamento')!;
    expect(ventana).toBeDefined();
    const pestanas = [...ventana.elemento.querySelectorAll('[role="tab"]')].map(
      (p) => p.textContent,
    );
    expect(pestanas).toEqual(['Hemiciclo', 'Negociación', 'Leyes', 'Historial de leyes']);
    expect(ventana.elemento.querySelector('.seccion__fase')!.textContent).toBe(
      'Se llena en la Fase 61 · Parlamento: votaciones (v0.62.0)',
    );
  });

  it('las teclas abren los grupos desde el mapa, pero no mientras se escribe', () => {
    const secciones = barra();
    expect(secciones.alTeclear(tecla(document.body, 'u'))).toBe(true);
    expect(menuAbierto()!.elemento.textContent).toContain('Diplomacia');
    // La misma tecla lo cierra.
    expect(secciones.alTeclear(tecla(document.body, 'U'))).toBe(true);
    expect(menuAbierto()).toBeNull();
    // Ejército (J) abre su ventana sin menú.
    secciones.alTeclear(tecla(document.body, 'j'));
    expect(ventanasAbiertas().map((v) => v.id)).toContain('seccion-ejercito');
    // Con Ctrl, otra letra o escribiendo en un campo, no hace nada.
    expect(secciones.alTeclear(tecla(document.body, 'g', { ctrlKey: true }))).toBe(false);
    expect(secciones.alTeclear(tecla(document.body, 'x'))).toBe(false);
    const campo = document.createElement('input');
    document.body.appendChild(campo);
    expect(secciones.alTeclear(tecla(campo, 'g'))).toBe(false);
  });

  it('cada sección se abre una vez y todas muestran en qué fase se llenan', () => {
    for (const id of SECCIONES.keys()) {
      const ventana = abrirSeccion(id)!;
      expect(ventana.elemento.querySelector('.seccion__fase'), id).not.toBeNull();
      // Abrirla otra vez la trae delante, no abre otra.
      expect(abrirSeccion(id)).toBe(ventana);
    }
    expect(ventanasAbiertas()).toHaveLength(SECCIONES.size);
    expect(abrirSeccion('no-existe')).toBeNull();
  });

  it('el Consejo de Ministros enseña los 20 ministerios', () => {
    const contenido = contenidoPestana('consejo', { id: 'ministerios', fase: 26 });
    expect(contenido.querySelectorAll('.seccion__ministerios li')).toHaveLength(20);
    expect(contenido.textContent).toContain('Economía y Hacienda');
    // Una sección de una sola pestaña no lleva barra de pestañas.
    const poblacion = abrirSeccion('poblacion')!;
    expect(poblacion.elemento.querySelector('[role="tablist"]')).toBeNull();
  });
});
