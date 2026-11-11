/**
 * Une las fuentes descargadas en el conjunto final de países de 2010 (tareas f1-t5 y f1-t8).
 * Es lógica pura (sin red ni archivos) para poder probarla con tests.
 */
import type { ConjuntoPaises, NivelRenta, PaisDatos } from '../../../src/datos/paises.ts';
import {
  CAMPOS,
  DERIVADOS,
  MIX_ELECTRICO,
  SECTORES,
  SIGLA,
  UMBRALES_RENTA,
  type Archivo,
  type Campo,
} from './campos.ts';
import type { ArchivoFuente, PaisBase } from './tipos.ts';

export interface PoblacionTerritorio {
  valor: number;
  anioDato: number;
  metodo: 'directo' | 'retroproyectado';
}

export interface Entradas {
  paises: PaisBase[];
  archivos: Record<Archivo, ArchivoFuente>;
  /** Población de los territorios sin datos oficiales (06-territorios.ts). */
  territorios: Record<string, { poblacion: PoblacionTerritorio }>;
}

interface Valor {
  valor: number;
  origen: string;
}

const ANIOS = [2010, 2009, 2008];
/** Un grupo necesita al menos estos países con dato real para dar una mediana fiable. */
const MINIMO_GRUPO = 3;

export const METODOS_ESTIMACION: Record<string, string> = {
  'mediana-grupo': 'Mediana de los países con dato real de su misma región y nivel de renta.',
  'per-capita-grupo':
    'Mediana por habitante de los países de su misma región y nivel de renta, multiplicada por su población.',
  cero: 'La fuente no da el dato; se supone 0.',
  'reparto-grupo':
    'Generación eléctrica estimada, repartida entre fuentes como la mediana de su grupo.',
  retroproyeccion:
    'Dato de Wikidata de otro año llevado a 2010 con el crecimiento del país del que forma parte.',
  derivado: 'Calculado a partir de otros campos, alguno de ellos estimado.',
  'anio-AAAA': 'Dato real de otro año (el indicado) usado como aproximación para 2010.',
};

export const FUENTES: Record<string, string> = {
  BM: 'Banco Mundial, World Development Indicators',
  FMI: 'FMI, Perspectivas de la economía mundial (WEO)',
  OWID: 'Our World in Data (Ember, Energy Institute, EIA, Global Carbon Project, USGS, BGS)',
  WD: 'Wikidata',
  DER: 'Derivado de otros campos reales',
  EST: 'Estimación (valor de respaldo), no es un dato real',
};

export const esEstimacion = (origen: string): boolean => origen.startsWith('EST:');

export function mediana(valores: readonly number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 === 1 ? orden[mitad]! : (orden[mitad - 1]! + orden[mitad]!) / 2;
}

/** Redondea a 6 cifras significativas: suficiente para el juego y más legible. */
function redondear(valor: number): number {
  return valor === 0 ? 0 : Number(valor.toPrecision(6));
}

function buscar(
  archivo: ArchivoFuente,
  indicador: string,
  codigo: string,
  anios: readonly number[],
): { valor: number; anio: number } | null {
  const serie = archivo.indicadores[indicador]?.valores[codigo];
  if (!serie) return null;
  for (const anio of anios) {
    const valor = serie[String(anio)];
    if (valor !== undefined) return { valor, anio };
  }
  return null;
}

function codigoEn(pais: PaisBase, archivo: Archivo): string | null {
  if (archivo === 'bm') return pais.codigos.bm;
  if (archivo === 'fmi') return pais.codigos.fmi;
  return pais.codigos.owid;
}

