# Registro de cambios

Aquí se anota lo nuevo de cada versión del juego. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[SemVer](https://semver.org/lang/es/): se sube de versión al cerrar cada fase de la hoja de ruta.

La versión tiene una sola fuente, `package.json`. `roadmap.json` (`versionActual` e `historial`)
y este archivo deben coincidir con ella; los tests lo comprueban.

## 0.9.1 - 2026-11-16

Ajustes de la Fase 8 pedidos por el jugador al probar la v0.9.0: que ningún retrato parezca ya
visto ni se parezca a otro.

### Cambiado

- **Cada retrato tiene su cara** (ajuste f8-a1):
  - Forma de la cara (ovalada, redonda, cuadrada, afilada, larga) y proporciones.
  - Ojos con blanco, iris de color y 5 formas.
  - Nariz (6 tipos), labios con color (finos, medios, gruesos), orejas (4) y cejas (6).
  - Gesto (neutro, leve sonrisa, sonrisa, serio).
  - Arrugas según la edad, lunar y piel con tonos intermedios y matices.
  - Los genéricos los reparten según la región, sin exagerar rasgos.
- **Genéricos que se peinan y visten según su zona** (ajuste f8-a2):
  - África:
    - pelo afro corto y alto, rapado, trenzas y canas en las sienes;
    - agbada con gorro fila (Nigeria, Benín) y kente (Ghana);
    - dashiki y gele (golfo de Guinea), boubou con kufi (Sahel);
    - kanzu (África oriental) y chaqueta abacost (África central).
  - Resto del mundo:
    - guayabera (Caribe y Centroamérica), barong (Filipinas), batik con songkok (Indonesia, Malasia);
    - camisa de flores (Pacífico), kameez (Pakistán, Afganistán), topi (Nepal);
    - sari, hiyab, kufiya en el Golfo y turbante en Omán.
  - Trajes de 11 colores con camisa de color, corbata lisa, de rayas o de lunares, pañuelo e
    insignia con el color del país.
  - Barbas (bigote grueso y fino, chivo, cerrada, de tres días), tupé, flequillo lateral, gafas
    de pasta, doradas y sin montura, y pendientes.
- **217 homenajes** (ajuste f8-a3):
  - Los 97 anteriores, con su cara propia.
  - 120 nuevos de todas las regiones, con detalles como la pajarita de Ilves, el monóculo de
    Jorge Tupou V, el chal de Rajapaksa, el turbante de Qabús, el kente de Atta Mills o la agbada
    de Boni Yayi.
- Un test exige que dos personas cualesquiera se diferencien al menos en 5 de 22 rasgos.

### Corregido

- Un homenaje ya no puede heredar al azar la barba, las gafas ni el tocado del retrato genérico:
  solo los lleva si se le ponen a propósito.

## 0.9.0 - 2026-11-16

Fase 8: ficha de país.

### Añadido

- **Ficha de país** en el panel de la derecha, con cuatro pestañas:
  - **Resumen:** régimen político con su icono, jefe de Estado y jefe de Gobierno con su retrato,
    cargo y año de llegada; capital, región, nivel de renta, población, PIB y PIB por habitante.
  - **Economía:** PIB, crecimiento, paro, inflación, deuda, saldo fiscal, cuenta corriente y
    comercio; PIB por sectores y electricidad por fuente, con sus barras.
  - **Sociedad:** población, superficie, densidad, esperanza de vida, alfabetización, acceso a la
    electricidad, internet, gasto en sanidad, educación y defensa, efectivos militares y CO₂.
  - **Fuentes:** de dónde sale cada dato, los cargos y el régimen.
  - Cada dato explica qué es al pasar el ratón y los estimados llevan asterisco y aviso.
  - La pestaña elegida se recuerda al cambiar de país.
- **Gobiernos de 2010** (`scripts/datos/20-gobiernos.ts`, Wikidata):
  - Régimen (uno de los 8 del GDD) y jefes de Estado y de Gobierno de los 223 países a 1 de enero
    de 2010.
  - Correcciones a mano en `scripts/datos/manual/gobiernos-2010.json`, cada una con su motivo:
    regímenes que han cambiado desde 2010, cargos que faltan, erratas de Wikidata y nombres de país
    de 2010.
  - Los cargos van en femenino cuando los ocupa una mujer.
  - Los territorios dependientes muestran el jefe de Estado de su soberano.
- **Retratos ilustrados** (`src/av/retratos.ts`): bustos dibujados con código en SVG, nunca
  fotografías, sobre el color del país en el mapa.
  - **97 homenajes** a los líderes de 2010 de los países y figuras importantes: todos los del G20,
    el papa, Jameneí, Kim Jong-il, Gadafi, Chávez, Raúl Castro…
  - Cada homenaje es reconocible por su pelo, barba, gafas, ropa, tocado o gesto: la media melena
    de Merkel, la trenza de Timoshenko, el sombrero y las perlas de Isabel II, la boina de Chávez,
    el gorro karakul de Karzai, el turbante de Manmohan Singh…
  - El resto lleva un retrato genérico, respetuoso y siempre igual para la misma persona, según la
    región del país, el estilo de su régimen (uniforme en las juntas, túnica y kufiya en las
    monarquías del Golfo, boubou en el Sahel), el sexo y la edad.
- **Iconos de los 8 regímenes.**
- **Galería:** los iconos de los regímenes y los 326 retratos, primero los homenajes.

## 0.8.2 - 2026-11-16

Ajustes de la Fase 7 pedidos por el jugador al probar la v0.8.1.

### Cambiado

- **Colores de país rehechos:**
  - Cada país lleva su color representativo, el que se le asocia al pensar en él y no solo el
    principal de su bandera: España y Rumanía amarillo, Portugal y Reino Unido rojo, Italia verde
    azulado, Países Bajos naranja, Francia azul, Brasil verde, Argentina celeste…
  - Está en una tabla revisable de 185 países (`src/map/config/colores-pais.json`), con nombres
    de color en español. Los territorios pequeños usan los colores de su bandera.
  - Ya no hay paleta cerrada: cada país lleva una variante de su color (más clara, más oscura o
    algo girada) para no parecerse a los de alrededor.
  - Vecinos siempre claramente distintos. Ningún color casi igual a menos de 1.500 km, ni
    repetido dentro de la misma zona del mapa. 212 de 223 países llevan su propio tono.
  - Los colores se calculan una vez con un script nuevo (`19-colores-pais.ts`) y el mapa solo los
    lee, así que abre igual de rápido.
- **Barra de secciones como en los simuladores geopolíticos de PC:**
  - Barra grande abajo con 8 apartados y sin «Más»: Gobierno, Ministerios, Política, Economía,
    Mundo, Ejército, Investigación e Informes.
  - Cada apartado abre encima una sub-barra con sus elementos, y cada elemento abre su ventana.
  - Teclas: G, I, P, E, U, J, V y N. En la sub-barra, flechas, Intro y Escape.
- **Gobierno y Ministerios, separados:**
  - Gobierno: Presidencia, Consejo de Ministros, Presupuesto e Impuestos.
  - Ministerios: los 19 ministerios. Cada uno tiene su ventana con resumen, presupuesto, leyes
    del departamento, acciones e infraestructuras (si las tiene). Todo está vacío hasta su fase,
    con el aviso de cuándo llega.
  - El Consejo de Ministros enlaza con la ventana de cada ministerio.
- La leyenda y la ficha del país quedan por encima de la barra.

### Añadido

- 23 iconos nuevos para los ministerios y las ventanas.
- Galería:
  - «Color de cada país» enseña el color pedido y el que lleva en el mapa.
  - Nueva sección con los colores de referencia de la tabla.

## 0.8.1 - 2026-11-16

Ajustes de la Fase 7 pedidos por el jugador al probar la v0.8.0 (opción B en los dos casos).

### Añadido

- **Barra de secciones** abajo en el centro del mapa: Gobierno · Economía · Política · Mundo ·
  Ejército · Más. Cada botón tiene su letra subrayada como atajo (G, E, P, U, J y S; la M sigue
  siendo silenciar) y abre un menú con sus secciones.
- **Ventanas de las 17 secciones del juego**, con sus pestañas, hechas con los componentes de
  la Fase 7:
  - Consejo de Ministros, con los 20 ministerios del GDD.
  - Presupuesto, Impuestos y Parlamento y leyes, con historial de leyes.
  - Economía, Energía, Infraestructuras, Partidos y elecciones, Sociedad, Población y
    Regiones.
  - Comercio, Diplomacia, Ejército, Investigación, Informes y noticias y Comparador.

  Por ahora están vacías: cada pestaña dice qué tendrá y en qué fase se llena. Se pueden abrir
  varias a la vez y moverlas.

- **17 iconos nuevos** para las secciones, dibujados con código.
- **Galería: «Color de cada país»**, con la bandera y el color de los 223 países y territorios,
  para revisarlos.

### Cambiado

- **Color de cada país según el que se le asocia**, dentro de la paleta:
  - El de su bandera (un script nuevo saca sus colores principales) o el de una lista
    revisable de colores tradicionales: España amarillo, Reino Unido rojo, Marruecos rojo y
    verde, Italia verde azulado, Países Bajos naranja, Francia azul, Irlanda y Portugal verde…
  - Dos vecinos siguen sin llevar nunca colores parecidos, así que algunos países llevan su
    segundo color o uno cercano.
  - 178 de 223 llevan su color o uno muy cercano. Ningún color se repite a menos de 1.500 km
    ni más de 10 veces en el mundo.
- Las ventanas se abren enteras a la vista aunque sean altas.

## 0.8.0 - 2026-11-16

Fase 7 · Componentes de interfaz.

### Añadido

- **Tipografía Inter** (licencia SIL Open Font License) en toda la interfaz y en los nombres del
  mapa, con cifras de ancho fijo en las tablas.
- **Ventanas flotantes** (decisión del jugador: movibles):
  - Se mueven arrastrando el título o con Alt + flechas (con Mayúsculas, más deprisa) y nunca
    se salen de la pantalla.
  - Recuerdan dónde se dejaron, puede haber varias abiertas y la que se toca pasa delante.
  - Escape cierra la que tiene el foco.
- **Paneles laterales**, uno por lado, y **pestañas** que se recorren con las flechas, Inicio y
  Fin.
- **Componentes de datos:**
  - Tablas ordenables con el ratón y el teclado.
  - Deslizadores con su valor a la vista.
  - Información al pasar el ratón o al llevar el foco a un indicador.
  - Menú contextual.
- **Clic derecho en el mapa** (también Mayús + F10 o la tecla de menú sobre lo seleccionado):
  ver la ficha del país, centrar el mapa, acercar y ver el mundo entero.
- **Gráficos en SVG propio:**
  - Líneas con guía y valores al pasar el ratón, barras, minigráficos y una «barra de partes»
    en lugar de los gráficos de sectores.
  - Colores de serie comprobados para daltonismo y una vista «Ver como tabla» en todos.
- **Muestrario en la galería** con todos los componentes. Usa datos reales de 2010 (población,
  PIB y mix eléctrico); los ejemplos inventados van marcados como tales.
- **Animaciones cortas** al abrir y cerrar ventanas, paneles y menús. Al cambiar de pestaña, la
  raya se desliza y el contenido entra desde el lado. Con «reducir movimiento» activado en el
  sistema, todo es instantáneo.
- **Sonidos de navegación** sintetizados: abrir una ventana, cerrar, cambiar de pestaña y abrir
  el menú. Nunca suenan al pasar el ratón.

### Cambiado

- En los paneles estrechos, las pestañas se compactan para que se vean todas.
- El menú del mapa ya no suena dos veces al abrirse.

## 0.7.1 - 2026-11-16

Ajuste de la Fase 6 pedido por el jugador tras probar la v0.7.0.

### Cambiado

- **Mapa político con 45 colores** en lugar de 12: 15 tonos del círculo cromático con tres
  luminosidades, creados con código en OKLCH.
- **Reparto por parecido a la vista**, no solo por color idéntico:
  - Dos vecinos nunca llevan colores parecidos.
  - Con el mundo entero a la vista, ningún color se repite entre países a menos de 1.500 km
    (antes había 55 pares).
  - Los países muy grandes (Rusia, Canadá, Estados Unidos, China, Brasil, Australia…) llevan
    colores distintos entre sí y evitan los tonos más claros y los azules, que sobre el terreno
    parecían hielo o agua.
- La capa política deja ver algo menos el terreno, para que los colores se distingan mejor.

## 0.7.0 - 2026-11-12

Fase 6 · Capas del mapa.

### Añadido

- **Capas del mapa** en un desplegable de la barra superior, que se abre con un clic o con la
  tecla C (decisión del jugador: sin un atajo por capa); se maneja también con las flechas,
  Intro y Escape, y se recuerda la última capa elegida:
  - Política (la de siempre), riqueza (PIB por habitante), población total, densidad de
    población, crecimiento, paro, deuda pública, inflación y reservas de petróleo, gas natural
    y carbón.
  - Leyenda abajo a la izquierda con tramos redondos («1.000 a 2.500 $»), gris para los países
    sin dato y rayado para los datos estimados. La ficha de cada país muestra primero el dato
    de la capa.
  - Riqueza, población y densidad también por regiones al acercarse; en las demás capas, la
    ficha de una región da el dato de su país.
- **Rampas de color accesibles**, creadas con código en OKLCH: dos tramos seguidos se
  distinguen también con protanopia, deuteranopia y tritanopia (lo comprueban los tests).
- **Densidad de población** con la superficie terrestre real de 2010 (FAO, vía Banco Mundial,
  servida por Our World in Data; `scripts/datos/16-superficie.ts`). Los 10 territorios sin
  dato usan la superficie medida en el mapa, marcada como estimación.
- **Mapa más realista** (opciones A y C elegidas por el jugador):
  - Colores del terreno de Natural Earth II (bosques, desiertos, hielo) bajo los colores de los
    países y mar más oscuro cuanto más profundo (`scripts/datos/17-terreno.ts`).
  - Deslizador «Intensidad del terreno» en Ajustes (0 % deja los colores lisos).
  - Volumen sin 3D: luz y sombra en los bordes de los países, sombra de la costa sobre el mar,
    país seleccionado levantado con su sombra y brillo suave del agua (se apaga con «reducir
    movimiento» y en Ajustes).
- **Audiovisual:** seis iconos nuevos (capas, política, densidad, petróleo, gas y carbón),
  cambio de capa con fundido de colores y leyenda animada, sonido «capa» y rampas de las capas
  en la galería.

## 0.6.1 - 2026-11-12

Ajuste de la Fase 5 pedido por el jugador tras probar la v0.6.0.

### Añadido

- Capitales de provincia en todos los países (`scripts/datos/13-ciudades.ts`): la capital de
  cada unidad de primer nivel de Natural Earth según Wikidata (la vigente en 2010) y las capitales
  de región de Natural Earth. Si la ciudad ya estaba, solo se marca como capital de provincia.
  - 2035 ciudades nuevas y 1443 ya existentes marcadas, en 198 países (4246 ciudades en total).
  - España: las 50 capitales de provincia (Cáceres, Teruel, Soria…), Ceuta, Melilla, Mérida y
    Santiago de Compostela.
  - Eslovenia, Macedonia, Letonia, Malta y Azerbaiyán se quedan sin ellas: sus unidades de
    primer nivel son municipios.
  - La población, como en el resto de ciudades: la de 2010 o la más cercana; 393 de las nuevas
    no tienen dato en Wikidata.

### Cambiado

- Las capitales de provincia aparecen antes al acercarse (como muy tarde con el zoom con el que
  se ven todas), con un punto algo mayor que el de las demás ciudades.
- La ficha y el panel de una capital de provincia dicen de qué provincia es: «Capital de
  Cáceres (España)».

## 0.6.0 - 2026-11-12

Fase 5 · Regiones del mundo.

### Añadido

- 2974 regiones como eran en 2010, a partir de las divisiones de Natural Earth
  (`scripts/datos/14-regiones.ts`):
  - España por comunidades autónomas, con Ceuta y Melilla.
  - Francia con sus 22 regiones de 2010 y Kenia con sus 8 provincias.
  - Italia por regiones, Reino Unido por naciones y regiones inglesas y Rusia por regiones
    económicas.
  - Cambios posteriores deshechos: Telangana, Alborz, Sejong, las Darfur nuevas…
  - Hasta unas 30 por país; Estados Unidos (51) y Argelia (48), como excepciones.
- Población y PIB de 2010 de cada región (`scripts/datos/15-regiones-datos.ts`), con su fuente:
  DOSE (Wenz y otros, CC BY 4.0) en 66 países y Wikidata. Lo que falta, estimado y marcado con
  asterisco. Todo se ajusta para que las regiones sumen el total del país.
- Al acercarse a un país, aparecen sus regiones con fronteras discontinuas, nombres en cursiva
  y un tono algo distinto en cada una. Al pasar el ratón, ficha de la región (población y PIB
  por habitante); con un clic, panel con población, PIB, PIB por habitante, la fuente de cada
  dato y un botón para ver la ficha del país.
- Transición animada: las regiones aparecen poco a poco según crece el país en pantalla y, la
  primera vez, con un fundido.
- Hoja de ruta: la idea del mapa más realista (opciones A y C) queda en la Fase 6.

### Cambiado

- La población de las ciudades se elige ahora de forma determinista cuando Wikidata tiene
  varios datos del mismo año (cambian 31 ciudades).

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
