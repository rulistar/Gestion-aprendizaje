import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../../db/client.js';
import { auditUpdate } from '../../db/audit.js';
import { generateToken, hashToken } from './tokens.js';

export const SESSION_COOKIE = 'sid';

/** Renovar la sesión en cada petición escribiría en la BD sin parar: se renueva como mucho 1 vez/min */
const RENEW_AFTER_MS = 60_000;

function expiresFrom(now: Date, idleMinutes: number): Date {
  return new Date(now.getTime() + idleMinutes * 60_000);
}

interface NewSession {
  userId: string;
  idleMinutes: number;
  ipAddress?: string;
  userAgent?: string | undefined;
}

/** Crea una sesión y devuelve el token (sin hash) para enviarlo en la cookie */
export async function createSession(
  db: Db,
  { userId, idleMinutes, ipAddress, userAgent }: NewSession,
) {
  const token = generateToken();
  const now = new Date();
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      lastSeenAt: now,
      expiresAt: expiresFrom(now, idleMinutes),
      ipAddress: ipAddress ?? null,
      userAgent: userAgent?.slice(0, 500) ?? null,
    },
  });
  return token;
}

/**
 * Busca una sesión vigente de un usuario activo. Si expiró por inactividad (o el usuario fue
 * desactivado) la elimina. Si sigue vigente, extiende su plazo: la expiración cuenta desde el
 * último uso.
 */
export async function findActiveSession(db: Db, token: string, idleMinutes: number) {
  const tokenHash = hashToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: { select: { status: true } } },
  });
  if (!session) return null;

  const now = new Date();
  if (session.expiresAt <= now || session.user.status !== 'ACTIVE') {
    await db.session.deleteMany({ where: { tokenHash } });
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() > RENEW_AFTER_MS) {
    await db.session.update({
      where: { tokenHash },
      data: { lastSeenAt: now, expiresAt: expiresFrom(now, idleMinutes) },
    });
  }
  return { tokenHash, userId: session.userId };
}

export async function deleteSession(db: Db, token: string) {
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function sessionCookieOptions(secure: boolean) {
  return {
    path: '/',
    httpOnly: true, // JavaScript del navegador no puede leerla (protege ante XSS)
    sameSite: 'lax', // otros sitios no pueden enviarla en peticiones que modifican datos
    secure, // solo por HTTPS en producción
  } as const;
}

/**
 * Inicia sesión para `userId` en este navegador: sesión nueva en cada inicio (la anterior, si
 * había, se invalida) y cookie HttpOnly. Lo usan el login y aceptar una invitación.
 */
export async function startSession(request: FastifyRequest, reply: FastifyReply, userId: string) {
  const { db, sessionIdleMinutes, secureCookies } = request.server;
  const previous = request.cookies[SESSION_COOKIE];
  if (previous) await deleteSession(db, previous);

  const token = await createSession(db, {
    userId,
    idleMinutes: sessionIdleMinutes,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  });
  await db.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date(), ...auditUpdate(userId) },
  });
  reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(secureCookies));
}

/**
 * preHandler para rutas que exigen sesión: `{ preHandler: requireAuth }`.
 * Deja el usuario en `request.auth`; sin sesión válida responde 401.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[SESSION_COOKIE];
  const session = token
    ? await findActiveSession(request.server.db, token, request.server.sessionIdleMinutes)
    : null;

  if (!session) {
    return reply
      .clearCookie(SESSION_COOKIE, { path: '/' })
      .code(401)
      .send({ message: 'Inicia sesión para continuar' });
  }
  request.auth = session;
}
