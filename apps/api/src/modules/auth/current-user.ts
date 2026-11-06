import type { CurrentUser } from '@aprendizaje/shared';
import type { Db } from '../../db/client.js';
import { listWorkspacesForUser } from '../workspaces/workspaces.service.js';

/** El usuario de la sesión con sus workspaces (respuesta de /auth/me, del login y de aceptar una invitación) */
export async function getCurrentUser(db: Db, userId: string): Promise<CurrentUser> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isSystemAdmin: user.isSystemAdmin,
    workspaces: await listWorkspacesForUser(db, userId),
  };
}
