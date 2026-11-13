import { completePasswordResetSchema, passwordResetTokenRequestSchema } from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { authRateLimit } from '../../security.js';
import { getCurrentUser } from '../auth/current-user.js';
import { startSession } from '../auth/session.js';
import {
  completePasswordReset,
  InvalidResetError,
  previewPasswordReset,
} from './password-reset.service.js';

const INVALID_LINK =
  'El enlace no es válido, ya se usó o caducó. Pide uno nuevo al Admin del sistema.';

/** Límite de intentos por IP + enlace, como al aceptar una invitación; el token no se registra */
function resetRateLimitKey(request: FastifyRequest): string {
  const body = request.body as { token?: unknown } | undefined;
  return `${request.ip}|${typeof body?.token === 'string' ? body.token : ''}`;
}

const rateLimited = {
  config: { rateLimit: { ...authRateLimit, hook: 'preHandler', keyGenerator: resetRateLimitKey } },
} as const;

/** Restablecer una contraseña olvidada (HU-15). Rutas públicas: la "llave" es el token del enlace */
export const passwordResetRoutes: FastifyPluginCallback = (app, _options, done) => {
  // Para quién es el enlace (POST para que el token no vaya en la URL)
  app.post('/password-resets/preview', rateLimited, async (request, reply) => {
    const parsed = passwordResetTokenRequestSchema.safeParse(request.body);
    const preview = parsed.success ? await previewPasswordReset(app.db, parsed.data.token) : null;
    return preview ?? reply.code(404).send({ message: INVALID_LINK });
  });

  // Guarda la contraseña nueva, cierra las sesiones de la cuenta y deja la sesión iniciada
  app.post('/password-resets/complete', rateLimited, async (request, reply) => {
    const parsed = completePasswordResetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    try {
      const userId = await completePasswordReset(app.db, parsed.data.token, parsed.data.password);
      await startSession(request, reply, userId);
      return getCurrentUser(app.db, userId);
    } catch (error) {
      if (error instanceof InvalidResetError) {
        return reply.code(404).send({ message: INVALID_LINK });
      }
      throw error;
    }
  });

  done();
};
