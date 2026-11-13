import { currentUserSchema, passwordResetLinkSchema } from '@aprendizaje/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { userWithSession } from '../../test/users.js';
import { resetPasswordByEmail } from '../auth/reset-password.js';
import { SESSION_COOKIE } from '../auth/session.js';

const db = createTestDb();
const app = buildApp({ db });

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

// Contraseñas generadas en cada corrida: nunca un valor fijo en el código
const newPassword = () => `nueva-${crypto.randomUUID()}`;

/** Admin del sistema y Caro, que olvidó su contraseña */
async function setup() {
  const root = await userWithSession(db, 'root@example.com');
  await db.user.update({ where: { id: root.user.id }, data: { isSystemAdmin: true } });
  const caro = await userWithSession(db, 'caro@example.com');
  return { root, caro };
}

function createReset(cookies: Record<string, string>, userId: string) {
  return app.inject({ method: 'POST', url: `/api/v1/users/${userId}/password-reset`, cookies });
}

function complete(token: string, password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/password-resets/complete',
    payload: { token, password },
  });
}

function login(email: string, password: string) {
  return app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });
}

describe('restablecer contraseña (HU-15)', () => {
  it('el Admin del sistema genera un enlace; con él se crea la contraseña y se entra', async () => {
    const { root, caro } = await setup();
    const created = await createReset(root.cookies, caro.user.id);
    expect(created.statusCode).toBe(200);
    const { token } = passwordResetLinkSchema.parse(created.json());
    // En la BD solo queda el hash
    const row = await db.passwordReset.findFirstOrThrow({ where: { userId: caro.user.id } });
    expect(row.tokenHash).not.toBe(token);
    expect(row.createdById).toBe(root.user.id);

    const preview = await app.inject({
      method: 'POST',
      url: '/api/v1/password-resets/preview',
      payload: { token },
    });
    expect(preview.json()).toEqual({ name: 'caro@example.com', email: 'caro@example.com' });

    const password = newPassword();
    const done = await complete(token, password);
    expect(done.statusCode).toBe(200);
    expect(currentUserSchema.parse(done.json()).id).toBe(caro.user.id);
    expect(done.cookies.some((cookie) => cookie.name === SESSION_COOKIE)).toBe(true);
    // Su sesión anterior se cerró y la contraseña nueva funciona
    const me = await app.inject({ url: '/api/v1/auth/me', cookies: caro.cookies });
    expect(me.statusCode).toBe(401);
    expect((await login('caro@example.com', password)).statusCode).toBe(200);
  });

  it('el enlace sirve una sola vez; uno nuevo invalida el anterior; caducado no sirve', async () => {
    const { root, caro } = await setup();
    const first = passwordResetLinkSchema.parse(
      (await createReset(root.cookies, caro.user.id)).json(),
    );
    const second = passwordResetLinkSchema.parse(
      (await createReset(root.cookies, caro.user.id)).json(),
    );
    expect((await complete(first.token, newPassword())).statusCode).toBe(404);
    expect((await complete(second.token, newPassword())).statusCode).toBe(200);
    const reused = await complete(second.token, newPassword());
    expect(reused.statusCode).toBe(404);
    expect(reused.json<{ message: string }>().message).toContain('Pide uno nuevo');

    const third = passwordResetLinkSchema.parse(
      (await createReset(root.cookies, caro.user.id)).json(),
    );
    await db.passwordReset.updateMany({
      where: { userId: caro.user.id, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await complete(third.token, newPassword())).statusCode).toBe(404);
  });

  it('solo el Admin del sistema genera enlaces, y no para una cuenta desactivada', async () => {
    const { root, caro } = await setup();
    expect((await createReset(caro.cookies, root.user.id)).statusCode).toBe(403);

    await db.user.update({ where: { id: caro.user.id }, data: { status: 'DISABLED' } });
    const disabled = await createReset(root.cookies, caro.user.id);
    expect(disabled.statusCode).toBe(409);

    const unknown = await createReset(root.cookies, '01a18cf0-0000-7000-8000-000000000000');
    expect(unknown.statusCode).toBe(404);
  });

  it('una contraseña corta da 400 y el enlace sigue sirviendo', async () => {
    const { root, caro } = await setup();
    const { token } = passwordResetLinkSchema.parse(
      (await createReset(root.cookies, caro.user.id)).json(),
    );
    expect((await complete(token, 'corta')).statusCode).toBe(400);
    expect((await complete(token, newPassword())).statusCode).toBe(200);
  });

  it('el comando de terminal invalida los enlaces sin usar de esa cuenta', async () => {
    const { root, caro } = await setup();
    const { token } = passwordResetLinkSchema.parse(
      (await createReset(root.cookies, caro.user.id)).json(),
    );
    await resetPasswordByEmail(db, 'caro@example.com', newPassword());
    expect((await complete(token, newPassword())).statusCode).toBe(404);
  });
});
