# GDD — Simulador geopolítico (nombre provisional: «Geopolítica 2010»)

> **Documento de Diseño del Juego (GDD).** Este archivo es la referencia principal del proyecto.
> Claude Code debe leerlo al inicio de cada sesión, junto con `CLAUDE.md` y `roadmap.json`.
> Versión del documento: 1.2 · Fecha: 11/11/2026 · Idioma del proyecto: español.

---

## Índice

1. Visión y pilares de diseño
2. Plataforma y arquitectura técnica
3. Escenario inicial: 1 de enero de 2010
4. Fuentes de datos reales
5. Bucle de juego, tiempo y roles
6. Sistemas del juego
   - 6.1 Economía macro
   - 6.2 Presupuesto y deuda
   - 6.3 Impuestos
   - 6.4 Ministerios
   - 6.5 Infraestructuras
   - 6.6 Energía y electricidad
   - 6.7 Red y telecomunicaciones
   - 6.8 Recursos naturales
   - 6.9 Industria, sectores y empresas
   - 6.10 Comercio
   - 6.11 Sanidad
   - 6.12 Educación
   - 6.13 Trabajo, pensiones y Seguridad Social
   - 6.14 Sociedad, grupos sociales y opinión pública
   - 6.15 Partidos, parlamento y elecciones
   - 6.16 Leyes y constitución
   - 6.17 Independentismo y regiones
   - 6.18 Tecnología e investigación
   - 6.19 Diplomacia y organizaciones internacionales
   - 6.20 Ejército y guerras
   - 6.21 Interior, justicia y seguridad
   - 6.22 Medio ambiente y desastres
   - 6.23 Eventos
   - 6.24 IA de los demás países
7. Interfaz y experiencia en móvil
   - 7.1 Contenido audiovisual
8. Modelo de datos
9. Hoja de ruta: etapas, fases y versiones (orden de trabajo)
10. Web de la Hoja de ruta y comunicación entre webs
11. Reglas de trabajo para Claude Code
12. Añadir contenido y cambios durante el desarrollo
13. Decisiones abiertas
14. Mensaje inicial para Claude Code

---

## 1. Visión y pilares de diseño

**Concepto.** Un simulador geopolítico en tiempo real con pausa, al estilo de *Power & Revolution / Geopolitical Simulator*. El jugador dirige un país real a partir del **1 de enero de 2010** y gestiona todo lo que hace funcionar un Estado: economía, presupuesto, impuestos, ministerios, infraestructuras, energía, recursos, empresas, comercio, leyes, partidos, elecciones, regiones e independentismo, tecnología, diplomacia y guerra.

**Pilares de diseño**

1. **Todo está conectado.** Ninguna decisión es aislada. Subir el IVA afecta a la inflación, al consumo, a la popularidad, a los votos de cada grupo social y a la recaudación.
2. **Datos reales de partida.** Cada país empieza con sus datos reales de 2010. A partir de ahí, la historia la escribe la simulación.
3. **Mapa 2D interactivo como centro del juego.** El mapa político es plano, con capas de información y zoom hasta las regiones. El mapa de juego no es un globo 3D; el 3D se reserva para componentes complementarios (sección 7.1).
4. **Profundidad accesible.** Hay mucha información, pero se organiza por ministerios, con resúmenes, alertas y consejos de asesores.
5. **Consecuencias, no guiones.** Hay eventos históricos opcionales, pero el mundo evoluciona por la simulación.
6. **Pensado para móvil y PC.** Se juega en el navegador, con controles táctiles y paneles que se adaptan a la pantalla.
7. **Largo plazo.** El juego no tiene fin. Las tecnologías permiten llegar a 2075 y más allá.
8. **Acabado audiovisual desde el principio.** Cada sistema llega con sus gráficos, sus animaciones y su sonido; no se deja para el final.

**Referencias:** Power & Revolution / Geopolitical Simulator (profundidad política y económica, mapa 2D), Geoplanetical (sistemas interconectados, energía y red eléctrica, árbol tecnológico largo), Democracy (grupos de votantes y políticas), Supreme Ruler (militar en mapa).

---

## 2. Plataforma y arquitectura técnica

| Aspecto | Decisión |
|---|---|
| Plataforma | Web (navegador de móvil y PC). Sin servidor: todo se ejecuta en el cliente. |
| Lenguaje | TypeScript |
| Herramientas | Vite (compilación), Vitest (tests) |
| Publicación | GitHub Pages mediante GitHub Actions. Cada fusión en `main` publica una versión nueva. |
| Mapa | `d3-geo` + TopoJSON simplificado, dibujado en Canvas (más rápido que SVG con ~200 países y miles de regiones) |
| Simulación | Motor puro y determinista (semilla aleatoria guardada) que se ejecuta en un Web Worker para no bloquear la interfaz |
| Guardado | IndexedDB (partidas) + exportar e importar partida como archivo `.json` |
| Datos | Archivos JSON en `/public/data`, generados con scripts reproducibles en `/scripts` |
| Idioma | Interfaz en español. Los textos van en `/src/i18n/es.json` para poder traducir en el futuro. |
| Audiovisual | Gráficos vectoriales (SVG) y Canvas, animaciones con CSS y Canvas, sonido sintetizado con Web Audio y 3D opcional con WebGL, cargado solo cuando se usa (sección 7.1) |

**Estructura de carpetas**

```
/                       → juego (página principal)
/hoja-de-ruta/          → web independiente de la hoja de ruta
/docs/GDD.md            → este documento
/CLAUDE.md              → reglas de trabajo para Claude Code
/roadmap.json           → estado de fases y tareas (lo leen las dos webs)
/scripts/               → descarga y procesado de datos reales (Node)
/fuentes/               → material original (p. ej. árboles tecnológicos .docx)
/public/data/           → datos ya procesados que carga el juego
/public/av/             → recursos audiovisuales (banderas, iconos, ilustraciones, sonidos)
/src/sim/               → motor de simulación (sin dependencias de interfaz)
/src/sim/systems/       → un archivo por sistema (economia.ts, energia.ts…)
/src/ui/                → pantallas y componentes
/src/map/               → mapa 2D y capas
/src/av/                → sonido, animaciones y escenas 3D (sin lógica de juego)
/tests/                 → tests del motor
```

**Rendimiento.** El juego debe moverse con fluidez en un móvil de gama media: unos 200 países simulados mensualmente, regiones agregadas y un mapa a 60 fps al desplazar. Los países que no ve el jugador pueden simularse con menos detalle.

---

## 3. Escenario inicial: 1 de enero de 2010

**Fecha de inicio:** viernes, 1 de enero de 2010. El juego arranca en pausa.

**Contexto mundial que debe reflejar el estado inicial**

- Salida de la **crisis financiera de 2008**: mucho paro en varios países (España en torno al 19 %), déficits altos y deuda pública en aumento.
- Zona euro con **16 miembros** (Estonia entra en 2011) y tensión creciente sobre la deuda de Grecia, Irlanda, Portugal, España e Italia.
- **Unión Europea de 27 miembros** (Croacia entra en 2013) y **OTAN de 28 miembros**.
- Guerras en curso en **Afganistán** e **Irak**.
- **Sudán** sigue unido; Sudán del Sur no existe todavía como Estado (independencia en julio de 2011).
- **Crimea** pertenece a Ucrania.
- **Kosovo** declaró la independencia en 2008 y tiene un reconocimiento parcial.
- **Abjasia y Osetia del Sur**: reconocidas por Rusia tras la guerra de 2008.
- **BRIC** (Sudáfrica se une a finales de 2010) y **G20** como foro principal.
- China está a punto de superar a Japón como segunda economía mundial.
- El petróleo ronda los 75–80 $ por barril.
- Potencias nucleares: EE. UU., Rusia, China, Francia, Reino Unido, India, Pakistán, Corea del Norte e Israel (no declarado).

**Mapa de 2010.** Se usan las fronteras de Natural Earth corregidas a 2010: Sudán del Sur fusionado con Sudán, Crimea dentro de Ucrania, y Kosovo, Taiwán, Palestina, Sáhara Occidental, Somalilandia, Chipre del Norte, Transnistria, Abjasia y Osetia del Sur marcados como territorios de estatus especial o en disputa.

**Eventos históricos opcionales** (se activan o desactivan al crear la partida): rescate de Grecia (2010), Primavera Árabe (desde diciembre de 2010), Fukushima (2011), referéndum e independencia de Sudán del Sur (2011), crisis de Crimea (2014), etc. Si están activados, ocurren con una probabilidad que depende del estado real de la simulación, no de forma fija.

---

## 4. Fuentes de datos reales

Los datos los **descarga y procesa Claude Code** con scripts en `/scripts`. Cada script debe ser reproducible, indicar la fuente y el año, y aplicar **valores de respaldo** cuando falte un dato: estimación por región y nivel de renta, marcada como `"estimado": true`.

| Fuente | Datos | Uso |
|---|---|---|
| Banco Mundial (API WDI) | Población, PIB, PIB per cápita, PIB por sectores, paro, inflación, deuda, gasto en sanidad, educación y defensa (% PIB), esperanza de vida, alfabetización, acceso a electricidad, usuarios de internet, comercio (% PIB), efectivos militares | Estado inicial de cada país |
| FMI (WEO) | Deuda pública, déficit, tipos | Presupuesto y deuda |
| Our World in Data (`energy-data`, `co2-data` en GitHub) | Mix eléctrico, producción y consumo por fuente, emisiones | Energía y medio ambiente |
| Energy Institute / EIA / USGS | Reservas y producción de petróleo, gas, carbón, uranio y minerales | Recursos naturales |
| UN Comtrade / CEPII BACI / WITS | Comercio bilateral por productos | Comercio. Si no es accesible, se aproxima con un modelo de gravedad. |
| SIPRI (vía Banco Mundial) | Gasto militar | Ejército |
| Natural Earth | Fronteras de países y regiones (admin-1), capitales, ciudades | Mapa |
| ParlGov / Wikipedia | Partidos, escaños, gobiernos y sistemas electorales en 2010 | Política (detallado en unos 40 países principales; plantilla genérica en el resto) |
| Listas Fortune Global 500 (2010) | Grandes empresas reales | Empresas con nombre (fase posterior) |

**Regla:** los valores de juego que no existen como dato (estabilidad, moral militar, influencia, etc.) se calculan con fórmulas documentadas en el código a partir de datos reales y se revisan con el jugador.

---

## 5. Bucle de juego, tiempo y roles

**Tiempo**
- Tiempo real con pausa. La unidad mínima es **1 día**.
- Velocidades: Pausa · ×1 (1 día ≈ 2 s) · ×2 · ×4 · ×8.
- Ritmos de simulación:
  - **Diario:** movimiento militar, combates, construcción, eventos.
  - **Semanal:** encuestas y opinión pública.
  - **Mensual:** economía, presupuesto, comercio, energía y demografía.
  - **Anual:** cierre presupuestario, cuentas nacionales, investigación agregada y envejecimiento de infraestructuras.
- El juego se pausa automáticamente ante decisiones importantes (declaración de guerra, moción de censura, referéndum…), y es configurable.

**Bucle básico:** observar (mapa, informes y alertas) → decidir (leyes, presupuesto, órdenes a ministerios, diplomacia, ejército) → ver las consecuencias (indicadores, encuestas, reacciones de otros países) → ajustar.

**Roles jugables**
1. **Jefe de Gobierno / Estado** (v1.0): control del ejecutivo según el régimen del país.
2. **Líder de la oposición** (post-1.0): ganar elecciones, presentar mociones de censura, movilizar, presionar.
3. **Líder independentista o revolucionario** (post-1.0).

**Condiciones de derrota** (opcionales): perder unas elecciones, moción de censura, golpe de Estado, revolución, derrota militar total o bancarrota con colapso social. Tras perder se puede seguir como oposición (post-1.0) o terminar la partida.

**Objetivos opcionales** (escenarios): reducir el paro por debajo de X %, lograr la independencia energética, ganar dos elecciones seguidas, convertirse en potencia regional, etc.

---

## 6. Sistemas del juego

> Todas las fórmulas son **orientativas**. Claude Code debe implementarlas con tests, parámetros en archivos de configuración (`/src/sim/config/*.json`) y ajustarlas para que el mundo se comporte de forma creíble entre 2010 y 2015 si el jugador no hace nada.

### 6.1 Economía macro

**Variables por país:** PIB nominal y real, PIB per cápita, crecimiento, inflación, paro, población activa, productividad, consumo, inversión, ahorro, tipo de interés oficial, tipo de cambio, reservas de divisas, balanza comercial, balanza por cuenta corriente, índice bursátil, precio de la vivienda, confianza de consumidores y empresas, economía sumergida (%).

**Funcionamiento**
- **Producción por sector:** producción = productividad × trabajo × capital. La productividad depende de la tecnología, la educación, las infraestructuras, la energía disponible y la corrupción.
- **Demanda:** consumo (renta disponible y confianza) + inversión (tipos, confianza, seguridad jurídica) + gasto público + exportaciones netas.
- **Inflación:** brecha de producción + masa monetaria + precios de la energía e importaciones + expectativas.
- **Paro:** ley de Okun (crecimiento frente a crecimiento potencial) + rigidez laboral (leyes) + desajuste educativo.
- **Banco central:** si es independiente, fija los tipos con una regla tipo Taylor; si no, los fija el jugador. En la zona euro, el BCE decide para todos los miembros.
- **Moneda:** tipo de cambio flotante, fijo o unión monetaria. Puede devaluarse.
- **Ciclos y crisis:** burbujas (vivienda, bolsa), crisis bancarias, de deuda o de divisas, con contagio entre países con mucho comercio o deuda cruzada.

**Acciones del jugador:** fijar tipos (sin banco central independiente), devaluar o revaluar, controles de capital, rescatar bancos, planes de estímulo, cambiar el régimen de moneda, solicitar ayuda al FMI.

### 6.2 Presupuesto y deuda

**Ingresos:** impuestos (6.3), cotizaciones sociales, beneficios de empresas públicas, venta de recursos, aranceles, privatizaciones, ayudas recibidas.
**Gastos:** presupuesto de cada ministerio (6.4), pensiones, prestaciones, intereses de la deuda, subvenciones, transferencias a regiones, ayuda exterior.

