import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const app = buildApp({
  logger: { level: env.LOG_LEVEL },
  trustProxy: env.TRUST_PROXY,
  security: { production: env.NODE_ENV === 'production', corsOrigins: env.CORS_ORIGINS },
});

// Cierre ordenado: termina las peticiones en curso antes de salir
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
