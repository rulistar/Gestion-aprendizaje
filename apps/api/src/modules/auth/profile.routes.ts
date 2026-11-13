import {
  changeMyEmailSchema,
  changeMyPasswordSchema,
  updateMyNameSchema,
} from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { authRateLimit } from '../../security.js';
import { getCurrentUser } from './current-user.js';
import {
  changeMyEmail,
  changeMyPassword,
  EmailTakenError,
  updateMyName,
  WrongPasswordError,
} from './profile.service.js';
import { requireAuth } from './session.js';

function profileError(reply: FastifyReply, error: unknown) {
  // 400 y no 401: un 401 haría que la web cerrara la sesión
  if (error instanceof WrongPasswordError) {
    return reply.code(400).send({ message: 'La contraseña actual no es correcta' });
  }
  if (error instanceof EmailTakenError) {
    return reply.code(409).send({ message: 'Ese correo ya lo usa otra cuenta' });
  }
  throw error;
}

/**
 * Mi perfil (HU-14, como HU-29 de Gestor de Proyectos): cada quien cambia su nombre, su correo y su contraseña sin pedírselo al
 * Admin. Correo y contraseña piden la contraseña actual, tienen límite de intentos (como el
 * login) y cierran las demás sesiones del usuario.
 */
export const profileRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.patch('/auth/me/name', async (request, reply) => {
    const parsed = updateMyNameSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    await updateMyName(app.db, request.auth!.userId, parsed.data.name);
    return getCurrentUser(app.db, request.auth!.userId);
  });

  app.put('/auth/me/email', { config: { rateLimit: authRateLimit } }, async (request, reply) => {
    const parsed = changeMyEmailSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    try {
      await changeMyEmail(app.db, request.auth!, parsed.data);
    } catch (error) {
      return profileError(reply, error);
    }
    return getCurrentUser(app.db, request.auth!.userId);
  });

  app.put('/auth/me/password', { config: { rateLimit: authRateLimit } }, async (request, reply) => {
    const parsed = changeMyPasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    try {
      await changeMyPassword(app.db, request.auth!, parsed.data);
    } catch (error) {
      return profileError(reply, error);
    }
    return reply.code(204).send();
  });

  done();
};