- Presupuesto anual por ministerio, con partidas internas (personal, inversión, mantenimiento, programas).
- **Déficit/superávit → deuda.** Emisión de bonos con un interés que depende de la prima de riesgo (rating, deuda/PIB, déficit, estabilidad política, inflación).
- **Rating crediticio** (AAA → D), revisado periódicamente.
- **Impago:** posible, con consecuencias graves (acceso cerrado a los mercados, inflación, crisis bancaria, caída de popularidad).
- El presupuesto se aprueba en el parlamento si el régimen lo exige. Si no se aprueba, se **prorroga** el anterior.

**Pantalla:** tabla de ingresos y gastos con deslizadores por partida, previsión a 12 meses y comparación con el año anterior.

### 6.3 Impuestos

| Impuesto | Parámetros |
|---|---|
| IRPF (renta) | Hasta 6 tramos con tipo, mínimo exento y deducciones principales |
| Sociedades | Tipo general, reducido para pymes, deducciones por I+D |
| IVA | General, reducido y superreducido |
| Cotizaciones sociales | Parte de la empresa y parte del trabajador |
| Patrimonio y sucesiones | Activado o no, tipo y mínimo |
| Plusvalías y rentas del capital | Tipo |
| Especiales | Carburantes, electricidad, tabaco, alcohol, bebidas azucaradas, lujo |
| Medioambientales | Tasa de carbono, emisiones, residuos |
| Aranceles | Por categoría de producto (ver comercio) |
| Tasas | Turística, financiera, sobre tecnologías (IA y robótica en el futuro) |

**Efectos:** recaudación (con curva de Laffer suave y economía sumergida), consumo, inversión, deslocalización de empresas, satisfacción de cada grupo social y desigualdad (índice de Gini).

### 6.4 Ministerios

Cada ministerio tiene **ministro** (con competencia, ideología, partido y lealtad), **presupuesto**, **indicadores clave**, **infraestructuras propias** y **acciones**. El jugador puede nombrar y cesar ministros, crear, fusionar o suprimir ministerios y dar órdenes concretas.

| Ministerio | Indicadores clave | Ejemplos de acciones |
|---|---|---|
| Presidencia | Popularidad, estabilidad, cohesión del gobierno | Remodelar el gobierno, comunicación, cuestión de confianza |
| Economía y Hacienda | Crecimiento, déficit, deuda, recaudación | Presupuesto, impuestos, emisión de deuda |
| Exteriores | Relaciones, tratados, imagen internacional | Embajadas, visitas, tratados, sanciones |
| Defensa | Fuerza militar, preparación, moral | Reclutamiento, compras, despliegues |
| Interior | Criminalidad, terrorismo, orden público | Policía, control fronterizo, gestión de protestas |
| Justicia | Independencia judicial, corrupción, prisiones | Reformas judiciales, indultos, lucha anticorrupción |
| Sanidad | Esperanza de vida, listas de espera, camas | Hospitales, personal, vacunación, epidemias |
| Educación | Alfabetización, nivel educativo, abandono | Colegios, universidades, becas, profesorado |
| Ciencia e Investigación | Puntos de investigación, patentes | Centros de I+D, prioridades, cooperación |
| Trabajo y Seguridad Social | Paro, pensiones, salario mínimo | Reformas laborales, edad de jubilación, prestaciones |
| Industria y Comercio | Producción industrial, exportaciones | Subvenciones, aranceles, tratados comerciales |
| Energía | Mix, precio de la electricidad, apagones, dependencia | Centrales, red, interconexiones, reservas |
| Transportes e Infraestructuras | Calidad de la red de transporte | Carreteras, ferrocarril, puertos, aeropuertos |
| Telecomunicaciones y Digital | Cobertura, velocidad, ciberseguridad | Fibra, 4G/5G, ciberdefensa |
| Agricultura, Pesca y Alimentación | Producción agraria, autosuficiencia | Ayudas, regadíos, cuotas |
| Medio Ambiente | Emisiones, contaminación, espacios protegidos | Normativa, energías limpias, reforestación |
| Vivienda | Precio de la vivienda, sinhogarismo | Vivienda pública, regulación del alquiler |
| Cultura y Deporte | Satisfacción cultural, turismo | Eventos, patrimonio, candidaturas olímpicas |
| Igualdad y Asuntos Sociales | Pobreza, Gini, dependencia | Rentas mínimas, ayudas |
| Administraciones Territoriales | Tensión territorial, nivel de autonomía | Competencias, financiación regional, diálogo |

### 6.5 Infraestructuras

Las infraestructuras se ubican **por región** del mapa y tienen: tipo, nivel o capacidad, estado de conservación (0–100 %, se degrada si no se mantiene), coste de construcción, plazo, coste anual de mantenimiento y empleo generado.

| Categoría | Tipos |
|---|---|
| Sanidad | Hospitales (camas), centros de salud, hospitales militares |
| Educación | Colegios, institutos, universidades, centros de FP |
| Transporte | Carreteras, autopistas, ferrocarril convencional, alta velocidad, metro, puertos, aeropuertos |
| Energía | Centrales (por tipo), líneas de alta tensión, subestaciones, interconexiones, almacenamiento |
| Telecomunicaciones | Fibra, antenas 3G/4G/5G, centros de datos, cables submarinos |
| Agua | Presas, depuradoras, desaladoras, regadíos |
| Seguridad | Comisarías, prisiones, bases militares, puestos fronterizos |
| Vivienda | Vivienda pública |
| Investigación | Centros de I+D, laboratorios, bases de lanzamiento espacial |

**Cola de construcción** por ministerio, con prioridades. Las obras pueden retrasarse por falta de presupuesto, corrupción o conflicto. Dentro de cada región se aplican **rendimientos decrecientes**: el décimo hospital aporta menos que el primero.

### 6.6 Energía y electricidad

**Generación por tipo:** carbón, gas, fuel, nuclear, hidráulica, eólica terrestre y marina, solar fotovoltaica y térmica, biomasa, geotérmica y, en el futuro, fusión y otras (según tecnología).

**Variables:** capacidad instalada (MW), factor de carga, producción (GWh), demanda, precio mayorista y minorista, emisiones, dependencia exterior, reservas estratégicas de petróleo y gas.

**Red eléctrica**
- La capacidad de transporte entre regiones limita adónde llega la energía.
- **Interconexiones internacionales** para importar y exportar electricidad.
- **Apagones** si la demanda supera a la oferta o falla la red. Afectan a la industria, a la popularidad y a la sanidad.
- El almacenamiento (baterías, bombeo) suaviza la intermitencia de las renovables.

**Combustibles:** petróleo y gas producidos o importados (oleoductos, gasoductos, gas natural licuado). Una subida del precio mundial encarece la electricidad y el transporte.

**Acciones:** construir o cerrar centrales, primas a las renovables, impuestos sobre la energía, precio regulado o libre, nacionalizar eléctricas, acuerdos de suministro, construir gasoductos o interconexiones, reservas estratégicas, plan de ahorro energético.

### 6.7 Red y telecomunicaciones

- **Cobertura y velocidad:** banda ancha fija (cobre → fibra) y móvil (3G → 4G → 5G → futuras, según tecnología).
- **Efectos:** productividad de los servicios, sector TIC, educación, satisfacción de los jóvenes.
- **Ciberseguridad:** nivel de protección frente a ciberataques de otros países (relacionado con espionaje y guerra).
- **Control de internet:** de libre a censurado (ley); afecta a libertades, estabilidad y opinión pública.

### 6.8 Recursos naturales

**Recursos:** petróleo, gas natural, carbón, uranio, hierro, cobre, aluminio (bauxita), níquel, litio, cobalto, tierras raras, oro, plata, fosfatos, madera, agua dulce, tierra cultivable, pesca.

**Por país y región:** reservas probadas, producción anual, coste de extracción y empresa explotadora (pública, privada o extranjera).

- Las reservas **se agotan** con la producción y pueden **descubrirse nuevas** (exploración, tecnología).
- **Precios mundiales** por recurso según la oferta y la demanda global, con volatilidad y efecto de las guerras y sanciones.
- **Acciones:** conceder licencias, nacionalizar, cambiar regalías, prohibir exportaciones, crear reservas estratégicas, explorar.
- Los recursos son **insumos** de la industria (6.9), de la energía (6.6), de la investigación y de la fabricación militar.

### 6.9 Industria, sectores y empresas

**Sectores económicos** (unos 28, versión simplificada de los ~130 de Power & Revolution):
Agricultura · Ganadería · Pesca · Silvicultura · Minería · Petróleo y gas · Electricidad · Agua y residuos · Construcción · Alimentación y bebidas · Textil y calzado · Química · Farmacéutica · Siderurgia y metalurgia · Automoción · Aeroespacial · Defensa y armamento · Electrónica · Maquinaria · Software y TIC · Telecomunicaciones · Comercio · Transporte y logística · Turismo y hostelería · Finanzas y seguros · Inmobiliario · Servicios públicos · Ocio y cultura.

**Cada sector tiene:** producción, empleo, productividad, salarios, inversión, exportaciones e importaciones, insumos que necesita (recursos, energía, otros sectores) y peso en el PIB.

**Empresas**
- **Fase 1:** empresas agregadas por sector y país (públicas y privadas).
- **Fase 2:** grandes empresas reales con nombre (2010) con sede, sector, facturación, beneficios, empleados y presencia internacional.
- **Acciones:** nacionalizar o privatizar, subvencionar, rescatar, atraer inversión extranjera (incentivos fiscales), crear empresas públicas, autorizar o bloquear fusiones, sancionar a empresas extranjeras.
- **Deslocalización:** las empresas se van si los costes (impuestos, salarios, energía) o el riesgo político suben demasiado.

### 6.10 Comercio

- **Bienes comerciables:** recursos (6.8) y productos de cada sector (6.9).
- **Flujos bilaterales** entre países, calculados a partir de los datos de 2010 y, después, de la demanda, los precios, la distancia, los aranceles y las relaciones.
- **Tratados:** libre comercio, unión aduanera, mercado común, unión monetaria (euro), acuerdos de inversión.
- **Herramientas:** aranceles por categoría, cuotas, subvenciones a la exportación, embargos y sanciones (individuales o mediante organizaciones).
- **OMC:** pertenencia y litigios por aranceles abusivos.
- **Indicadores:** balanza comercial, principales socios, dependencia de un proveedor (riesgo).

### 6.11 Sanidad

- **Indicadores:** esperanza de vida, mortalidad infantil, médicos y enfermeros por cada 1.000 habitantes, camas por cada 1.000 habitantes, listas de espera, gasto sanitario (% PIB), cobertura (pública universal / mixta / privada).
- **Personal sanitario:** se forma en las universidades (educación) y puede emigrar si los salarios son bajos.
- **Epidemias y pandemias:** brotes con contagio entre países según el comercio y los viajes. Medidas: vacunación, cuarentenas, cierre de fronteras.
- **Leyes relacionadas:** modelo sanitario, copago, aborto, eutanasia, drogas, tabaco.
- **Efectos:** productividad, población, satisfacción de jubilados y familias, gasto público.

### 6.12 Educación

- **Indicadores:** alfabetización, tasa de escolarización por nivel, abandono escolar, nivel educativo medio, calidad (tipo PISA), universitarios, investigadores.
- **Niveles:** infantil, primaria, secundaria, formación profesional, universidad y posgrado.
- **Recursos:** profesorado, centros, becas, presupuesto.
- **Efectos (con retraso de años):** productividad, investigación, innovación, menor paro estructural, valores sociales y voto.
- **Leyes:** educación obligatoria hasta X años, tasas universitarias, educación religiosa, idioma vehicular (relacionado con las regiones), educación privada y concertada.

### 6.13 Trabajo, pensiones y Seguridad Social

- **Mercado laboral:** salario mínimo, salario medio, jornada máxima, tipo de despido (indemnización), contratación temporal, convenios colectivos y poder sindical.
- **Prestaciones:** desempleo (cuantía y duración), renta mínima, dependencia, maternidad y paternidad.
- **Pensiones:** sistema de reparto o capitalización, edad de jubilación, cálculo de la pensión y fondo de reserva. Sostenibilidad según la pirámide de edad.
- **Huelgas:** generales o sectoriales, convocadas por sindicatos según la satisfacción y las reformas; paralizan sectores durante días.

### 6.14 Sociedad, grupos sociales y opinión pública

**Demografía:** población por grupos de edad (pirámide), natalidad, mortalidad, migración (entrada y salida, según la renta, la seguridad y las leyes), urbanización y población por región.

**Grupos sociales** (cada ciudadano pertenece a varios, con un peso estimado según los datos del país):
Trabajadores · Clase media · Empresarios · Funcionarios · Jubilados · Jóvenes · Estudiantes · Parados · Agricultores · Religiosos · Laicos · Ecologistas · Militares y fuerzas de seguridad · Inmigrantes · Minorías étnicas o lingüísticas · Regionalistas o nacionalistas · Clase alta.

**Cada grupo tiene:** tamaño, satisfacción (0–100), prioridades (qué temas le importan y cuánto), ideología media y capacidad de movilización.

**Opinión pública**
- Popularidad del gobierno y del líder, valoración de cada ministro.
- **Temas de preocupación** (paro, economía, corrupción, sanidad, inmigración, seguridad, vivienda, territorio…), con un peso cambiante según la situación.
- **Medios de comunicación:** libertad de prensa, medios públicos y privados, propaganda (en regímenes autoritarios).
- **Protestas:** manifestaciones, huelgas, disturbios y revueltas, según la satisfacción y la movilización. Gestión: diálogo, concesiones, policía, represión (con consecuencias internas e internacionales).
- **Estabilidad del régimen:** combina legitimidad, apoyo del ejército, satisfacción, economía y represión. Si es muy baja: golpe de Estado, revolución o guerra civil.

### 6.15 Partidos, parlamento y elecciones

**Ideología en 4 ejes** (de −100 a +100):
1. **Económico:** intervencionismo ↔ libre mercado
2. **Social:** progresista ↔ conservador
3. **Autoridad:** libertario ↔ autoritario
4. **Territorial:** centralista ↔ descentralizador/independentista

**Partidos:** nombre real (en unos 40 países con datos detallados; genéricos en el resto), siglas, color, líder (carisma, competencia, edad), ideología, base social (qué grupos les votan), financiación, militantes, escaños, ámbito (nacional o regional). Pueden fundarse, fusionarse, dividirse o ilegalizarse.

