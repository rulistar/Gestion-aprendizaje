import type {
  CreateWorkspaceRequest,
  Member,
  MembershipRole,
  WorkspaceSummary,
} from '@aprendizaje/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, auditSoftDelete, auditUpdate, notDeleted } from '../../db/audit.js';
import { seedCatalogs } from '../catalogs/catalogs.service.js';

/**
 * Workspaces que el usuario puede abrir (sin los que están en la papelera): aquellos de los que
 * es miembro activo. El Admin del sistema ve **todos**, como Admin.
 */
export async function listWorkspacesForUser(db: Db, userId: string): Promise<WorkspaceSummary[]> {
  const [user, memberships] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { isSystemAdmin: true } }),
    db.membership.findMany({
      where: { userId, ...notDeleted, workspace: notDeleted },
      include: { workspace: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const mine = memberships.map((m) => ({ ...m.workspace, role: m.role }));
  if (!user.isSystemAdmin) return mine;

  const others = await db.workspace.findMany({
    where: { ...notDeleted, id: { notIn: mine.map((w) => w.id) } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return [...mine, ...others.map((w) => ({ ...w, role: 'ADMIN' as const }))];
}

/** Membresías vigentes de usuarios activos (los desactivados no cuentan como miembros) */
function activeMembers(workspaceId: string) {
  return { workspaceId, ...notDeleted, user: { status: 'ACTIVE' as const } };
}

/** Miembros activos del workspace, por nombre. El correo solo lo ve quien gestiona miembros */
export async function listMembers(
  db: Db,
  workspaceId: string,
  { withEmail }: { withEmail: boolean },
): Promise<Member[]> {
  const memberships = await db.membership.findMany({
    where: activeMembers(workspaceId),
    select: { role: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: 'asc' } },
  });
  return memberships.map(({ role, user }) => ({
    userId: user.id,
    name: user.name,
    email: withEmail ? user.email : null,
    role,
  }));
}

/** El miembro no existe en el espacio (o ya fue quitado) → 404 */
export class MemberNotFoundError extends Error {}
/** La operación dejaría el espacio sin ningún Admin → 409 */
export class LastAdminError extends Error {}

/**
 * Cambia el rol o quita a un miembro, en una transacción que comprueba que el espacio no se quede
 * sin Admin. Quitar es un borrado lógico de la membresía: pierde el acceso al instante (cada
 * petición revisa la membresía).
 */
async function changeMembership(
  db: Db,
  actorId: string,
  workspaceId: string,
  userId: string,
  change: { role: MembershipRole } | { remove: true },
) {
  await db.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { workspaceId, userId, ...notDeleted },
      select: { id: true, role: true },
    });
    if (!membership) throw new MemberNotFoundError();

    const losesAdmin =
      membership.role === 'ADMIN' && ('remove' in change || change.role !== 'ADMIN');
    if (losesAdmin) {
      const admins = await tx.membership.count({
        where: { ...activeMembers(workspaceId), role: 'ADMIN' },
      });
      if (admins <= 1) throw new LastAdminError();
    }

    await tx.membership.update({
      where: { id: membership.id },
      data:
        'remove' in change
          ? auditSoftDelete(actorId)
          : { role: change.role, ...auditUpdate(actorId) },
    });
  });
}

export function changeMemberRole(
  db: Db,
  actorId: string,
  workspaceId: string,
  userId: string,
  role: MembershipRole,
) {
  return changeMembership(db, actorId, workspaceId, userId, { role });
}

export function removeMember(db: Db, actorId: string, workspaceId: string, userId: string) {
  return changeMembership(db, actorId, workspaceId, userId, { remove: true });
}

/**
 * Cambia el nombre visible del espacio. Es solo una etiqueta: todo (permisos, enlaces, apps
 * externas) se relaciona por el ID, que no cambia.
 */
export async function renameWorkspace(
  db: Db,
  actorId: string,
  workspaceId: string,
  { name }: CreateWorkspaceRequest,
) {
  return db.workspace.update({
    where: { id: workspaceId },
    data: { name, ...auditUpdate(actorId) },
    select: { id: true, name: true },
  });
}

/** Crea un workspace y deja a quien lo crea como su Admin, en una sola transacción */
export async function createWorkspace(
  db: Db,
  actorId: string,
  { name }: CreateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  return db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { name, ...auditCreate(actorId) },
    });
    const membership = await tx.membership.create({
      data: { workspaceId: workspace.id, userId: actorId, role: 'ADMIN', ...auditCreate(actorId) },
    });
    await seedCatalogs(tx, workspace.id, actorId);
    return { id: workspace.id, name: workspace.name, role: membership.role };
  });
}
