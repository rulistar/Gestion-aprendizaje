import type { HealthResponse } from '@aprendizaje/shared';
import type { FastifyPluginCallback } from 'fastify';

/** Endpoint de salud: lo usan el hosting y el monitoreo para saber si la API está viva. */
export const healthRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.get('/health', (): HealthResponse => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  done();
};
