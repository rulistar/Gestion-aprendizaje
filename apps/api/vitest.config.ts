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
  },
});
