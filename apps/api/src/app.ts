import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Db } from './db/client.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { registerSecurity, type SecurityOptions } from './security.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Cliente de base de datos, disponible en rutas y plugins como `app.db` */
    db: Db;
  }
}

export interface BuildAppOptions extends FastifyServerOptions {
  db: Db;
  security?: SecurityOptions;
}

/**
 * Construye la instancia de Fastify sin abrir un puerto.
 * Separarlo de server.ts permite probar la app con `app.inject()`.
 * La base de datos se recibe desde fuera: quien la crea (server.ts o las pruebas) la cierra.
 */
export function buildApp({ db, security = {}, ...options }: BuildAppOptions) {
  const app = Fastify(options);

  app.decorate('db', db);

  registerSecurity(app, security);

  // Cada módulo registra sus rutas bajo el prefijo versionado de la API
  void app.register(healthRoutes, { prefix: '/api/v1' });

  return app;
}
