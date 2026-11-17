/**
 * Composición del presupuesto público de 2010 (tarea f17-t1; decisión del jugador: datos del
 * Banco Mundial y el FMI). De qué se nutren los ingresos (impuestos por tipo, cotizaciones,
 * ayudas y otros) y en qué se va el gasto (sueldos, compras, intereses, transferencias e
 * inversión), con el gasto sanitario público y la población de 65 años o más (para estimar las
 * pensiones). Los totales de ingresos, gasto, saldo y deuda son los del FMI (23-fmi-fiscal.ts y
 * 03-fmi.ts); estas partes, en % de los ingresos o del gasto, se reparten sobre ellos.
 *
 * Fuente: Banco Mundial, World Development Indicators, API v2 (https://api.worldbank.org/v2),
 *         a partir de las estadísticas de finanzas públicas del FMI (GFS, gobierno central).
 * Años:   2005–2012 (se usa el más cercano a 2010; muchos países no publican todos los años).
 *
 * Salida: fuentes/datos/bm-presupuesto.json
 * Uso:    node scripts/datos/26-bm-presupuesto.ts
 */
import { descargarIndicadorBM, URL_BASE_BM, type IndicadorBM } from './lib/banco-mundial.ts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { escribirJsonCompacto, ruta } from './lib/comun.ts';
import { codigosBM, hoy, leerPaises } from './lib/paises.ts';
import type { ArchivoFuente } from './lib/tipos.ts';

const AMPLIO: [number, number] = [2005, 2012];

export const INDICADORES_PRESUPUESTO: Record<string, IndicadorBM> = {
  // ── Ingresos (% de los ingresos) ──
  ingresosRenta: {
    codigo: 'GC.TAX.YPKG.RV.ZS',
    descripcion: 'Impuestos sobre la renta, los beneficios y las plusvalías',
    unidad: '% de los ingresos',
    anios: AMPLIO,
  },
  ingresosConsumo: {
    codigo: 'GC.TAX.GSRV.RV.ZS',
    descripcion: 'Impuestos sobre bienes y servicios (IVA y especiales)',
    unidad: '% de los ingresos',
    anios: AMPLIO,
  },
  ingresosCotizaciones: {
    codigo: 'GC.REV.SOCL.ZS',
    descripcion: 'Cotizaciones sociales',
    unidad: '% de los ingresos',
    anios: AMPLIO,
  },
  ingresosComercio: {
    codigo: 'GC.TAX.INTT.RV.ZS',
    descripcion: 'Impuestos sobre el comercio internacional (aranceles)',
    unidad: '% de los ingresos',
    anios: AMPLIO,
  },
  ingresosOtrosImpuestos: {
    codigo: 'GC.TAX.OTHR.RV.ZS',
    descripcion: 'Otros impuestos',
    unidad: '% de los ingresos',
    anios: AMPLIO,
  },
  ingresosOtros: {
    codigo: 'GC.REV.GOTR.ZS',
    descripcion: 'Ayudas recibidas y otros ingresos (empresas públicas, recursos naturales…)',
    unidad: '% de los ingresos',
    anios: AMPLIO,
  },
  // ── Gasto por tipo (% del gasto) ──
  gastoSueldos: {
    codigo: 'GC.XPN.COMP.ZS',
    descripcion: 'Remuneración de los empleados públicos',
    unidad: '% del gasto',
    anios: AMPLIO,
  },
  gastoCompras: {
    codigo: 'GC.XPN.GSRV.ZS',
    descripcion: 'Compras de bienes y servicios',
    unidad: '% del gasto',
    anios: AMPLIO,
  },
  gastoIntereses: {
    codigo: 'GC.XPN.INTP.ZS',
    descripcion: 'Intereses de la deuda',
    unidad: '% del gasto',
    anios: AMPLIO,
  },
  gastoTransferencias: {
    codigo: 'GC.XPN.TRFT.ZS',
    descripcion: 'Subvenciones y otras transferencias (prestaciones sociales incluidas)',
    unidad: '% del gasto',
    anios: AMPLIO,
  },
  gastoOtros: {
    codigo: 'GC.XPN.OTHR.ZS',
    descripcion: 'Otros gastos',
    unidad: '% del gasto',
    anios: AMPLIO,
  },
  inversionPublicaPib: {
    codigo: 'GC.NFN.TOTL.GD.ZS',
    descripcion: 'Inversión neta en activos no financieros (inversión pública)',
    unidad: '% del PIB',
    anios: AMPLIO,
  },
  // ── Por función ──
  gastoSanidadPublicoPib: {
    codigo: 'SH.XPD.GHED.GD.ZS',
    descripcion: 'Gasto sanitario público (del propio país)',
    unidad: '% del PIB',
  },
  // ── Para estimar las pensiones ──
  poblacionMayor65: {
    codigo: 'SP.POP.65UP.TO.ZS',
    descripcion: 'Población de 65 años o más',
    unidad: '% de la población',
  },
};

const codigos = codigosBM(leerPaises());
const salida: ArchivoFuente = {
  fuente: 'Banco Mundial, World Development Indicators (API v2): finanzas públicas',
  url: URL_BASE_BM,
  descargado: hoy(),
  notas: [
    'Presupuesto (tarea f17-t1): las partes de los ingresos y del gasto son del gobierno central (estadísticas de finanzas públicas del FMI, vía el Banco Mundial) y se reparten sobre los totales de todas las administraciones del FMI. Lo que no tiene dato se estima con la mediana de su región y nivel de renta.',
  ],
  indicadores: {},
};

// El servidor del Banco Mundial a veces no responde durante un rato: cada indicador descargado se
// guarda aparte (fuera del repositorio) y, si falta alguno, se puede volver a ejecutar más tarde
// sin repetir los que ya están.
const CACHE = ruta('../cache-datos/bm-presupuesto');
mkdirSync(CACHE, { recursive: true });
const faltan: string[] = [];
for (const [clave, indicador] of Object.entries(INDICADORES_PRESUPUESTO)) {
  const archivoCache = join(CACHE, `${clave}-${indicador.codigo}.json`);
  let descargado: ReturnType<typeof descargarIndicadorBM>;
  if (existsSync(archivoCache)) {
    descargado = JSON.parse(readFileSync(archivoCache, 'utf8')) as ReturnType<
      typeof descargarIndicadorBM
    >;
  } else {
    try {
      descargado = descargarIndicadorBM(indicador, codigos);
      writeFileSync(archivoCache, JSON.stringify(descargado));
    } catch {
      console.log(`${clave.padEnd(24)} ${indicador.codigo.padEnd(20)} sin respuesta del servidor`);
      faltan.push(clave);
      continue;
    }
  }
  const { valores, actualizadoFuente } = descargado;
  salida.indicadores[clave] = {
    codigo: indicador.codigo,
    descripcion: indicador.descripcion,
    unidad: indicador.unidad,
    actualizadoFuente,
    valores,
  };
  console.log(
    `${clave.padEnd(24)} ${indicador.codigo.padEnd(20)} ${Object.keys(valores).length} países`,
  );
}

if (faltan.length > 0) {
  console.error(
    `Faltan ${faltan.length} indicadores (${faltan.join(', ')}): vuelve a ejecutarlo más tarde.`,
  );
  process.exit(2);
}

escribirJsonCompacto('fuentes/datos/bm-presupuesto.json', salida, 4);
