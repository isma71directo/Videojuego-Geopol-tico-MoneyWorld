# Registro de cambios

Aquí se anota lo nuevo de cada versión del juego. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[SemVer](https://semver.org/lang/es/): se sube de versión al cerrar cada fase de la hoja de ruta.

La versión tiene una sola fuente, `package.json`. `roadmap.json` (`versionActual` e `historial`)
y este archivo deben coincidir con ella; los tests lo comprueban.

## 0.1.0 - 2026-11-11

Fase 0 · Cimientos del proyecto.

### Añadido

- Proyecto con Vite, TypeScript y Vitest, con ESLint y Prettier.
- Estructura de carpetas del documento de diseño y `CLAUDE.md` con las reglas de trabajo.
- `roadmap.json` con las 9 etapas, las 51 fases, el lanzamiento y las ampliaciones, y su esquema.
- Publicación automática en GitHub Pages con GitHub Actions en cada cambio en `main`.
- Web independiente de la Hoja de ruta (`/hoja-de-ruta/`): etapas y fases desplegables, estado de
  cada tarea, última sesión, ideas pendientes e historial. Se actualiza sola cada 2 minutos.
- Pantalla de inicio del juego con la versión, el acceso a la Hoja de ruta y los Ajustes.
- Botón «Reportar fallo / sugerencia» y plantillas de issue (`fallo`, `idea`, `datos`).
- Aviso de «versión nueva disponible» compartido entre el juego y la Hoja de ruta.