**Regímenes políticos:** parlamentario, presidencial, semipresidencial, monarquía parlamentaria, monarquía absoluta, partido único, junta militar, teocracia. Cada uno define quién gobierna, si hay elecciones y qué poderes tiene el jugador.

**Parlamento**
- Una o dos cámaras, con escaños por partido.
- **Votaciones de leyes y presupuestos:** cada diputado vota según su partido, su ideología, la presión de su base y los acuerdos. El jugador negocia apoyos (concesiones, cargos, inversiones en regiones).
- **Coaliciones:** gobierno en coalición o en minoría con apoyos puntuales.
- **Moción de censura** (incluida la constructiva), **cuestión de confianza**, **disolución** y elecciones anticipadas.

**Elecciones**
- Sistemas: proporcional (D'Hondt, Sainte-Laguë), mayoritario uninominal, a dos vueltas, mixto y presidencial. Barrera electoral y circunscripciones (por región).
- **Voto:** cercanía ideológica a cada grupo + gestión del gobierno (economía, paro, escándalos) + carisma del líder + campaña + voto útil.
- **Campaña:** presupuesto, mítines por región, debates televisados, promesas (que luego se recuerdan).
- **Encuestas** semanales con margen de error.
- Elecciones **regionales** en los países con regiones autónomas, que afectan al poder territorial.

### 6.16 Leyes y constitución

**Cada ley tiene:** identificador, nombre, categoría, opciones o niveles (p. ej. "pena de muerte: abolida / solo delitos militares / vigente"), mayoría necesaria (simple, absoluta, constitucional, referéndum), coste de aplicación, efectos (modificadores en variables), reacción de cada grupo social y de otros países, y requisitos.

**Categorías y ejemplos** (objetivo: unas 150 leyes al llegar a la v1.0):

| Categoría | Ejemplos |
|---|---|
| Constitución y Estado | Forma de Estado, sistema electoral, límite de mandatos, modelo territorial (unitario / autonómico / federal), referéndums, independencia judicial |
| Derechos y libertades | Libertad de prensa, de reunión, de culto, control de internet, matrimonio igualitario, aborto, eutanasia, pena de muerte |
| Economía | Independencia del banco central, régimen de moneda, regulación bancaria, control de precios, regla de gasto |
| Trabajo | Salario mínimo, jornada, despido, sindicatos, huelga |
| Social | Pensiones, prestaciones, renta básica, vivienda, alquiler |
| Sanidad y consumo | Modelo sanitario, drogas, tabaco, alcohol |
| Educación | Escolarización obligatoria, tasas, lengua vehicular |
| Interior y justicia | Policía, prisiones, armas, inmigración, asilo, antiterrorismo, estado de excepción |
| Defensa | Servicio militar, presupuesto mínimo, armas nucleares, exportación de armas |
| Medio ambiente | Emisiones, energía nuclear sí o no, protección de espacios |
| Territorial | Lenguas cooficiales, competencias regionales, financiación regional, derecho de autodeterminación |

**Constitución:** algunas leyes son constitucionales y requieren mayorías reforzadas o referéndum. En regímenes autoritarios, el jugador puede gobernar por decreto, con más riesgo de inestabilidad e imagen internacional negativa.

### 6.17 Independentismo y regiones

**Regiones:** cada país se divide en regiones (admin-1 de Natural Earth, agrupadas si son demasiadas). Cada región tiene población, economía, infraestructuras, partidos regionales e indicadores propios.

**Variables territoriales por región**
- **Identidad propia** (0–100): lengua, historia, cultura diferenciada.
- **Apoyo a la independencia** (% de la población).
- **Nivel de autonomía:** centralizada → descentralizada → autonomía amplia → federal → confederal.
- **Agravios:** inversión pública recibida frente a impuestos pagados, represión, desprecio a su lengua, sentencias judiciales.
- **Partidos regionalistas e independentistas** y su fuerza en las elecciones regionales.
- **Apoyo exterior:** países que apoyan o rechazan la secesión.

**Acciones del gobierno central:** transferir competencias, mejorar la financiación, reconocer la lengua, diálogo y negociación, autorizar un referéndum pactado, intervenir la autonomía (suspensión temporal), ilegalizar partidos, represión policial.

**Evolución posible**
1. Aumento de tensión → manifestaciones y victorias independentistas en elecciones regionales.
2. Referéndum (pactado o unilateral).
3. **Independencia pactada:** se crea un **nuevo país en el mapa**, que hereda su parte de población, deuda, ejército, infraestructuras y recursos.
4. **Declaración unilateral:** crisis constitucional, reconocimiento internacional parcial, posible intervención o conflicto.
5. **Insurgencia o guerra de secesión** en casos extremos.

El jugador también puede **apoyar movimientos independentistas en otros países** para desestabilizarlos.

**Movimientos activos en 2010 (lista inicial):** Cataluña, País Vasco, Escocia, Flandes, Quebec, Córcega, Padania, Tirol del Sur, Groenlandia, Nueva Caledonia, Kurdistán (Irak, Turquía, Siria, Irán), Sudán del Sur, Tíbet, Xinjiang, Chechenia, Cachemira, Mindanao, Papúa Occidental, Bougainville, Sáhara Occidental, Somalilandia, Transnistria, Abjasia, Osetia del Sur, Nagorno Karabaj, Kosovo (reconocimiento parcial), Chipre del Norte, Palestina, Taiwán (estatus especial), Biafra, Cabinda, Santa Cruz (Bolivia).

### 6.18 Tecnología e investigación

**Integración con los árboles tecnológicos del jugador**
- **10 ramas:** Energía · Espacio · Biotecnología y Medicina · Redes y Computación · Industria y Robótica · Recursos y Extracción · Transporte e Infraestructura · Militar · Agricultura · Medio Ambiente. *(Confirmar si Agricultura y Medio Ambiente son dos ramas o una.)*
- Unas **2.500 tecnologías** con niveles 1–12, cada una con: prerrequisitos, recursos, dinero, personal, instalaciones o infraestructura necesarias y tiempo.
- **Origen:** documentos `.docx` del jugador (formato de `01_Energia.docx`) en `/fuentes/arboles/`. Un script los convierte a `/public/data/tecnologias/*.json` y valida que no haya prerrequisitos rotos ni ciclos.
- **Árbol con fecha de 2006 y partida en 2010:** cada país empieza con las tecnologías de 2006–2010 ya investigadas según su nivel tecnológico real (estimado a partir de I+D, patentes y PIB per cápita). Los países punteros tienen todo lo de 2010; los menos avanzados, solo una parte.

**Investigación**
- **Puntos de investigación** por rama, según gasto en I+D (público y privado), investigadores (educación), centros de I+D, universidades y cooperación internacional.
- El jugador elige **prioridades por rama** y una **cola de proyectos**. Los proyectos consumen dinero, personal y recursos y exigen las instalaciones necesarias.
- **Difusión:** las tecnologías se abaratan cuando otros países ya las tienen. Se pueden comprar licencias, cooperar o conseguir por espionaje.
- **Efectos:** desbloquean edificios, unidades militares, leyes, sectores y mejoras de productividad, eficiencia energética, sanidad, etc.

### 6.19 Diplomacia y organizaciones internacionales

- **Relaciones bilaterales** de −100 a +100, según ideología, comercio, historia, alianzas, incidentes y ayudas.
- **Acciones:** abrir o cerrar embajadas, visitas oficiales, cumbres, tratados (comercio, defensa mutua, no agresión, cooperación tecnológica o energética, extradición), ayuda al desarrollo, préstamos, sanciones, expulsión de diplomáticos, reconocer o no a un Estado, mediar en conflictos.
- **Organizaciones (estado de 2010):** ONU (Asamblea y Consejo de Seguridad con veto), UE, OTAN, OTSC, Unión Africana, ASEAN, Mercosur, OEA, Liga Árabe, OPEP, OCS, G8, G20, BRIC, FMI, Banco Mundial, OMC.
  - Votaciones (resoluciones de la ONU, sanciones, adhesiones), requisitos de entrada y beneficios u obligaciones (fondos de la UE, defensa colectiva de la OTAN, cuotas de la OPEP…).
- **Imagen internacional:** derechos humanos, democracia, fiabilidad. Afecta a la inversión, el turismo y los apoyos.

### 6.20 Ejército y guerras

**Fuerzas armadas por país:** Tierra, Armada, Aire, fuerzas especiales, fuerzas de misiles y arsenal nuclear (si lo hay). Efectivos (profesionales, reclutas, reservistas), presupuesto, preparación, moral, experiencia, nivel tecnológico e industria de defensa propia.

**Equipamiento:** carros de combate, vehículos blindados, artillería, defensa antiaérea, cazas, bombarderos, helicópteros, drones (según tecnología), fragatas, destructores, submarinos, portaaviones, misiles. Se compra a otros países o se fabrica (con la tecnología y la industria necesarias).

**Unidades en el mapa:** agrupaciones (brigadas o divisiones, flotas, escuadrones) con posición, movimiento por regiones, suministro y logística. Bases en el propio país y en el extranjero (por acuerdo).

**Guerra**
1. **Causa:** disputa territorial, independentismo, alianza, terrorismo, recursos, cambio de régimen.
2. **Declaración:** necesita apoyo parlamentario y popular según el régimen, con reacción de la ONU y las alianzas.
3. **Combate:** resolución por región con modelo tipo Lanchester, modificado por terreno, tecnología, superioridad aérea, suministro, moral y defensa.
4. **Ocupación:** control de regiones, resistencia o insurgencia, coste de mantenerla.
5. **Fin:** alto el fuego, armisticio o tratado de paz (anexión, retirada, reparaciones, cambio de régimen, independencia de una región).
- **Costes:** gasto, bajas, destrucción de infraestructuras, caída del comercio, refugiados, sanciones y popularidad (efecto "unión ante la bandera" al principio, cansancio después).
- **Nuclear (fase posterior):** doctrina, disuasión, ataque con represalia prevista y consecuencias catastróficas (víctimas, invierno nuclear, sanciones globales).

### 6.21 Interior, justicia y seguridad

- **Indicadores:** criminalidad, tasa de homicidios, terrorismo, población penitenciaria, corrupción (0–100), independencia judicial, confianza en la policía.
- **Terrorismo:** grupos activos en 2010 con su capacidad y objetivos. Atentados con impacto en la opinión pública y la economía.
- **Corrupción:** reduce la eficacia del gasto (una parte se pierde), provoca escándalos que afectan a ministros y partidos, y se combate con fiscalía, tribunales y transparencia.
- **Servicios de inteligencia (fase posterior):** espionaje, contraespionaje, operaciones encubiertas, robo de tecnología, desestabilización y ciberataques.

### 6.22 Medio ambiente y desastres

- **Emisiones de CO₂** por país (energía, industria, transporte, agricultura) y **contaminación local** (afecta a la sanidad).
- **Cambio climático global** simplificado: las emisiones acumuladas suben la temperatura y aumentan la frecuencia de sequías, inundaciones y olas de calor.
- **Desastres naturales:** terremotos, tsunamis, huracanes, inundaciones, sequías, incendios y erupciones, con probabilidades según la geografía real. Afectan a la población, las infraestructuras y la economía, y permiten pedir o enviar ayuda internacional.
- **Acuerdos climáticos:** compromisos de reducción (estilo Kioto o París) con presión internacional.

### 6.23 Eventos

- **Eventos aleatorios:** crisis bancarias, escándalos de corrupción, accidentes industriales, epidemias, descubrimientos de recursos, avances tecnológicos, atentados, muerte o enfermedad de líderes, filtraciones.
- **Eventos históricos opcionales** desde 2010 (ver sección 3), condicionados al estado real del mundo.
- **Formato:** título, descripción, imagen o icono, condiciones de activación, probabilidad, opciones de respuesta y efectos de cada opción.
- **Noticias:** un teletipo con lo que pasa en el mundo, filtrable por país y tema.

### 6.24 IA de los demás países

- Cada país no jugador tiene una **personalidad** (agresiva, pacifista, comercial, aislacionista, expansionista…) derivada de su régimen, ideología e historia.
- **Toma decisiones mensuales** con prioridades: estabilidad interna → economía → seguridad → influencia exterior.
- Ajusta presupuesto e impuestos, aprueba leyes coherentes con su gobierno, celebra elecciones, firma o rompe tratados, reacciona a las acciones del jugador y puede iniciar guerras si tiene motivo, capacidad y apoyo.
- Debe ser **creíble y no tramposa**: usa las mismas reglas que el jugador.

---

## 7. Interfaz y experiencia en móvil

**Principio:** el mapa ocupa toda la pantalla y los paneles se abren por encima (hojas deslizables en móvil, paneles laterales en PC).

**Pantallas**
1. **Inicio:** nueva partida, cargar, ajustes, enlace a la Hoja de ruta, versión del juego.
2. **Nueva partida:** elegir país en el mapa, dificultad, eventos históricos sí o no, semilla.
3. **Mapa principal:**
   - Barra superior: fecha, controles de tiempo, tesorería, popularidad, alertas.
   - Barra inferior (móvil): Gobierno · Economía · Política · Mundo · Ejército · Más.
   - **Capas del mapa:** político, alianzas, relaciones con mi país, PIB per cápita, crecimiento, paro, deuda, energía (mix y apagones), recursos, independentismo por región, conflictos, militar y elecciones.
   - Tocar un país muestra su ficha; un toque largo o doble toque muestra las acciones diplomáticas.
4. **Consejo de Ministros:** cuadrícula de ministerios con su indicador principal y alertas.
5. **Presupuesto** e **Impuestos** con deslizadores y previsión.
6. **Parlamento y leyes:** hemiciclo, votaciones, catálogo de leyes, negociación.
7. **Partidos y encuestas:** intención de voto, valoración de líderes, grupos sociales.
8. **Economía:** gráficos históricos (PIB, paro, inflación, deuda), sectores, empresas.
9. **Energía:** mix, demanda, red, precios.
10. **Infraestructuras:** mapa por región y cola de obras.
11. **Comercio y diplomacia:** socios, tratados, organizaciones, relaciones.
12. **Ejército:** fuerzas, unidades en el mapa, compras, guerras activas.
13. **Investigación:** árbol por ramas (con zoom), cola y prioridades.
14. **Regiones:** ficha de cada región (economía, autonomía, independentismo).
15. **Informes y noticias:** teletipo, resúmenes mensuales y asesores.
16. **Ajustes:** velocidad, pausa automática, sonido (música y efectos), gráficos (animaciones y 3D), accesibilidad, idioma.

**Experiencia de uso**
- Zonas táctiles de al menos 44 px, gestos de zoom y arrastre en el mapa, y modo vertical y horizontal.
- **Asesores:** cada ministro avisa de los problemas y propone medidas ("El paro juvenil supera el 40 %. Propuesta: plan de empleo joven").
- Tooltips que explican cada indicador y qué lo afecta.
- Tema oscuro por defecto, con colores accesibles.

### 7.1 Contenido audiovisual

**Principio:** cada fase entrega el contenido audiovisual de lo que construye (gráficos, animaciones, sonido y, si procede, 3D). Es la última tarea de cada fase en la sección 9.

**Qué incluye**
- **Gráficos:** iconos e ilustraciones vectoriales, banderas y emblemas, visualización de datos (gráficos, leyendas, capas del mapa).
- **Animación:** transiciones de la interfaz, efectos en el mapa (flujos, crisis, combates, desastres) y secuencias de los momentos importantes (noche electoral, firma de un tratado, nacimiento de un país).
- **Sonido:** efectos de interfaz, alertas y eventos, y música ambiental según la situación.
- **3D:** componentes complementarios cuando aporten algo que el 2D no da.

**Cómo se produce**
- Claude Code lo crea **con código**: SVG, Canvas y CSS para los gráficos y las animaciones, síntesis con Web Audio para el sonido y WebGL para el 3D. No hace falta ningún programa externo.
- **Material real de licencia libre** cuando exista (por ejemplo, banderas): se descarga con un script reproducible y se anota la fuente y la licencia en `/docs/creditos.md`.
- **Lo que no se puede crear con código** (fotografías, vídeo grabado, música grabada, voces): se sustituye por una alternativa generada (ilustración, música sintetizada) o lo aporta el jugador en `/fuentes/av/`. Nunca se usa material sin una licencia clara.
- **Personas, partidos y empresas reales:** no se usan fotografías ni logotipos registrados; se representan con retratos genéricos y emblemas propios (color y siglas).

**Reglas del 3D**
- El **mapa de juego sigue siendo 2D**. El 3D es para componentes complementarios: globo decorativo del inicio, hemiciclo, salas de votación, maquetas de edificios, centrales y equipamiento militar, efectos de combates y desastres.
- Cada uso de 3D figura en la sección 9 como **propuesta** y se confirma con el jugador al planificar esa fase.
- Se carga **solo cuando se usa**, siempre hay una **alternativa en 2D** y se puede desactivar en Ajustes. Nunca es necesario para jugar.
- Rendimiento en un móvil de gama media: el mapa mantiene sus 60 fps y una escena 3D no baja de unos 30 fps; si no se consigue, se muestra la alternativa en 2D.

**Reglas del sonido**
- Empieza tras el primer toque del jugador (los navegadores no permiten otra cosa), con un botón de silencio siempre a mano y volúmenes separados de música y efectos.
- Ninguna información se da solo con sonido o solo con color: todo aviso sonoro tiene su equivalente visual.
- Con «reducir movimiento» activado en el dispositivo, las animaciones se simplifican.

---

## 8. Modelo de datos (resumen)

Tipos principales en TypeScript (orientativo; Claude Code lo detalla en `/src/sim/types.ts`):

```ts
interface Pais {
  id: string;               // ISO3, p. ej. "ESP"
  nombre: string;
  regimen: Regimen;
  capital: string;
  regiones: string[];       // ids de Region
  poblacion: Demografia;
  economia: Economia;       // PIB, inflación, paro, tipos, moneda…
  presupuesto: Presupuesto; // ingresos y gastos por partida
  impuestos: Impuestos;
  ministerios: Record<MinisterioId, Ministerio>;
  energia: Energia;
  recursos: Record<RecursoId, Yacimiento>;
  sectores: Record<SectorId, Sector>;
  leyes: Record<LeyId, string>;            // ley → opción vigente
  parlamento: Parlamento;
  partidos: string[];                      // ids de Partido
  gruposSociales: Record<GrupoId, GrupoSocial>;
  tecnologias: { investigadas: string[]; cola: ProyectoInvestigacion[] };
  relaciones: Record<string, number>;      // ISO3 → −100..100
  tratados: string[];
  ejercito: Ejercito;
  estabilidad: number;
  datosEstimados: string[];                // campos sin dato real
}

interface Region {
  id: string; paisId: string; nombre: string;
  poblacion: number; pib: number;
  infraestructuras: Infraestructura[];
  identidad: number; apoyoIndependencia: number;
  autonomia: NivelAutonomia; agravios: number;
}

interface Partido {
  id: string; paisId: string; nombre: string; siglas: string; color: string;
  ideologia: { economico: number; social: number; autoridad: number; territorial: number };
  lider: Personaje; escanos: number; ambito: "nacional" | "regional";
}

interface Ley {
  id: string; nombre: string; categoria: string;
  opciones: { id: string; nombre: string; efectos: Efecto[]; reacciones: Record<GrupoId, number> }[];
  mayoria: "simple" | "absoluta" | "constitucional" | "referendum";
  requisitos?: Condicion[];
}

interface Tecnologia {
  id: string; rama: RamaId; nivel: number; nombre: string; anioReferencia?: number;
  prerrequisitos: string[];
  coste: { dinero: number; personal: number; recursos: Record<RecursoId, number>; tiempoMeses: number };
  instalaciones: string[];
  desbloquea: Efecto[];
}

interface EstadoPartida {
  version: string; semilla: number; fecha: string; // "2010-01-01"
  jugador: { paisId: string; rol: "gobierno" | "oposicion" };
  paises: Record<string, Pais>; regiones: Record<string, Region>;
  partidos: Record<string, Partido>; tratados: Record<string, Tratado>;
  unidades: Record<string, Unidad>; guerras: Guerra[];
  preciosMundiales: Record<RecursoId, number>;
  noticias: Noticia[]; historico: Serie[];
}
```

**Efectos:** un sistema genérico de modificadores (`{ variable, operacion, valor, duracion, retrasoMeses }`) que comparten leyes, tecnologías, eventos y edificios. Así se pueden añadir contenidos sin tocar el motor.

---

## 9. Hoja de ruta: etapas, fases y versiones (orden de trabajo)

> **Orden obligatorio.** Cada fase se apoya en las anteriores. Claude Code trabaja por **tareas pequeñas** dentro de la fase activa, actualiza `roadmap.json` y no empieza una fase nueva hasta cumplir el "Hecho cuando" de la anterior, salvo que el jugador lo autorice.
>
> **Cómo leer cada fase**
> - **Objetivo:** qué se consigue.
> - **Depende de:** fases que deben estar terminadas.
> - **Tareas:** lista ordenada de trabajo.
> - **Tests:** pruebas automáticas obligatorias.
> - **Prueba en el móvil:** qué debe comprobar el jugador al publicarse la versión.
> - **Hecho cuando:** condición para cerrar la fase y subir de versión.
> - **Audiovisual:** la última tarea de cada fase es su contenido gráfico, sonoro y, si procede, 3D (sección 7.1). Las propuestas de 3D se confirman con el jugador al planificar la fase.

### Resumen de etapas

| Etapa | Versiones | Fases | Resultado |
|---|---|---|---|
| A · Prealfa: cimientos y mundo | 0.1 – 0.5 | 0 – 4 | Proyecto publicado, datos reales de 2010 y mapa 2D navegable |
| B · Alfa 1: el país funciona | 0.6 – 0.12 | 5 – 11 | **Primera versión jugable:** gestionar la economía de un país en el tiempo |
| C · Alfa 2: servicios e infraestructuras | 0.13 – 0.19 | 12 – 18 | Ministerios sociales, obras, transporte, energía y telecomunicaciones |
| D · Alfa 3: economía real y mundo conectado | 0.20 – 0.25 | 19 – 24 | Recursos, industria, empresas, comercio, diplomacia y organizaciones |
| E · Beta 1: política | 0.26 – 0.34 | 25 – 33 | Sociedad, partidos, parlamento, elecciones, leyes, regímenes, regiones e independentismo |
| F · Beta 2: tecnología y poder | 0.35 – 0.42 | 34 – 41 | Árboles tecnológicos, ejército, guerra, seguridad y medio ambiente |
| G · Beta 3: mundo vivo | 0.43 – 0.47 | 42 – 46 | IA de países, eventos, noticias y estadísticas |
| H · Versión candidata | 0.48 – 0.51 | 47 – 50 | Tutorial, equilibrado, rendimiento y contenido completo |
| **Lanzamiento** | **1.0** | — | Juego completo como Jefe de Gobierno |
| I · Ampliaciones | 1.1 – 2.0 | — | Oposición, espionaje, nuclear, espacio, mods, multijugador… |

---

### ETAPA A · Prealfa: cimientos y mundo

#### Fase 0 — v0.1.0 · Cimientos del proyecto
**Objetivo:** proyecto creado, publicado automáticamente y con la Hoja de ruta funcionando.
**Depende de:** nada.
**Tareas**
1. Crear el proyecto con Vite + TypeScript + Vitest, ESLint y Prettier.
2. Crear la estructura de carpetas de la sección 2 y mover este documento a `docs/GDD.md` si no está ahí.
3. Crear `CLAUDE.md` con las reglas de la sección 11.
4. Crear `roadmap.json` con **todas** las etapas, fases y tareas de esta sección (formato de la sección 10).
5. Configurar GitHub Actions: instalar, pasar tests, compilar y publicar en GitHub Pages en cada cambio en `main`.
6. Crear la web independiente `/hoja-de-ruta/` (sección 10).
7. Crear la pantalla de inicio del juego: título provisional, versión, botones (Nueva partida, desactivado por ahora; Hoja de ruta; Ajustes).
8. Crear el botón "Reportar fallo / sugerencia" con *issue* de GitHub prerrellenada y plantillas de *issue* (`fallo`, `idea`, `datos`).
9. Crear `CHANGELOG.md` y la gestión de versión (una sola fuente: `package.json`).

**Tests:** el proyecto compila; un test de ejemplo pasa; `roadmap.json` es válido según su esquema.
**Prueba en el móvil:** abrir la dirección pública, ver la pantalla de inicio, entrar en la Hoja de ruta, desplegar fases y enviar una *issue* de prueba.
**Hecho cuando:** la publicación automática funciona y las dos webs muestran la misma versión.
*Acción del jugador:* en GitHub, Settings → Pages → Source: **GitHub Actions**.

#### Fase 1 — v0.2.0 · Datos reales de 2010
**Objetivo:** todos los países con sus datos reales de partida, descargados con scripts reproducibles.
**Depende de:** Fase 0.
**Tareas**
1. Script de descarga del Banco Mundial (indicadores de la sección 4) con años 2008–2010; usar 2009 o 2010 según disponibilidad.
2. Script de Our World in Data: energía (mix y consumo) y emisiones.
3. Script de recursos: reservas y producción (petróleo, gas, carbón, minerales principales).
4. Tabla de equivalencias de países (ISO3, nombres en español, países y territorios especiales de 2010).
5. **Valores de respaldo** para datos que falten (por región y nivel de renta), marcados como estimados.
6. Validación: rangos lógicos, sumas coherentes (sectores ≈ 100 % del PIB) y ausencia de duplicados.
7. **Informe de cobertura** (`/docs/datos-cobertura.md`): qué porcentaje de datos es real o estimado por país.
8. Salida final: `/public/data/paises-2010.json`.
9. **Audiovisual:** banderas de todos los países y territorios vigentes el 1 de enero de 2010 (SVG de licencia libre, descargadas con un script reproducible; ojo con las que han cambiado después, como Libia, Birmania, Siria, Mauritania o Afganistán) e iconos vectoriales de los indicadores básicos (población, PIB, paro, inflación, deuda, energía). Créditos en `/docs/creditos.md`.

**Tests:** validación del esquema de datos; ningún país jugable sin población, PIB o capital.
**Prueba en el móvil:** abrir el informe de cobertura en GitHub y revisar 3 países conocidos.
**Hecho cuando:** existen datos de al menos 190 países y el informe de cobertura está publicado.

#### Fase 2 — v0.3.0 · Mapa 2D base
**Objetivo:** mapa político del mundo en 2010, fluido en móvil.
**Depende de:** Fase 1.
**Tareas**
1. Procesar Natural Earth (admin-0) y aplicar las correcciones de 2010 (sección 3).
2. Simplificar geometrías a varios niveles de detalle (TopoJSON) para móvil.
3. Dibujar el mapa en Canvas con proyección adecuada para estrategia (p. ej. Robinson o Equal Earth; decidir con el jugador).
4. Zoom con pellizco y rueda, arrastre, límites del mundo y doble toque para acercar.
5. Selección de país al tocar, con resaltado del borde.
6. Colores por país (estables y distinguibles) y nombres que aparecen según el zoom.
7. Capitales y ciudades principales al acercar.
8. Medidor de rendimiento interno (fps) en modo desarrollo.
9. **Audiovisual:** estilo visual del mapa (colores de países, océano y bordes), animaciones de zoom y de selección, y motor de sonido (Web Audio) con los primeros efectos de interfaz y los ajustes de sonido. Propuesta de 3D: globo terráqueo decorativo en la pantalla de inicio (el mapa de juego sigue en 2D).

**Tests:** cada país de los datos tiene geometría y viceversa (salvo excepciones documentadas).
**Prueba en el móvil:** mover y acercar el mapa sin tirones; tocar países pequeños (Luxemburgo, Singapur) y que se seleccionen.
**Hecho cuando:** el mapa va a unos 60 fps en un móvil de gama media y todos los países son seleccionables.

#### Fase 3 — v0.4.0 · Regiones y capas del mapa
**Objetivo:** regiones dentro de cada país y capas temáticas de información.
**Depende de:** Fase 2.
**Tareas**
1. Procesar regiones (admin-1) y agruparlas cuando un país tenga demasiadas (máx. orientativo: 30 por país).
2. Datos básicos por región: población y PIB estimado (reparto proporcional si no hay dato).
3. Mostrar regiones al superar cierto zoom.
4. Sistema genérico de **capas** con leyenda: político, población, PIB per cápita, crecimiento, paro, deuda, inflación.
5. Selector de capas (menú desplegable en móvil).
6. Buscador de países y regiones con autocompletado.
7. **Audiovisual:** rampas de color accesibles para cada capa, iconos de las capas, leyendas y transición animada al cambiar de capa.

**Tests:** cada región pertenece a un país existente; la suma de población de regiones ≈ población del país.
**Prueba en el móvil:** cambiar de capa, leer la leyenda, buscar "Cataluña" y "Texas".
**Hecho cuando:** las capas funcionan y las regiones se ven y seleccionan al acercar.

#### Fase 4 — v0.5.0 · Fichas de país y nueva partida
**Objetivo:** consultar cualquier país y empezar una partida eligiendo uno.
**Depende de:** Fase 3.
**Tareas**
1. Ficha de país (hoja deslizable en móvil): bandera, régimen, jefe de Estado y de Gobierno de 2010, población, PIB, indicadores clave, con fuente y aviso de estimados.
2. Ficha de región.
3. Pantalla "Nueva partida": elegir país en el mapa o en una lista ordenable, dificultad, eventos históricos sí o no, semilla.
4. Pantalla principal de partida con barra superior (fecha 01/01/2010, tesorería, popularidad provisional) y barra inferior de navegación (secciones vacías por ahora).
5. Base de interfaz: tema oscuro, tipografía, componentes reutilizables (paneles, pestañas, deslizadores, tablas, gráficos).
6. **Audiovisual:** iconos de los regímenes, retratos genéricos ilustrados para los cargos (sin fotografías de personas reales), animaciones de hojas y pestañas, sonidos de navegación y animación de la elección de país.

**Tests:** la ficha muestra datos para todos los países sin errores.
**Prueba en el móvil:** crear una partida con España y con otro país; navegar por las secciones vacías.
**Hecho cuando:** se puede empezar una partida con cualquier país y ver su ficha completa.

---

### ETAPA B · Alfa 1: el país funciona

#### Fase 5 — v0.6.0 · Motor de tiempo y guardado
**Objetivo:** el tiempo avanza y la partida se puede guardar.
**Depende de:** Fase 4.
**Tareas**
1. Reloj con pausa y velocidades (×1, ×2, ×4, ×8) y ritmos diario, semanal, mensual y anual.
2. Motor de simulación en un Web Worker con comunicación por mensajes.
3. Generador aleatorio determinista con semilla guardada.
4. Sistema genérico de **efectos y modificadores** (sección 8).
5. Guardado en IndexedDB (manual, automático mensual y varias ranuras).
6. Exportar e importar partida como `.json`, con número de versión y **migraciones**.
7. Pausa automática configurable ante eventos importantes.
8. **Audiovisual:** reloj animado del paso del tiempo, sonidos de pausa y de cambio de velocidad, indicador de guardado y primera música ambiental sintetizada.

**Tests:** dos partidas con la misma semilla y las mismas acciones dan el mismo resultado; guardar y cargar no altera el estado.
**Prueba en el móvil:** avanzar un año a ×8, guardar, cerrar el navegador, volver y cargar.
**Hecho cuando:** el tiempo avanza sin bloquear la interfaz y las partidas se recuperan siempre.

#### Fase 6 — v0.7.0 · Economía macro
**Objetivo:** cada país tiene una economía que evoluciona mes a mes.
**Depende de:** Fase 5.
**Tareas**
1. Modelo de producción y demanda (6.1).
2. Inflación, paro (Okun), productividad y crecimiento potencial.
3. Consumo, inversión, ahorro y confianza.
4. Historial mensual de indicadores y pantalla **Economía** con gráficos.
5. Capa del mapa con crecimiento e inflación en tiempo real.
6. **Audiovisual:** gráficos históricos animados, iconos de los indicadores macroeconómicos y sonidos de las alertas económicas.

**Tests:** simulación de 5 años sin intervención en los 20 mayores países con valores en rangos creíbles (crecimiento entre −10 % y +15 %, inflación entre −5 % y +30 %, salvo casos justificados).
**Prueba en el móvil:** jugar 2 años y revisar que los gráficos de España, EE. UU. y China tienen sentido.
**Hecho cuando:** pasa el test de credibilidad y los gráficos funcionan.

#### Fase 7 — v0.8.0 · Banco central, moneda y sistema financiero
**Objetivo:** política monetaria, tipos de cambio y crisis financieras.
**Depende de:** Fase 6.
**Tareas**
1. Banco central (independiente o no) con regla tipo Taylor.
2. Zona euro: el BCE decide para los 16 miembros de 2010.
3. Regímenes de moneda: flotante, fijo, unión monetaria; devaluar y revaluar.
4. Reservas de divisas y controles de capital.
5. Sistema bancario simplificado: solvencia, crédito, rescates.
6. Bolsa e índice de precios de la vivienda; burbujas y crisis con contagio.
7. **Audiovisual:** símbolos de las monedas, visualización de los tipos de interés y del tipo de cambio, y animación del contagio de una crisis en el mapa.

**Tests:** subir los tipos reduce la inflación y el crecimiento con retraso; una crisis bancaria se contagia a socios con mucha exposición.
**Prueba en el móvil:** subir los tipos en un país sin banco central independiente y ver el efecto en 12 meses.
**Hecho cuando:** la política monetaria funciona y puede producirse una crisis financiera.

#### Fase 8 — v0.9.0 · Presupuesto y deuda
**Objetivo:** el Estado tiene ingresos, gastos y deuda.
**Depende de:** Fase 7.
**Tareas**
1. Estructura de ingresos y gastos por partida y ministerio (6.2).
2. Datos iniciales de 2010 (gasto por función y deuda real).
3. Déficit, emisión de bonos, intereses, prima de riesgo y rating.
4. Impago y petición de ayuda al FMI.
5. Pantalla **Presupuesto** con deslizadores, previsión a 12 meses y comparación interanual.
6. Prórroga presupuestaria (preparada para cuando exista el parlamento).
7. **Audiovisual:** deslizadores con respuesta visual y sonora, gráfico de ingresos y gastos y distintivo animado del rating.

**Tests:** gastar más sin ingresos sube la deuda y, a partir de cierto umbral, la prima de riesgo.
**Prueba en el móvil:** subir mucho el gasto y comprobar que el rating baja.
**Hecho cuando:** el presupuesto es editable y sus efectos son coherentes.

#### Fase 9 — v0.10.0 · Impuestos
**Objetivo:** sistema fiscal completo.
**Depende de:** Fase 8.
**Tareas**
1. Todos los impuestos de la sección 6.3 con sus parámetros.
2. Recaudación con curva de Laffer suave, economía sumergida y evasión.
3. Efectos en consumo, inversión, inflación, desigualdad (Gini) y deslocalización.
4. Pantalla **Impuestos** con simulador ("si subes el IVA un punto, recaudarás X").
5. **Audiovisual:** iconos de cada impuesto, curva de Laffer animada y simulador visual de la recaudación.

**Tests:** subir un impuesto aumenta la recaudación hasta un punto y después la reduce.
**Prueba en el móvil:** subir el IVA y el IRPF y comparar la previsión con el resultado real a 6 meses.
**Hecho cuando:** todos los impuestos funcionan y el simulador acierta de forma aproximada.

#### Fase 10 — v0.11.0 · Interfaz de gobierno
**Objetivo:** gobernar desde un Consejo de Ministros.
**Depende de:** Fase 9.
**Tareas**
1. Ministerios de la sección 6.4 con presupuesto, indicadores y alertas (las acciones se irán añadiendo en cada fase).
2. Ministros: competencia, ideología, lealtad; nombrar y cesar.
3. **Asesores:** avisos con propuestas de medidas.
4. Centro de notificaciones y teletipo de noticias.
5. Panel de resumen mensual ("Informe del mes").
6. **Audiovisual:** iconos de los 20 ministerios, retratos genéricos de los ministros, teletipo animado, sonidos de notificación e ilustración del informe del mes. Propuesta de 3D: sala del Consejo de Ministros.

**Tests:** cada ministerio tiene datos para todos los países.
**Prueba en el móvil:** abrir el Consejo de Ministros, cesar a un ministro y leer el informe del mes.
**Hecho cuando:** todo lo construido hasta ahora se maneja desde los ministerios.

#### Fase 11 — v0.12.0 · Demografía y población
**Objetivo:** población viva.
**Depende de:** Fase 10.
**Tareas**
1. Pirámide de edades, natalidad, mortalidad y envejecimiento.
2. Migración entre países según renta, seguridad y leyes.
3. Población por región y urbanización.
4. Pantalla de población y capa del mapa.
5. **Audiovisual:** pirámide de población animada y flujos migratorios animados en el mapa.

**Tests:** 10 años de simulación dan cifras de población cercanas a las reales de 2020 (±5 % en los países grandes).
**Prueba en el móvil:** ver la pirámide de Japón y la de Nigeria.
**Hecho cuando:** la demografía evoluciona de forma creíble.

> 🎮 **HITO ALFA 1:** ya se puede jugar a gestionar la economía de un país en el tiempo. Partida de prueba recomendada: España 2010–2014.

---

### ETAPA C · Alfa 2: servicios e infraestructuras

#### Fase 12 — v0.13.0 · Trabajo, pensiones y Seguridad Social
**Objetivo:** mercado laboral y protección social (6.13).
**Depende de:** Fase 11.
**Tareas**
1. Salario mínimo y medio, jornada, despido, temporalidad, convenios y poder sindical.
2. Prestación por desempleo, renta mínima y dependencia.
3. Pensiones: reparto o capitalización, edad de jubilación, fondo de reserva y sostenibilidad según la demografía.
4. Huelgas sectoriales y generales (versión básica; se amplía en la Fase 26).
5. Acciones del Ministerio de Trabajo.
6. **Audiovisual:** iconos del mercado laboral y las prestaciones, gráfico de la proyección de pensiones y animación y sonido de las huelgas.

**Tests:** subir la edad de jubilación mejora el saldo de pensiones y empeora la satisfacción de los mayores (preparado para la Fase 25).
**Prueba en el móvil:** reformar las pensiones y ver la proyección a 20 años.
**Hecho cuando:** el sistema de pensiones responde a la demografía y a las reformas.

#### Fase 13 — v0.14.0 · Sanidad
**Objetivo:** sistema sanitario (6.11).
**Depende de:** Fase 12.
**Tareas**
1. Indicadores: esperanza de vida, mortalidad infantil, personal, camas, listas de espera.
2. Modelos: público universal, mixto y privado; copago.
3. Personal sanitario: formación (enlazada con educación en la Fase 14) y emigración.
4. Epidemias básicas con contagio entre países.
5. Acciones: contratar personal, vacunación, campañas de prevención.
6. **Audiovisual:** iconos sanitarios, animación de la propagación de epidemias en el mapa y sonidos de alerta sanitaria.

**Tests:** recortar el gasto sanitario empeora las listas de espera en meses y la esperanza de vida en años.
**Prueba en el móvil:** recortar sanidad un 20 % y observar los avisos del asesor.
**Hecho cuando:** la sanidad responde al gasto y a las decisiones con retrasos realistas.

#### Fase 14 — v0.15.0 · Educación
**Objetivo:** sistema educativo (6.12).
**Depende de:** Fase 13.
**Tareas**
1. Niveles educativos, escolarización, abandono, calidad y universitarios.
2. Profesorado, becas, tasas.
3. Efectos con retraso en productividad, paro estructural e investigadores.
4. Acciones del Ministerio de Educación.
5. **Audiovisual:** iconos de los niveles educativos y gráficos que muestren los efectos con retraso.

**Tests:** más gasto en educación mejora la productividad a 10–15 años, no antes.
**Prueba en el móvil:** comparar la calidad educativa de varios países en una capa del mapa.
**Hecho cuando:** la educación alimenta la economía a largo plazo.

#### Fase 15 — v0.16.0 · Infraestructuras: base y cola de obras
**Objetivo:** construir y mantener infraestructuras por región (6.5).
**Depende de:** Fase 14.
**Tareas**
1. Modelo genérico de infraestructura: tipo, capacidad, estado, coste, plazo, mantenimiento y empleo.
2. Infraestructuras iniciales de 2010 estimadas por región (hospitales, colegios, universidades, prisiones, comisarías).
3. Cola de obras por ministerio, prioridades, retrasos por falta de presupuesto o corrupción.
4. Degradación sin mantenimiento.
5. Pantalla **Infraestructuras** y capa del mapa.
6. **Audiovisual:** iconos de cada tipo de infraestructura, animación de la obra en curso y de la inauguración, y sonidos de construcción. Propuesta de 3D: maquetas sencillas de edificios en la ficha de región.

**Tests:** una obra sin presupuesto se retrasa; una infraestructura sin mantenimiento pierde capacidad.
**Prueba en el móvil:** construir un hospital en una región y seguirlo hasta su inauguración.
**Hecho cuando:** las obras se construyen, cuestan y afectan a los indicadores regionales.

#### Fase 16 — v0.17.0 · Transporte y logística
**Objetivo:** redes de transporte.
**Depende de:** Fase 15.
**Tareas**
1. Carreteras, autopistas, ferrocarril convencional y alta velocidad, metro, puertos y aeropuertos por región.
2. Índice de conectividad regional que afecta a la productividad, el turismo y el comercio.
3. Conexiones entre regiones y con otros países (preparado para logística militar).
4. Capa del mapa de transporte.
5. **Audiovisual:** trazado de las redes de transporte en el mapa con animación del tráfico e iconos de cada medio.

**Tests:** mejorar la conectividad de una región aumenta su producción.
**Prueba en el móvil:** ver la red de alta velocidad de España en 2010 en la capa de transporte.
**Hecho cuando:** el transporte influye en la economía regional.

#### Fase 17 — v0.18.0 · Energía y red eléctrica
**Objetivo:** sistema energético completo (6.6).
**Depende de:** Fase 16.
**Tareas**
1. Centrales por tipo y región con capacidad y factor de carga (datos de 2010).
2. Demanda eléctrica por sectores y hogares.
3. Red de transporte entre regiones e interconexiones internacionales.
4. Precios mayorista y minorista; apagones.
5. Combustibles: petróleo y gas producidos o importados, gasoductos, gas natural licuado, reservas estratégicas.
6. Pantalla **Energía** (mix, demanda, red, precios) y capa del mapa.
7. Acciones del Ministerio de Energía.
8. **Audiovisual:** iconos de las centrales por tipo, animación del flujo eléctrico en la red y efecto visual y sonoro de los apagones. Propuesta de 3D: maqueta de cada tipo de central.

**Tests:** cerrar centrales sin reponer capacidad provoca subida de precios y apagones.
**Prueba en el móvil:** cerrar todas las nucleares y observar el resultado en un año.
**Hecho cuando:** la energía limita y encarece la economía de forma realista.

#### Fase 18 — v0.19.0 · Telecomunicaciones, vivienda y agua
**Objetivo:** completar los servicios básicos.
**Depende de:** Fase 17.
**Tareas**
1. Telecomunicaciones (6.7): fibra, 3G/4G, centros de datos, ciberseguridad, control de internet.
2. Vivienda: precio, vivienda pública, regulación del alquiler, sinhogarismo.
3. Agua: presas, depuradoras, desaladoras, regadíos, estrés hídrico.
4. **Audiovisual:** iconos de telecomunicaciones, vivienda y agua, y animación del despliegue de cobertura en el mapa.

**Tests:** más cobertura de banda ancha mejora la productividad de los servicios.
**Prueba en el móvil:** desplegar fibra en una región y comprobar el efecto.
**Hecho cuando:** todos los ministerios de servicios tienen contenido real.

> 🎮 **HITO ALFA 2:** el país completo funciona por dentro: servicios, obras, transporte y energía.

---

### ETAPA D · Alfa 3: economía real y mundo conectado

#### Fase 19 — v0.20.0 · Recursos naturales y precios mundiales
**Objetivo:** recursos con reservas, producción y mercado mundial (6.8).
**Depende de:** Fase 18.
**Tareas**
1. Reservas y producción por país y región (datos de 2010).
2. Agotamiento, exploración y descubrimientos.
3. Precios mundiales por oferta y demanda, con volatilidad.
4. Acciones: licencias, regalías, nacionalización, prohibición de exportar, reservas estratégicas.
5. Capa de recursos en el mapa.
6. **Audiovisual:** iconos de los 18 recursos, gráfico de precios mundiales en movimiento y animación de los descubrimientos.

**Tests:** cortar la producción de un gran exportador sube el precio mundial.
**Prueba en el móvil:** como Arabia Saudí, reducir la producción de petróleo y ver el precio.
**Hecho cuando:** los recursos generan ingresos y dependencias reales.

#### Fase 20 — v0.21.0 · Sectores productivos e industria
**Objetivo:** economía dividida en unos 28 sectores (6.9).
**Depende de:** Fase 19.
**Tareas**
1. Sectores con producción, empleo, salarios, productividad e inversión.
2. Insumos entre sectores (tabla simplificada) y de recursos y energía.
3. Subvenciones y planes industriales por sector.
4. Pantalla de sectores dentro de **Economía**.
5. **Audiovisual:** iconos de los 28 sectores y diagrama animado de los insumos entre sectores.

**Tests:** una subida del petróleo encarece la energía, frena la industria y beneficia a los productores.
**Prueba en el móvil:** lanzar un plan para el sector automoción y seguir su empleo.
**Hecho cuando:** el PIB es la suma de sectores interconectados.

#### Fase 21 — v0.22.0 · Empresas
**Objetivo:** empresas agregadas, públicas y privadas.
**Depende de:** Fase 20.
**Tareas**
1. Empresas agregadas por sector y país (públicas y privadas).
2. Nacionalizar, privatizar, rescatar, crear empresas públicas.
3. Inversión extranjera directa y deslocalización.
4. Autorizar o bloquear fusiones (básico).
5. **Audiovisual:** emblemas genéricos de empresas por sector (sin logotipos reales) y animación de nacionalizaciones y privatizaciones.

**Tests:** subir mucho los impuestos de sociedades provoca deslocalización.
**Prueba en el móvil:** nacionalizar el sector eléctrico y ver el impacto en presupuesto y precios.
**Hecho cuando:** las empresas responden al entorno y al gobierno.

#### Fase 22 — v0.23.0 · Comercio internacional
**Objetivo:** flujos comerciales entre países (6.10).
**Depende de:** Fase 21.
**Tareas**
1. Matriz de comercio bilateral inicial (datos de 2010 o modelo de gravedad).
2. Evolución según demanda, precios, distancia, aranceles y relaciones.
3. Aranceles por categoría, cuotas, subvenciones a la exportación.
4. Tratados de libre comercio y uniones aduaneras.
5. Embargos y sanciones.
6. Pantalla **Comercio** con socios principales y dependencias.
7. **Audiovisual:** líneas animadas de los flujos comerciales en el mapa e iconos de los bienes.

**Tests:** sancionar a un socio reduce el comercio de ambos.
**Prueba en el móvil:** poner aranceles a China y ver precios, exportaciones y reacción.
**Hecho cuando:** el comercio conecta las economías del mundo.

#### Fase 23 — v0.24.0 · Diplomacia y relaciones
**Objetivo:** relaciones entre países (6.19).
**Depende de:** Fase 22.
**Tareas**
1. Relaciones bilaterales iniciales de 2010 (afinidad, alianzas, conflictos conocidos).
2. Acciones: embajadas, visitas, cumbres, tratados, ayuda, préstamos, sanciones, expulsiones, reconocimiento de Estados.
3. Imagen internacional.
4. Pantalla **Diplomacia** y capa de relaciones en el mapa.
5. **Audiovisual:** iconos de las acciones diplomáticas, animación de los cambios de relación, escenas ilustradas de visitas y cumbres, y sonidos de firma de tratados.

**Tests:** acciones hostiles bajan las relaciones y los aliados del afectado reaccionan.
**Prueba en el móvil:** mejorar relaciones con un país mediante visitas y un tratado.
**Hecho cuando:** la diplomacia tiene consecuencias económicas y políticas.

#### Fase 24 — v0.25.0 · Organizaciones internacionales
**Objetivo:** el orden internacional de 2010.
**Depende de:** Fase 23.
**Tareas**
1. ONU (Asamblea y Consejo de Seguridad con veto), UE, OTAN, OTSC, UA, ASEAN, Mercosur, OEA, Liga Árabe, OPEP, OCS, G8, G20, BRIC, FMI, Banco Mundial y OMC con sus miembros de 2010.
2. Votaciones, adhesiones, salidas y expulsiones.
3. Beneficios y obligaciones (fondos de la UE, defensa colectiva, cuotas de la OPEP, normas de la OMC).
4. Capa de alianzas en el mapa.
5. **Audiovisual:** emblemas de las organizaciones (los oficiales cuando su licencia lo permita; si no, versiones propias) y sala de votación animada. Propuesta de 3D: sala del Consejo de Seguridad.

**Tests:** solicitar la entrada en la UE comprueba requisitos y requiere unanimidad.
**Prueba en el móvil:** proponer sanciones en el Consejo de Seguridad y ver el veto.
**Hecho cuando:** las organizaciones influyen en las decisiones de los países.

> 🎮 **HITO ALFA 3:** el mundo está conectado por la economía, el comercio y la diplomacia.

---

### ETAPA E · Beta 1: política

#### Fase 25 — v0.26.0 · Sociedad y grupos sociales
**Objetivo:** la población opina según sus intereses (6.14).
**Depende de:** Fase 24.
**Tareas**
1. Grupos sociales con tamaño estimado por país, prioridades e ideología media.
2. Satisfacción de cada grupo calculada a partir de todos los sistemas anteriores.
3. Temas de preocupación con peso cambiante.
4. Popularidad del gobierno y del líder; valoración de ministros.
5. Pantalla **Sociedad** con grupos y temas.
6. **Audiovisual:** iconos de los 17 grupos sociales y gráficos animados de satisfacción y de temas de preocupación.

**Tests:** una reforma impopular baja la satisfacción de los grupos afectados y no la de los demás.
**Prueba en el móvil:** subir el salario mínimo y ver qué grupos mejoran y cuáles empeoran.
**Hecho cuando:** cada decisión tiene ganadores y perdedores visibles.

#### Fase 26 — v0.27.0 · Medios, protestas y estabilidad
**Objetivo:** reacción social activa.
**Depende de:** Fase 25.
**Tareas**
1. Medios de comunicación: libertad de prensa, medios públicos y privados, propaganda.
2. Manifestaciones, huelgas (ampliación de la Fase 12), disturbios y revueltas.
3. Gestión: diálogo, concesiones, policía, represión, con consecuencias.
4. Estabilidad del régimen (6.14).
5. **Audiovisual:** portadas de prensa y cabeceras de televisión generadas, animación de las protestas en el mapa y ambiente sonoro sintetizado de manifestación.

**Tests:** baja satisfacción prolongada desencadena protestas; la represión baja la imagen internacional.
**Prueba en el móvil:** provocar una huelga general y negociar su fin.
**Hecho cuando:** la sociedad puede presionar al gobierno.

#### Fase 27 — v0.28.0 · Partidos y personajes
**Objetivo:** partidos y políticos (6.15).
**Depende de:** Fase 26.
**Tareas**
1. Ideología en 4 ejes.
2. Partidos reales de 2010 en unos 40 países (datos con fuente) y plantilla genérica para el resto.
3. Líderes y personajes con carisma, competencia, edad, ideología, escándalos.
4. Fundar, fusionar, dividir e ilegalizar partidos.
5. Pantalla **Partidos**.
6. **Audiovisual:** emblemas de los partidos a partir de su color y sus siglas (sin logotipos registrados), retratos genéricos de los líderes y brújula ideológica animada.

**Tests:** todos los países tienen al menos un partido o fuerza política coherente con su régimen.
**Prueba en el móvil:** revisar los partidos de España, Reino Unido y Alemania en 2010.
**Hecho cuando:** el panorama político de 2010 es reconocible.

#### Fase 28 — v0.29.0 · Parlamento y votaciones
**Objetivo:** el parlamento decide.
**Depende de:** Fase 27.
**Tareas**
1. Una o dos cámaras con escaños de 2010.
2. Votación de leyes y presupuestos: disciplina de partido, ideología, presión y acuerdos.
3. Negociación de apoyos (concesiones, inversiones regionales, cargos).
4. Coaliciones y gobiernos en minoría.
5. Moción de censura, cuestión de confianza y disolución.
6. Pantalla **Parlamento** con hemiciclo.
7. **Audiovisual:** hemiciclo animado con la votación escaño a escaño y sonidos de la votación. Propuesta de 3D: hemiciclo.

**Tests:** un gobierno en minoría no aprueba presupuestos sin apoyos.
**Prueba en el móvil:** negociar los presupuestos con un partido regional.
**Hecho cuando:** el presupuesto y las leyes dependen del parlamento.

#### Fase 29 — v0.30.0 · Elecciones y campañas
**Objetivo:** ganar o perder el poder en las urnas.
**Depende de:** Fase 28.
**Tareas**
1. Sistemas electorales: D'Hondt, Sainte-Laguë, mayoritario, dos vueltas, mixto, presidencial; barreras y circunscripciones.
2. Calendario electoral real (próximas elecciones desde 2010).
3. Modelo de voto (6.15) y encuestas semanales con margen de error.
4. Campaña: presupuesto, mítines por región, debates, promesas.
5. Noche electoral con resultados en el mapa por circunscripción.
6. Derrota del jugador al perder (de momento, fin de partida).
7. **Audiovisual:** noche electoral con recuento animado y mapa por circunscripción, sintonía y sonidos propios, y carteles de campaña generados.

**Tests:** con la misma situación, el resultado varía poco entre semillas; con una mala gestión, el gobierno pierde.
**Prueba en el móvil:** jugar hasta las elecciones generales españolas de 2011.
**Hecho cuando:** se pueden ganar y perder elecciones en España y en 3 países más de prueba.

#### Fase 30 — v0.31.0 · Leyes y constitución
**Objetivo:** catálogo de leyes (6.16).
**Depende de:** Fase 29.
**Tareas**
1. Formato de ley con opciones, efectos y reacciones.
2. Situación legal inicial de cada país en 2010 (las leyes clave, con fuente cuando se pueda).
3. Catálogo inicial de unas 60 leyes en todas las categorías.
4. Mayorías y referéndums; leyes constitucionales.
5. Gobierno por decreto en regímenes autoritarios.
6. Pantalla **Leyes** con buscador, filtros y previsión de votos.
7. **Audiovisual:** iconos de las categorías de leyes y animación de la aprobación y la derogación de una ley.

**Tests:** cada ley tiene efectos y reacciones definidos y se puede aprobar o derogar.
**Prueba en el móvil:** aprobar una reforma laboral y ver sus efectos en 6 meses.
**Hecho cuando:** las leyes cambian el país de forma visible.

#### Fase 31 — v0.32.0 · Regímenes y cambios de régimen
**Objetivo:** distintos sistemas políticos y su caída.
**Depende de:** Fase 30.
**Tareas**
1. Regímenes de 2010 (parlamentario, presidencial, monarquías, partido único, junta, teocracia) con poderes del jugador.
2. Lealtad del ejército y las élites.
3. Golpes de Estado, revoluciones y transiciones democráticas.
4. Cambio de régimen por reforma constitucional.
5. **Audiovisual:** iconos de los regímenes y secuencias ilustradas, con sonido, de golpe de Estado, revolución y transición.

**Tests:** estabilidad muy baja durante meses puede producir un golpe o una revolución.
**Prueba en el móvil:** como un régimen autoritario, reprimir protestas y vigilar la lealtad del ejército.
**Hecho cuando:** los regímenes pueden caer y transformarse.

#### Fase 32 — v0.33.0 · Regiones, autonomía y elecciones regionales
**Objetivo:** el país por dentro (6.17, parte 1).
**Depende de:** Fase 31.
**Tareas**
1. Nivel de autonomía por región y competencias transferidas.
2. Gobiernos y parlamentos regionales en países descentralizados.
3. Elecciones regionales.
4. Financiación regional y agravios.
5. Pantalla **Regiones**.
6. **Audiovisual:** banderas de las principales regiones (licencia libre, script reproducible) y mapa animado de los resultados regionales.

**Tests:** transferir competencias cambia quién gestiona el gasto y la satisfacción regional.
**Prueba en el móvil:** revisar las comunidades autónomas españolas y negociar financiación.
**Hecho cuando:** las regiones tienen vida política propia.

#### Fase 33 — v0.34.0 · Independentismo y nuevos países
**Objetivo:** secesión (6.17, parte 2).
**Depende de:** Fase 32.
**Tareas**
1. Identidad, apoyo a la independencia y apoyo exterior por región, con los movimientos de 2010.
2. Acciones del gobierno central (diálogo, referéndum, intervención de la autonomía, ilegalización, represión).
3. Referéndum pactado o unilateral; declaración unilateral; reconocimiento internacional.
4. **Creación de un país nuevo en el mapa** con su parte de población, deuda, ejército, infraestructuras, recursos y partidos.
5. Apoyar movimientos independentistas en otros países.
6. Capa de independentismo en el mapa.
7. **Audiovisual:** animación del nacimiento de un país en el mapa (nueva frontera y bandera), banderas de los movimientos de 2010 y secuencia del referéndum.

**Tests:** una independencia pactada crea un país válido y jugable; la suma de población se conserva.
**Prueba en el móvil:** autorizar un referéndum en Escocia y seguir el proceso.
**Hecho cuando:** pueden nacer países nuevos en la partida.

> 🎮 **HITO BETA 1:** el juego político completo: gobernar, negociar, ganar elecciones y gestionar el territorio.

---

### ETAPA F · Beta 2: tecnología y poder

#### Fase 34 — v0.35.0 · Importación de los árboles tecnológicos
**Objetivo:** cargar las ~2.500 tecnologías del jugador (6.18).
**Depende de:** Fase 33.
**Tareas**
1. Script que lee los `.docx` de `/fuentes/arboles/` (formato de `01_Energia.docx`) y genera JSON por rama.
2. Validación: identificadores únicos, prerrequisitos existentes, sin ciclos, costes completos; informe de errores en `/docs/tecnologias-informe.md`.
3. Asignación de efectos de juego a cada tecnología (propuesta automática por categoría, revisable por el jugador).
4. Estado inicial de 2010 por país según su nivel tecnológico.
5. **Audiovisual:** iconos de las 10 ramas y de las categorías de tecnología, generados de forma sistemática para las ~2.500 tecnologías.

**Tests:** las 10 ramas cargan sin errores; ninguna tecnología es inalcanzable.
**Prueba en el móvil:** revisar el informe y corregir los errores que señale en los documentos.
**Hecho cuando:** todo el árbol está cargado y validado.

#### Fase 35 — v0.36.0 · Investigación y efectos
**Objetivo:** investigar y notar los resultados.
**Depende de:** Fase 34.
**Tareas**
1. Puntos de investigación por rama (I+D público y privado, investigadores, centros, universidades).
2. Cola de proyectos y prioridades; consumo de dinero, personal, recursos e instalaciones.
3. Difusión, licencias y cooperación.
4. Aplicación de efectos (desbloqueos y mejoras).
5. Pantalla **Investigación** con árbol navegable y zoom.
6. **Audiovisual:** árbol tecnológico navegable y animado, y efecto visual y sonoro al completar una tecnología. Propuesta de 3D: maquetas de las tecnologías más destacadas.

**Tests:** cada tecnología investigada aplica sus efectos; sin las instalaciones necesarias no se puede investigar.
**Prueba en el móvil:** investigar una tecnología energética y ver el efecto en el mix.
**Hecho cuando:** la tecnología transforma la economía y desbloquea contenido.

#### Fase 36 — v0.37.0 · Fuerzas armadas y equipamiento
**Objetivo:** ejércitos de 2010 (6.20, parte 1).
**Depende de:** Fase 35.
**Tareas**
1. Efectivos, presupuesto, preparación, moral y experiencia por país (datos reales y estimaciones).
2. Catálogo de equipamiento por tipo y generación tecnológica.
3. Compra a otros países y fabricación propia (industria de defensa y tecnología).
4. Reclutamiento: profesional, servicio obligatorio, reservistas.
5. Pantalla **Ejército**.
6. **Audiovisual:** siluetas vectoriales del equipamiento por tipo y generación e insignias de cada rama de las fuerzas armadas. Propuesta de 3D: modelos del equipamiento en su ficha.

**Tests:** la potencia militar inicial ordena a los países de forma creíble (EE. UU., Rusia, China en cabeza).
**Prueba en el móvil:** comprar aviones a un aliado y ver el coste y el plazo.
**Hecho cuando:** cada país tiene un ejército gestionable.

#### Fase 37 — v0.38.0 · Unidades en el mapa, bases y logística
**Objetivo:** fuerzas visibles y desplegables.
**Depende de:** Fase 36.
**Tareas**
1. Agrupaciones (brigadas o divisiones, flotas, escuadrones) en el mapa.
2. Movimiento por regiones, rutas marítimas y aéreas.
3. Bases propias y en el extranjero por acuerdo.
4. Suministro y logística según el transporte (Fase 16).
5. Capa militar del mapa.
6. **Audiovisual:** símbolos militares estándar de las unidades, animación de movimientos y rutas en el mapa y sonidos de despliegue.

**Tests:** una unidad sin suministro pierde preparación.
**Prueba en el móvil:** desplegar una flota y mover tropas entre regiones.
**Hecho cuando:** las fuerzas se mueven por el mapa con lógica.

#### Fase 38 — v0.39.0 · Guerra y combate
**Objetivo:** conflictos armados (6.20, parte 2).
**Depende de:** Fase 37.
**Tareas**
1. Causas de guerra y declaración (parlamento, opinión pública, ONU, alianzas).
2. Combate por región: modelo tipo Lanchester con terreno, tecnología, aire, suministro y moral.
3. Bombardeos e impacto en infraestructuras y población.
4. Guerras en curso en 2010 (Afganistán, Irak) representadas.
5. Pantalla de guerra con frentes y bajas.
6. **Audiovisual:** animaciones de combate y de bombardeo en el mapa, líneas de frente, sonido de combate sintetizado y pantalla de guerra. Propuesta de 3D: vista de un combate.

**Tests:** el bando superior gana con más frecuencia, pero no siempre.
**Prueba en el móvil:** iniciar un conflicto limitado y seguirlo en el mapa.
**Hecho cuando:** se puede librar una guerra completa.

#### Fase 39 — v0.40.0 · Ocupación, insurgencia y paz
**Objetivo:** cerrar los conflictos.
**Depende de:** Fase 38.
**Tareas**
1. Ocupación de regiones, resistencia e insurgencia.
2. Alto el fuego, armisticio, negociación y tratados de paz (anexión, retirada, reparaciones, cambio de régimen, independencia).
3. Refugiados y reconstrucción.
4. Cambio de fronteras en el mapa.
5. **Audiovisual:** animación del cambio de fronteras, escena ilustrada de la firma de la paz y flujos de refugiados en el mapa.

**Tests:** un tratado de paz con anexión mueve la región al nuevo país y conserva sus datos.
**Prueba en el móvil:** firmar una paz con cesión territorial.
**Hecho cuando:** las guerras terminan y cambian el mapa.

#### Fase 40 — v0.41.0 · Interior, justicia, corrupción y terrorismo
**Objetivo:** seguridad interior (6.21).
**Depende de:** Fase 39.
**Tareas**
1. Criminalidad, policía, prisiones.
2. Corrupción: pérdidas de gasto, escándalos, lucha anticorrupción.
3. Independencia judicial.
4. Grupos terroristas activos en 2010 y atentados.
5. Acciones de Interior y Justicia.
6. **Audiovisual:** iconos de seguridad y justicia, y tratamiento visual y sonoro sobrio de atentados y escándalos.

**Tests:** más corrupción reduce la eficacia del gasto en todos los ministerios.
**Prueba en el móvil:** lanzar un plan anticorrupción y ver los escándalos que destapa.
**Hecho cuando:** la seguridad interior influye en la política y la economía.

#### Fase 41 — v0.42.0 · Medio ambiente, clima y desastres
**Objetivo:** el planeta reacciona (6.22).
**Depende de:** Fase 40.
**Tareas**
1. Emisiones por sector y país; contaminación local y su efecto en la salud.
2. Clima global simplificado.
3. Desastres naturales con probabilidades según la geografía real.
4. Ayuda internacional y acuerdos climáticos.
5. Capa ambiental del mapa.
6. **Audiovisual:** animaciones de cada tipo de desastre en el mapa, capa de temperatura global y sonidos de desastre. Propuesta de 3D: efectos de los desastres.

**Tests:** más emisiones globales aumentan con los años la frecuencia de desastres climáticos.
**Prueba en el móvil:** sufrir un desastre y gestionar la reconstrucción.
**Hecho cuando:** el medio ambiente es un factor más del juego.

> 🎮 **HITO BETA 2:** todos los sistemas del GDD existen.

---

### ETAPA G · Beta 3: mundo vivo

#### Fase 42 — v0.43.0 · IA de países: política interior
**Objetivo:** los países no jugadores se gobiernan solos (6.24).
**Depende de:** Fase 41.
**Tareas**
1. Personalidad de cada país (régimen, ideología, historia).
2. Decisiones mensuales: presupuesto, impuestos, leyes coherentes con su gobierno, obras, energía.
3. Reacción a crisis (paro, deuda, protestas).
4. **Audiovisual:** resumen visual de las decisiones de cada gobierno e iconos de las personalidades de los países.

**Tests:** 10 años sin jugador: ningún país entra en bancarrota absurda ni hace cambios incoherentes con su ideología.
**Prueba en el móvil:** observar cómo gestiona Francia una crisis.
**Hecho cuando:** los países no jugadores se gobiernan de forma creíble.

#### Fase 43 — v0.44.0 · IA de países: exterior y militar
**Objetivo:** los países actúan en el mundo.
**Depende de:** Fase 42.
**Tareas**
1. Diplomacia, comercio y tratados según intereses.
2. Reacción a las acciones del jugador.
3. Decisiones militares: rearme, alianzas, intervenciones y guerras con motivo, capacidad y apoyo.
4. Uso de las organizaciones internacionales.
5. **Audiovisual:** animaciones en el mapa de las reacciones diplomáticas y de los movimientos militares de los demás países.

**Tests:** la IA no declara guerras sin motivo ni capacidad; responde a amenazas.
**Prueba en el móvil:** amenazar a un vecino y ver la reacción de sus aliados.
**Hecho cuando:** el mundo responde con lógica al jugador.

#### Fase 44 — v0.45.0 · Eventos aleatorios y noticias
**Objetivo:** imprevistos (6.23).
**Depende de:** Fase 43.
**Tareas**
1. Motor de eventos: condiciones, probabilidad, opciones y efectos.
2. Catálogo inicial de unos 100 eventos.
3. Teletipo de noticias mundial filtrable.
4. **Audiovisual:** ilustración o icono propio para cada evento del catálogo, teletipo animado, sintonía de noticias y sonidos según la gravedad.

**Tests:** cada evento se puede disparar en pruebas y sus opciones aplican efectos.
**Prueba en el móvil:** jugar un año y responder a varios eventos.
**Hecho cuando:** las partidas tienen sorpresas variadas.

#### Fase 45 — v0.46.0 · Eventos históricos de 2010 en adelante
**Objetivo:** historia opcional.
**Depende de:** Fase 44.
**Tareas**
1. Eventos históricos condicionados: rescates del euro, Primavera Árabe, Fukushima, Sudán del Sur, Crimea, etc.
2. Opción de activarlos o desactivarlos al crear la partida.
3. Tests de credibilidad 2010–2015 frente al histórico real.
4. **Audiovisual:** ilustraciones propias de los eventos históricos (sin fotografías reales) y secuencias especiales para los más importantes.

**Tests:** con eventos activados y sin jugador, 2010–2015 se parece a la realidad en las grandes cifras.
**Prueba en el móvil:** jugar con y sin eventos históricos y comparar.
**Hecho cuando:** el modo histórico funciona sin forzar resultados.

#### Fase 46 — v0.47.0 · Estadísticas, informes y comparador
**Objetivo:** entender lo que pasa.
**Depende de:** Fase 45.
**Tareas**
1. Comparador de países con gráficos.
2. Clasificaciones mundiales (PIB, potencia militar, felicidad, tecnología…).
3. Informe anual del país.
4. Historial de la partida (línea de tiempo con hechos clave).
5. **Audiovisual:** gráficos comparativos animados, línea de tiempo ilustrada de la partida y opción de guardar un gráfico como imagen.

**Prueba en el móvil:** comparar España con Italia en 10 indicadores.
**Hecho cuando:** el jugador puede analizar el mundo con facilidad.

> 🎮 **HITO BETA 3:** el mundo está vivo; el juego está completo en contenido base.

---

### ETAPA H · Versión candidata

#### Fase 47 — v0.48.0 · Tutorial y ayuda
1. Tutorial interactivo por pasos.
2. Tooltips en todos los indicadores ("qué es" y "qué lo afecta").
3. Enciclopedia del juego.
4. **Audiovisual:** animaciones guiadas y resaltados del tutorial e ilustraciones de la enciclopedia.
**Hecho cuando:** un jugador nuevo entiende lo básico en 15 minutos.

#### Fase 48 — v0.49.0 · Equilibrado
1. Partidas automáticas de 20 años con distintas semillas.
2. Ajuste de parámetros en `/src/sim/config/`.
3. Niveles de dificultad.
4. Revisión de todos los "Hecho cuando" anteriores.
5. **Audiovisual:** mezcla y niveles de sonido, ritmo de las animaciones y revisión de la coherencia visual de todo el juego.
**Hecho cuando:** ningún país diverge de forma absurda y la dificultad se nota.

#### Fase 49 — v0.50.0 · Rendimiento, accesibilidad e instalación
1. Optimización para móviles de gama media.
2. **PWA:** instalable en el móvil como una app y jugable sin conexión.
3. Accesibilidad (contraste, tamaño de texto, lectores de pantalla en menús).
4. **Audiovisual:** optimización del peso y de la carga de los recursos audiovisuales, modo sin animaciones, alternativa visual para todo sonido e iconos y pantalla de arranque de la app instalada.
**Hecho cuando:** se instala en el móvil y una partida de 10 años va fluida.

#### Fase 50 — v0.51.0 · Contenido completo
1. Ampliar a unas 150 leyes.
2. Partidos reales en más países.
3. Más eventos y revisión de textos.
4. **Audiovisual:** completar los iconos, ilustraciones y sonidos que falten, música ambiental según la situación (paz, crisis, guerra) y pantalla de créditos.
**Hecho cuando:** se cumplen los objetivos de contenido del GDD.

### v1.0.0 · Lanzamiento
**Lista de comprobación:** todos los tests en verde · partida completa con 5 países distintos sin errores · Hoja de ruta y CHANGELOG al día · guardados compatibles · tutorial completo · contenido audiovisual completo y créditos al día.

---

### ETAPA I · Ampliaciones después de la 1.0 (orden orientativo)

| Versión | Contenido |
|---|---|
| v1.1 | Grandes empresas reales con nombre (2010) y mercado bursátil por empresa |
| v1.2 | Oposición jugable: liderar un partido, ganar elecciones, mociones, movilizaciones |
| v1.3 | Servicios de inteligencia: espionaje, contraespionaje, operaciones encubiertas |
| v1.4 | Ciberguerra y robo de tecnología |
| v1.5 | Armas nucleares completas: doctrina, disuasión, ataque, invierno nuclear |
| v1.6 | Espacio: satélites, estaciones, base lunar y más allá (según la rama Espacio) |
| v1.7 | Multinacionales jugables (rol de empresario) |
| v1.8 | Escenarios con objetivos y desafíos |
| v1.9 | Editor y soporte de mods |
| v1.10 | Más idiomas |
| v2.0 | Multijugador (requiere servidor; ver decisiones abiertas) |

---

## 10. Web de la Hoja de ruta y comunicación entre webs

**Dos webs independientes en el mismo repositorio:**
- Juego: `https://<usuario>.github.io/<repo>/`
- Hoja de ruta: `https://<usuario>.github.io/<repo>/hoja-de-ruta/`

**Hoja de ruta**
- Desplegables por fase, con versión, objetivo, porcentaje completado y "Hecho cuando".
- Cada tarea con estado (**pendiente / en curso / hecha**), fecha y enlace al cambio (commit o PR).
- **Historial de versiones** (changelog) con lo nuevo en cada versión.
- Se **refresca sola** cada pocos minutos leyendo `roadmap.json`.
- Botón "Jugar esta versión".

**Comunicación**
- Las dos webs leen `roadmap.json` y muestran la misma versión actual.
- Si están abiertas en el mismo navegador, se avisan al instante (BroadcastChannel) de eventos como "nueva versión disponible".
- El juego tiene un botón "Reportar fallo / sugerencia" que abre una *issue* de GitHub con versión, fecha de la partida, país y descripción. Claude Code revisa las *issues* al empezar cada sesión, las añade a la Hoja de ruta y las resuelve.

**Formato de `roadmap.json`**
```json
{
  "versionActual": "0.1.0",
  "actualizado": "2026-11-11T15:00:00Z",
  "faseActiva": "fase-0",
  "ultimaSesion": {
    "fecha": "2026-11-11",
    "resumen": "Creado el proyecto y la publicación automática.",
    "siguientePaso": "Terminar la web de la Hoja de ruta (tarea f0-t6).",
    "pendienteDelJugador": ["Cambiar Settings → Pages → Source a GitHub Actions"]
  },
  "etapas": [
    { "id": "A", "nombre": "Prealfa: cimientos y mundo", "hito": null },
    { "id": "B", "nombre": "Alfa 1: el país funciona", "hito": "Primera versión jugable" }
  ],
  "fases": [
    {
      "id": "fase-0",
      "etapa": "A",
      "version": "0.1.0",
      "nombre": "Cimientos del proyecto",
      "objetivo": "Proyecto creado, publicado y con la Hoja de ruta funcionando",
      "dependeDe": [],
      "hechoCuando": "La publicación automática funciona y las dos webs muestran la misma versión",
      "pruebaJugador": "Abrir la web, entrar en la Hoja de ruta y enviar una issue de prueba",
      "estado": "en-curso",
      "tareas": [
        { "id": "f0-t1", "titulo": "Proyecto Vite + TypeScript + Vitest", "estado": "hecha", "fecha": "2026-11-11", "enlace": "" },
        { "id": "f0-t5", "titulo": "Publicación con GitHub Actions", "estado": "en-curso", "fecha": "2026-11-11", "enlace": "" }
      ]
    }
  ],
  "ideasPendientes": [
    { "id": "idea-1", "titulo": "Ejemplo: modo de juego histórico", "origen": "issue #3", "faseAsignada": null }
  ],
  "historial": [
    { "version": "0.1.0", "fecha": "2026-11-11", "cambios": ["Primera versión pública"] }
  ]
}
```

**Notas del formato** (el esquema completo está en `roadmap.schema.json`):
- Estados posibles de fases y tareas: `pendiente`, `en-curso` y `hecha`.
- En una tarea pendiente, `fecha` es `null` y `enlace` es `""`.
- El lanzamiento (`lanzamiento`, v1.0.0) figura como una fase más de la etapa H, con su lista de comprobación como tareas. Las ampliaciones de la etapa I figuran como fases (`v1-1` … `v2-0`) sin tareas hasta que se detallen.
- `versionActual` debe coincidir con la versión de `package.json` (única fuente de la versión).

La Hoja de ruta muestra también el bloque **"Última sesión"** (qué se hizo, siguiente paso y qué tiene pendiente el jugador) y la lista de **ideas pendientes** aún sin fase asignada.

---

## 11. Reglas de trabajo para Claude Code (copiar a `CLAUDE.md`)

1. **Leer al empezar:** `CLAUDE.md`, `docs/GDD.md`, `roadmap.json` y las *issues* abiertas.
2. **Idioma:** código, comentarios, textos, commits y documentación en español (los nombres de variables pueden ir en español sin tildes).
3. **Orden:** trabajar solo en la fase activa de `roadmap.json`, en tareas pequeñas.
4. **Hoja de ruta siempre al día:** marcar la tarea "en curso" al empezar y "hecha" al terminar, con fecha y enlace; añadir al historial lo nuevo de cada versión.
5. **Motor puro y probado:** toda la lógica de simulación en `/src/sim`, sin dependencias de la interfaz, con tests en Vitest. No se fusiona nada con tests en rojo.
6. **Parámetros fuera del código:** constantes de equilibrado en `/src/sim/config/*.json`.
7. **Datos reproducibles:** todo dato real procede de un script en `/scripts` que indica fuente y año; los datos estimados se marcan.
8. **Pensado para móvil:** probar cada pantalla a 360 px de ancho y con controles táctiles.
9. **Compatibilidad de partidas:** si cambia el formato de guardado, incluir migración.
10. **Versiones:** subir la versión (semver) al cerrar cada fase y actualizar `versionActual`.
11. **Dudas de diseño:** si algo no está en el GDD, proponer opciones al jugador en lugar de inventar; anotar la decisión en el GDD.
12. **No romper el GDD:** cualquier cambio de diseño se refleja también en `docs/GDD.md` y en el registro de cambios de diseño (sección 12).
13. **Guardar el trabajo a menudo:** hacer commit y push al terminar **cada tarea**, sin acumular cambios. Si la sesión se detiene (límite de uso, inactividad o cierre), lo subido a GitHub no se pierde.
14. **Dejar la sesión lista para retomar:** al terminar cada tarea, actualizar `ultimaSesion` en `roadmap.json` (qué se hizo, siguiente paso y qué tiene pendiente el jugador). Al empezar una sesión nueva o retomar una, leer ese bloque y continuar desde ahí.
15. **Una fase, una rama y un PR:** trabajar cada fase en su rama. Al cerrarla, abrir el PR con un resumen en español de lo nuevo y la "Prueba en el móvil" para que el jugador sepa qué comprobar.
16. **Peticiones nuevas del jugador:** toda idea o corrección (mensaje o *issue*) se añade a `roadmap.json`: a la fase activa si es pequeña o un fallo; a la fase que corresponda si es un sistema; o a `ideasPendientes` si no encaja. Avisar al jugador de dónde ha ido.
17. **Prioridad de los fallos:** un fallo que rompa el juego publicado se corrige antes que cualquier tarea nueva.
18. **Limitaciones de red:** si el entorno no puede acceder a una fuente de datos, explicarlo al jugador y proponer una alternativa; no inventar datos haciéndolos pasar por reales.
19. **Audiovisual en cada fase:** cada fase entrega su contenido audiovisual (gráficos, animación, sonido y, si procede, 3D) según la sección 7.1. Se crea con código o con material de licencia libre anotado en `/docs/creditos.md`; nunca se usa material sin licencia clara. El 3D se propone al jugador en el plan de la fase y siempre tiene alternativa en 2D.

---

## 12. Añadir contenido y cambios durante el desarrollo

El GDD es un **documento vivo**: el jugador puede añadir, quitar o corregir cualquier cosa en cualquier momento.

**Formas de pedir cambios**
1. **En la sesión abierta de Code:** escribir el cambio aunque Claude esté trabajando; el mensaje queda en cola hasta que lo lea.
2. **En una sesión nueva:** para trabajos independientes (p. ej. "revisa los partidos de Italia"). Puede haber varias sesiones a la vez.
3. **Con una *issue*:** desde el botón del juego o desde GitHub, con las etiquetas `fallo`, `idea` o `datos`. Claude las revisa al empezar cada sesión.
4. **Editando el GDD:** el jugador cambia `docs/GDD.md` y avisa a Claude para que adapte el código y la Hoja de ruta.

**Registro de cambios de diseño**

| Fecha | Cambio | Motivo | Secciones afectadas |
|---|---|---|---|
| 11/11/2026 | GDD v1.0 inicial | — | Todas |
| 11/11/2026 | Hoja de ruta ampliada a 51 fases en 9 etapas | Más detalle y orden | 9, 10, 11 |
| 11/11/2026 | Precisado el formato de `roadmap.json`: estados, `fecha` nula en tareas pendientes, lanzamiento y ampliaciones como fases, versión ligada a `package.json` | Necesario para validar el archivo con un esquema (Fase 0) | 10 |
| 11/11/2026 | Contenido audiovisual en todas las fases: nueva sección 7.1, tarea «Audiovisual» en las fases 1–50, 3D permitido en componentes complementarios (el mapa sigue en 2D) y regla 19 | Petición del jugador | 1, 2, 7, 9, 11, 13 |

---

## 13. Decisiones abiertas

| Tema | Opciones | Propuesta |
|---|---|---|
| Nombre del juego | Libre | Pendiente del jugador |
| Ramas tecnológicas | ¿Agricultura y Medio Ambiente son una o dos? | Dos, para llegar a 10 |
| Países con partidos reales | 20 / 40 / todos | 40 en la v1.0 y ampliar después |
| Eventos históricos | Activados o desactivados por defecto | Activados, con probabilidad |
| Velocidad ×1 | 1 día = 1 / 2 / 3 s | 2 s |
| Derrota al perder elecciones | Fin de partida / seguir como oposición | Fin de partida hasta la v1.2 |
| Multijugador | No / por turnos / tiempo real | No hasta la v2.0 (requiere servidor y coste) |
| Dificultad | Fácil / Normal / Realista | Las tres, cambiando la tolerancia de votantes, mercados e IA |
| Proyección del mapa | Robinson / Equal Earth / Mercator | Equal Earth (proporciones reales, aspecto de mapa político) |
| Unidad de tiempo visible | 1 día (sección 5) / reloj por horas del día, como en Power & Revolution | Petición del jugador (issue n.º 3): reloj por horas, manteniendo los ritmos diario, semanal, mensual y anual de la simulación. Concretar velocidades al planificar la Fase 5 |
| Uso del 3D | Ninguno / solo componentes complementarios / también el mapa | Solo componentes complementarios, confirmados fase a fase; el mapa sigue en 2D |
| Sonido al abrir el juego | Activado / desactivado por defecto | Activado tras el primer toque, con botón de silencio visible |
| Música, voces y fotografías | Solo material generado con código / también archivos aportados por el jugador | Generado con código; el jugador puede aportar archivos en `/fuentes/av/` |
| Territorios especiales jugables | Todos / solo los que tienen datos / ninguno | Jugables Kosovo, Taiwán y Palestina (tienen datos reales); los demás, no, hasta tener datos fiables |
| Territorios dependientes (Hong Kong, Groenlandia, Puerto Rico…) | Países aparte / regiones de su país soberano | No están en los datos de la Fase 1; decidir al hacer el mapa (Fases 2 y 3) |

---

## 14. Mensaje inicial para Claude Code

Copiar y enviar en la pestaña **Code**, con el repositorio seleccionado y en **modo Plan**:

```
Eres el desarrollador de mi videojuego de estrategia geopolítica. Lee completo docs/GDD.md: es el documento de diseño y la referencia principal del proyecto. Sigue sus reglas de trabajo (sección 11) desde ahora.

Tarea de esta sesión: la Fase 0 (v0.1.0 · Cimientos del proyecto) de la sección 9, nada más. En concreto:
1. Crea el proyecto (Vite + TypeScript + Vitest) con la estructura de la sección 2. Si el GDD no está en docs/GDD.md, muévelo ahí.
2. Crea CLAUDE.md con las reglas de la sección 11.
3. Crea roadmap.json con TODAS las etapas, fases y tareas de la sección 9 y el formato de la sección 10 (incluidos ultimaSesion e ideasPendientes).
4. Configura GitHub Actions para compilar, pasar los tests y publicar en GitHub Pages.
5. Crea la web independiente /hoja-de-ruta/ (sección 10): desplegables por etapa y fase, estado de cada tarea, última sesión, ideas pendientes e historial; que se refresque sola y enlace al juego.
6. Crea la pantalla de inicio del juego con la versión, el enlace a la Hoja de ruta y el botón "Reportar fallo / sugerencia" con plantillas de issue (fallo, idea, datos).

Todo en español. Haz commit y push al terminar cada tarea y mantén roadmap.json al día. Antes de programar, preséntame el plan. Al terminar, abre el PR y dime exactamente qué tengo que hacer yo (por ejemplo, el ajuste de GitHub Pages) y qué debo comprobar en el móvil.
```

**Mensaje para las siguientes sesiones** (después de cerrar cada fase):

```
Lee CLAUDE.md, docs/GDD.md, roadmap.json (sobre todo ultimaSesion) y las issues abiertas. Continúa con la fase activa siguiendo las reglas. Antes de programar, preséntame el plan.
```
