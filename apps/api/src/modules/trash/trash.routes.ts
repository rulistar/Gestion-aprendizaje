import {
  roleHasPermission,
  trashKindSchema,
  trashPermission,
  visibleTrashKinds,
} from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requireMembership, requirePermission } from '../workspaces/access.js';
import { listTrash, purgeFromTrash, restoreFromTrash } from './trash.service.js';

const itemParamsSchema = z.object({ kind: trashKindSchema, id: z.uuid() });

const BASE = '/workspaces/:workspaceId/trash';

function notInTrash(reply: FastifyReply) {
  return reply.code(404).send({ message: 'No está en la papelera' });
}

/**
 * Lo que puede restaurar quien pide; lo demás, para él no está en la papelera (404, no 403: no se
 * revela qué hay).
 */
function parseItem(request: FastifyRequest) {
  const params = itemParamsSchema.safeParse(request.params);
  if (!params.success) return null;
  return roleHasPermission(request.membership!.role, trashPermission(params.data.kind))
    ? params.data
    : null;
}

/**
 * Papelera del espacio (HU-07): cada quien ve y restaura lo que pudo quitar; borrar para siempre,
 * solo el Admin (`trash.manage`)
 */
export const trashRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(BASE, { preHandler: requireMembership }, async (request) =>
    listTrash(app.db, request.membership!.workspaceId, visibleTrashKinds(request.membership!.role)),
  );

  app.post(
    `${BASE}/:kind/:id/restore`,
    { preHandler: requireMembership },
    async (request, reply) => {
      const item = parseItem(request);
      const restored =
        item &&
        (await restoreFromTrash(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          item.kind,
          item.id,
        ));
      return restored ? reply.code(204).send() : notInTrash(reply);
    },
  );

  app.delete(
    `${BASE}/:kind/:id`,
    { preHandler: requirePermission('trash.manage') },
    async (request, reply) => {
      const item = parseItem(request);
      const purged =
        item && (await purgeFromTrash(app.db, request.membership!.workspaceId, item.kind, item.id));
      return purged ? reply.code(204).send() : notInTrash(reply);
    },
  );

  done();
};
