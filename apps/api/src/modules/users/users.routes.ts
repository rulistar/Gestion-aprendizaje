import { changeUserEmailSchema, setUserStatusSchema } from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { EmailTakenError } from '../auth/profile.service.js';
import { requireAuth } from '../auth/session.js';
import { createPasswordReset, DisabledAccountError } from './password-reset.service.js';
import {
  changeUserEmail,
  listSystemUsers,
  SelfDisableError,
  setUserStatus,
} from './users.service.js';

const userParamsSchema = z.object({ userId: z.uuid() });

function userNotFound(reply: FastifyReply) {
  return reply.code(404).send({ message: 'Usuario no encontrado' });
}

/** preHandler: solo el Admin del sistema (el Admin de un espacio no cambia correos; HU-15) */
async function requireSystemAdmin(request: FastifyRequest, reply: FastifyReply) {
  const actor = await request.server.db.user.findUnique({
    where: { id: request.auth!.userId },
    select: { isSystemAdmin: true },
  });
  if (!actor?.isSystemAdmin) {
    return reply.code(403).send({ message: 'Solo el Admin del sistema administra las cuentas' });
  }
}

/**
 * Usuarios del sistema (HU-15): ver todas las cuentas, corregir correos, desactivar cuentas y
 * generar enlaces para restablecer contraseñas (HU-15)
 */
export const usersRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', requireSystemAdmin);

  app.get('/users', async () => listSystemUsers(app.db));

  app.put('/users/:userId/email', async (request, reply) => {
    const params = userParamsSchema.safeParse(request.params);
    if (!params.success) return userNotFound(reply);
    const parsed = changeUserEmailSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    try {
      const found = await changeUserEmail(
        app.db,
        request.auth!,
        params.data.userId,
        parsed.data.email,
      );
      if (!found) return userNotFound(reply);
    } catch (error) {
      if (error instanceof EmailTakenError) {
        return reply.code(409).send({ message: 'Ese correo ya lo usa otra cuenta' });
      }
      throw error;
    }
    return listSystemUsers(app.db);
  });

  app.patch('/users/:userId/status', async (request, reply) => {
    const params = userParamsSchema.safeParse(request.params);
    if (!params.success) return userNotFound(reply);
    const parsed = setUserStatusSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    try {
      const found = await setUserStatus(
        app.db,
        request.auth!.userId,
        params.data.userId,
        parsed.data.status,
      );
      if (!found) return userNotFound(reply);
    } catch (error) {
      if (error instanceof SelfDisableError) {
        return reply.code(409).send({ message: 'No puedes desactivar tu propia cuenta' });
      }
      throw error;
    }
    return listSystemUsers(app.db);
  });

  // Enlace para que cree una contraseña nueva (HU-15); el token solo se ve en esta respuesta
  app.post('/users/:userId/password-reset', async (request, reply) => {
    const params = userParamsSchema.safeParse(request.params);
    if (!params.success) return userNotFound(reply);
    try {
      const link = await createPasswordReset(app.db, request.auth!.userId, params.data.userId);
      return link ?? userNotFound(reply);
    } catch (error) {
      if (error instanceof DisabledAccountError) {
        return reply.code(409).send({
          message: 'La cuenta está desactivada: reactívala antes de restablecer su contraseña',
        });
      }
      throw error;
    }
  });

  done();
};
