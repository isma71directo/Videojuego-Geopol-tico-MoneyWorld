/**
 * Color de cada país en el mapa político (ajuste f7-a3). El reparto (src/map/colores.ts) compara
 * cada país con todos los de su zona y tarda demasiado para hacerlo al abrir el mapa, así que se
 * calcula aquí una vez y el mapa solo lo lee.
 *
 * Entradas (del propio repositorio, sin red):
 *  - src/map/config/colores-pais.json: color representativo de cada país (tabla revisable).
 *  - src/map/config/colores-banderas.json: colores de las banderas (18-colores-banderas.ts).
 *  - public/data/mapa-2010-mundo.json: fronteras de 2010 (vecinos, cercanos y distancias).
 *
 * Salida: public/data/colores-pais.json
 * Uso:    node scripts/datos/19-colores-pais.ts (tras cambiar la tabla o las banderas)
 */
import { createServer } from 'vite';
import type { TopologiaMapa } from '../../src/map/geometria.ts';
import { escribirJsonCompacto, leerJson, ruta } from './lib/comun.ts';

// El reparto es el mismo código del juego; Vite lo carga tal cual (con sus JSON de configuración).
const servidor = await createServer({
  root: ruta(''),
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});
const { coloresDelMapa } = (await servidor.ssrLoadModule(
  '/src/map/colores.ts',
)) as typeof import('../../src/map/colores.ts');
const topo = leerJson<TopologiaMapa>('public/data/mapa-2010-mundo.json');
const colores = coloresDelMapa(topo);
await servidor.close();
escribirJsonCompacto(
  'public/data/colores-pais.json',
  {
    fuente:
      'Calculado por scripts/datos/19-colores-pais.ts a partir de la tabla de colores representativos (src/map/config/colores-pais.json), los colores de las banderas y el mapa de 2010.',
    colores: Object.fromEntries([...colores].sort(([a], [b]) => a.localeCompare(b))),
  },
  1,
);
console.log(`Colores de ${colores.size} países guardados.`);
