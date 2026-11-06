import { createDb, type Db } from '../db/client.js';

/**
 * URL de la base de datos de pruebas. Si no se define TEST_DATABASE_URL, se deriva de
 * DATABASE_URL agregando el sufijo `_test` al nombre de la BD (aprendizaje_dev → aprendizaje_dev_test).
 * Así las pruebas nunca tocan los datos de desarrollo.
 */
export function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!explicit && !base) {
    throw new Error('Define DATABASE_URL (o TEST_DATABASE_URL) para ejecutar las pruebas');
  }

  const url = new URL(explicit ?? base ?? '');
  if (!explicit) url.pathname = `${url.pathname}_test`;

  // Protección: jamás ejecutar pruebas (que borran datos) contra una BD que no sea de pruebas
  if (!url.pathname.endsWith('_test')) {
    throw new Error(
      `La BD de pruebas debe terminar en "_test" (recibido: "${url.pathname.slice(1)}")`,
    );
  }
  return url.toString();
}

export function createTestDb(): Db {
  return createDb(testDatabaseUrl());
}

const TRUNCATE_ALL =
  'TRUNCATE TABLE "sessions", "memberships", "workspaces", "users" RESTART IDENTITY CASCADE';

/** PostgreSQL canceló la consulta por un bloqueo mutuo (deadlock) */
function isDeadlock(error: unknown): boolean {
  return error instanceof Error && error.message.includes('40P01');
}

/**
 * Vacía todas las tablas entre pruebas para que cada una empiece desde cero. TRUNCATE bloquea
 * todas las tablas a la vez y, en CI, a veces choca con otra conexión que aún se está cerrando:
 * PostgreSQL cancela uno de los dos (deadlock) y basta con reintentar.
 */
export async function resetDb(db: Db): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await db.$executeRawUnsafe(TRUNCATE_ALL);
      return;
    } catch (error) {
      if (!isDeadlock(error) || attempt >= 3) throw error;
    }
  }
}
