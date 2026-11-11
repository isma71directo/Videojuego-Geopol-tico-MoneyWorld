import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Única fuente de la versión del juego: package.json.
const paquete = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  // Rutas relativas: el juego funciona en cualquier subcarpeta de GitHub Pages.
  base: './',
  define: {
    __VERSION__: JSON.stringify(paquete.version),
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
