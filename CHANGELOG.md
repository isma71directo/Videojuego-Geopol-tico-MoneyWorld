# Registro de cambios

Aquí se anota lo nuevo de cada versión del juego. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[SemVer](https://semver.org/lang/es/): se sube de versión al cerrar cada fase de la hoja de ruta.

La versión tiene una sola fuente, `package.json`. `roadmap.json` (`versionActual` e `historial`)
y este archivo deben coincidir con ella; los tests lo comprueban.

## 0.5.2 - 2026-11-12

Ajuste de la Fase 4 pedido por el jugador tras probar la v0.5.1.

### Corregido

- Nombres de ciudades mal traducidos en Natural Earth: «Señorío de Tlaxcala» → Tlaxcala,
  «El higo luperon» → Puerto Plata, «San Borja» → Santa Ana del Yacuma, «Condado de Kilju» →
  Kilju, «Mineápolis» → Minneapolis, entre otros.
- Ciudades renombradas después de 2010, con su nombre de entonces: Dnipropetrovsk,
  Kirovogrado, Xiangfan, Jessore y Almatý.
- Transliteraciones con signos poco usados en español (Kunduz, Herat, Ludhiana…) y nombres
  oficiales largos en lugar del habitual (Puebla, Acapulco, Querétaro, Davao, Cebú…).
- Quitados dos lugares erróneos de Natural Earth que tenían la población de otra ciudad del
  mismo nombre («Arak» en Argelia y «Al Ḥilla» en Arabia Saudí).

## 0.5.1 - 2026-11-12

Ajustes de la Fase 4 pedidos por el jugador tras probar la v0.5.0.

### Cambiado

- **Más colores:** 12 tonos en lugar de 8. Además de que dos vecinos nunca coinciden, se evita
  repetir color entre los vecinos de un país y entre países cercanos sin frontera (islas,
  estrechos): ningún país comparte color con dos de sus vecinos a la vez.
- **Nombres de países:** aparecen siempre que no se pisen con otro, aunque el nombre sea más
  ancho que el país (Marruecos se ve con el mundo entero a la vista). Si el sitio está ocupado,
  el nombre prueba un poco más arriba, abajo o a un lado y, si aun así no cabe, su forma corta
  («Rep. Checa»). Solo los países diminutos, como Hong Kong, esperan al zoom.
- **Orden de las ciudades:** aparecen al acercarse según su población (Zaragoza antes que
  Córdoba y esta antes que Oviedo). Las capitales, algo antes que una ciudad del mismo tamaño.
  Ahora hay 2214 ciudades: todas las de más de 100 000 habitantes (hasta 50 por país).

### Añadido

- Población de cada ciudad, de Wikidata: la de 2010 o, si no la hay, la de la fecha más
  cercana, con su año. Si Wikidata no tiene ninguna con fecha, la de 2010 de la ONU.
- Ficha de la ciudad al pasar el ratón por su punto o su nombre, y panel al hacer clic, con su
  población, el año y la fuente del dato y un botón para ver la ficha de su país.
- Hoja de ruta: apartado «Ajustes tras la prueba» en cada fase, para lo que el jugador pide
  cambiar después de probarla.

## 0.5.0 - 2026-11-12

Fase 4 · Mapa: selección, nombres y sonido.

### Añadido

- Al pasar el ratón, el país se resalta y aparece una ficha con su bandera, su capital, su
  población y su PIB por habitante. Con un clic queda seleccionado y se abre un panel a la
  derecha con sus datos clave de 2010 (los estimados, con asterisco). Escape o un clic en el mar
  quitan la selección. Los microestados (Vaticano, Mónaco, Singapur…) se señalan por su punto.
- Cada país tiene siempre el mismo color y nunca el de un vecino, con una paleta nueva de ocho
  tonos bien distintos.
- Nombres de los países que aparecen según el zoom (primero los grandes) sin pisarse; los de
  las islas y países pequeños, debajo de su contorno al acercarse.
- Capitales de 2010 (Buyumbura en Burundi, Sujumi en Abjasia…) y ciudades principales al
  acercarse, con un script nuevo (`scripts/datos/13-ciudades.ts`) que usa Natural Earth y,
  para las capitales que faltan, Wikidata.
- Motor de sonido con Web Audio y efectos de interfaz sintetizados: seleccionar, quitar la
  selección, abrir un panel y pulsar un botón. Empieza con el primer clic o la primera tecla.
- Botón de silencio junto a «Volver» y tecla M en el mapa; silencio y volumen de los efectos en
  Ajustes.
- Pulso dorado al seleccionar un país (sin animación si el dispositivo pide reducir el
  movimiento).
- Galería audiovisual: paleta del mapa político y botones para escuchar los sonidos.

## 0.4.1 - 2026-11-12

### Corregido

- El medidor de rendimiento del mapa no se veía si no se añadía `?fps` a la dirección, y en
  algunos navegadores quedaba tapado por la barra inferior. Ahora se activa en Ajustes o con la
  tecla F en el mapa, se recuerda en el navegador y está arriba a la derecha.

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
