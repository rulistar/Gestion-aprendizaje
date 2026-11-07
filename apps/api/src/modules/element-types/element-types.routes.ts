import { createElementTypeSchema, updateElementTypeSchema } from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requireMembership, requirePermission } from '../workspaces/access.js';
import {
  createElementType,
  DuplicateElementTypeError,
  LastElementTypeError,
  listElementTypes,
  updateElementType,
} from './element-types.service.js';

const typeParamsSchema = z.object({ typeId: z.uuid() });

const BASE = '/workspaces/:workspaceId/element-types';
const NOT_FOUND = 'Tipo no encontrado';

function sendElementTypeError(reply: FastifyReply, error: unknown) {
  if (error instanceof DuplicateElementTypeError) {
    return reply.code(409).send({ message: 'Ya existe un tipo activo con ese nombre' });
  }
  if (error instanceof LastElementTypeError) {
    return reply.code(409).send({ message: 'Debe quedar al menos un tipo activo' });
  }
  throw error;
}

/** Tipos de elemento (HU-02). Los ve todo miembro, para usar sus etiquetas; los cambia el Admin */
export const elementTypesRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(BASE, { preHandler: requireMembership }, async (request) =>
    listElementTypes(app.db, request.membership!.workspaceId),
  );

  app.post(BASE, { preHandler: requirePermission('catalog.manage') }, async (request, reply) => {
    const parsed = createElementTypeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    try {
      const type = await createElementType(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        parsed.data,
      );
      return await reply.code(201).send(type);
    } catch (error) {
      return sendElementTypeError(reply, error);
    }
  });

  app.patch(
    `${BASE}/:typeId`,
    { preHandler: requirePermission('catalog.manage') },
    async (request, reply) => {
      const params = typeParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: NOT_FOUND });
      const parsed = updateElementTypeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      try {
        const type = await updateElementType(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          params.data.typeId,
          parsed.data,
        );
        return type ?? (await reply.code(404).send({ message: NOT_FOUND }));
      } catch (error) {
        return sendElementTypeError(reply, error);
      }
    },
  );

  done();
};
