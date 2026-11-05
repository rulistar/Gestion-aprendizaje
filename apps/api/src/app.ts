import Fastify, { type FastifyServerOptions } from 'fastify';
import { healthRoutes } from './modules/health/health.routes.js';
import { registerSecurity, type SecurityOptions } from './security.js';

export interface BuildAppOptions extends FastifyServerOptions {
  security?: SecurityOptions;
}

/**
 * Construye la instancia de Fastify sin abrir un puerto.
 * Separarlo de server.ts permite probar la app con `app.inject()`.
 */
export function buildApp({ security = {}, ...options }: BuildAppOptions = {}) {
  const app = Fastify(options);

  registerSecurity(app, security);

  // Cada módulo registra sus rutas bajo el prefijo versionado de la API
  void app.register(healthRoutes, { prefix: '/api/v1' });

  return app;
}
