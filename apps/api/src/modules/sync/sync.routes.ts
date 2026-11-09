import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../workspaces/access.js';
import { disableSync, enableSync, getSyncStatus, retrySync } from './sync.service.js';

const paramsSchema = z.object({ elementId: z.uuid() });

const BASE = '/workspaces/:workspaceId/elements/:elementId/sync';
const NOT_FOUND = 'Elemento no encontrado';
const UNAVAILABLE = 'La conexión con Gestor de Proyectos no está configurada';

/**
 * Enviar un elemento a Gestor de Proyectos (INT-02, ADR-0004): ver cómo va, enviarlo, dejar de
 * sincronizarlo y reintentar un envío fallido. Lo ve quien ve el elemento; lo cambia quien lo edita.
 */
export const syncRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  const elementIdOf = (request: FastifyRequest) => {
    const params = paramsSchema.safeParse(request.params);
    return params.success ? params.data.elementId : null;
  };

  async function sendStatus(request: FastifyRequest, reply: FastifyReply, elementId: string) {
    const status = await getSyncStatus(
      app.db,
      app.syncAvailable,
      request.membership!.workspaceId,
      elementId,
    );
    return status ?? reply.code(404).send({ message: NOT_FOUND });
  }

  app.get(BASE, { preHandler: requirePermission('element.read') }, async (request, reply) => {
    const elementId = elementIdOf(request);
    if (!elementId) return reply.code(404).send({ message: NOT_FOUND });
    return sendStatus(request, reply, elementId);
  });

  app.post(BASE, { preHandler: requirePermission('element.update') }, async (request, reply) => {
    const elementId = elementIdOf(request);
    if (!elementId) return reply.code(404).send({ message: NOT_FOUND });
    if (!app.syncAvailable) return reply.code(409).send({ message: UNAVAILABLE });
    const enabled = await enableSync(
      app.db,
      request.auth!.userId,
      request.membership!.workspaceId,
      elementId,
    );
    return enabled
      ? sendStatus(request, reply, elementId)
      : reply.code(404).send({ message: NOT_FOUND });
  });

  // Se puede aunque la conexión ya no esté configurada: solo olvida los vínculos
  app.delete(BASE, { preHandler: requirePermission('element.update') }, async (request, reply) => {
    const elementId = elementIdOf(request);
    if (!elementId) return reply.code(404).send({ message: NOT_FOUND });
    const disabled = await disableSync(
      app.db,
      request.auth!.userId,
      request.membership!.workspaceId,
      elementId,
    );
    return disabled
      ? sendStatus(request, reply, elementId)
      : reply.code(404).send({ message: NOT_FOUND });
  });

  app.post(
    `${BASE}/retry`,
    { preHandler: requirePermission('element.update') },
    async (request, reply) => {
      const elementId = elementIdOf(request);
      if (!elementId) return reply.code(404).send({ message: NOT_FOUND });
      if (!app.syncAvailable) return reply.code(409).send({ message: UNAVAILABLE });
      const found = await retrySync(app.db, request.membership!.workspaceId, elementId);
      return found
        ? sendStatus(request, reply, elementId)
        : reply.code(404).send({ message: NOT_FOUND });
    },
  );

  done();
};
