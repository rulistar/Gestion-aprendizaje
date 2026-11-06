import {
  createWorkspaceRequestSchema,
  roleHasPermission,
  updateMemberRoleRequestSchema,
} from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requireMembership, requirePermission } from './access.js';
import {
  changeMemberRole,
  createWorkspace,
  LastAdminError,
  listMembers,
  listWorkspacesForUser,
  MemberNotFoundError,
  removeMember,
  renameWorkspace,
} from './workspaces.service.js';

const memberParamsSchema = z.object({ userId: z.uuid() });
const MEMBER_NOT_FOUND = 'Miembro no encontrado';

function sendMemberError(reply: FastifyReply, error: unknown) {
  if (error instanceof MemberNotFoundError) {
    return reply.code(404).send({ message: MEMBER_NOT_FOUND });
  }
  if (error instanceof LastAdminError) {
    return reply.code(409).send({
      message: 'El espacio debe tener al menos un Admin: nombra a otro antes de hacer este cambio',
    });
  }
  throw error;
}

export const workspacesRoutes: FastifyPluginCallback = (app, _options, done) => {
  // Todas las rutas de este módulo exigen sesión
  app.addHook('preHandler', requireAuth);

  app.get('/workspaces', async (request) => {
    return listWorkspacesForUser(app.db, request.auth!.userId);
  });

  // Un workspace del que soy miembro, con mi rol (404 si no lo soy)
  app.get('/workspaces/:workspaceId', { preHandler: requireMembership }, async (request) => {
    const { workspaceId, role } = request.membership!;
    const workspace = await app.db.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });
    return { ...workspace, role };
  });

  app.get(
    '/workspaces/:workspaceId/members',
    { preHandler: requireMembership },
    async (request) => {
      const { workspaceId, role } = request.membership!;
      return listMembers(app.db, workspaceId, {
        withEmail: roleHasPermission(role, 'member.manage'),
      });
    },
  );

  // Cambiar el rol de un miembro o quitarlo del espacio (solo el Admin)
  const onlyManagers = { preHandler: requirePermission('member.manage') };

  app.patch('/workspaces/:workspaceId/members/:userId', onlyManagers, async (request, reply) => {
    const params = memberParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(404).send({ message: MEMBER_NOT_FOUND });
    const parsed = updateMemberRoleRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    try {
      await changeMemberRole(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        params.data.userId,
        parsed.data.role,
      );
      return await reply.code(204).send();
    } catch (error) {
      return sendMemberError(reply, error);
    }
  });

  app.delete('/workspaces/:workspaceId/members/:userId', onlyManagers, async (request, reply) => {
    const params = memberParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(404).send({ message: MEMBER_NOT_FOUND });
    try {
      await removeMember(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        params.data.userId,
      );
      return await reply.code(204).send();
    } catch (error) {
      return sendMemberError(reply, error);
    }
  });

  // Renombrar el espacio (solo el Admin): el nombre es una etiqueta, el ID no cambia
  app.patch(
    '/workspaces/:workspaceId',
    { preHandler: requirePermission('workspace.update') },
    async (request, reply) => {
      const parsed = createWorkspaceRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      const { workspaceId, role } = request.membership!;
      const workspace = await renameWorkspace(
        app.db,
        request.auth!.userId,
        workspaceId,
        parsed.data,
      );
      return { ...workspace, role };
    },
  );

  // Solo el Admin del sistema crea espacios; los demás entran por invitación
  app.post('/workspaces', async (request, reply) => {
    const actor = await app.db.user.findUnique({
      where: { id: request.auth!.userId },
      select: { isSystemAdmin: true },
    });
    if (!actor?.isSystemAdmin) {
      return reply
        .code(403)
        .send({ message: 'Solo el Admin del sistema puede crear espacios de trabajo' });
    }
    const parsed = createWorkspaceRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    const workspace = await createWorkspace(app.db, request.auth!.userId, parsed.data);
    return reply.code(201).send(workspace);
  });

  done();
};
