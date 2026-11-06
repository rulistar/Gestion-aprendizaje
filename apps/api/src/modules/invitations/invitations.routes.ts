import { createInvitationRequestSchema } from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyPluginCallback } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../workspaces/access.js';
import {
  createInvitation,
  InvitationConflictError,
  listPendingInvitations,
  revokeInvitation,
} from './invitations.service.js';

const invitationParamsSchema = z.object({ invitationId: z.uuid() });

const BASE = '/workspaces/:workspaceId/invitations';

/** Invitaciones de un workspace: solo quien tiene `member.manage` (el Admin) */
export const invitationsRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);
  const onlyManagers = { preHandler: requirePermission('member.manage') };

  app.get(BASE, onlyManagers, async (request) =>
    listPendingInvitations(app.db, request.membership!.workspaceId),
  );

  app.post(BASE, onlyManagers, async (request, reply) => {
    const parsed = createInvitationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    try {
      const created = await createInvitation(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        parsed.data,
      );
      return await reply.code(201).send(created);
    } catch (error) {
      if (error instanceof InvitationConflictError) {
        return reply.code(409).send({ message: error.message });
      }
      throw error;
    }
  });

  app.delete(`${BASE}/:invitationId`, onlyManagers, async (request, reply) => {
    const params = invitationParamsSchema.safeParse(request.params);
    const revoked =
      params.success &&
      (await revokeInvitation(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        params.data.invitationId,
      ));
    if (!revoked) {
      return reply.code(404).send({ message: 'Invitación no encontrada o ya no está pendiente' });
    }
    return reply.code(204).send();
  });

  done();
};
