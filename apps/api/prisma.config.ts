import { defineConfig } from 'prisma/config';

// Prisma no lee .env por sí solo: se carga el .env de la raíz si existe (en CI las variables ya vienen del entorno)
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // Sin .env: se usan las variables de entorno del sistema
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // `prisma generate` no necesita conexión; las migraciones fallan con un error claro si falta
    url: process.env.DATABASE_URL ?? '',
  },
});
