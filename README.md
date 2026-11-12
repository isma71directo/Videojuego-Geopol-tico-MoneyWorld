# Geopolítica 2010 (nombre provisional)

Simulador geopolítico en tiempo real con pausa que se juega en el navegador del PC, con ratón y teclado.
El jugador dirige un país real a partir del **1 de enero de 2010**.

- 🎮 **Jugar:** <https://isma71directo.github.io/Videojuego-Geopol-tico-MoneyWorld/>
- 🗺️ **Hoja de ruta:** <https://isma71directo.github.io/Videojuego-Geopol-tico-MoneyWorld/hoja-de-ruta/>
- 📘 **Documento de diseño:** [docs/GDD.md](docs/GDD.md)
- 📝 **Cambios de cada versión:** [CHANGELOG.md](CHANGELOG.md)

## Estructura

| Carpeta          | Contenido                                               |
| ---------------- | ------------------------------------------------------- |
| `/`              | Juego (página principal)                                |
| `/hoja-de-ruta/` | Web independiente de la Hoja de ruta                    |
| `/docs/GDD.md`   | Documento de diseño: la referencia del proyecto         |
| `/CLAUDE.md`     | Reglas de trabajo para Claude Code                      |
| `/roadmap.json`  | Estado de fases y tareas (lo leen las dos webs)         |
| `/scripts/`      | Descarga y procesado de datos reales                    |
| `/fuentes/`      | Material original (p. ej. árboles tecnológicos `.docx`) |
| `/public/data/`  | Datos ya procesados que carga el juego                  |
| `/src/sim/`      | Motor de simulación, sin dependencias de interfaz       |
| `/src/ui/`       | Pantallas y componentes                                 |
| `/src/map/`      | Mapa 2D y capas                                         |
| `/src/i18n/`     | Textos de la interfaz (`es.json`)                       |
| `/tests/`        | Tests (Vitest)                                          |

## Desarrollo

Hace falta Node 22 o superior.

```bash
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo
npm test           # pasar los tests
npm run compilar   # comprobar tipos y compilar en dist/
npm run comprobar  # lint + formato + tests + compilación (lo mismo que hace GitHub Actions)
```

Cada fusión en `main` publica una versión nueva en GitHub Pages.

## Reportar fallos o proponer ideas

Desde el botón **«Reportar fallo / sugerencia»** del juego o directamente en
[las issues del repositorio](https://github.com/isma71directo/Videojuego-Geopol-tico-MoneyWorld/issues/new/choose).
