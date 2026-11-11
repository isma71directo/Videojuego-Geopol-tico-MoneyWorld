import { etiquetaVersion } from './compartido/version';

// Punto de entrada del juego. La pantalla de inicio llega en la tarea f0-t7.
const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = `Geopolítica 2010 · ${etiquetaVersion()}`;
}
