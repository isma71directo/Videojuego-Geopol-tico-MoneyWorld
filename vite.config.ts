import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const ruta = (relativa: string): string => fileURLToPath(new URL(relativa, import.meta.url));

// Única fuente de la versión y de la dirección del repositorio: package.json.
const paquete = JSON.parse(readFileSync(ruta('./package.json'), 'utf8')) as {
  version: string;
  repository: { url: string };
};
const repositorio = paquete.repository.url.replace(/\.git$/, '');

/**
 * Publica roadmap.json junto a las dos webs. En desarrollo Vite ya lo sirve
 * desde la raíz; al compilar hay que copiarlo a dist/.
 */
function publicarRoadmap(): Plugin {
  return {
    name: 'publicar-roadmap',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'roadmap.json',
        source: readFileSync(ruta('./roadmap.json')),
      });
    },
  };
}

export default defineConfig({
  // Rutas relativas: el juego funciona en cualquier subcarpeta de GitHub Pages.
  base: './',
  define: {
    __VERSION__: JSON.stringify(paquete.version),
    __REPOSITORIO__: JSON.stringify(repositorio),
  },
  plugins: [publicarRoadmap()],
  build: {
    rollupOptions: {
      // Dos webs independientes: el juego y la Hoja de ruta.
      input: {
        juego: ruta('./index.html'),
        'hoja-de-ruta': ruta('./hoja-de-ruta/index.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
