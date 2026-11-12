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

  /** Fases numeradas («fase-0», «fase-1»…), en orden. */
  const numeradas = roadmap.fases.filter((f) => /^fase-\d+$/.test(f.id));

  it('numera las fases seguidas desde la 0, cada una con su versión 0.(n+1).0', () => {
    expect(numeradas.length).toBeGreaterThanOrEqual(100);
    numeradas.forEach((fase, n) => {
      expect(fase.id).toBe(`fase-${n}`);
      expect(fase.version).toBe(`0.${n + 1}.0`);
      expect(fase.tareas.length, `la fase ${n} no tiene tareas`).toBeGreaterThan(0);
      expect(fase.hechoCuando, `la fase ${n} no tiene «Hecho cuando»`).not.toBe('');
    });
  });

  it('las fases son cortas: de la 2 en adelante, entre 2 y 4 tareas', () => {
    for (const fase of numeradas.slice(2)) {
      expect(fase.tareas.length, fase.id).toBeGreaterThanOrEqual(2);
      expect(fase.tareas.length, fase.id).toBeLessThanOrEqual(4);
    }
  });

  it('cada fase tiene objetivo, prueba en el móvil y tarea audiovisual', () => {
    for (const fase of numeradas.slice(1)) {
      expect(fase.objetivo, fase.id).not.toBe('');
      expect(fase.pruebaJugador, fase.id).not.toBe('');
      expect(
        fase.tareas.some((tarea) => tarea.titulo.startsWith('Audiovisual:')),
        `${fase.id} sin tarea audiovisual`,
      ).toBe(true);
    }
  });

  it('cada fase depende de la anterior', () => {
    numeradas.slice(1).forEach((fase, i) => expect(fase.dependeDe).toEqual([`fase-${i}`]));
    const lanzamiento = roadmap.fases.find((f) => f.id === 'lanzamiento');
    expect(lanzamiento?.dependeDe).toEqual([numeradas.at(-1)!.id]);
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

  it('detecta un ajuste que no sale en una versión de corrección de su fase', () => {
    const malo = copia();
    const fase = malo.fases.find((f) => f.id === 'fase-4')!;
    fase.ajustes = [
      {
        id: 'f4-a9',
        titulo: 'Prueba',
        version: '0.6.0',
        origen: 'test',
        estado: 'pendiente',
        fecha: null,
        enlace: '',
      },
    ];
    expect(comprobarCoherencia(malo).some((p) => p.includes('versión de corrección'))).toBe(true);
    fase.ajustes[0]!.version = '0.5.2';
    expect(comprobarCoherencia(malo).some((p) => p.includes('versión de corrección'))).toBe(false);
  });

  it('detecta un ajuste con el mismo identificador que una tarea', () => {
    const malo = copia();
    const fase = malo.fases.find((f) => f.id === 'fase-4')!;
    fase.ajustes = [
      {
        id: 'f4-t1',
        titulo: 'Prueba',
        version: '0.5.1',
        origen: 'test',
        estado: 'pendiente',
        fecha: null,
        enlace: '',
      },
    ];
    expect(comprobarCoherencia(malo)).toContain('Tarea repetida: f4-t1');
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
