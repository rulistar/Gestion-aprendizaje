import { elementFichaSchema, elementTodayQuerySchema } from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../workspaces/access.js';
import {
  createElement,
  deleteElement,
  getElement,
  InvalidActualDatesError,
  InvalidReferenceError,
  listElements,
  updateElement,
} from './elements.service.js';

const elementParamsSchema = z.object({ elementId: z.uuid() });

const BASE = '/workspaces/:workspaceId/elements';
const NOT_FOUND = 'Elemento no encontrado';

/** El día en la zona del usuario, para las fechas reales automáticas; si no viene, el del servidor */
export function todayOf(request: FastifyRequest) {
  const query = elementTodayQuerySchema.safeParse(request.query);
  return (query.success && query.data.today) || new Date().toISOString().slice(0, 10);
}

export function sendElementError(reply: FastifyReply, error: unknown) {
  if (error instanceof InvalidReferenceError) {
    return reply.code(400).send({ message: error.message });
  }
  if (error instanceof InvalidActualDatesError) {
    return reply
      .code(400)
      .send({ message: 'El inicio real es posterior a hoy: corrígelo para terminar' });
  }
  throw error;
}

/** Fichas de los elementos (HU-03). El rol decide qué puede hacer cada quien */
export const elementsRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(BASE, { preHandler: requirePermission('element.read') }, async (request) =>
    listElements(app.db, request.membership!.workspaceId),
  );

  app.post(BASE, { preHandler: requirePermission('element.create') }, async (request, reply) => {
    const parsed = elementFichaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    try {
      const element = await createElement(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        parsed.data,
        todayOf(request),
      );
      return await reply.code(201).send(element);
    } catch (error) {
      return sendElementError(reply, error);
    }
  });

  app.get(
    `${BASE}/:elementId`,
    { preHandler: requirePermission('element.read') },
    async (request, reply) => {
      const params = elementParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: NOT_FOUND });
      const element = await getElement(
        app.db,
        request.membership!.workspaceId,
        params.data.elementId,
      );
      return element ?? (await reply.code(404).send({ message: NOT_FOUND }));
    },
  );

  app.put(
    `${BASE}/:elementId`,
    { preHandler: requirePermission('element.update') },
    async (request, reply) => {
      const params = elementParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: NOT_FOUND });
      const parsed = elementFichaSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      try {
        const element = await updateElement(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          params.data.elementId,
          parsed.data,
          todayOf(request),
        );
        return element ?? (await reply.code(404).send({ message: NOT_FOUND }));
      } catch (error) {
        return sendElementError(reply, error);
      }
    },
  );

  // A la papelera (HU-07); de ahí se restaura o, solo el Admin, se borra para siempre
  app.delete(
    `${BASE}/:elementId`,
    { preHandler: requirePermission('element.delete') },
    async (request, reply) => {
      const params = elementParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: NOT_FOUND });
      const deleted = await deleteElement(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        params.data.elementId,
      );
      return deleted ? reply.code(204).send() : reply.code(404).send({ message: NOT_FOUND });
    },
  );

  done();
};
