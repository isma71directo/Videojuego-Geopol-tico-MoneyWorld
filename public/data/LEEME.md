# /public/data

Datos ya procesados que carga el juego (JSON). Los generan los scripts de `/scripts`;
no se editan a mano. Los primeros datos llegan en la Fase 1.

| Archivo | Contenido | Script |
| --- | --- | --- |
| `paises-2010.json` | Datos de 2010 de cada país y territorio (con el origen de cada valor) | `scripts/datos/10-construir.ts` |
| `mapa-2010-mundo.json`, `mapa-2010-detalle.json` | Fronteras del 1 de enero de 2010 en dos niveles de detalle | `scripts/datos/09-fronteras.ts` |
| `mapa-agua.json` | Ríos y lagos del mapa | `scripts/datos/12-agua.ts` |
| `ciudades-2010.json` | Capitales de 2010 y ciudades principales, con el zoom desde el que se muestran | `scripts/datos/13-ciudades.ts` |