/** Dato real de un campo para un país, o null si ninguna fuente lo tiene. */
function valorReal(pais: PaisBase, campo: Campo, entradas: Entradas): Valor | null {
  const anios = campo.anios ?? ANIOS;
  for (const fuente of campo.fuentes) {
    const archivo = entradas.archivos[fuente.archivo];
    const factor = fuente.factor ?? 1;
    const origenDe = (anio: number): string =>
      campo.soloOtroAnio ? `EST:anio-${anio}` : `${SIGLA[fuente.archivo]}:${anio}`;

    // El FMI ya da unido el Sudán de 2010; las demás fuentes lo dan por partes.
    const componentes = fuente.archivo === 'fmi' ? undefined : pais.componentes;
    if (!componentes) {
      const codigo = codigoEn(pais, fuente.archivo);
      const hallado = codigo ? buscar(archivo, fuente.indicador, codigo, anios) : null;
      if (hallado) return { valor: hallado.valor * factor, origen: origenDe(hallado.anio) };
      continue;
    }

    const partes = componentes
      .map((codigo) => ({ codigo, hallado: buscar(archivo, fuente.indicador, codigo, anios) }))
      .filter((parte) => parte.hallado !== null);
    const principal = partes.find((parte) => parte.codigo === componentes[0]);
    if (!principal) continue;
    if (campo.agregacion === 'suma') {
      const suma = partes.reduce((total, parte) => total + parte.hallado!.valor, 0);
      return { valor: suma * factor, origen: origenDe(principal.hallado!.anio) };
    }
    // Media ponderada por la población o el PIB de cada parte (Banco Mundial).
    const indicadorPeso = campo.agregacion === 'media-pib' ? 'pib' : 'poblacion';
    let suma = 0;
    let pesoTotal = 0;
    for (const parte of partes) {
      const peso = buscar(entradas.archivos.bm, indicadorPeso, parte.codigo, ANIOS)?.valor ?? 0;
      suma += parte.hallado!.valor * peso;
      pesoTotal += peso;
    }
    if (pesoTotal > 0) {
      return { valor: (suma / pesoTotal) * factor, origen: origenDe(principal.hallado!.anio) };
    }
  }
  // Listas de productores: no figurar es no producir. Solo vale si la fuente cubre el país.
  if (campo.ausenteEsCero && pais.codigos.owid) return { valor: 0, origen: 'OWID:ausente' };
  return null;
}

function nivelPorRenta(rentaPerCapita: number): NivelRenta {
  for (const [umbral, nivel] of UMBRALES_RENTA) if (rentaPerCapita <= umbral) return nivel;
  return 'alto';
}

const NIVELES: readonly string[] = ['bajo', 'medio-bajo', 'medio-alto', 'alto'];

export interface Resultado {
  conjunto: ConjuntoPaises;
  /** Datos de las fuentes que se han descartado por ser claramente erróneos. */
  incidencias: string[];
}

/** Fuera de este rango, la suma de los tres sectores de una fuente no es creíble. */
const SUMA_SECTORES_CREIBLE: [number, number] = [60, 120];

