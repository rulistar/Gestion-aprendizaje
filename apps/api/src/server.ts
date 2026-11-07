import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDb } from './db/client.js';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const production = env.NODE_ENV === 'production';
// dist/server.js → apps/web/dist: en producción la API también sirve la web (TEC-04)
const webDist =
  env.WEB_DIST_DIR ??
  (production ? fileURLToPath(new URL('../../web/dist', import.meta.url)) : undefined);
const app = buildApp({
  db,
  logger: { level: env.LOG_LEVEL },
  trustProxy: env.TRUST_PROXY,
  security: { production, corsOrigins: env.CORS_ORIGINS },
  sessionIdleMinutes: env.SESSION_IDLE_MINUTES,
  ...(webDist && { webDist }),
});

// Cierre ordenado: termina las peticiones en curso y libera las conexiones a la BD antes de salir
app.addHook('onClose', async () => {
  await db.$disconnect();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info(`${signal} recibido, cerrando servidor`);
    void app.close().then(() => process.exit(0));
  });
}

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
