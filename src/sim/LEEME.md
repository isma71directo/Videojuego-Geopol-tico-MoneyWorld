# /src/sim — motor de simulación

Motor puro y determinista del juego. Reglas (GDD, sección 11):

- **Sin dependencias de la interfaz:** nada de `document`, `window`, `/src/ui` ni `/src/map`
  (ESLint lo impide).
- **Un archivo por sistema** en `systems/` (`economia.ts`, `energia.ts`…).
- **Parámetros de equilibrado fuera del código**, en `config/*.json`.
- **Todo con tests** en `/tests` (Vitest).

El motor empieza en la Fase 5 (tiempo y guardado).
