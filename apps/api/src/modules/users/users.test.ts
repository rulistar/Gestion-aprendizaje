import { systemUserListSchema } from '@aprendizaje/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { createWorkspace } from '../workspaces/workspaces.service.js';

const db = createTestDb();
const app = buildApp({ db });

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

/** Admin del sistema con un espacio donde Beto es Admin del espacio y Caro, miembro */
async function setup() {
  const root = await userWithSession(db, 'root@example.com');
  await db.user.update({ where: { id: root.user.id }, data: { isSystemAdmin: true } });
  const ws = await createWorkspace(db, root.user.id, { name: 'Idiomas' });
  const beto = await userWithSession(db, 'beto@example.com');
  await addMember(db, ws.id, beto.user.id, 'ADMIN');
  const caro = await userWithSession(db, 'caro@example.com');
  await addMember(db, ws.id, caro.user.id, 'MEMBER');
  return { root, ws, beto, caro };
}

function me(cookies: Record<string, string>) {
  return app.inject({ url: '/api/v1/auth/me', cookies });
}

describe('usuarios del sistema (HU-15)', () => {
  it('el Admin del sistema ve todas las cuentas con sus espacios', async () => {
    const { root } = await setup();
    const response = await app.inject({ url: '/api/v1/users', cookies: root.cookies });
    expect(response.statusCode).toBe(200);
    const users = systemUserListSchema.parse(response.json());
    expect(
      users.map((u) => [u.email, u.status, u.workspaces.map((w) => `${w.name}:${w.role}`)]),
    ).toEqual([
      ['beto@example.com', 'ACTIVE', ['Idiomas:ADMIN']],
      ['caro@example.com', 'ACTIVE', ['Idiomas:MEMBER']],
      ['root@example.com', 'ACTIVE', ['Idiomas:ADMIN']],
    ]);
  });

  it('el Admin de un espacio no administra cuentas', async () => {
    const { beto, caro } = await setup();
    expect((await app.inject({ url: '/api/v1/users', cookies: beto.cookies })).statusCode).toBe(
      403,
    );
    const change = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${caro.user.id}/email`,
      cookies: beto.cookies,
      payload: { email: 'caro.nueva@example.com' },
    });
    expect(change.statusCode).toBe(403);
  });

  it('corrige el correo de alguien (en minúsculas, sin repetir) y cierra sus sesiones', async () => {
    const { root, caro } = await setup();
    const taken = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${caro.user.id}/email`,
      cookies: root.cookies,
      payload: { email: 'BETO@example.com' },
    });
    expect(taken.statusCode).toBe(409);

    const changed = await app.inject({
      method: 'PUT',
      url: `/api/v1/users/${caro.user.id}/email`,
      cookies: root.cookies,
      payload: { email: ' Caro.Lopez@Example.com ' },
    });
    expect(changed.statusCode).toBe(200);
    const caroNow = systemUserListSchema.parse(changed.json()).find((u) => u.id === caro.user.id);
    expect(caroNow?.email).toBe('caro.lopez@example.com');
    expect((await me(caro.cookies)).statusCode).toBe(401);
    // El Admin sigue con su sesión
    expect((await me(root.cookies)).statusCode).toBe(200);

    const unknown = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/01a18cf0-0000-7000-8000-000000000000/email',
      cookies: root.cookies,
      payload: { email: 'nadie@example.com' },
    });
    expect(unknown.statusCode).toBe(404);
  });

  it('desactivar cierra sus sesiones y le impide entrar; reactivar lo devuelve', async () => {
    const { root, caro } = await setup();
    const url = `/api/v1/users/${caro.user.id}/status`;
    const disabled = await app.inject({
      method: 'PATCH',
      url,
      cookies: root.cookies,
      payload: { status: 'DISABLED' },
    });
    expect(disabled.statusCode).toBe(200);
    expect((await me(caro.cookies)).statusCode).toBe(401);
    expect(await db.session.count({ where: { userId: caro.user.id } })).toBe(0);
    const row = await db.user.findUniqueOrThrow({ where: { id: caro.user.id } });
    expect(row.status).toBe('DISABLED');
    expect(row.updatedById).toBe(root.user.id);

    const enabled = await app.inject({
      method: 'PATCH',
      url,
      cookies: root.cookies,
      payload: { status: 'ACTIVE' },
    });
    expect(enabled.statusCode).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: caro.user.id } })).status).toBe(
      'ACTIVE',
    );
  });

  it('el Admin del sistema no puede desactivarse a sí mismo', async () => {
    const { root } = await setup();
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/users/${root.user.id}/status`,
      cookies: root.cookies,
      payload: { status: 'DISABLED' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ message: string }>().message).toBe(
      'No puedes desactivar tu propia cuenta',
    );
  });
});
