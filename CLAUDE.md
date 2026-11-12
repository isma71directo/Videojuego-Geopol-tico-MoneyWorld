# CLAUDE.md — reglas de trabajo del proyecto

Simulador geopolítico en el navegador (nombre provisional: «Geopolítica 2010»).
El documento de diseño `docs/GDD.md` es la referencia principal; estas reglas son su sección 11.
Al jugador se le llama «el jugador»: es quien dirige el proyecto y prueba cada versión en el PC.
El juego es solo para PC (navegador, ratón y teclado); la Hoja de ruta y la galería siguen funcionando en el móvil.

## Reglas

1. **Leer al empezar:** `CLAUDE.md`, `docs/GDD.md`, `roadmap.json` y las _issues_ abiertas.
2. **Idioma:** código, comentarios, textos, commits y documentación en español (los nombres de variables pueden ir en español sin tildes).
3. **Orden:** trabajar solo en la fase activa de `roadmap.json`, en tareas pequeñas. Si una tarea no cabe en una sesión corta, dividirla en `roadmap.json` antes de empezarla.
4. **Hoja de ruta siempre al día:** marcar la tarea "en curso" al empezar y "hecha" al terminar, con fecha y enlace; añadir al historial lo nuevo de cada versión.
5. **Motor puro y probado:** toda la lógica de simulación en `/src/sim`, sin dependencias de la interfaz, con tests en Vitest. No se fusiona nada con tests en rojo.
6. **Parámetros fuera del código:** constantes de equilibrado en `/src/sim/config/*.json`.
7. **Datos reproducibles:** todo dato real procede de un script en `/scripts` que indica fuente y año; los datos estimados se marcan.
8. **Pensado para PC:** probar cada pantalla en el navegador del PC a 1280 × 720 y a 1920 × 1080, con ratón y teclado. La Hoja de ruta y la galería siguen siendo usables en el móvil.
9. **Compatibilidad de partidas:** si cambia el formato de guardado, incluir migración.
10. **Versiones:** subir la versión (semver) al cerrar cada fase y actualizar `versionActual`.
11. **Dudas de diseño:** si algo no está en el GDD, proponer opciones al jugador en lugar de inventar; anotar la decisión en el GDD.
12. **No romper el GDD:** cualquier cambio de diseño se refleja también en `docs/GDD.md` y en el registro de cambios de diseño (sección 12).
13. **Guardar el trabajo a menudo:** hacer commit y push al terminar **cada tarea**, sin acumular cambios. Si la sesión se detiene (límite de uso, inactividad o cierre), lo subido a GitHub no se pierde.
14. **Dejar la sesión lista para retomar:** al terminar cada tarea, actualizar `ultimaSesion` en `roadmap.json` (qué se hizo, siguiente paso y qué tiene pendiente el jugador). Al empezar una sesión nueva o retomar una, leer ese bloque y continuar desde ahí.
15. **Una fase, una rama y un PR:** trabajar cada fase en su rama. Al cerrarla, abrir el PR con un resumen en español de lo nuevo y la "Prueba en el PC" para que el jugador sepa qué comprobar.
16. **Peticiones nuevas del jugador:** toda idea o corrección (mensaje o _issue_) se añade a `roadmap.json`: a la fase activa si es pequeña o un fallo; a la fase que corresponda si es un sistema; o a `ideasPendientes` si no encaja. Avisar al jugador de dónde ha ido.
17. **Prioridad de los fallos:** un fallo que rompa el juego publicado se corrige antes que cualquier tarea nueva.
18. **Limitaciones de red:** si el entorno no puede acceder a una fuente de datos, explicarlo al jugador y proponer una alternativa; no inventar datos haciéndolos pasar por reales.
19. **Audiovisual en cada fase:** cada fase entrega su contenido audiovisual (gráficos, animación, sonido y, si procede, 3D) según la sección 7.1. Se crea con código o con material de licencia libre anotado en `/docs/creditos.md`; nunca se usa material sin licencia clara. El 3D se propone al jugador en el plan de la fase y siempre tiene alternativa en 2D.

## Órdenes útiles

```bash
npm install        # instalar dependencias (Node 22 o superior)
npm run dev        # servidor de desarrollo
npm test           # tests (Vitest)
npm run compilar   # comprobar tipos y compilar en dist/
npm run comprobar  # lint + formato + tests + compilación: lo mismo que GitHub Actions
npm run formato    # aplicar Prettier
```

Antes de cada commit debe pasar `npm run comprobar`.

## Cómo subir de versión

La versión tiene una sola fuente: `package.json`. Al cerrar una fase:

1. `npm version <nueva> --no-git-tag-version` (cambia `package.json` y `package-lock.json`).
2. En `roadmap.json`: `versionActual`, estado de la fase, nueva `faseActiva` y entrada en `historial`.
3. En `CHANGELOG.md`: apartado `## <nueva> - AAAA-MM-DD` con lo nuevo.

Los tests fallan si las tres cosas no coinciden.

## Dónde está cada cosa

- `docs/GDD.md` — diseño del juego. La sección 9 es la hoja de ruta (108 fases cortas, una versión cada una)
  y la 10, el formato de `roadmap.json`.
- `roadmap.json` — estado de fases y tareas. Lo leen el juego y la Hoja de ruta; su esquema es
  `roadmap.schema.json` y los tests comprueban que sea válido y coherente.
- `package.json` — única fuente de la versión. `versionActual` de `roadmap.json` debe coincidir
  (hay un test que lo exige).
- `CHANGELOG.md` — cambios de cada versión, además del `historial` de `roadmap.json`.
- `src/sim/` — motor puro, sin interfaz. `src/ui/` y `src/map/` — interfaz y mapa.
- `src/av/` y `public/av/` — sonido, animaciones, escenas 3D y recursos audiovisuales; sus fuentes y
  licencias se anotan en `docs/creditos.md`.
- `src/compartido/` — código que usan las dos webs (versión, hoja de ruta, reporte de fallos).
- `src/i18n/es.json` — todos los textos visibles; no se escriben textos sueltos en el código.
- `hoja-de-ruta/` — web independiente de la Hoja de ruta.
- `.github/` — publicación en GitHub Pages y plantillas de _issue_ (`fallo`, `idea`, `datos`).

## Convenciones de commits

- Mensajes en español, que empiecen por el identificador de la tarea: `f0-t3: crear CLAUDE.md`.
- Un commit (y push) por tarea terminada, con `roadmap.json` ya actualizado.
