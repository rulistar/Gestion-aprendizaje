import { randomBytes } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { userWithSession } from '../../test/users.js';
import { resetPasswordByEmail, ResetPasswordError } from './reset-password.js';

const db = createTestDb();
const app = buildApp({ db });

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

const newPassword = () => randomBytes(16).toString('hex');
const login = (email: string, password: string) =>
  app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });

describe('resetPasswordByEmail', () => {
  it('la contraseña nueva entra y normaliza el correo', async () => {
    await userWithSession(db, 'ana@example.com');
    const password = newPassword();

    const user = await resetPasswordByEmail(db, '  ANA@Example.com ', password);

    expect(user.email).toBe('ana@example.com');
    expect((await login('ana@example.com', password)).statusCode).toBe(200);
  });

  it('la contraseña anterior deja de servir', async () => {
    await userWithSession(db, 'ana@example.com');
    const first = newPassword();
    await resetPasswordByEmail(db, 'ana@example.com', first);

    await resetPasswordByEmail(db, 'ana@example.com', newPassword());

    expect((await login('ana@example.com', first)).statusCode).toBe(401);
  });

  it('guarda un hash Argon2id, nunca la contraseña', async () => {
    await userWithSession(db, 'ana@example.com');
    const password = newPassword();

    await resetPasswordByEmail(db, 'ana@example.com', password);

    const { passwordHash } = await db.user.findUniqueOrThrow({
      where: { email: 'ana@example.com' },
    });
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(passwordHash).not.toContain(password);
  });

  it('cierra las sesiones de esa cuenta y no las de las demás', async () => {
    const ana = await userWithSession(db, 'ana@example.com');
    const luis = await userWithSession(db, 'luis@example.com');

    await resetPasswordByEmail(db, 'ana@example.com', newPassword());

    const me = (cookies: Record<string, string>) => app.inject({ url: '/api/v1/auth/me', cookies });
    expect((await me(ana.cookies)).statusCode).toBe(401);
    expect((await me(luis.cookies)).statusCode).toBe(200);
  });

  it('una cuenta desactivada sigue desactivada y no entra', async () => {
    const { user } = await userWithSession(db, 'ana@example.com');
    await db.user.update({ where: { id: user.id }, data: { status: 'DISABLED' } });
    const password = newPassword();

    const result = await resetPasswordByEmail(db, 'ana@example.com', password);

    expect(result.status).toBe('DISABLED');
    expect((await login('ana@example.com', password)).statusCode).toBe(401);
  });

  it('un correo sin cuenta da error y no cambia nada', async () => {
    await expect(
      resetPasswordByEmail(db, 'nadie@example.com', newPassword()),
    ).rejects.toBeInstanceOf(ResetPasswordError);
    expect(await db.user.count()).toBe(0);
  });

  it('rechaza una contraseña corta o un correo inválido, sin tocar la cuenta', async () => {
    const { user } = await userWithSession(db, 'ana@example.com');
    const before = await db.user.findUniqueOrThrow({ where: { id: user.id } });

    await expect(resetPasswordByEmail(db, 'ana@example.com', 'corta123')).rejects.toThrow(
      /Mínimo 12 caracteres/,
    );
    await expect(resetPasswordByEmail(db, 'no-es-correo', newPassword())).rejects.toThrow(
      /Correo no válido/,
    );

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('el mensaje de error nunca incluye la contraseña', async () => {
    const password = 'secreta';
    const error = await resetPasswordByEmail(db, 'ana@example.com', password).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ResetPasswordError);
    expect((error as ResetPasswordError).message).not.toContain(password);
  });
});
