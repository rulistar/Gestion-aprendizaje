import { z } from 'zod';
import { workspaceSummarySchema } from './workspaces.js';

/** Correo normalizado: sin espacios y en minúsculas, para que no haya dos cuentas "iguales" */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Correo no válido'));

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(100, 'Máximo 100 caracteres');

/**
 * Política mínima de contraseñas (OWASP): longitud antes que complejidad.
 * El máximo evita que una contraseña enorme haga trabajar de más al hash.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(256, 'Máximo 256 caracteres');

/** El login no aplica la política de longitud: si cambia, las contraseñas antiguas siguen sirviendo */
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria').max(256),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Usuario con sesión iniciada: respuesta de POST /auth/login y GET /auth/me */
export const currentUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  isSystemAdmin: z.boolean(),
  workspaces: z.array(workspaceSummarySchema),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
