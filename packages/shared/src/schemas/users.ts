import { z } from 'zod';
import { emailSchema, passwordSchema } from './auth.js';
import { invitationTokenSchema } from './invitations.js';
import { workspaceSummarySchema } from './workspaces.js';

export const userStatusSchema = z.enum(['ACTIVE', 'DISABLED']);
export type UserStatus = z.infer<typeof userStatusSchema>;

/** Una cuenta, vista por el Admin del sistema (HU-15) */
export const systemUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  status: userStatusSchema,
  isSystemAdmin: z.boolean(),
  lastLoginAt: z.iso.datetime().nullable(),
  /** Espacios donde es miembro, con su rol */
  workspaces: z.array(workspaceSummarySchema),
});
export type SystemUser = z.infer<typeof systemUserSchema>;

/** Respuesta de GET /users; por nombre */
export const systemUserListSchema = z.array(systemUserSchema);

/** Cuerpo de PUT /users/:userId/email: corregir el correo de alguien (mismas reglas que HU-14) */
export const changeUserEmailSchema = z.object({ email: emailSchema });
export type ChangeUserEmailInput = z.infer<typeof changeUserEmailSchema>;

/** Cuerpo de PATCH /users/:userId/status: desactivar o reactivar una cuenta */
export const setUserStatusSchema = z.object({ status: userStatusSchema });
export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>;

// --- Restablecer una contraseña olvidada (HU-15) ---

/** Como las invitaciones: un solo uso y caduca a las 48 horas */
export const PASSWORD_RESET_TTL_HOURS = 48;

/** Respuesta de POST /users/:userId/password-reset: el token se devuelve una sola vez */
export const passwordResetLinkSchema = z.object({
  token: z.string(),
  expiresAt: z.iso.datetime(),
});
export type PasswordResetLink = z.infer<typeof passwordResetLinkSchema>;

/** Cuerpo de POST /password-resets/preview */
export const passwordResetTokenRequestSchema = z.object({ token: invitationTokenSchema });

/** Para quién es el enlace (se muestra antes de pedir la contraseña nueva) */
export const passwordResetPreviewSchema = z.object({ name: z.string(), email: z.email() });
export type PasswordResetPreview = z.infer<typeof passwordResetPreviewSchema>;

/** Cuerpo de POST /password-resets/complete: la contraseña nueva (la web pide repetirla) */
export const completePasswordResetSchema = z.object({
  token: invitationTokenSchema,
  password: passwordSchema,
});
export type CompletePasswordResetInput = z.infer<typeof completePasswordResetSchema>;
