/** Validación del conjunto final de países (tarea f1-t6). Lógica pura, con tests. */
import type { ConjuntoPaises } from '../../../src/datos/paises.ts';
import { CAMPOS, DERIVADOS, MIX_ELECTRICO, SECTORES } from './campos.ts';
import { esEstimacion } from './construir.ts';

export interface ResultadoValidacion {
  /** Fallos que impiden publicar los datos. */
  errores: string[];
  /** Valores fuera de lo habitual, para revisarlos a mano; no impiden publicar. */
  avisos: string[];
}

/** Estados soberanos el 1 de enero de 2010: 192 miembros de la ONU y el Vaticano. */
export const ESTADOS_2010 = 193;
/** Mínimo de países con población y PIB reales que exige la Fase 1. */
export const MINIMO_PAISES_CON_DATOS = 190;

const DEFINICIONES = [...CAMPOS, ...DERIVADOS];

export function validar(conjunto: ConjuntoPaises): ResultadoValidacion {
  const errores: string[] = [];
  const avisos: string[] = [];
  const paises = Object.entries(conjunto.paises);

  const repetidos = (valores: (string | null)[]): string[] => {
    const vistos = new Set<string>();
    const dobles = new Set<string>();
    for (const valor of valores) {
      if (valor === null) continue;
      if (vistos.has(valor)) dobles.add(valor);
      vistos.add(valor);
    }
    return [...dobles];
  };
  for (const nombre of repetidos(paises.map(([, pais]) => pais.nombre))) {
    errores.push(`Nombre de país repetido: ${nombre}`);
  }
  for (const iso2 of repetidos(paises.map(([, pais]) => pais.iso2))) {
    errores.push(`Código ISO2 repetido: ${iso2}`);
  }

  const estados = paises.filter(([, pais]) => pais.tipo === 'pais').length;
  if (estados !== ESTADOS_2010) {
    errores.push(`Hay ${estados} Estados soberanos y en 2010 eran ${ESTADOS_2010}`);
  }

  let conDatosReales = 0;
  for (const [clave, pais] of paises) {
    const { datos, origen } = pais;
    if (pais.id !== clave) errores.push(`${clave}: el identificador interno es ${pais.id}`);
    if (pais.capital.trim() === '') errores.push(`${pais.nombre}: sin capital`);

    for (const esencial of ['poblacion', 'pib']) {
      if (pais.jugable && datos[esencial] == null) {
        errores.push(`${pais.nombre}: es jugable pero no tiene ${esencial}`);
      }
    }
    if (
      datos.poblacion != null &&
      datos.pib != null &&
      !esEstimacion(origen.poblacion!) &&
      !esEstimacion(origen.pib!)
    ) {
      conDatosReales += 1;
    }

    for (const campo of DEFINICIONES) {
      const valor = datos[campo.clave];
      const procedencia = origen[campo.clave];
      if (valor === undefined) {
        errores.push(`${pais.nombre}: falta el campo ${campo.clave}`);
        continue;
      }
      if ((valor === null) !== (procedencia === undefined)) {
        errores.push(`${pais.nombre}: ${campo.clave} y su origen no cuadran`);
      }
      if (valor === null) continue;
      if (!Number.isFinite(valor)) {
        errores.push(`${pais.nombre}: ${campo.clave} no es un número`);
        continue;
      }
      const [minimo, maximo] = campo.limites;
      if (valor < minimo || valor > maximo) {
        errores.push(
          `${pais.nombre}: ${campo.clave} = ${valor} es imposible (${minimo} a ${maximo})`,
        );
      } else if (campo.habitual && (valor < campo.habitual[0] || valor > campo.habitual[1])) {
        avisos.push(`${pais.nombre}: ${campo.nombre} = ${valor} ${campo.unidad} (${procedencia})`);
      }
    }

    const estimados = Object.keys(origen).filter((campo) => esEstimacion(origen[campo]!));
    if ([...estimados].sort().join() !== [...pais.datosEstimados].sort().join()) {
      errores.push(`${pais.nombre}: datosEstimados no coincide con los orígenes «EST:»`);
    }

    const sectores = SECTORES.map((campo) => datos[campo]);
    if (sectores.every((sector) => sector != null)) {
      const suma = sectores.reduce<number>((total, sector) => total + sector!, 0);
      if (Math.abs(suma - 100) > 0.5) {
        errores.push(`${pais.nombre}: los sectores suman ${suma.toFixed(1)} % del PIB`);
      }
    }

    const generacion = datos.generacionElectrica;
    const mix = MIX_ELECTRICO.map((campo) => datos[campo]);
    if (generacion != null && mix.every((parte) => parte != null)) {
      const suma = mix.reduce<number>((total, parte) => total + parte!, 0);
      if (Math.abs(suma - generacion) > Math.max(0.5, generacion * 0.05)) {
        avisos.push(
          `${pais.nombre}: el mix eléctrico suma ${suma.toFixed(1)} TWh y la generación es ${generacion} TWh`,
        );
      }
    }

    if (datos.pib != null && datos.poblacion != null && datos.pibPerCapita != null) {
      const esperado = datos.pib / datos.poblacion;
      if (Math.abs(datos.pibPerCapita - esperado) > esperado * 0.001) {
        errores.push(`${pais.nombre}: el PIB per cápita no es PIB entre población`);
      }
    }
  }

  if (conDatosReales < MINIMO_PAISES_CON_DATOS) {
    errores.push(
      `Solo ${conDatosReales} países tienen población y PIB reales; hacen falta ${MINIMO_PAISES_CON_DATOS}`,
    );
  }
  return { errores, avisos };
}

export interface Cobertura {
  reales: number;
  estimados: number;
  sinDato: number;
}

const vacia = (): Cobertura => ({ reales: 0, estimados: 0, sinDato: 0 });

/** Cuántos valores son reales, estimados o faltan: en total, por país y por campo. */
export function cobertura(conjunto: ConjuntoPaises): {
  total: Cobertura;
  porPais: Record<string, Cobertura>;
  porCampo: Record<string, Cobertura & { porFuente: Record<string, number> }>;
} {
  const total = vacia();
  const porPais: Record<string, Cobertura> = {};
  const porCampo: Record<string, Cobertura & { porFuente: Record<string, number> }> = {};
  for (const clave of Object.keys(conjunto.campos)) porCampo[clave] = { ...vacia(), porFuente: {} };

  for (const pais of Object.values(conjunto.paises)) {
    const propia = (porPais[pais.id] = vacia());
    for (const clave of Object.keys(conjunto.campos)) {
      const procedencia = pais.origen[clave];
      const tipo: keyof Cobertura =
        procedencia === undefined ? 'sinDato' : esEstimacion(procedencia) ? 'estimados' : 'reales';
      total[tipo] += 1;
      propia[tipo] += 1;
      porCampo[clave]![tipo] += 1;
      if (procedencia && tipo === 'reales') {
        const fuente = procedencia.split(':')[0]!;
        porCampo[clave]!.porFuente[fuente] = (porCampo[clave]!.porFuente[fuente] ?? 0) + 1;
      }
    }
  }
  return { total, porPais, porCampo };
}
