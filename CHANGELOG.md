# Registro de cambios

Aquí se anota lo nuevo de cada versión del juego. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[SemVer](https://semver.org/lang/es/): se sube de versión al cerrar cada fase de la hoja de ruta.

La versión tiene una sola fuente, `package.json`. `roadmap.json` (`versionActual` e `historial`)
y este archivo deben coincidir con ella; los tests lo comprueban.

## 0.20.0 - 2026-11-18

Fase 19: presupuesto jugable. Primera fase con el nuevo orden de la hoja de ruta (decisión del
jugador: desde la Fase 19, cada fase trae decisiones del jugador).

### Añadido

- **Pantalla «Presupuesto» editable** (Gobierno › Presupuesto, pestaña «Nuevo presupuesto»):
  - un deslizador por ministerio y, desplegado, uno por cada partida (personal, inversión,
    mantenimiento y programas), del 0 % al 200 % de lo que gasta ahora, con su dinero;
  - la subida de las pensiones de cada enero o «con el IPC, como dice la ley», y la prestación de
    cada parado;
  - atajos: subir todo con el IPC, dejarlo como está y recortar un 5 %;
  - un resumen que cambia al momento (gasto, ingresos y déficit);
  - **previsión a 12 meses**: hace un año, ahora, sin cambios y con este presupuesto (ingresos,
    gastos, saldo, deuda y prima). Usa las reglas de la partida: si no cambia nada más, coincide con
    lo que pasa;
  - «Aprobar el presupuesto»: vale desde el día 1 del mes siguiente, con un sello y su sonido.
- **El presupuesto es anual** (decisión del jugador): si llega enero sin presupuesto nuevo, se
  prorroga el anterior.
- **Los gobiernos de la IA aprueban su presupuesto cada enero**, según su situación:
  - con la prima cerca del cierre de los mercados, recortan;
  - con un déficit alto, congelan; con uno moderado, suben con la inflación;
  - con margen, suben con la economía; con superávit, algo más.
- **Población activa** (estimada) y prestación por parado en dinero.
- Sonidos de los deslizadores (suben o bajan) y del presupuesto aprobado. El editor también está
  en la galería (Economía de un país).

### Cambiado

- **El presupuesto se ve en dinero**, no en % del PIB (decisión del jugador):
  - ingresos, gastos, deuda e intereses en dólares; el déficit y los intereses, también como parte
    de los ingresos;
  - los ingresos, en % de lo recaudado; los gastos, en % de lo gastado;
  - los gráficos, en miles de millones de dólares;
  - el % del PIB, solo en las ayudas.
- **El gasto de los ministerios queda fijo en dinero hasta que se decide otro** (decisión del
  jugador): ya no crece solo con la economía, y con la inflación compra menos. Las pensiones crecen
  con el envejecimiento y suben cada enero lo decidido (por defecto, el IPC; no bajan por ley).
- **Lo que se decide en el presupuesto llega a la economía**: consumo público, inversión y consumo
  de los hogares. Los recortes de una crisis de deuda llegan por el mismo camino.
- **Nuevo orden de la hoja de ruta:**
  - Fase 20: deuda y Tesoro jugables;
  - Fases 21 y 22: impuestos;
  - Fase 23: banco central y pantalla de Economía;
  - Fase 24: moneda;
  - Fase 25: bancos.
- Formato de partida 8: las partidas guardadas reciben el presupuesto en dinero al cargarlas, sin
  saltos.

## 0.19.0 - 2026-11-17

Fase 18: deuda, prima de riesgo y rating.

### Añadido

- **Tipos reales de 2010** (OCDE: bono a 10 años de 40 países; script
  `scripts/datos/27-riesgo-pais.ts`, con la estabilidad política del Banco Mundial) y una
  **fórmula pública de la prima de riesgo y el rating** calibrada con ellos (decisión del
  jugador). Tiene en cuenta la deuda, el déficit, el déficit exterior, la renta, la inflación, el
  crecimiento, la estabilidad y si el país tiene moneda propia. Error medio: 0,8 puntos. Los
  demás países, estimados y marcados.
- **Mercado de la deuda cada mes:**
  - la prima va hacia la que pide la fórmula;
  - la deuda que vence y la nueva se pagan al tipo de ahora, así que el tipo medio sube poco a
    poco (vida media de 6,5 años; decisión del jugador);
  - rating de AAA a D, revisado cada trimestre;
  - una prima alta encarece el crédito: se invierte menos y cae la confianza;
  - contagio a los países que se parecen (misma moneda o región y deuda alta).
- **Crisis de deuda** (decisión del jugador: elegir entre el FMI y el impago):
  - con la prima por encima de 15 puntos, los mercados se cierran;
  - el jugador elige en una ventana (la partida se para) y la IA según su situación;
  - **rescate del FMI:** deuda al 3,5 % durante 3 años a cambio de un ajuste proporcional al
    déficit (recortes y subidas de impuestos). Hace de cortafuegos del contagio;
  - **impago:** quita del 50 %, rating D, 4 años sin mercados ni intereses, recortes de
    ministerios y pensiones hasta cerrar el déficit, confianza hundida y un recargo en la prima al
    volver. Contagia.
  - Sin intervención, Grecia deja de pagar en 2011 (PIB −26 % y paro del 27 % en 2013), e
    Irlanda, Portugal y España la siguen entre 2012 y 2014.
- **En pantalla** (ficha de cada país y Gobierno › Presupuesto):
  - el rating con un distintivo animado del color de su escalón;
  - la prima de riesgo y la crisis de deuda;
  - el gráfico de la prima con la línea del cierre de los mercados.
- **Alertas** «Crisis de deuda», «Bajan el rating» y «Suben el rating», con su icono y su sonido.
  Iconos nuevos de rating y prima, y sección del rating en la galería.

### Cambiado

- Desaparece el **ajuste forzoso provisional** de la v0.16.1 (y su fila en la ficha). Sin
  decisiones, los recortes ya no son automáticos: llegan con el rescate del FMI o con el impago.
- Formato de partida 7: las partidas guardadas reciben el mercado de su deuda al cargarlas.

## 0.18.0 - 2026-11-17

Fase 17: presupuesto, ingresos y gastos.

### Añadido

- **Datos del presupuesto de 2010** (Banco Mundial, a partir de las estadísticas de finanzas
  públicas del FMI; script `scripts/datos/26-bm-presupuesto.ts`): de dónde salen los ingresos
  (renta, IVA y consumos, cotizaciones, aranceles y otros) y en qué se va el gasto (sueldos,
  compras, intereses, transferencias e inversión pública), gasto sanitario público y población
  de 65 años o más. Lo que falta se estima con la mediana de la región y el nivel de renta.
- **Presupuesto de cada país** (decisiones del jugador: cada ministerio por dentro; datos del
  Banco Mundial y el FMI):
  - Ingresos: 7 tipos (renta de las personas y de las sociedades, IVA y consumos, cotizaciones,
    aranceles, otros impuestos y otros ingresos).
  - Gastos: los 20 ministerios, cada uno con personal, inversión, mantenimiento y programas;
    pensiones, desempleo e intereses de la deuda.
  - Cuadra con los totales del FMI (España: ingresos 36,4 % del PIB, gastos 45,8 %, déficit
    −9,5 %; pensiones 10,1 %, desempleo 3 %). Sanidad, educación y defensa, reales; el reparto
    del resto de ministerios y sus partidas, estimado y marcado con un asterisco.
- **Responde a la economía cada mes** (estabilizadores automáticos): la recaudación sigue a su
  base (cae en una recesión), las prestaciones por desempleo siguen al paro, las pensiones suben
  con los precios y el envejecimiento, y los intereses, con la deuda.
- **El déficit se cubre con deuda:** el saldo de cada mes pasa por la tesorería; si baja de un
  mes de gastos, el Estado emite deuda (al tipo de 2010; los mercados llegan en la Fase 18), y
  con superávit la paga. Más deuda, más intereses: nada se arregla solo.
- **En pantalla:** el «Presupuesto del Estado» en la pestaña Economía de la ficha de cada país
  y en Gobierno › Presupuesto (solo para ver hasta la Fase 23), con barras de ingresos y gastos
  con iconos, gráficos de ingresos, gastos y deuda desde 2010 y los ministerios desplegables.
  La tesorería de la barra superior ya se mueve. **Iconos nuevos:** renta, IVA, personal,
  mantenimiento, programas y pensiones. El presupuesto también en la galería.

### Cambiado

- Formato de la partida 6, con el presupuesto; las partidas guardadas antes lo reciben al
  cargarse, con los datos de 2010 sobre su economía de ese momento.
- La descarga del Banco Mundial usa `curl` con tiempo límite y, si su API no responde, la
  descarga en CSV del mismo indicador.

## 0.17.0 - 2026-11-17

Fase 16: economía, inflación y paro.

### Añadido

- **Paro** de cada país desde el de 2010 (Banco Mundial), con las decisiones del jugador:
  - **Ley de Okun:** sube cuando la economía produce por debajo de lo que podría y baja cuando
    produce por encima. Es más sensible en los países ricos y en los mercados laborales rígidos
    o con mucho empleo temporal (estimado y marcado).
  - **Histéresis:** si se queda alto mucho tiempo, parte se vuelve estructural y ya no baja solo;
    esos parados dejan de producir. El mercado de trabajo asume la caída poco a poco, con
    salarios más bajos.
  - Los parados gastan menos y el paro hunde la confianza de los consumidores.
  - Sin intervención, Grecia pasa del 12,7 % al 24 % en cuatro años y baja hacia el 19 %;
    España, del 19,9 % al 25 %. Alemania, China o México apenas cambian.
- **Inflación persistente** desde la de 2010 (decisión del jugador): cada país arrastra la suya
  por las expectativas; baja con mucho paro y sube cuando falta (curva de Phillips), sin ancla
  hasta el banco central (Fase 20). Por encima del 10 % resta inversión y confianza de las
  empresas; la deflación frena el consumo. Gastar de más recalienta: baja el paro, pero sube la
  inflación. **PIB nominal** (a precios de cada momento).
- **En pantalla:** PIB nominal, paro (con lo que ha cambiado en 12 meses) e inflación en la ficha
  de cada país y en Economía › Economía, y un gráfico del paro y la inflación desde 2010.
- **Test de credibilidad del GDD:** en 5 años sin intervención, los 20 mayores países crecen entre
  −10 % y +15 % al año, con inflación entre −5 % y +30 % (solo Macao y Zimbabue se salen el
  primer año, por su crecimiento real de 2010).
- **Alertas económicas** de tu país: recesión, paro que se dispara, inflación alta o desbocada y
  deflación. Las graves paran la partida (si la pausa automática está activada) y salen en el
  aviso del centro; las demás, en una tarjeta arriba a la derecha que se va sola. Cada una con
  su icono (nuevos: recesión y deflación) y un **sonido sintetizado propio**. Sección «Alertas
  económicas» en la galería.

### Cambiado

- Formato de la partida 5, con el paro y la inflación; las partidas guardadas antes los reciben
  al cargarse, con los datos de 2010.
- El crecimiento de 2010 por encima del potencial (rebote tras 2009 o auge) se toma como
  capacidad nueva; por debajo, abre una brecha de producción.

## 0.16.1 - 2026-11-17

Ajuste de la Fase 15 tras la consulta del jugador («la economía no siempre va a crecer»).

### Cambiado

- **Nada mejora solo** (ajuste f15-a1, decisión del jugador; pilar 9 del GDD). Sin
  intervención, cada país sigue sus datos de 2010:
  - La productividad solo se acerca a la de los países más avanzados si el país tiene base para
    ello (alfabetización, acceso a la electricidad, uso de internet y gasto en educación); sin
    esa base, apenas crece.
  - Los **desequilibrios de 2010** (deuda y déficit públicos altos, déficit exterior, paro)
    fuerzan un ajuste a los seis meses: el Estado recorta su gasto hasta dejar el déficit en el
    3 % del PIB, los mercados cierran el crédito (baja la inversión) y cae la confianza. Grecia
    cae cuatro años seguidos y en diez no recupera su PIB de 2010; Portugal, España, Islandia y
    Letonia también encogen. Es provisional hasta la deuda y la prima de riesgo de la Fase 18.
  - **Dureza según la dificultad:** en «realista», el ajuste pesa por completo; en «normal», un
    75 %, y en «fácil», la mitad. Dura lo mismo en todas.
- Formato de la partida 4: las partidas guardadas con la v0.16.0 reciben los desequilibrios de
  2010 al cargarse.

### Añadido

- Fila **«Ajuste forzoso»** en la economía en vivo (ficha y Economía › Economía): cuánto gasto
  falta por recortar mientras dura el ajuste.
- Tests de «si se hace mal, empeora» (regla 20): menos inversión da menos capital y menos PIB,
  recortar el gasto hunde el PIB a corto plazo, sin base la productividad apenas crece, y
  «realista» es más duro que «fácil».

## 0.16.0 - 2026-11-17

Fase 15: economía, producción y demanda.

### Añadido

- **Datos de 2010 por sector y demanda** (ONU, _National Accounts – Analysis of Main
  Aggregates_; script `scripts/datos/25-onu-cuentas.ts`): el peso en la economía de siete
  sectores (agricultura y pesca; minería y energía; industria; construcción; comercio y turismo;
  transporte; otros servicios) y el reparto de la demanda (consumo de los hogares, consumo
  público, inversión, exportaciones e importaciones). 206 países con datos reales; 17
  territorios, entre ellos Taiwán, estimados y marcados.
- **Economía de cada país, mes a mes y sin azar** (decisiones del jugador):
  - Cada sector produce con su productividad, su capital y su trabajo; la inversión se suma al
    capital, que se desgasta; el trabajo crece con la población; la productividad crece más en
    los países con menos renta (convergencia).
  - Cada país arranca con su crecimiento real de 2010 y se acerca poco a poco a su crecimiento
    potencial (China: 9,7 %, 7,7 %, 6,6 %…; Grecia cae en 2010–2012 y se recupera).
  - Sin azar: cambiará con las decisiones (inversión, gasto, impuestos, servicios…) cuando
    lleguen el presupuesto y los impuestos.
- **Confianza de consumidores y empresas** (índice, 100 = normal; estimada al empezar): sube o
  baja según el crecimiento frente al potencial y mueve el consumo, la inversión y el PIB.
  **Ahorro nacional.**
- **La economía en vivo** en la pestaña Economía de la ficha de cada país y en Economía ›
  Economía: PIB real, crecimiento, potencial, confianzas, consumo, inversión, ahorro, producción
  por sectores y gráfico del PIB desde 2010, al día cada mes.
- **Iconos nuevos** (consumo, inversión, ahorro, confianza, empresas, construcción, servicios y
  crecimiento potencial) y **gráfico animado**: se dibuja al aparecer y su último punto late con
  cada mes. Sección «Economía de un país» en la galería.

### Cambiado

- Formato de la partida 3, con la economía de cada país; las partidas guardadas antes la reciben
  al cargarse, con los datos de 2010.
- Los gráficos de líneas pueden ajustar el eje a los valores y elegir sus marcas.

## 0.15.1 - 2026-11-17

Ajustes de la Fase 14 tras probar la v0.15.0.

### Añadido

- **Nombre de los guardados manuales** (ajuste f14-a1, petición del jugador): campo «Nombre del
  guardado (opcional)» en la ventana «Guardar partida», de hasta 60 caracteres. Se ve en las
  ranuras («Ranura 2 · Antes de las elecciones»), en «Cargar partida» y en «Continuar». Empieza
  con el nombre de la ranura de la partida; Ctrl+S lo conserva y dejarlo vacío lo quita.

### Cambiado

- El juego pide al navegador que no borre las partidas la primera vez que se guarda a mano, y no
  al abrirse: en Firefox salía un aviso de permiso nada más entrar (ajuste f14-a2).

## 0.15.0 - 2026-11-17

Fase 14: guardar y cargar partidas.

### Añadido

- **Guardar en el navegador** (IndexedDB; decisiones del jugador):
  - Cinco ranuras manuales, compartidas por todas las partidas. Guardar en una ocupada pregunta
    antes de sobrescribirla.
  - Guardado automático al empezar cada mes (el día 1 a las 00:00 en punto), del que se conservan
    los tres más recientes, y además el del 1 de enero de cada año, que no se borra solo.
  - Se pide al navegador que no borre los datos por falta de espacio. Si el navegador no deja
    guardar (algunas ventanas privadas), se avisa: las partidas duran mientras la página esté
    abierta.
- **Menú de la partida** (botón «Menú»): Guardar (Ctrl+S, en la ranura de la partida), Guardar
  en…, Cargar…, Ajustes, Exportar a un archivo y Salir al menú. El tiempo se para mientras sus
  ventanas están abiertas.
  - Salir con algo jugado sin guardar pregunta «¿Guardar antes de salir?»: Seguir jugando, Salir
    sin guardar o Guardar y salir.
  - Ajustes se abre también en la partida y lo que se cambia se nota al momento. La ayuda de la
    pausa automática dice ya que vale para cualquier suceso importante (recordatorio del jugador).
- **Ventanas Guardar y Cargar partida** con la bandera, el país, la fecha y la hora de cada
  guardado y cuándo se guardó.
- **Exportar e importar** la partida como archivo .json, con el juego, el formato y la versión.
  Al importar se comprueba y se migra; lo que no es una partida de este juego, está dañado o es de
  una versión más nueva se rechaza con su aviso.
- **Inicio:** «Continuar» abre la partida guardada más reciente (y dice cuál es); «Cargar
  partida» abre la lista y deja importar un archivo.
- **Indicador de guardado** arriba en el centro («Guardando…», lo guardado o el error), con un
  sonido propio al guardar a mano o exportar; los automáticos no suenan.
- **Iconos nuevos** (guardar, cargar, ajustes, exportar, importar y hecho) y sección «Guardar y
  cargar» en la galería.

### Cambiado

- Formato de la partida 2 (identificador de la partida, efectos y agenda), con su migración desde
  el formato 1 (v0.11 a v0.13). Al cargar, el azar se vuelve a sembrar (decisión de la Fase 12).
- Al cerrar o recargar la pestaña, el navegador solo pregunta si hay algo jugado sin guardar.

## 0.14.0 - 2026-11-17

Fase 13: efectos y pausa automática.

### Añadido

- **Motor de efectos** (sección 8 del GDD):
  - Un efecto cambia un dato de un país (de momento, la tesorería o la popularidad): suma, multiplica
    o fija un valor, con un retraso antes de empezar y una duración.
  - Se aplican y caducan solos en el motor; se combinan en orden (fijar, multiplicar, sumar) y
    respetan los límites de cada dato (la popularidad, entre 0 y 100).
  - Son la base de las leyes, tecnologías y eventos de las próximas fases. Todavía no hay efectos
    de verdad: la luna de miel de la popularidad espera a la opinión pública (Fase 56), por
    decisión del jugador.
- **Efectos en curso a la vista** (decisión del jugador: en los dos sitios):
  - En la explicación de la tesorería y de la popularidad de la barra superior: qué los cambia y
    hasta cuándo. El valor que se ve ya lleva los efectos.
  - Ventana nueva **Informes › Efectos en curso**, con su icono: qué cambia cada efecto, su origen,
    sus fechas y si ya actúa o cuándo empieza. Se repinta sola al cambiar el día.
- **Pausa automática ante sucesos importantes** (decisión del jugador):
  - La partida se para sola justo a la hora de un suceso importante (una guerra, una moción de
    censura, un referéndum, una crisis…), aunque vaya a ×64.
  - El aviso es una ventana en el centro con qué ha pasado y cuándo, «Seguir» (Intro) y «Quedarse
    en pausa» (Escape); las teclas del mapa no actúan detrás de ella.
  - Opción «Pausar ante sucesos importantes» en Ajustes, activada por defecto.
- **Aviso visual y sonoro**: una campanada propia (más aguda que la de la pausa), el fondo
  oscurecido y dos latidos de un anillo dorado. En la galería, la sección «Aviso de la pausa
  automática» y la campanada en «Sonidos de la interfaz».
- **Modo de prueba «?prueba»** al final de la dirección: la partida empieza con un efecto de prueba
  (+3 de popularidad del 2 al 12 de enero) y un suceso de prueba el 3 de enero a las 08:00,
  marcados como «prueba».

## 0.13.0 - 2026-11-17

Fase 12: motor en segundo plano, azar de la partida y música.

### Añadido

- **Motor en un Web Worker** (otro hilo del navegador):
  - La partida y el reloj viven en el worker; la pantalla le manda la velocidad y recibe el estado.
  - La pantalla nunca se bloquea: si calcular un paso tarda, el tiempo del juego va más despacio.
  - Para comprobarlo, «?carga=200» al final de la dirección añade 200 ms de cálculo a cada día.
  - El reloj de manecillas y la noche se siguen moviendo sin saltos entre mensaje y mensaje.
- **Azar de la partida** (decisión del jugador):
  - Generador propio, sembrado con una semilla de verdad al azar en cada partida nueva (y de nuevo
    al cargar, cuando lleguen las partidas guardadas).
  - La IA puede repetir alguna decisión, pero el conjunto de lo que pasa en todos los países hace
    prácticamente imposible que dos partidas sean iguales. De momento no se nota: es la base de la
    economía, la IA y los eventos de las próximas fases.
- **Música ambiental compuesta con código** (decisiones del jugador: tranquila y tensa según la
  situación, en piezas fijas pero abundantes, en el menú y en la partida):
  - Doce piezas tranquilas (media hora), cada una con su tonalidad, modo, tempo, compás y acordes,
    con colchón de acordes, bajo, arpegios, melodía y campanas sintetizados y una reverberación.
  - Suenan desde el primer clic en el inicio y siguen en la partida, en orden al azar sin repetir
    hasta que han sonado todas. En pausa bajan un poco.
  - Volumen de la música en Ajustes.
  - Ocho piezas tensas (más de un cuarto de hora) para las crisis, guerras y elecciones, con cambio
    de ambiente con fundido; sonarán cuando lleguen esos sistemas.
  - Galería: sección «Música ambiental» para escuchar cada pieza y el cambio de ambiente.

## 0.12.4 - 2026-11-17

Ajustes pedidos por el jugador al probar la v0.12.3 y al comentar el plan de la Fase 12.

### Cambiado

- **Velocidades ×1, ×2, ×8, ×16, ×32 y ×64** (ajuste f11-a4): se quita ×4 y se añaden ×32 (un
  día en 1,5 s, un año en unos 9 min) y ×64 (un día en 0,75 s, un año en unos 4,6 min). Las
  teclas 1 a 6 eligen cada una, en orden. El minutero del reloj se mueve a ×1 y ×2.

### Quitado

- **Semilla de «Nueva partida»** (ajuste f11-a5): cada partida tiene su propio azar, que no se
  elige; por dentro se anota solo para poder reproducir un fallo. La Fase 12 ya no busca partidas
  repetibles: la IA de los otros países no repetirá sus decisiones ni las del jugador tendrán
  siempre la misma consecuencia (decisión del jugador, anotada en el GDD).

## 0.12.3 - 2026-11-17

Último ajuste de la Fase 11, pedido por el jugador al probar la v0.12.2.

### Añadido

- **Velocidad ×16** (ajuste f11-a3): un día en 3 s y un año en unos 18 min, con su botón en la
  barra superior y la tecla 5.

## 0.12.2 - 2026-11-17

Ajuste de la Fase 11 pedido por el jugador al probar la v0.12.1: un año tiene que ser mucho
tiempo, porque guerras, manifestaciones o campañas durarán días o semanas.

### Cambiado

- **Reloj cuatro veces más lento** (ajuste f11-a2):
  - ×1: una hora cada 2 s (un día en 48 s, una semana en unos 5,6 min).
  - ×2: un día en 24 s.
  - ×4: un día en 12 s y una semana en 84 s.
  - ×8: un día en 6 s y un año en unos 36 min (una legislatura, unas 2,4 h).
- El minutero del reloj se mueve hasta ×4.

## 0.12.1 - 2026-11-17

Ajuste de la Fase 11 pedido por el jugador al probar la v0.12.0.

### Cambiado

- **Noche de las 20:00 a las 7:00** (ajuste f11-a1): la sombra de la noche ya no sigue al Sol real
  (en enero anochecía hacia las 18:00). En la capital del jugador anochece a las 20:00 y amanece a
  las 7:00 todo el año, con un crepúsculo de unos 20 minutos; el resto del mundo se oscurece según
  su longitud. La esfera del reloj usa el mismo horario.
- El reloj se queda como está: sin horario de verano ni diferencias horarias entre países, que no
  son parte del juego (decisión del jugador).

## 0.12.0 - 2026-11-16

Fase 11: reloj del juego. Atiende la idea de la issue n.º 3 (que el juego corra por horas, como en
Power & Revolution).

### Añadido

- **Reloj por horas** (decisión del jugador):
  - La partida empieza el 1 de enero de 2010 a medianoche y en pausa, y avanza hora a hora.
  - Marca la hora local de la capital del jugador, con su huso horario de 2010 (Madrid, UTC+1;
    Caracas, UTC−4:30…).
  - Al cambiar de día se dan los pasos de la simulación: diario cada medianoche, semanal cada
    lunes, mensual cada día 1 y anual cada 1 de enero (un año: 365, 52, 12 y 1). Los sistemas de
    las próximas fases los irán usando.
  - Motor puro en `src/sim/reloj.ts`, con el ritmo en `src/sim/config/tiempo.json`.
- **Controles del tiempo** en la barra superior: pausa y ×1 (una hora cada 0,5 s, un día en 12 s),
  ×2, ×4 y ×8 (un día en 1,5 s), con el ratón, la barra espaciadora y las teclas 1 a 4. Al seguir,
  vuelve a la última velocidad; al pedir salir, el tiempo se para.
- **Husos horarios de 2010** de los 223 países y territorios (`scripts/datos/24-husos.ts`, base
  de datos IANA, dominio público); «Nueva partida» enseña el del país elegido.
- **Audiovisual:**
  - Reloj de manecillas junto a la hora, que se mueve sin saltos; de noche, la esfera se oscurece,
    y en pausa la hora parpadea despacio.
  - Noche y día en el mapa: una sombra suave con su crepúsculo, calculada con la posición real del
    Sol para la hora de la partida (en enero, noche polar en el Ártico). Avanza con las horas y se
    puede quitar en Ajustes.
  - Sonidos de pausa, seguir y cambio de velocidad (también en la galería).
  - Iconos de pausa y seguir.

### Cambiado

- En la partida, las herramientas del mapa (sonido, capas y buscador) pasan a una fila bajo la
  barra superior, para que quepa todo a 1280 px.

## 0.11.0 - 2026-11-16

Fase 10: nueva partida. Con ella termina la Etapa A (prealfa).

### Añadido

- **Nueva partida** (decisión del jugador: mapa grande y panel):
  - Lista de los 221 países jugables a la izquierda, con filtro (con y sin tildes) y orden por
    nombre, población, PIB, PIB por habitante o región; se maneja también con las flechas.
  - Un clic en el mapa (en un país, una de sus regiones o una ciudad) o en la lista elige el país.
  - A la derecha, el país elegido con su bandera, su capital, su líder con su retrato, el régimen,
    la población y el PIB, y las opciones: dificultad (Fácil, Normal o Realista), eventos
    históricos y semilla (un número o una palabra; botón para otra al azar).
  - La partida se crea en el motor (`src/sim/partida.ts`) el 1 de enero de 2010.
- **Tesorería y popularidad iniciales** (decisión del jugador: estimadas con fórmula, provisionales
  hasta el presupuesto y la opinión pública; parámetros en `src/sim/config/inicio.json`):
  - Tesorería: los ingresos públicos de un mes.
  - Popularidad: parte de 50 y cambia con el crecimiento, el paro, la inflación, los años del líder
    en el cargo y el régimen, entre 15 y 85.
  - «Nueva partida» enseña las dos, marcadas como estimación, con el desglose de la popularidad.
- **Ingresos y gasto públicos de 2010** del FMI (Monitor Fiscal, `scripts/datos/23-fmi-fiscal.ts`):
  190 países con dato real y el resto estimados con la mediana de su grupo; también en la ficha
  del país.
- **Pantalla de partida:**
  - Barra superior con «Menú», el país del jugador (un clic lleva el mapa a él), la fecha, la
    tesorería y la popularidad con un medidor, cada dato con su explicación; las herramientas del
    mapa, a la derecha.
  - El país del jugador lleva siempre un contorno azul claro en el mapa.
  - Salir al menú pide confirmación, también con el botón «atrás» del navegador, y recargar avisa:
    la partida aún no se guarda (llega en la Fase 14).
- **Audiovisual:**
  - Al elegir un país, su resumen entra con una animación y la bandera «salta».
  - Transición al empezar: la bandera del país con un brillo, su nombre y la fecha, y una fanfarria
    corta nueva; se salta con un clic o una tecla.
  - Iconos de fecha, popularidad y salir.
  - Galería: la ventana de confirmación, la transición y el sonido nuevo.

## 0.10.0 - 2026-11-16

Fase 9: buscador y ficha de región.

### Añadido

- **Buscador** (decisión del jugador: lupa y ventana en el centro):
  - Se abre con la lupa de arriba o con la tecla B.
  - Encuentra los 223 países (también por su nombre en inglés o su código), unas 2.700 regiones y
    unas 4.200 ciudades, con y sin tildes, por cualquier palabra, con varias palabras o con una
    errata.
  - Resalta lo que coincide y dice de qué país es cada resultado y cuántos habitantes tiene.
  - Se maneja con las flechas, Intro y Esc, o con el ratón.
  - Al elegir, la cámara viaja hasta el resultado (alejándose a mitad de camino si está lejos) y
    abre su ficha.
- **Ficha de región** con pestañas, como la de país:
  - **Resumen:** país, capital (o ciudad principal si no es segura), población, PIB, PIB por
    habitante, superficie, densidad, actividad principal y el sector en el que destaca frente a su
    país (Texas, la industria).
  - **Economía:** reparto del valor añadido por sectores y recursos agrupados por tipo, con el
    número de yacimientos y algunos ejemplos.
  - **Ciudades:** las principales con su población y sus capitales; un clic lleva el mapa a ellas.
  - **Fuentes:** de dónde sale cada dato.
- **Datos de cada región** (`scripts/datos/21-regiones-economia.ts`):
  - Peso de la agricultura, la industria y los servicios en 2010 (DOSE, 954 regiones); donde no
    hay, la ficha muestra el del país y lo dice.
  - Recursos de 994 regiones: 3.139 grandes yacimientos minerales del USGS («Major Mineral
    Deposits of the World», dominio público) y 5.588 campos de petróleo, 293 de gas y 1.826 minas
    de carbón de Wikidata activos en 2010. Se descartan los que la fuente sitúa en otro país.
  - Superficie (Wikidata), capital solo cuando es segura (Natural Earth o Wikidata) y ciudades
    principales.
- Índice ligero de las regiones para el buscador (`scripts/datos/22-buscador.ts`).
- **Audiovisual:**
  - Al llegar a un resultado, su contorno late tres veces y suena un tintineo.
  - Iconos de los recursos (uranio, lingote, gema, pico, batería y cristales).
  - Iconos de la lupa y de las ciudades.
  - Galería: sección «Recursos de las regiones» y el sonido nuevo.

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
