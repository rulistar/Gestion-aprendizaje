import {
  INVITATION_TTL_HOURS,
  type CreateInvitationRequest,
  type CreateInvitationResponse,
  type Invitation,
  type MembershipRole,
} from '@aprendizaje/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, auditUpdate, notDeleted } from '../../db/audit.js';
import { generateToken, hashToken } from '../auth/tokens.js';

/** Lo que se lee de una invitación para mostrarla: nunca el hash del token */
const invitationSelect = { id: true, email: true, role: true, expiresAt: true } as const;

function toInvitation(row: {
  id: string;
  email: string;
  role: MembershipRole;
  expiresAt: Date;
}): Invitation {
  return { ...row, expiresAt: row.expiresAt.toISOString() };
}

/** Pendiente = ni aceptada, ni revocada, ni caducada */
export function pending(now: Date) {
  return { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } };
}

export async function listPendingInvitations(db: Db, workspaceId: string): Promise<Invitation[]> {
  const rows = await db.invitation.findMany({
    where: { workspaceId, ...pending(new Date()) },
    select: invitationSelect,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toInvitation);
}

/** Ya es miembro o ya tiene una invitación pendiente (→ 409) */
export class InvitationConflictError extends Error {}

/** Crea una invitación y devuelve el token una sola vez (en la BD queda su hash) */
export async function createInvitation(
  db: Db,
  actorId: string,
  workspaceId: string,
  { email, role }: CreateInvitationRequest,
): Promise<CreateInvitationResponse> {
  const now = new Date();
  const [isMember, hasPending] = await Promise.all([
    db.membership.count({ where: { workspaceId, ...notDeleted, user: { email } } }),
    db.invitation.count({ where: { email, workspaceId, ...pending(now) } }),
  ]);
  if (isMember > 0) {
    throw new InvitationConflictError('Esa persona ya es miembro de este espacio');
  }
  if (hasPending > 0) {
    throw new InvitationConflictError(
      'Ya hay una invitación pendiente para ese correo; revócala para generar otra',
    );
  }

  const token = generateToken();
  const row = await db.invitation.create({
    data: {
      workspaceId,
      email,
      role,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_HOURS * 3_600_000),
      ...auditCreate(actorId),
    },
    select: invitationSelect,
  });
  return { invitation: toInvitation(row), token };
}

/** Revoca una invitación pendiente del espacio; false si no existe o ya no está pendiente */
export async function revokeInvitation(
  db: Db,
  actorId: string,
  workspaceId: string,
  invitationId: string,
): Promise<boolean> {
  const now = new Date();
  const { count } = await db.invitation.updateMany({
    where: { id: invitationId, workspaceId, ...pending(now) },
    data: { revokedAt: now, revokedById: actorId, ...auditUpdate(actorId) },
  });
  return count > 0;
}
