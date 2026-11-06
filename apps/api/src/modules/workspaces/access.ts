import { roleHasPermission, type MembershipRole, type Permission } from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../../db/client.js';
import { notDeleted } from '../../db/audit.js';

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() });

/** Acceso de quien pregunta en el workspace de la URL */
export interface WorkspaceAccess {
  workspaceId: string;
  userId: string;
  role: MembershipRole;
}

/**
 * Acceso del usuario al workspace: su membresía activa o, si es el **Admin del sistema**, ADMIN en
 * cualquier workspace existente. null = sin acceso.
 */
export async function findAccess(
  db: Db,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceAccess | null> {
  const membership = await db.membership.findFirst({
    where: { workspaceId, userId, ...notDeleted, workspace: notDeleted },
    select: { role: true },
  });
  if (membership) return { workspaceId, userId, role: membership.role };

  const [user, workspace] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { isSystemAdmin: true } }),
    db.workspace.findFirst({ where: { id: workspaceId, ...notDeleted }, select: { id: true } }),
  ]);
  return user?.isSystemAdmin && workspace ? { workspaceId, userId, role: 'ADMIN' } : null;
}

/**
 * preHandler para rutas `/workspaces/:workspaceId/...`. Va después de `requireAuth` y deja el
 * acceso en `request.membership`:
 *
 * - no es miembro (o el ID no es válido) → 404: no revela que el workspace existe
 * - es miembro pero su rol no tiene el permiso → 403
 */
function workspaceGuard(permission?: Permission) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const params = workspaceParamsSchema.safeParse(request.params);
    const access =
      params.success && request.auth
        ? await findAccess(request.server.db, params.data.workspaceId, request.auth.userId)
        : null;

    if (!access) {
      return reply.code(404).send({ message: 'Espacio de trabajo no encontrado' });
    }
    if (permission && !roleHasPermission(access.role, permission)) {
      return reply.code(403).send({ message: 'No tienes permiso para esta acción' });
    }
    request.membership = access;
  };
}

/** Solo exige ser miembro del workspace, con cualquier rol */
export const requireMembership = workspaceGuard();

/** Exige ser miembro y que el rol tenga el permiso: `{ preHandler: requirePermission('member.manage') }` */
export function requirePermission(permission: Permission) {
  return workspaceGuard(permission);
}
