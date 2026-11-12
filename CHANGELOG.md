# Registro de cambios

Aquí se anota lo nuevo de cada versión del juego. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[SemVer](https://semver.org/lang/es/): se sube de versión al cerrar cada fase de la hoja de ruta.

La versión tiene una sola fuente, `package.json`. `roadmap.json` (`versionActual` e `historial`)
y este archivo deben coincidir con ella; los tests lo comprueban.

## 0.4.0 - 2026-11-12

Fase 3 · Mapa: dibujo, relieve y navegación.

### Añadido

- Mapa del mundo de 2010 a pantalla completa en Canvas con la proyección Miller, abierto desde
  «Explorar el mapa» en la pantalla de inicio.
- Navegación: arrastrar, pellizcar y doble toque en el móvil; rueda y doble clic en el PC;
  flechas y +/− en el teclado. Límites arriba y abajo y vuelta continua este-oeste.
- Relieve sombreado y fondo oceánico de Natural Earth reproyectados a Miller, en teselas que se
  descargan según el zoom (1,8 MB en total).
- Ríos y lagos de Natural Earth: los grandes desde lejos y los demás al acercarse.
- Paleta de colores de mapa político, zoom animado e inercia al soltar (se desactivan si el
  dispositivo pide reducir el movimiento).
- Medidor de rendimiento con `?fps` al final de la dirección.

### Diseño

- Decisiones del jugador: mapa grande, plano y rectangular (proyección Miller), con vuelta
  este-oeste, vivo (relieve, ríos, detalle) y con modos de mapa con leyenda.

## 0.3.0 - 2026-11-12

Fase 2 · Mapa: fronteras y territorios de 2010.

### Añadido

- Fronteras del 1 de enero de 2010 a partir de Natural Earth 1:10m (`scripts/datos/09-fronteras.ts`),
  con las correcciones de `scripts/datos/manual/mapa-2010.json`: Sudán unido, Crimea dentro de
  Ucrania, Abjasia, Osetia del Sur, Transnistria y el Sáhara Occidental como territorios propios,
  Antillas Neerlandesas e Islas del Canal unidas.
- Mapa en TopoJSON en dos niveles: «mundo» (340 KB) para el móvil y «detalle» (926 KB) para
  acercarse. Los microestados conservan su forma.
- 21 territorios dependientes jugables (Hong Kong, Macao, Puerto Rico, Groenlandia, Islas Feroe…),
  cada uno con su país soberano, y las Antillas Neerlandesas tal como eran en 2010.
- Vista previa del mapa de 2010 en la galería audiovisual y banderas de los territorios nuevos.

### Cambiado

- Jugables también Abjasia, Osetia del Sur, Transnistria, Somalilandia y Chipre del Norte.
- Hoja de ruta dividida en 108 fases cortas de 2 a 4 tareas, una versión cada una.
- 3D solo donde sea posible y necesario para el juego (sin globo 3D).

## 0.2.0 - 2026-11-11

Fase 1 · Datos reales de 2010.

### Añadido

- Datos reales de partida de 202 países y territorios a 1 de enero de 2010 (193 Estados y 9
  territorios de estatus especial) en `public/data/paises-2010.json`: 62 campos de demografía,
  economía, Estado, sociedad, energía, emisiones y recursos naturales.
- Scripts reproducibles en `scripts/datos/` que descargan el Banco Mundial, el FMI, Our World in
  Data y Wikidata, unen las fuentes y validan el resultado (`npm run datos`).
- Cada valor indica su fuente y su año. Los que faltan se estiman por región y nivel de renta y
  quedan marcados como estimados.
- Informe de cobertura (`docs/datos-cobertura.md`) y créditos (`docs/creditos.md`).
- Banderas de todos los países tal como eran en 2010 e iconos de los indicadores.
- Galería audiovisual (`/galeria/`), enlazada desde la Hoja de ruta.

### Diseño

- Contenido audiovisual en todas las fases (GDD, sección 7.1, y regla 19). El 3D se permite en
  componentes complementarios; el mapa de juego sigue en 2D.

## 0.1.1 - 2026-11-11

### Corregido

- Los avisos enviados con «Reportar fallo / sugerencia» llegaban sin la versión del juego: GitHub
  cargaba la plantilla e ignoraba el texto ya rellenado (issue n.º 3).
- Las plantillas de issue llevaban una pista oculta que, al escribir desde el móvil, podía esconder
  el resto del aviso. Se ha quitado.

### Añadido

- La hoja de reporte muestra los datos del juego que se añaden al aviso y permite copiarlos, por si
  GitHub abre el formulario sin ellos.

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
