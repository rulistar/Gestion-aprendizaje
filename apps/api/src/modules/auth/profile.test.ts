import { currentUserSchema } from '@aprendizaje/shared';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { createFirstAdmin } from '../setup/first-admin.js';
import { SESSION_COOKIE } from './session.js';

const db = createTestDb();
const credentials = { email: 'ana@example.com', password: 'una-clave-bien-larga' };
const NEW_PASSWORD = 'otra-clave-todavia-mas-larga';

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

/** Inicia sesión y devuelve las cookies de esa sesión */
async function login(body: object = credentials) {
  const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: body });
  expect(response.statusCode).toBe(200);
  const sid = response.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
  return { [SESSION_COOKIE]: sid };
}

function me(cookies: Record<string, string>) {
  return app.inject({ url: '/api/v1/auth/me', cookies });
}

describe('mi perfil (HU-14)', () => {
  it('cambia mi nombre, sin espacios de sobra, y queda quién lo cambió', async () => {
    const cookies = await login();
    const ana = await db.user.findUniqueOrThrow({ where: { email: credentials.email } });

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me/name',
      cookies,
      payload: { name: '  Ana López ' },
    });
    expect(response.statusCode).toBe(200);
    expect(currentUserSchema.parse(response.json()).name).toBe('Ana López');
    const updated = await db.user.findUniqueOrThrow({ where: { id: ana.id } });
    expect(updated.updatedById).toBe(ana.id);

    const empty = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me/name',
      cookies,
      payload: { name: '   ' },
    });
    expect(empty.statusCode).toBe(400);
  });

  it('cambiar la contraseña pide la actual y cierra mis demás sesiones', async () => {
    const cookies = await login();
    const elsewhere = await login();

    const wrong = await app.inject({
      method: 'PUT',
      url: '/api/v1/auth/me/password',
      cookies,
      payload: {
        currentPassword: 'no-es-la-clave',
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      },
    });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json<{ message: string }>().message).toBe('La contraseña actual no es correcta');

    const mismatch = await app.inject({
      method: 'PUT',
      url: '/api/v1/auth/me/password',
      cookies,
      payload: {
        currentPassword: credentials.password,
        newPassword: NEW_PASSWORD,
        confirmPassword: 'otra-cosa-distinta',
      },
    });
    expect(mismatch.statusCode).toBe(400);

    const changed = await app.inject({
      method: 'PUT',
      url: '/api/v1/auth/me/password',
      cookies,
      payload: {
        currentPassword: credentials.password,
        newPassword: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      },
    });
    expect(changed.statusCode).toBe(204);
    expect((await me(cookies)).statusCode).toBe(200);
    expect((await me(elsewhere)).statusCode).toBe(401);

    // La anterior ya no sirve; la nueva, sí
    const old = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: credentials,
    });
    expect(old.statusCode).toBe(401);
    await login({ email: credentials.email, password: NEW_PASSWORD });
  });

  it('cambiar el correo lo guarda en minúsculas, no acepta uno en uso y cierra mis demás sesiones', async () => {
    const cookies = await login();
    const elsewhere = await login();
    await db.user.create({ data: { email: 'beto@example.com', name: 'Beto' } });

    const taken = await app.inject({
      method: 'PUT',
      url: '/api/v1/auth/me/email',
      cookies,
      payload: { email: 'Beto@Example.com', currentPassword: credentials.password },
    });
    expect(taken.statusCode).toBe(409);

    const wrong = await app.inject({
      method: 'PUT',
      url: '/api/v1/auth/me/email',
      cookies,
      payload: { email: 'ana.lopez@example.com', currentPassword: 'no-es-la-clave' },
    });
    expect(wrong.statusCode).toBe(400);

    const changed = await app.inject({
      method: 'PUT',
      url: '/api/v1/auth/me/email',
      cookies,
      payload: { email: '  Ana.Lopez@Example.com ', currentPassword: credentials.password },
    });
    expect(changed.statusCode).toBe(200);
    expect(currentUserSchema.parse(changed.json()).email).toBe('ana.lopez@example.com');
    expect((await me(elsewhere)).statusCode).toBe(401);
    await login({ email: 'ana.lopez@example.com', password: credentials.password });
  });

  it('sin sesión no se puede cambiar nada', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me/name',
      payload: { name: 'Intruso' },
    });
    expect(response.statusCode).toBe(401);
  });

  // Cada intento verifica la contraseña con Argon2, lento a propósito: con la máquina ocupada puede
  // pasar de los 5 s por omisión. Se juntan los códigos para que, si falla, se vea la secuencia (TEC-11)
  it(
    'limita los intentos con la contraseña actual, como el login',
    { timeout: 20_000 },
    async () => {
      const cookies = await login();
      const attempt = () =>
        app.inject({
          method: 'PUT',
          url: '/api/v1/auth/me/email',
          cookies,
          payload: { email: 'nuevo@example.com', currentPassword: 'no-es-la-clave' },
        });
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) statuses.push((await attempt()).statusCode);
      expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
    },
  );
});
