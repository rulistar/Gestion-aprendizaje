import { currentUserSchema } from '@aprendizaje/shared';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { createFirstAdmin, FIRST_WORKSPACE_NAME } from '../setup/first-admin.js';
import { SESSION_COOKIE } from './session.js';
import { hashToken } from './tokens.js';

const db = createTestDb();
const credentials = { email: 'ana@example.com', password: 'una-clave-bien-larga' };

// App nueva en cada prueba: el contador del límite de intentos vive en memoria
let app: ReturnType<typeof buildApp>;

beforeEach(async () => {
  await resetDb(db);
  await createFirstAdmin(db, { name: 'Ana', ...credentials });
  app = buildApp({ db });
});

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  await db.$disconnect();
});

function login(body: unknown = credentials, cookie?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: body as object,
    ...(cookie ? { cookies: { [SESSION_COOKIE]: cookie } } : {}),
  });
}

function sessionCookie(response: LightMyRequestResponse) {
  return response.cookies.find((c) => c.name === SESSION_COOKIE);
}

async function loginToken() {
  const cookie = sessionCookie(await login());
  if (!cookie) throw new Error('El login no devolvió la cookie de sesión');
  return cookie.value;
}

function me(token?: string) {
  return app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    ...(token ? { cookies: { [SESSION_COOKIE]: token } } : {}),
  });
}

describe('POST /auth/login', () => {
  it('con credenciales correctas devuelve el usuario y una cookie segura', async () => {
    const response = await login({ ...credentials, email: ' ANA@example.com ' });

    expect(response.statusCode).toBe(200);
    const user = currentUserSchema.parse(response.json());
    expect(user).toMatchObject({ email: 'ana@example.com', isSystemAdmin: true });
    expect(user.workspaces).toEqual([
      expect.objectContaining({ name: FIRST_WORKSPACE_NAME, role: 'ADMIN' }),
    ]);

    const cookie = sessionCookie(response);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(cookie?.secure).toBeFalsy(); // en localhost no hay HTTPS
  });

  it('en la BD guarda solo el hash del token, nunca el token', async () => {
    const token = await loginToken();

    const sessions = await db.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tokenHash).toBe(hashToken(token));
    expect(sessions[0]?.tokenHash).not.toBe(token);
  });

  it('en producción la cookie es Secure', async () => {
    const prod = buildApp({ db, security: { production: true }, trustProxy: true });
    const response = await prod.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: credentials,
      headers: { 'x-forwarded-proto': 'https' },
    });
    await prod.close();

    expect(sessionCookie(response)?.secure).toBe(true);
  });

  it('responde el mismo mensaje genérico si la contraseña es incorrecta o el correo no existe', async () => {
    const wrongPassword = await login({ ...credentials, password: 'no-es-la-clave' });
    const unknownEmail = await login({ ...credentials, email: 'nadie@example.com' });

    for (const response of [wrongPassword, unknownEmail]) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ message: 'Correo o contraseña incorrectos' });
      expect(sessionCookie(response)).toBeUndefined();
    }
  });

  it('un usuario desactivado no puede iniciar sesión', async () => {
    await db.user.updateMany({ data: { status: 'DISABLED' } });

    expect((await login()).statusCode).toBe(401);
  });

  it('rechaza un cuerpo inválido con 400', async () => {
    expect((await login({ email: 'ana@example.com' })).statusCode).toBe(400);
  });

  it('genera un token nuevo en cada login e invalida el anterior de ese navegador', async () => {
    const first = await loginToken();
    const second = sessionCookie(await login(credentials, first))?.value;

    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect((await me(first)).statusCode).toBe(401);
    expect((await me(second)).statusCode).toBe(200);
  });

  // Argon2 es lento a propósito: más tiempo que los 5 s por omisión, y la secuencia completa si falla
  it(
    'limita los intentos por IP y correo: el 6.º seguido responde 429',
    { timeout: 20_000 },
    async () => {
      const wrong = { ...credentials, password: 'no-es-la-clave' };
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) statuses.push((await login(wrong)).statusCode);
      expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
      // Otro correo desde la misma IP tiene su propio contador
      expect((await login({ ...wrong, email: 'luis@example.com' })).statusCode).toBe(401);
    },
  );
});

describe('GET /auth/me', () => {
  it('sin sesión responde 401', async () => {
    expect((await me()).statusCode).toBe(401);
    expect((await me('token-inventado')).statusCode).toBe(401);
  });

  it('con sesión devuelve el usuario actual', async () => {
    const response = await me(await loginToken());

    expect(response.statusCode).toBe(200);
    expect(currentUserSchema.parse(response.json()).email).toBe('ana@example.com');
  });
});

describe('POST /auth/logout', () => {
  it('invalida la sesión en el servidor y borra la cookie', async () => {
    const token = await loginToken();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { [SESSION_COOKIE]: token },
    });

    expect(response.statusCode).toBe(204);
    expect(sessionCookie(response)?.value).toBe(''); // el navegador la elimina
    expect(await db.session.count()).toBe(0);
    // Aunque alguien hubiera copiado la cookie, ya no sirve
    expect((await me(token)).statusCode).toBe(401);
  });
});

describe('expiración por inactividad', () => {
  it('una sesión vencida responde 401 y se elimina', async () => {
    const token = await loginToken();
    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await me(token)).statusCode).toBe(401);
    expect(await db.session.count()).toBe(0);
  });

  it('usar la sesión extiende su plazo desde el último uso', async () => {
    const token = await loginToken();
    const twoMinutesAgo = new Date(Date.now() - 2 * 60_000);
    await db.session.updateMany({
      data: { lastSeenAt: twoMinutesAgo, expiresAt: new Date(Date.now() + 60_000) },
    });

    expect((await me(token)).statusCode).toBe(200);

    const session = await db.session.findFirstOrThrow();
    expect(session.lastSeenAt.getTime()).toBeGreaterThan(twoMinutesAgo.getTime());
    // Ahora vence 60 min (valor por defecto) después del último uso
    expect(session.expiresAt.getTime() - session.lastSeenAt.getTime()).toBe(60 * 60_000);
  });
});
