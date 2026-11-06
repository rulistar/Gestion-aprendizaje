import {
  invitationTokenRequestSchema,
  registerFromInvitationRequestSchema,
} from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { authRateLimit } from '../../security.js';
import { getCurrentUser } from '../auth/current-user.js';
import { requireAuth, startSession } from '../auth/session.js';
import {
  acceptAsExistingUser,
  acceptAsNewUser,
  AccountExistsError,
  InvalidInvitationError,
  previewInvitation,
  WrongAccountError,
} from './accept.service.js';

const INVALID_LINK =
  'El enlace no es válido, ya se usó o caducó. Pide uno nuevo a quien te invitó.';

/**
 * Límite de intentos por IP + enlace: frena a quien insiste con un enlace (o fuerza a calcular
 * muchos hashes Argon2 al registrarse). El token solo se usa como clave en memoria; no se registra.
 */
function acceptRateLimitKey(request: FastifyRequest): string {
  const body = request.body as { token?: unknown } | undefined;
  return `${request.ip}|${typeof body?.token === 'string' ? body.token : ''}`;
}

const rateLimited = {
  config: { rateLimit: { ...authRateLimit, hook: 'preHandler', keyGenerator: acceptRateLimitKey } },
} as const;

/** Traduce los errores del servicio a respuestas HTTP */
function sendAcceptError(reply: FastifyReply, error: unknown) {
  if (error instanceof InvalidInvitationError) {
    return reply.code(404).send({ message: INVALID_LINK });
  }
  if (error instanceof AccountExistsError) {
    return reply.code(409).send({
      message: 'Ese correo ya tiene una cuenta: inicia sesión para aceptar la invitación',
    });
  }
  if (error instanceof WrongAccountError) {
    return reply.code(403).send({
      message: 'Esta invitación es para otro correo. Cierra sesión y entra con la cuenta invitada.',
    });
  }
  throw error;
}

/** Aceptar una invitación. Rutas públicas: la "llave" es el token del enlace */
export const acceptInvitationRoutes: FastifyPluginCallback = (app, _options, done) => {
  // A qué workspace y con qué rol me invitan (POST para que el token no vaya en la URL)
  app.post('/invitations/preview', rateLimited, async (request, reply) => {
    const parsed = invitationTokenRequestSchema.safeParse(request.body);
    const preview = parsed.success ? await previewInvitation(app.db, parsed.data.token) : null;
    return preview ?? reply.code(404).send({ message: INVALID_LINK });
  });

  // No tengo cuenta: la creo, entro al workspace y quedo con la sesión iniciada
  app.post('/invitations/register', rateLimited, async (request, reply) => {
    const parsed = registerFromInvitationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    try {
      const { userId, workspaceId } = await acceptAsNewUser(app.db, parsed.data.token, parsed.data);
      await startSession(request, reply, userId);
      return { workspaceId, user: await getCurrentUser(app.db, userId) };
    } catch (error) {
      return sendAcceptError(reply, error);
    }
  });

  // Ya tengo cuenta y sesión iniciada con el correo invitado: sumo el workspace
  app.post(
    '/invitations/accept',
    { ...rateLimited, preHandler: requireAuth },
    async (request, reply) => {
      const parsed = invitationTokenRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(404).send({ message: INVALID_LINK });
      try {
        const userId = request.auth!.userId;
        const { workspaceId } = await acceptAsExistingUser(app.db, parsed.data.token, userId);
        return { workspaceId, user: await getCurrentUser(app.db, userId) };
      } catch (error) {
        return sendAcceptError(reply, error);
      }
    },
  );

  done();
};
