import type { SystemUser, UserStatus } from '@aprendizaje/shared';
import type { Db } from '../../db/client.js';
import { auditUpdate } from '../../db/audit.js';
import { EmailTakenError } from '../auth/profile.service.js';

/** El Admin del sistema no puede desactivarse a sí mismo: nadie podría reactivarlo (→ 409) */
export class SelfDisableError extends Error {}

/** Todas las cuentas de personas (HU-15), con sus espacios, por nombre */
export async function listSystemUsers(db: Db): Promise<SystemUser[]> {
  const users = await db.user.findMany({
    where: { kind: 'HUMAN' },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      isSystemAdmin: true,
      lastLoginAt: true,
      memberships: {
        // Membresías vigentes, de espacios que no están en la papelera
        where: { deletedAt: null, workspace: { deletedAt: null } },
        select: { role: true, workspace: { select: { id: true, name: true } } },
        orderBy: { workspace: { name: 'asc' } },
      },
    },
    orderBy: { name: 'asc' },
  });
  return users.map(({ memberships, lastLoginAt, ...user }) => ({
    ...user,
    lastLoginAt: lastLoginAt?.toISOString() ?? null,
    workspaces: memberships.map(({ role, workspace }) => ({ ...workspace, role })),
  }));
}

/**
 * Corrige el correo de una cuenta (HU-15, mismas reglas que HU-14) y cierra sus sesiones; si es la
 * del propio Admin, conserva la sesión desde la que lo hace. false si no existe (→ 404).
 */
export async function changeUserEmail(
  db: Db,
  actor: { userId: string; tokenHash: string },
  userId: string,
  email: string,
): Promise<boolean> {
  const user = await db.user.findFirst({
    where: { id: userId, kind: 'HUMAN' },
    select: { id: true },
  });
  if (!user) return false;
  const taken = await db.user.findFirst({
    where: { email, id: { not: userId } },
    select: { id: true },
  });
  if (taken) throw new EmailTakenError();
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { email, ...auditUpdate(actor.userId) } }),
    db.session.deleteMany({ where: { userId, tokenHash: { not: actor.tokenHash } } }),
  ]);
  return true;
}

/**
 * Desactiva o reactiva una cuenta (HU-15). Desactivada no inicia sesión y sus sesiones se cierran;
 * sigue como miembro de sus espacios y lo que capturó se conserva. false si no existe (→ 404).
 */
export async function setUserStatus(
  db: Db,
  actorId: string,
  userId: string,
  status: UserStatus,
): Promise<boolean> {
  if (userId === actorId && status === 'DISABLED') throw new SelfDisableError();
  const user = await db.user.findFirst({
    where: { id: userId, kind: 'HUMAN' },
    select: { id: true },
  });
  if (!user) return false;
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { status, ...auditUpdate(actorId) } }),
    ...(status === 'DISABLED' ? [db.session.deleteMany({ where: { userId } })] : []),
  ]);
  return true;
}
