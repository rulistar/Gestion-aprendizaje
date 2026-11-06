import { execFileSync } from 'node:child_process';
import { createDb } from '../db/client.js';
import { testDatabaseUrl } from './test-db.js';

/**
 * Se ejecuta una vez antes de todas las pruebas: crea la BD de pruebas si no existe y le aplica
 * todas las migraciones (igual que en producción, con `migrate deploy`).
 */
export default async function globalSetup(): Promise<void> {
  try {
    process.loadEnvFile(new URL('../../../../.env', import.meta.url));
  } catch {
    // Sin .env (por ejemplo en CI): se usan las variables de entorno del sistema
  }

  await prepareDatabase(testDatabaseUrl());
}

/** Crea la BD si no existe y le aplica las migraciones. */
export async function prepareDatabase(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.slice(1);
  // CREATE DATABASE no admite parámetros: se valida el nombre antes de usarlo en el SQL
  if (!/^[a-z0-9_]+$/.test(dbName)) {
    throw new Error(`Nombre de BD de pruebas no válido: "${dbName}"`);
  }

  // Para crear una BD hay que conectarse a otra que ya exista: la de mantenimiento "postgres"
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = createDb(adminUrl.toString());
  try {
    const existing = await admin.$queryRaw<
      unknown[]
    >`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (existing.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.$disconnect();
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
}
