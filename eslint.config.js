// Configuración de ESLint (formato plano). El estilo lo decide Prettier.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/', 'public/data/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Regla 5 del proyecto: el motor de simulación no depende de la interfaz.
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ui/**', '**/map/**', '**/hoja-de-ruta/**'],
              message: 'El motor de simulación (src/sim) no puede depender de la interfaz.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'document', 'window'],
    },
  },
  prettier,
);
