# /scripts

Scripts de Node que descargan y procesan los datos reales del juego (GDD, sección 4).
Están escritos en TypeScript y Node 22 los ejecuta directamente.

Reglas:

- Cada script es **reproducible** e indica la **fuente** y el **año** de cada dato.
- Los datos que falten se rellenan con valores de respaldo marcados como estimados.
- La salida va a `/public/data/`. Nunca se editan a mano los archivos generados.

## Datos de países de 2010 (`scripts/datos/`)

```bash
npm run datos:descargar   # descarga todas las fuentes (necesita red) → fuentes/datos/
npm run datos:construir   # une, estima, valida y genera el resultado (sin red)
npm run datos             # las dos cosas seguidas
```

| Script                | Qué hace                                                                                                    | Salida                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `01-paises.ts`        | Tabla de países y territorios de 2010 (Banco Mundial, Wikidata, CLDR y tabla manual)                        | `fuentes/datos/paises.json`                                |
| `02-banco-mundial.ts` | Indicadores WDI de 2008–2010                                                                                | `fuentes/datos/banco-mundial.json`                         |
| `03-fmi.ts`           | Indicadores WEO de 2008–2010                                                                                | `fuentes/datos/fmi.json`                                   |
| `04-owid.ts`          | Energía y emisiones de Our World in Data                                                                    | `fuentes/datos/owid-*.json`                                |
| `05-recursos.ts`      | Reservas y producción de recursos naturales                                                                 | `fuentes/datos/recursos.json`                              |
| `06-territorios.ts`   | Población de los territorios sin datos oficiales (Wikidata)                                                 | `fuentes/datos/territorios.json`                           |
| `07-banderas.ts`      | Banderas de 2010 (flag-icons y Wikimedia Commons) con su licencia                                           | `public/av/banderas/`                                      |
| `08-creditos.ts`      | Créditos de datos y banderas (sin red)                                                                      | `docs/creditos.md`                                         |
| `09-fronteras.ts`     | Fronteras del 1 de enero de 2010 a partir de Natural Earth, con las correcciones de `manual/mapa-2010.json` | `public/data/mapa-2010-*.json` (TopoJSON)                  |
| `11-relieve.ts`       | Relieve sombreado y fondo oceánico reproyectados a Miller, en teselas (necesita `unzip`)                    | `public/av/relieve/`                                       |
| `12-agua.ts`          | Ríos y lagos de Natural Earth con el zoom al que se muestran                                                | `public/data/mapa-agua.json`                               |
| `10-construir.ts`     | Une las fuentes, aplica los valores de respaldo y valida                                                    | `public/data/paises-2010.json` y `docs/datos-cobertura.md` |

- `manual/mapa-2010.json` recoge las correcciones del mapa de 2010 (Crimea, Abjasia, Sudán unido…).
- `manual/paises-2010.json` es la tabla de países hecha a mano: territorios especiales, nombres y
  capitales de 2010, Sudán unido y niveles de renta sin dato.
- `lib/campos.ts` es el catálogo de campos: fuente, respaldo y límites de cada uno.
- Lo descargado se guarda ya reducido en `fuentes/datos/`, así que construir y pasar los tests no
  necesita red. Un test comprueba que `public/data/paises-2010.json` está al día con esas fuentes.
