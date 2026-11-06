import { z } from 'zod';
import { currentUserSchema, emailSchema, passwordSchema, personNameSchema } from './auth.js';
import { membershipRoleSchema } from './workspaces.js';

/** Como en Gestor de Proyectos: el enlace es de un solo uso y caduca a las 48 horas */
export const INVITATION_TTL_HOURS = 48;

/** Cuerpo de POST /workspaces/:workspaceId/invitations */
export const createInvitationRequestSchema = z.object({
  email: emailSchema,
  role: membershipRoleSchema,
});
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;

/** Invitación pendiente (ni aceptada, ni revocada, ni caducada) */
export const invitationSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: membershipRoleSchema,
  expiresAt: z.iso.datetime(),
});
export type Invitation = z.infer<typeof invitationSchema>;

export const invitationListSchema = z.array(invitationSchema);

/**
 * Respuesta al crear: el token viaja **solo esta vez**; en la BD queda únicamente su hash.
 * La web arma el enlace con él para que el Admin lo copie y lo envíe.
 */
export const createInvitationResponseSchema = z.object({
  invitation: invitationSchema,
  token: z.string(),
});
export type CreateInvitationResponse = z.infer<typeof createInvitationResponseSchema>;

// --- Aceptar una invitación ---
// El token viaja siempre en el cuerpo (POST), nunca en la URL: así no queda en registros.

/** Token del enlace: 32 bytes en base64url (43 caracteres) */
export const invitationTokenSchema = z.string().regex(/^[\w-]{43}$/, 'Enlace no válido');

/** Cuerpo de POST /invitations/preview y POST /invitations/accept */
export const invitationTokenRequestSchema = z.object({ token: invitationTokenSchema });
export type InvitationTokenRequest = z.infer<typeof invitationTokenRequestSchema>;

/** Lo que ve la persona invitada antes de aceptar */
export const invitationPreviewSchema = z.object({
  workspaceName: z.string(),
  email: z.string(),
  role: membershipRoleSchema,
  /** Si ese correo ya tiene cuenta: entonces inicia sesión en vez de crear una */
  hasAccount: z.boolean(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

/** Cuerpo de POST /invitations/register: crear la cuenta al aceptar */
export const registerFromInvitationRequestSchema = z.object({
  token: invitationTokenSchema,
  name: personNameSchema,
  password: passwordSchema,
});
export type RegisterFromInvitationRequest = z.infer<typeof registerFromInvitationRequestSchema>;

/** Respuesta al aceptar: la sesión queda iniciada y la web lleva al workspace */
export const acceptInvitationResponseSchema = z.object({
  workspaceId: z.uuid(),
  user: currentUserSchema,
});
export type AcceptInvitationResponse = z.infer<typeof acceptInvitationResponseSchema>;
