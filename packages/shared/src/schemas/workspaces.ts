import { z } from 'zod';

export const membershipRoleSchema = z.enum(['ADMIN', 'MEMBER', 'VIEWER']);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(80, 'Máximo 80 caracteres');

/** Cuerpo de POST /workspaces y de PATCH /workspaces/:workspaceId (renombrar) */
export const createWorkspaceRequestSchema = z.object({ name: workspaceNameSchema });
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;

/** Un workspace visto por un miembro: incluye el rol que tiene en él */
export const workspaceSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: membershipRoleSchema,
});
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;

/** Respuesta de GET /workspaces */
export const workspaceListSchema = z.array(workspaceSummarySchema);

/** Un miembro activo del workspace */
export const memberSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  /** Solo lo recibe quien gestiona miembros (el Admin); para los demás, null */
  email: z.string().nullable(),
  role: membershipRoleSchema,
});
export type Member = z.infer<typeof memberSchema>;

/** Respuesta de GET /workspaces/:workspaceId/members */
export const memberListSchema = z.array(memberSchema);

/** Cuerpo de PATCH /workspaces/:workspaceId/members/:userId: cambiar el rol */
export const updateMemberRoleRequestSchema = z.object({ role: membershipRoleSchema });
export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleRequestSchema>;
