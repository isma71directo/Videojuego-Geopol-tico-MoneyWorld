/**
 * Población y PIB de cada región en 2010 (tarea f5-t2).
 *
 * Fuentes:
 *  - DOSE, «Global dataset of reported subnational economic output» (Wenz et al.), versión
 *    V2.14 en Zenodo (registro 20035157), CC BY 4.0: PIB regional (en moneda local) y población
 *    de 2010 de unas 1400 regiones de 71 países.
 *  - Wikidata (CC0): población de las unidades de Natural Earth de cada región, la de 2010 o la
 *    de la fecha más cercana.
 *  - public/data/paises-2010.json: población y PIB del país (Banco Mundial, FMI…), a los que se
 *    ajustan las regiones.
 *
 * Método:
 *  - Población: la de DOSE si la región casa con regiones de DOSE solo suyas; si no, la suma de
 *    sus unidades en Wikidata; si no hay ninguna, se estima por superficie con la densidad del
 *    resto del país. Después todas se escalan para que sumen la población del país.
 *  - PIB: el del país, repartido según el peso de cada región en DOSE. Si una región de DOSE
 *    abarca varias nuestras (Inglaterra), se reparte entre ellas por población (estimado). Las
 *    regiones sin DOSE (ultramar, o países sin DOSE) reciben el PIB por habitante del país
 *    (estimado).
 *  - Un país de una sola región le pasa sus datos tal cual.
 *
 * Salida: public/data/regiones-2010-datos.json
 * Uso:    node scripts/datos/15-regiones-datos.ts (después de 10-construir.ts y 14-regiones.ts)
 */
import { descargarTexto, escribirJsonCompacto, leerCsv, leerJson } from './lib/comun.ts';
import { consultarPoblaciones, elegirPoblacion } from './lib/poblacion-wikidata.ts';

const URL_DOSE = 'https://zenodo.org/api/records/20035157/files/DOSE_V2.14.csv/content';
const ANIO = 2010;
/** Proporción mínima del PIB de DOSE de un país que tiene que casar para usarlo. */
const COBERTURA_MINIMA = 0.95;

interface Unidad {
  nombre: string;
  codigo: string | null;
  wikidata: string | null;
  km2: number;
}
interface RegionFuente {
  id: string;
  pais: string;
  nombre: string;
  unidades: Unidad[];
}
interface Pais {
  datos: Record<string, number | null>;
  origen: Record<string, string>;
}
interface ManualDose {
  alias: Record<string, Record<string, string[]>>;
  omitir: Record<string, string>;
}
interface DatosRegion {
  poblacion: number | null;
  origenPoblacion: string | null;
  pib: number | null;
  origenPib: string | null;
}

const regiones = leerJson<{ regiones: RegionFuente[] }>('fuentes/datos/regiones.json').regiones;
const paises = leerJson<{ paises: Record<string, Pais> }>('public/data/paises-2010.json').paises;
const manual = leerJson<ManualDose>('scripts/datos/manual/regiones-dose.json');
const omitir = new Set(Object.keys(manual.omitir).filter((k) => !k.startsWith('_')));

