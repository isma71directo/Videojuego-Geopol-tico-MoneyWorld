# /src/sim — motor de simulación

Motor puro y determinista del juego. Reglas (GDD, sección 11):

- **Sin dependencias de la interfaz:** nada de `document`, `window`, `/src/ui` ni `/src/map`
  (ESLint lo impide).
- **Un archivo por sistema** en `systems/` (`economia.ts`, `energia.ts`…).
- **Parámetros de equilibrado fuera del código**, en `config/*.json`.
- **Todo con tests** en `/tests` (Vitest).

Lo que hay ya:

- `partida.ts`: crear la partida el 1 de enero de 2010 (Fase 10) y avanzarla por horas.
- `valores-iniciales.ts`: tesorería y popularidad iniciales provisionales (Fase 10).
- `reloj.ts`: el reloj por horas, sus pasos diarios, semanales, mensuales y anuales, y las
  velocidades (Fase 11).
