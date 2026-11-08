import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    // Cobertura (TEC-06): las reglas de negocio puras viven aquí; objetivo 3 del acta (≥ 70 %)
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 70 },
    },
  },
});
