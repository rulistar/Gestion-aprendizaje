import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resuelve @aprendizaje/shared a su código fuente TS (sin necesidad de compilarlo antes)
  ssr: {
    resolve: {
      conditions: ['@aprendizaje/source', ...defaultServerConditions],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Crea la BD de pruebas y le aplica las migraciones antes de empezar
    globalSetup: ['src/test/global-setup.ts'],
    setupFiles: ['src/test/load-env.ts'],
    // Las pruebas comparten la BD de pruebas: se ejecutan de una en una para no pisarse
    fileParallelism: false,
    // Cobertura (TEC-06): la lógica de negocio de la API; objetivo 3 del acta (≥ 70 %).
    // Fuera: el cliente generado de Prisma, la ayuda de pruebas, los comandos interactivos y el arranque
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/generated/**',
        'src/test/**',
        'src/cli/**',
        'src/server.ts',
      ],
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 70 },
    },
  },
});
