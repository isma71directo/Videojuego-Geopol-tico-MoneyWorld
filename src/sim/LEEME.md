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
- `motor.ts`, `bucle.ts` y `trabajador.ts` (Fase 12): el motor guarda la partida y atiende las
  órdenes de la pantalla; el bucle lo hace avanzar mientras el tiempo corre, y el Web Worker los
  ejecuta en otro hilo para que la pantalla nunca se bloquee. La pantalla habla con él desde
  `src/ui/conexion-motor.ts`.
