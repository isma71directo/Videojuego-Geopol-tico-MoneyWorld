import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import {
  comprobarCoherencia,
  compararVersiones,
  fasesDeEtapa,
  progreso,
  type Fase,
  type Roadmap,
} from '../src/compartido/roadmap';

const leerJson = (ruta: string): unknown =>
  JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8'));

const roadmap = leerJson('../roadmap.json') as Roadmap;
const esquema = leerJson('../roadmap.schema.json') as object;
const paquete = leerJson('../package.json') as { version: string };

/** Copia profunda para probar roadmaps con errores sin tocar el real. */
const copia = (): Roadmap => structuredClone(roadmap);

describe('roadmap.json', () => {
  it('es válido según su esquema', () => {
    const validar = new Ajv({ allErrors: true }).compile(esquema);
    validar(roadmap);
    expect(validar.errors ?? []).toEqual([]);
  });

  it('no tiene incoherencias (referencias, duplicados, estados)', () => {
    expect(comprobarCoherencia(roadmap)).toEqual([]);
  });

  it('muestra la misma versión que package.json', () => {
    expect(roadmap.versionActual).toBe(paquete.version);
  });

  it('contiene las 9 etapas del GDD, de la A a la I', () => {
    expect(roadmap.etapas.map((etapa) => etapa.id)).toEqual([...'ABCDEFGHI']);
  });

  it('contiene las 51 fases numeradas del GDD con su versión', () => {
    for (let n = 0; n <= 50; n += 1) {
      const fase = roadmap.fases.find((f) => f.id === `fase-${n}`);
      expect(fase, `falta la fase ${n}`).toBeDefined();
      expect(fase?.version).toBe(`0.${n + 1}.0`);
      expect(fase?.tareas.length, `la fase ${n} no tiene tareas`).toBeGreaterThan(0);
      expect(fase?.hechoCuando, `la fase ${n} no tiene «Hecho cuando»`).not.toBe('');
    }
  });

  it('incluye el lanzamiento 1.0.0 y las ampliaciones hasta la 2.0.0', () => {
    expect(roadmap.fases.find((f) => f.id === 'lanzamiento')?.version).toBe('1.0.0');
    const ampliaciones = fasesDeEtapa(roadmap, 'I').map((f) => f.version);
    expect(ampliaciones).toHaveLength(11);
    expect(ampliaciones.at(0)).toBe('1.1.0');
    expect(ampliaciones.at(-1)).toBe('2.0.0');
  });

  it('ordena las fases por versión creciente', () => {
    const versiones = roadmap.fases.map((f) => f.version);
    expect([...versiones].sort(compararVersiones)).toEqual(versiones);
  });

  it('toda etapa tiene al menos una fase', () => {
    for (const etapa of roadmap.etapas) {
      expect(fasesDeEtapa(roadmap, etapa.id).length).toBeGreaterThan(0);
    }
  });
});

describe('comprobarCoherencia', () => {
  it('detecta una fase activa que no existe', () => {
    const malo = copia();
    malo.faseActiva = 'fase-999';
    expect(comprobarCoherencia(malo)).toContain('La fase activa no existe: fase-999');
  });

  it('detecta tareas repetidas', () => {
    const malo = copia();
    const [primera] = malo.fases[0]!.tareas;
    malo.fases[1]!.tareas.push({ ...primera!, estado: 'pendiente', fecha: null });
    expect(comprobarCoherencia(malo)).toContain(`Tarea repetida: ${primera!.id}`);
  });

  it('detecta dependencias inexistentes o posteriores', () => {
    const malo = copia();
    malo.fases[0]!.dependeDe = ['no-existe', malo.fases[1]!.id];
    const problemas = comprobarCoherencia(malo);
    expect(problemas.some((p) => p.includes('no existe: no-existe'))).toBe(true);
    expect(problemas.some((p) => p.includes('fase posterior'))).toBe(true);
  });

  it('detecta una fase hecha con tareas sin terminar', () => {
    const malo = copia();
    const fase = malo.fases.at(-20)!;
    fase.estado = 'hecha';
    expect(comprobarCoherencia(malo).some((p) => p.includes('le quedan tareas'))).toBe(true);
  });

  it('detecta una tarea hecha sin fecha', () => {
    const malo = copia();
    const fase = malo.fases[0]!;
    fase.tareas[0] = { ...fase.tareas[0]!, estado: 'hecha', fecha: null };
    expect(comprobarCoherencia(malo).some((p) => p.includes('no tiene fecha'))).toBe(true);
  });
});

describe('progreso', () => {
  const fase = (estados: Fase['estado'][], estado: Fase['estado'] = 'en-curso'): Fase => ({
    id: 'x',
    etapa: 'A',
    version: '0.1.0',
    nombre: 'x',
    objetivo: '',
    dependeDe: [],
    hechoCuando: '',
    pruebaJugador: '',
    estado,
    tareas: estados.map((e, i) => ({
      id: `t${i}`,
      titulo: 't',
      estado: e,
      fecha: e === 'pendiente' ? null : '2026-11-11',
      enlace: '',
    })),
  });

  it('cuenta las tareas hechas', () => {
    expect(progreso([fase(['hecha', 'hecha', 'en-curso', 'pendiente'])])).toEqual({
      hechas: 2,
      total: 4,
      porcentaje: 50,
    });
  });

  it('una fase sin tareas cuenta como una tarea según su estado', () => {
    expect(progreso([fase([], 'pendiente')]).porcentaje).toBe(0);
    expect(progreso([fase([], 'hecha')]).porcentaje).toBe(100);
  });

  it('sin fases el progreso es 0', () => {
    expect(progreso([])).toEqual({ hechas: 0, total: 0, porcentaje: 0 });
  });
});

describe('compararVersiones', () => {
  it('compara por números, no por texto', () => {
    expect(compararVersiones('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compararVersiones('1.0.0', '0.51.0')).toBeGreaterThan(0);
    expect(compararVersiones('0.1.0', '0.1.0')).toBe(0);
  });
});
