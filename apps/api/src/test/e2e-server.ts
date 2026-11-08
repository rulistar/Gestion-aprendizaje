import { fileURLToPath } from 'node:url';
import { buildApp } from '../app.js';
import { createDb } from '../db/client.js';
import { createFirstAdmin } from '../modules/setup/first-admin.js';
import { prepareDatabase } from './global-setup.js';
import { resetDb } from './test-db.js';

/**
 * Servidor de las pruebas de punta a punta (TEC-05); lo arranca Playwright con `pnpm test:e2e`.
 * Usa su propia BD (`<DATABASE_URL>_e2e`), la vacía en cada corrida y crea el primer Admin con el
 * correo y la contraseña de un solo uso que le pasa Playwright. Sirve la web compilada igual que
 * en producción (misma URL), pero por HTTP: corre en 127.0.0.1.
 */
const base = process.env.DATABASE_URL;
const { E2E_ADMIN_EMAIL: email, E2E_ADMIN_PASSWORD: password } = process.env;
if (!base || !email || !password) {
  throw new Error('Faltan DATABASE_URL, E2E_ADMIN_EMAIL o E2E_ADMIN_PASSWORD');
}

const url = new URL(base);
url.pathname = `${url.pathname}_e2e`;
await prepareDatabase(url.toString());

const db = createDb(url.toString());
await resetDb(db);
await createFirstAdmin(db, { name: 'Admin E2E', email, password });

const app = buildApp({
  db,
  webDist: fileURLToPath(new URL('../../../web/dist', import.meta.url)),
});
app.addHook('onClose', async () => {
  await db.$disconnect();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close().then(() => process.exit(0)));
}
await app.listen({ host: '127.0.0.1', port: Number(process.env.E2E_PORT ?? 3101) });
