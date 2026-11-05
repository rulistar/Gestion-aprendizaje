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
  },
});
