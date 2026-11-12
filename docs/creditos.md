# Créditos

> Generado por `npm run datos:construir`. No se edita a mano.

Procedencia y licencia de todo el material de terceros que usa el juego. Lo que no figura aquí
(iconos, sonidos sintetizados, interfaz, código) está hecho para el proyecto.

## Datos

| Fuente | Qué aporta | Condiciones |
| --- | --- | --- |
| [Banco Mundial, World Development Indicators](https://data.worldbank.org) | Población, PIB, paro, inflación, gasto público, sociedad | CC BY 4.0 |
| [FMI, Perspectivas de la economía mundial (WEO)](https://www.imf.org/external/datamapper) | Deuda, saldo fiscal, cuenta corriente y datos de respaldo | Reutilización con atribución, según las condiciones del FMI |
| [Our World in Data](https://ourworldindata.org) | Energía, emisiones y recursos (datos de Ember, Energy Institute, EIA, Global Carbon Project, USGS y BGS) | CC BY 4.0 para lo elaborado por OWID; los datos de terceros, según las condiciones de cada productor |
| [Wikidata](https://www.wikidata.org) | Capitales de 2010 (nombre y, si no están en Natural Earth, posición), población de las ciudades (la de 2010 o la más cercana) y población de territorios sin datos oficiales | CC0 |
| [CLDR](https://cldr.unicode.org) | Nombres de los países en español | Licencia Unicode |
| [Natural Earth](https://www.naturalearthdata.com) | Fronteras y ciudades (1:10m), tierra firme, ríos, lagos y relieve sombreado con fondo oceánico (1:50m) | Dominio público |

El detalle de cada dato (fuente y año) está en `public/data/paises-2010.json` y en el
[informe de cobertura](datos-cobertura.md).

## Banderas

Descargadas el 12/11/2026 con `scripts/datos/07-banderas.ts`.

- **211 banderas** de [flag-icons](https://github.com/lipis/flag-icons) v7.6.0, de Panayiotis Lipiridis. Licencia MIT.
- **12 banderas** de Wikimedia Commons: las que han cambiado desde 2010 y las de los territorios sin código ISO.

| País o territorio | Archivo | Licencia | Autor según Commons | Motivo |
| --- | --- | --- | --- | --- |
| Abjasia | [Flag of the Republic of Abkhazia.svg](https://commons.wikimedia.org/wiki/File:Flag_of_the_Republic_of_Abkhazia.svg) | Public domain | Drawn by User:Achim1999 | Territorio sin código ISO |
| Afganistán | [Flag of Afghanistan (2004–2013).svg](https://commons.wikimedia.org/wiki/File:Flag_of_Afghanistan_(2004%E2%80%932021,_variant).svg) | Public domain | 'Fry1989 ' | Bandera de 2004 a 2013 |
| Antillas Neerlandesas | [Flag of the Netherlands Antilles (1986–2010).svg](https://commons.wikimedia.org/wiki/File:Flag_of_the_Netherlands_Antilles_(1986%E2%80%932010).svg) | Public domain | sin indicar | Bandera de 1986 a 2010 (las Antillas se disolvieron en octubre de 2010) |
| Birmania | [Flag of Myanmar (1974–2010).svg](https://commons.wikimedia.org/wiki/File:Flag_of_Myanmar_(1974%E2%80%932010).svg) | Public domain | See File history below for details. | Bandera de 1974 a octubre de 2010 |
| Chipre del Norte | [Flag of the Turkish Republic of Northern Cyprus.svg](https://commons.wikimedia.org/wiki/File:Flag_of_the_Turkish_Republic_of_Northern_Cyprus.svg) | Public domain | See File History, below for details. | Territorio sin código ISO |
| Kirguistán | [Flag of Kyrgyzstan (1992–2023).svg](https://commons.wikimedia.org/wiki/File:Flag_of_Kyrgyzstan_(1992%E2%80%932023).svg) | Public domain | Э. Айдарбеков, Б. Жайчыбеков, С. Иптаров, Ж. Матаев, М. Сыдыков | Bandera de 1992 a 2023 |
| Libia | [Flag of Libya (1977–2011).svg](https://commons.wikimedia.org/wiki/File:Flag_of_Libya_(1977%E2%80%932011).svg) | Public domain | Zscout370 | Bandera de 1977 a 2011 |
| Mauritania | [Flag of Mauritania (1959–2017).svg](https://commons.wikimedia.org/wiki/File:Flag_of_Mauritania_(1959%E2%80%932017).svg) | Public domain | See File history for details. | Bandera de 1959 a 2017 |
| Osetia del Sur | [Flag of South Ossetia.svg](https://commons.wikimedia.org/wiki/File:Flag_of_South_Ossetia.svg) | Public domain | Various | Territorio sin código ISO |
| Siria | [Flag of Syria (1980–2024).svg](https://commons.wikimedia.org/wiki/File:Flag_of_the_United_Arab_Republic_(1958%E2%80%931971),_Flag_of_Syria_(1980%E2%80%932024).svg) | Public domain | See File history below for details. For further informations, see also: en:Syrian Arab Republic and the en:United Arab R | Bandera de 1980 a 2024 |
| Somalilandia | [Flag of Somaliland.svg](https://commons.wikimedia.org/wiki/File:Flag_of_Somaliland.svg) | Public domain | Government of Somaliland | Territorio sin código ISO |
| Transnistria | [Flag of Transnistria (state).svg](https://commons.wikimedia.org/wiki/File:Flag_of_Transnistria_(state).svg) | Public domain | See File history (below) for details. | Territorio sin código ISO |

- **Islas del Canal:** Las Islas del Canal no tienen bandera común (Jersey y Guernsey tienen la suya): se usa la del Reino Unido.

**Diferencias conocidas con 2010**

- Las banderas de flag-icons son las actuales. Se han sustituido las que cambiaron de forma visible desde 2010 (Afganistán, Kirguistán, Libia, Birmania, Mauritania y Siria) y se ha añadido la de las Antillas Neerlandesas, que dejó de usarse en 2010.
- No se han corregido cambios menores posteriores a 2010: tono del azul de Honduras (2022), escudo de Paraguay (2013) y Serbia (noviembre de 2010) y cenefa de Bielorrusia (2012).