/** «Comunidad Foral de Navarra» → «foral navarra»: sin tildes, signos ni palabras de relleno. */
const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(
      /\b(region|province|provincia|oblast|state|estado|departamento|department|governorate|prefecture|county|kraj|comunidad|autonomous|republic|of|de|del|la|el|the|and|y|city|ciudad)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

/** Parecido entre dos textos (coeficiente de Dice sobre pares de letras), de 0 a 1. */
function parecido(a: string, b: string): number {
  const pares = (t: string): string[] => [...t].slice(0, -1).map((c, i) => c + t[i + 1]);
  const pa = pares(a);
  const pb = pares(b);
  if (pa.length === 0 || pb.length === 0) return a === b ? 1 : 0;
  const resto = [...pb];
  let comunes = 0;
  for (const par of pa) {
    const i = resto.indexOf(par);
    if (i >= 0) {
      comunes++;
      resto.splice(i, 1);
    }
  }
  return (2 * comunes) / (pa.length + pb.length);
}

// DOSE: filas de 2010 con PIB, por país.
console.log('Descargando DOSE (PIB regional) de Zenodo…');
const dose = leerCsv(await descargarTexto(URL_DOSE)).filter(
  (fila) => fila.year === String(ANIO) && Number(fila.grp_lcu) > 0,
);
const dosePorPais = new Map<string, Record<string, string>[]>();
for (const fila of dose) {
  const lista = dosePorPais.get(fila.GID_0!) ?? [];
  lista.push(fila);
  dosePorPais.set(fila.GID_0!, lista);
}

// Wikidata: población de todas las unidades.
console.log('Consultando en Wikidata la población de las unidades de cada región…');
const declaraciones = await consultarPoblaciones(
  regiones.flatMap((r) => r.unidades.map((u) => u.wikidata ?? '')),
);

const porPais = new Map<string, RegionFuente[]>();
for (const region of regiones) {
  const lista = porPais.get(region.pais) ?? [];
  lista.push(region);
  porPais.set(region.pais, lista);
}

const resultado: Record<string, DatosRegion> = {};
const resumen = { dose: 0, poblacionDose: 0, poblacionWikidata: 0, poblacionEstimada: 0 };
const ajustes: Record<string, number> = {};
const sinCasar: string[] = [];

for (const [pais, lista] of porPais) {
  const datosPais = paises[pais];
  const poblacionPais = datosPais?.datos.poblacion ?? null;
  const pibPais = datosPais?.datos.pib ?? null;
  if (lista.length === 1) {
    resultado[lista[0]!.id] = {
      poblacion: poblacionPais,
      origenPoblacion: datosPais?.origen.poblacion ?? null,
      pib: pibPais,
      origenPib: datosPais?.origen.pib ?? null,
    };
    continue;
  }

  // 1. Regiones de DOSE de este país → regiones nuestras.
  const porNombre = new Map<string, string>();
  for (const region of lista) {
    porNombre.set(normalizar(region.nombre), region.id);
    for (const unidad of region.unidades) porNombre.set(normalizar(unidad.nombre), region.id);
  }
  const resolver = (nombre: string): string | null => {
    const exacto = porNombre.get(normalizar(nombre));
    if (exacto) return exacto;
    let mejor: string | null = null;
    let valor = 0.82;
    for (const [clave, id] of porNombre) {
      const p = parecido(normalizar(nombre), clave);
      if (p >= valor) {
        valor = p;
        mejor = id;
      }
    }
    return mejor;
  };
  const filasDose = omitir.has(pais) ? [] : (dosePorPais.get(pais) ?? []);
  const destinos = new Map<Record<string, string>, string[]>();
  let pibCasado = 0;
  let pibTotalDose = 0;
  for (const fila of filasDose) {
    const grp = Number(fila.grp_lcu);
    pibTotalDose += grp;
    const alias = manual.alias[pais]?.[fila.region!];
    const ids = alias
      ? alias.map((nombre) => {
          const id = lista.find((r) => r.nombre === nombre)?.id ?? resolver(nombre);
          if (!id)
            throw new Error(
              `${pais}: «${nombre}» (alias de «${fila.region}») no es ninguna región`,
            );
          return id;
        })
      : [resolver(fila.region!)].filter((id): id is string => id !== null);
    if (ids.length === 0) {
      sinCasar.push(`${pais}|${fila.region}`);
      continue;
    }
    destinos.set(fila, [...new Set(ids)]);
    pibCasado += grp;
  }
  const usarDose = filasDose.length > 0 && pibCasado / pibTotalDose >= COBERTURA_MINIMA;
  if (usarDose) resumen.dose++;

  // 2. Población de partida de cada región.
  const base = new Map<string, { valor: number; origen: string } | null>();
  for (const region of lista) {
    const filasSoloSuyas = usarDose
      ? [...destinos].filter(([, ids]) => ids.length === 1 && ids[0] === region.id)
      : [];
    const compartida =
      usarDose && [...destinos].some(([, ids]) => ids.length > 1 && ids.includes(region.id));
    const poblacionDose = filasSoloSuyas.reduce((suma, [fila]) => suma + Number(fila.pop || 0), 0);
    if (filasSoloSuyas.length > 0 && !compartida && poblacionDose > 0) {
      base.set(region.id, { valor: poblacionDose, origen: `DOSE:${ANIO}` });
      resumen.poblacionDose++;
      continue;
    }
    const valores = region.unidades.map((u) =>
      u.wikidata ? elegirPoblacion(declaraciones.get(u.wikidata) ?? [], ANIO) : null,
    );
    if (valores.length > 0 && valores.every((v) => v !== null)) {
      const mayor = valores.reduce((a, b) => (b!.valor > a!.valor ? b : a))!;
      base.set(region.id, {
        valor: valores.reduce((suma, v) => suma + v!.valor, 0),
        origen: `WD:${mayor.anio}`,
      });
      resumen.poblacionWikidata++;
    } else {
      base.set(region.id, null);
    }
  }
  // Las que no tienen dato: por superficie, con la densidad del resto del país.
  const area = (region: RegionFuente): number =>
    Math.max(
      1,
      region.unidades.reduce((suma, u) => suma + u.km2, 0),
    );
  const conDato = lista.filter((r) => base.get(r.id));
  const densidad =
    conDato.length > 0
      ? conDato.reduce((suma, r) => suma + base.get(r.id)!.valor, 0) /
        conDato.reduce((suma, r) => suma + area(r), 0)
      : 1;
  for (const region of lista) {
    if (!base.get(region.id)) {
      base.set(region.id, { valor: area(region) * densidad, origen: 'EST:superficie' });
      resumen.poblacionEstimada++;
    }
  }
  // Ajuste al total del país.
  const sumaBase = lista.reduce((suma, r) => suma + base.get(r.id)!.valor, 0);
  const factor = poblacionPais !== null && sumaBase > 0 ? poblacionPais / sumaBase : 1;
  // El ajuste solo dice algo si hay datos reales (si todo es estimado, es una simple escala).
  if (conDato.length > 0) ajustes[pais] = Math.round(factor * 1000) / 1000;
  const poblacion = new Map(lista.map((r) => [r.id, Math.round(base.get(r.id)!.valor * factor)]));

  // 3. PIB.
  const pib = new Map<string, { valor: number; origen: string }>();
  if (pibPais !== null) {
    const poblacionTotal = [...poblacion.values()].reduce((a, b) => a + b, 0) || 1;
    if (usarDose) {
      const peso = new Map<string, { valor: number; estimado: boolean }>();
      for (const [fila, ids] of destinos) {
        const grp = Number(fila.grp_lcu);
        const poblacionDestinos = ids.reduce((suma, id) => suma + poblacion.get(id)!, 0) || 1;
        for (const id of ids) {
          const parte = ids.length === 1 ? grp : (grp * poblacion.get(id)!) / poblacionDestinos;
          const previo = peso.get(id) ?? { valor: 0, estimado: false };
          peso.set(id, {
            valor: previo.valor + parte,
            estimado: previo.estimado || ids.length > 1,
          });
        }
      }
      // Las regiones sin DOSE (ultramar…) reciben el PIB por habitante del país.
      const sinDose = lista.filter((r) => !peso.has(r.id));
      let pibSinDose = 0;
      for (const region of sinDose) {
        const valor = (pibPais * poblacion.get(region.id)!) / poblacionTotal;
        pib.set(region.id, { valor, origen: 'EST:poblacion' });
        pibSinDose += valor;
      }
      const sumaPeso = [...peso.values()].reduce((suma, p) => suma + p.valor, 0);
      for (const [id, p] of peso) {
        pib.set(id, {
          valor: ((pibPais - pibSinDose) * p.valor) / sumaPeso,
          origen: p.estimado ? 'EST:dose-poblacion' : `DOSE:${ANIO}`,
        });
      }
    } else {
      for (const region of lista) {
        pib.set(region.id, {
          valor: (pibPais * poblacion.get(region.id)!) / poblacionTotal,
          origen: 'EST:poblacion',
        });
      }
    }
  }

  for (const region of lista) {
    const p = pib.get(region.id);
    resultado[region.id] = {
      poblacion: poblacionPais === null ? null : poblacion.get(region.id)!,
      origenPoblacion: poblacionPais === null ? null : base.get(region.id)!.origen,
      pib: p ? Math.round(p.valor) : null,
      origenPib: p ? p.origen : null,
    };
  }
}

escribirJsonCompacto(
  'public/data/regiones-2010-datos.json',
  {
    fuente:
      'DOSE V2.14 (Wenz et al., Zenodo 20035157, CC BY 4.0), Wikidata (CC0) y los datos de cada país de paises-2010.json. Población y PIB ajustados al total del país.',
    metodos: {
      'DOSE:2010': 'Dato de 2010 de DOSE (en el PIB, su peso en el país aplicado al PIB del país).',
      'WD:<año>': 'Suma de la población de Wikidata de sus unidades (la de 2010 o la más cercana).',
      'EST:superficie': 'Estimado: superficie por la densidad del resto del país.',
      'EST:dose-poblacion': 'Estimado: parte por población de una región mayor de DOSE.',
      'EST:poblacion': 'Estimado: PIB por habitante del país por su población.',
    },
    ajustePoblacion: ajustes,
    regiones: resultado,
  },
  2,
);
const total = regiones.length;
console.log(
  `regiones-2010-datos.json: ${total} regiones · PIB de DOSE en ${resumen.dose} países · ` +
    `población de DOSE ${resumen.poblacionDose}, de Wikidata ${resumen.poblacionWikidata}, ` +
    `estimada ${resumen.poblacionEstimada}. Regiones de DOSE sin casar: ${sinCasar.length}` +
    (sinCasar.length
      ? ` (${sinCasar.slice(0, 20).join(', ')}${sinCasar.length > 20 ? '…' : ''})`
      : '') +
    '.',
);
