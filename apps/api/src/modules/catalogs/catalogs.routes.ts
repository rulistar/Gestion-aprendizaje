import { createCatalogItemSchema, updateCatalogItemSchema } from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requireMembership, requirePermission } from '../workspaces/access.js';
import {
  createCatalogItem,
  DuplicateCatalogItemError,
  listCatalogItems,
  updateCatalogItem,
} from './catalogs.service.js';

const itemParamsSchema = z.object({ itemId: z.uuid() });

const BASE = '/workspaces/:workspaceId/catalogs';
const NOT_FOUND = 'Valor no encontrado';

function sendCatalogError(reply: FastifyReply, error: unknown) {
  if (error instanceof DuplicateCatalogItemError) {
    return reply.code(409).send({ message: 'Ya existe un valor activo con ese nombre' });
  }
  throw error;
}

/** Catálogos del espacio (HU-01). Los ve todo miembro, para elegirlos; los cambia el Admin */
export const catalogsRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(BASE, { preHandler: requireMembership }, async (request) =>
    listCatalogItems(app.db, request.membership!.workspaceId),
  );

  app.post(BASE, { preHandler: requirePermission('catalog.manage') }, async (request, reply) => {
    const parsed = createCatalogItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    try {
      const item = await createCatalogItem(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        parsed.data,
      );
      return await reply.code(201).send(item);
    } catch (error) {
      return sendCatalogError(reply, error);
    }
  });

  app.patch(
    `${BASE}/:itemId`,
    { preHandler: requirePermission('catalog.manage') },
    async (request, reply) => {
      const params = itemParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: NOT_FOUND });
      const parsed = updateCatalogItemSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      try {
        const item = await updateCatalogItem(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          params.data.itemId,
          parsed.data,
        );
        return item ?? (await reply.code(404).send({ message: NOT_FOUND }));
      } catch (error) {
        return sendCatalogError(reply, error);
      }
    },
  );

  done();
};