export function construir(entradas: Entradas): Resultado {
  const incidencias: string[] = [];
  const valores = new Map<string, Record<string, Valor>>();
  const niveles = new Map<string, NivelRenta>();

  // 1) Datos reales de cada fuente.
  for (const pais of entradas.paises) {
    const propios: Record<string, Valor> = {};
    for (const campo of CAMPOS) {
      const real = valorReal(pais, campo, entradas);
      if (real) propios[campo.clave] = real;
    }
    // Hay fuentes que rellenan con ceros los sectores que no conocen (p. ej. Venezuela).
    const sectores = SECTORES.map((clave) => propios[clave]?.valor);
    if (sectores.every((sector) => sector !== undefined)) {
      const suma = sectores.reduce<number>((total, sector) => total + sector!, 0);
      if (suma < SUMA_SECTORES_CREIBLE[0] || suma > SUMA_SECTORES_CREIBLE[1]) {
        incidencias.push(
          `${pais.nombre}: los sectores de la fuente suman ${suma.toFixed(1)} % del PIB; se descartan y se estiman.`,
        );
        for (const clave of SECTORES) delete propios[clave];
      }
    }
    const territorio = entradas.territorios[pais.id]?.poblacion;
    if (!propios.poblacion && territorio) {
      propios.poblacion = {
        valor: territorio.valor,
        origen:
          territorio.metodo === 'directo' ? `WD:${territorio.anioDato}` : 'EST:retroproyeccion',
      };
    }
    valores.set(pais.id, propios);
  }

  // 2) Nivel de renta de 2010: RNB per cápita; si falta, PIB per cápita; si no, tabla manual.
  for (const pais of entradas.paises) {
    const propios = valores.get(pais.id)!;
    const codigo = pais.componentes?.[0] ?? pais.codigos.bm;
    const rnb = codigo ? buscar(entradas.archivos.bm, 'rnbPerCapita', codigo, ANIOS) : null;
    const pibReal = propios.pib && !esEstimacion(propios.pib.origen) ? propios.pib.valor : null;
    const poblacion = propios.poblacion?.valor;
    if (pais.nivelRentaManual) {
      if (!NIVELES.includes(pais.nivelRentaManual)) {
        throw new Error(`Nivel de renta manual desconocido en ${pais.id}`);
      }
      niveles.set(pais.id, pais.nivelRentaManual as NivelRenta);
    } else if (rnb) niveles.set(pais.id, nivelPorRenta(rnb.valor));
    else if (pibReal && poblacion) niveles.set(pais.id, nivelPorRenta(pibReal / poblacion));
    else throw new Error(`No se puede calcular el nivel de renta de ${pais.id}: añádelo a mano.`);
  }

  // 3) Valores de respaldo: mediana del grupo (región + renta → renta → todos).
  const referencia = entradas.paises.filter((pais) => pais.tipo === 'pais');
  function medianaDeGrupo(pais: PaisBase, extraer: (id: string) => number | null): number | null {
    const nivel = niveles.get(pais.id);
    const filtros: ((otro: PaisBase) => boolean)[] = [
      (otro) => otro.region === pais.region && niveles.get(otro.id) === nivel,
      (otro) => niveles.get(otro.id) === nivel,
      () => true,
    ];
    for (const filtro of filtros) {
      const muestra = referencia
        .filter((otro) => otro.id !== pais.id && filtro(otro))
        .map((otro) => extraer(otro.id))
        .filter((valor): valor is number => valor !== null);
      if (muestra.length >= MINIMO_GRUPO) return mediana(muestra);
    }
    return null;
  }
  /** Valor real (no estimado) de un campo en otro país; es la base de las medianas. */
  const real = (id: string, clave: string): number | null => {
    const v = valores.get(id)?.[clave];
    return v && !esEstimacion(v.origen) ? v.valor : null;
  };
  const porHabitante = (id: string, clave: string): number | null => {
    const valor = real(id, clave);
    const poblacion = real(id, 'poblacion');
    return valor !== null && poblacion ? valor / poblacion : null;
  };

  // Las estimaciones se calculan todas a partir de datos reales y se aplican al final,
  // para que una estimación nunca alimente a otra a través de las medianas.
  const estimaciones = new Map<string, Record<string, Valor>>();
  for (const pais of entradas.paises) {
    const propios = valores.get(pais.id)!;
    const nuevas: Record<string, Valor> = {};
    const poblacion = propios.poblacion?.valor ?? null;
    for (const campo of CAMPOS) {
      if (propios[campo.clave]) continue;
      if (campo.respaldo === 'mediana') {
        const valor = medianaDeGrupo(pais, (id) => real(id, campo.clave));
        if (valor !== null) nuevas[campo.clave] = { valor, origen: 'EST:mediana-grupo' };
      } else if (campo.respaldo === 'per-capita' && poblacion !== null) {
        const valor = medianaDeGrupo(pais, (id) => porHabitante(id, campo.clave));
        if (valor !== null) {
          nuevas[campo.clave] = { valor: valor * poblacion, origen: 'EST:per-capita-grupo' };
        }
      } else if (campo.respaldo === 'cero') {
        nuevas[campo.clave] = { valor: 0, origen: 'EST:cero' };
      }
    }
    // Mix eléctrico de un país sin dato de generación: reparto como la mediana de su grupo.
    if (!propios.generacionElectrica && nuevas.generacionElectrica) {
      const generacion = nuevas.generacionElectrica.valor;
      const cuotas = MIX_ELECTRICO.map(
        (clave) =>
          medianaDeGrupo(pais, (id) => {
            const total = real(id, 'generacionElectrica');
            const parte = real(id, clave);
            return total && parte !== null ? parte / total : null;
          }) ?? 0,
      );
      const sumaCuotas = cuotas.reduce((a, b) => a + b, 0);
      MIX_ELECTRICO.forEach((clave, i) => {
        if (propios[clave]) return;
        nuevas[clave] = {
          valor: sumaCuotas > 0 ? (generacion * cuotas[i]!) / sumaCuotas : 0,
          origen: 'EST:reparto-grupo',
        };
      });
    }
    estimaciones.set(pais.id, nuevas);
  }

  // 4) Montaje de cada país.
  const paises: Record<string, PaisDatos> = {};
  for (const pais of entradas.paises) {
    const finales: Record<string, Valor> = {
      ...estimaciones.get(pais.id),
      ...valores.get(pais.id),
    };

    // Los tres sectores se reescalan para sumar 100: el Banco Mundial deja sin repartir los
    // impuestos netos sobre los productos, y el juego necesita que los sectores sumen el PIB.
    const sectores = SECTORES.map((clave) => finales[clave]);
    if (sectores.every((sector) => sector !== undefined)) {
      const suma = sectores.reduce((total, sector) => total + sector!.valor, 0);
      if (suma > 0) for (const sector of sectores) sector!.valor = (sector!.valor / suma) * 100;
    }

    for (const derivado of DERIVADOS) {
      const [a, b] = derivado.de.map((clave) => finales[clave]);
      if (!a || !b || b.valor === 0) continue;
      finales[derivado.clave] = {
        valor: derivado.calcular(a.valor, b.valor),
        origen: esEstimacion(a.origen) || esEstimacion(b.origen) ? 'EST:derivado' : 'DER',
      };
    }

    const claves = [...CAMPOS, ...DERIVADOS].map((campo) => campo.clave);
    const datos: Record<string, number | null> = {};
    const origen: Record<string, string> = {};
    for (const clave of claves) {
      const final = finales[clave];
      datos[clave] = final ? redondear(final.valor) : null;
      if (final) origen[clave] = final.origen;
    }

    paises[pais.id] = {
      id: pais.id,
      iso2: pais.iso2,
      nombre: pais.nombre,
      tipo: pais.tipo,
      jugable: pais.jugable,
      capital: pais.capital,
      region: pais.region,
      regionNombre: pais.regionNombre,
      nivelRenta: niveles.get(pais.id)!,
      ...(pais.estatus !== undefined ? { estatus: pais.estatus } : {}),
      ...(pais.reclamadoPor !== undefined ? { reclamadoPor: pais.reclamadoPor } : {}),
      datos,
      origen,
      datosEstimados: claves.filter((clave) => origen[clave] && esEstimacion(origen[clave])),
    };
  }

  const conjunto: ConjuntoPaises = {
    version: 1,
    fechaEscenario: '2010-01-01',
    fuentes: FUENTES,
    metodosEstimacion: METODOS_ESTIMACION,
    campos: Object.fromEntries(
      [...CAMPOS, ...DERIVADOS].map((campo) => [
        campo.clave,
        { nombre: campo.nombre, unidad: campo.unidad, grupo: campo.grupo },
      ]),
    ),
    paises,
  };
  return { conjunto, incidencias };
}
