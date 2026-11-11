/**
 * Tipos y utilidades de la hoja de ruta (roadmap.json, GDD sección 10).
 * Lo usan el juego, la web de la Hoja de ruta y los tests.
 */

export type Estado = 'pendiente' | 'en-curso' | 'hecha';

export interface Tarea {
  id: string;
  titulo: string;
  estado: Estado;
  /** Día en que se empezó o terminó (AAAA-MM-DD); null si sigue pendiente. */
  fecha: string | null;
  /** Enlace al commit o PR; vacío si todavía no existe. */
  enlace: string;
}

export interface Fase {
  id: string;
  etapa: string;
  version: string;
  nombre: string;
  objetivo: string;
  dependeDe: string[];
  hechoCuando: string;
  pruebaJugador: string;
  estado: Estado;
  tareas: Tarea[];
}

export interface Etapa {
  id: string;
  nombre: string;
  hito: string | null;
}

export interface UltimaSesion {
  fecha: string;
  resumen: string;
  siguientePaso: string;
  pendienteDelJugador: string[];
}

export interface IdeaPendiente {
  id: string;
  titulo: string;
  origen: string;
  faseAsignada: string | null;
}

export interface EntradaHistorial {
  version: string;
  fecha: string;
  cambios: string[];
}

export interface Roadmap {
  versionActual: string;
  actualizado: string;
  faseActiva: string;
  ultimaSesion: UltimaSesion;
  etapas: Etapa[];
  fases: Fase[];
  ideasPendientes: IdeaPendiente[];
  historial: EntradaHistorial[];
}

export interface Progreso {
  hechas: number;
  total: number;
  /** Porcentaje entero de 0 a 100. */
  porcentaje: number;
}

/**
 * Progreso de un grupo de fases, contado en tareas.
 * Una fase sin tareas cuenta como una sola tarea, hecha o no según su estado.
 */
export function progreso(fases: readonly Fase[]): Progreso {
  let hechas = 0;
  let total = 0;
  for (const fase of fases) {
    if (fase.tareas.length === 0) {
      total += 1;
      if (fase.estado === 'hecha') hechas += 1;
    } else {
      total += fase.tareas.length;
      hechas += fase.tareas.filter((tarea) => tarea.estado === 'hecha').length;
    }
  }
  const porcentaje = total === 0 ? 0 : Math.round((hechas / total) * 100);
  return { hechas, total, porcentaje };
}

/** Fases de una etapa, en el orden de la hoja de ruta. */
export function fasesDeEtapa(roadmap: Roadmap, etapaId: string): Fase[] {
  return roadmap.fases.filter((fase) => fase.etapa === etapaId);
}

/** Compara dos versiones semver. Devuelve <0, 0 o >0 como Array.sort. */
export function compararVersiones(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const diferencia = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diferencia !== 0) return diferencia;
  }
  return 0;
}

function duplicados(ids: readonly string[]): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const id of ids) {
    if (vistos.has(id)) repetidos.add(id);
    vistos.add(id);
  }
  return [...repetidos];
}

/**
 * Comprueba lo que el esquema JSON no puede: referencias entre elementos,
 * identificadores únicos y estados coherentes. Devuelve la lista de problemas
 * en español (vacía si todo está bien).
 */
export function comprobarCoherencia(roadmap: Roadmap): string[] {
  const problemas: string[] = [];
  const idsEtapas = new Set(roadmap.etapas.map((etapa) => etapa.id));
  const idsFases = roadmap.fases.map((fase) => fase.id);
  const posicion = new Map(idsFases.map((id, i) => [id, i]));

  for (const id of duplicados(roadmap.etapas.map((etapa) => etapa.id))) {
    problemas.push(`Etapa repetida: ${id}`);
  }
  for (const id of duplicados(idsFases)) problemas.push(`Fase repetida: ${id}`);
  for (const id of duplicados(roadmap.fases.flatMap((fase) => fase.tareas.map((t) => t.id)))) {
    problemas.push(`Tarea repetida: ${id}`);
  }
  for (const id of duplicados(roadmap.ideasPendientes.map((idea) => idea.id))) {
    problemas.push(`Idea repetida: ${id}`);
  }
  for (const version of duplicados(roadmap.historial.map((entrada) => entrada.version))) {
    problemas.push(`Versión repetida en el historial: ${version}`);
  }

  if (!posicion.has(roadmap.faseActiva)) {
    problemas.push(`La fase activa no existe: ${roadmap.faseActiva}`);
  }

  roadmap.fases.forEach((fase, i) => {
    if (!idsEtapas.has(fase.etapa)) {
      problemas.push(`La fase ${fase.id} pertenece a una etapa que no existe: ${fase.etapa}`);
    }
    for (const dependencia of fase.dependeDe) {
      const j = posicion.get(dependencia);
      if (j === undefined) {
        problemas.push(`La fase ${fase.id} depende de una fase que no existe: ${dependencia}`);
      } else if (j >= i) {
        problemas.push(`La fase ${fase.id} depende de una fase posterior: ${dependencia}`);
      }
    }
    const estados = fase.tareas.map((tarea) => tarea.estado);
    if (fase.estado === 'hecha' && estados.some((estado) => estado !== 'hecha')) {
      problemas.push(`La fase ${fase.id} está hecha pero le quedan tareas sin terminar`);
    }
    if (fase.estado === 'pendiente' && estados.some((estado) => estado !== 'pendiente')) {
      problemas.push(`La fase ${fase.id} está pendiente pero tiene tareas empezadas`);
    }
    for (const tarea of fase.tareas) {
      if (tarea.estado !== 'pendiente' && tarea.fecha === null) {
        problemas.push(`La tarea ${tarea.id} está ${tarea.estado} pero no tiene fecha`);
      }
      if (tarea.estado === 'pendiente' && tarea.fecha !== null) {
        problemas.push(`La tarea ${tarea.id} está pendiente pero tiene fecha`);
      }
    }
  });

  for (const idea of roadmap.ideasPendientes) {
    if (idea.faseAsignada !== null && !posicion.has(idea.faseAsignada)) {
      problemas.push(`La idea ${idea.id} está asignada a una fase que no existe`);
    }
  }
  for (const entrada of roadmap.historial) {
    if (compararVersiones(entrada.version, roadmap.versionActual) > 0) {
      problemas.push(`El historial tiene una versión posterior a la actual: ${entrada.version}`);
    }
  }
  return problemas;
}
