import { loginRequestSchema } from '@aprendizaje/shared';
import type { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { authRateLimit } from '../../security.js';
import { getCurrentUser } from './current-user.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  deleteSession,
  requireAuth,
  SESSION_COOKIE,
  sessionCookieOptions,
  startSession,
} from './session.js';

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';

/**
 * Hash de una contraseña cualquiera, calculado una sola vez. Si el correo no existe se verifica
 * contra él: así la respuesta tarda lo mismo y el tiempo no revela qué correos tienen cuenta.
 */
let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= hashPassword('contraseña-ficticia-para-igualar-tiempos');
  return dummyHash;
}

/** El límite de intentos cuenta por IP + correo: frena a quien prueba contraseñas para una cuenta */
function loginRateLimitKey(request: FastifyRequest): string {
  const body = request.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return `${request.ip}|${email}`;
}

export const authRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.post(
    '/auth/login',
    {
      config: {
        // preHandler: el límite se evalúa con el cuerpo ya leído, para poder usar el correo
        rateLimit: { ...authRateLimit, hook: 'preHandler', keyGenerator: loginRateLimitKey },
      },
    },
    async (request, reply) => {
      const parsed = loginRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: 'Escribe tu correo y tu contraseña' });
      }
      const { email, password } = parsed.data;

      const user = await app.db.user.findUnique({ where: { email } });
      const passwordOk = user?.passwordHash
        ? await verifyPassword(user.passwordHash, password)
        : await verifyPassword(await getDummyHash(), password).then(() => false);

      if (!user || !passwordOk || user.status !== 'ACTIVE' || user.kind !== 'HUMAN') {
        return reply.code(401).send({ message: INVALID_CREDENTIALS });
      }

      await startSession(request, reply, user.id);
      return getCurrentUser(app.db, user.id);
    },
  );

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    // Se borra en el servidor: aunque alguien hubiera copiado la cookie, ya no sirve
    if (token) await deleteSession(app.db, token);
    return reply
      .clearCookie(SESSION_COOKIE, sessionCookieOptions(app.secureCookies))
      .code(204)
      .send();
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => {
    return getCurrentUser(app.db, request.auth!.userId);
  });

  done();
};
