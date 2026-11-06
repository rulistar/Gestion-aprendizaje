import {
  acceptInvitationResponseSchema,
  invitationPreviewSchema,
  type MembershipRole,
} from '@aprendizaje/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { verifyPassword } from '../auth/password.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { createWorkspace } from '../workspaces/workspaces.service.js';
import { createInvitation, revokeInvitation } from './invitations.service.js';

const db = createTestDb();
const app = buildApp({ db });

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

const PASSWORD = 'una-contraseña-larga';

/** Workspace de Ana con una invitación para `email` */
async function setup(email = 'luis@example.com', role: MembershipRole = 'MEMBER') {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });
  const { invitation, token } = await createInvitation(db, ana.user.id, ws.id, { email, role });
  return { ana, ws, invitation, token };
}

function post(url: string, payload: object, cookies: Record<string, string> = {}) {
  return app.inject({ method: 'POST', url: `/api/v1/invitations/${url}`, payload, cookies });
}

const register = (token: string, name = 'Luis', password = PASSWORD) =>
  post('register', { token, name, password });

describe('POST /invitations/preview', () => {
  it('muestra el workspace, el rol y si el correo ya tiene cuenta', async () => {
    const { token } = await setup('luis@example.com', 'VIEWER');

    const response = await post('preview', { token });

    expect(invitationPreviewSchema.parse(response.json())).toEqual({
      workspaceName: 'Equipo',
      email: 'luis@example.com',
      role: 'VIEWER',
      hasAccount: false,
    });
  });

  it('el mismo 404 genérico para un enlace inventado, revocado o caducado', async () => {
    const { ana, ws, invitation, token } = await setup();
    const fake = 'x'.repeat(43);
    const invented = await post('preview', { token: fake });

    await revokeInvitation(db, ana.user.id, ws.id, invitation.id);
    const revoked = await post('preview', { token });

    const other = await createInvitation(db, ana.user.id, ws.id, {
      email: 'eva@example.com',
      role: 'MEMBER',
    });
    await db.invitation.update({
      where: { id: other.invitation.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await post('preview', { token: other.token });

    for (const response of [invented, revoked, expired]) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(invented.json());
    }
  });
});

describe('POST /invitations/register (no tengo cuenta)', () => {
  it('crea la cuenta con Argon2id, la membresía con el rol y deja la sesión iniciada', async () => {
    const { ws, invitation, token } = await setup('luis@example.com', 'VIEWER');

    const response = await register(token, '  Luis Pérez ');

    expect(response.statusCode).toBe(200);
    const body = acceptInvitationResponseSchema.parse(response.json());
    expect(body.workspaceId).toBe(ws.id);
    expect(body.user).toMatchObject({ name: 'Luis Pérez', email: 'luis@example.com' });
    expect(body.user.workspaces).toEqual([{ id: ws.id, name: 'Equipo', role: 'VIEWER' }]);

    const user = await db.user.findUniqueOrThrow({ where: { email: 'luis@example.com' } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(user.passwordHash!, PASSWORD)).toBe(true);

    const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
    const me = await app.inject({
      url: '/api/v1/auth/me',
      cookies: { [SESSION_COOKIE]: cookie!.value },
    });
    expect(me.statusCode).toBe(200);

    const row = await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(row.acceptedAt).not.toBeNull();
    expect(row.acceptedById).toBe(user.id);
  });

  it('el enlace es de un solo uso', async () => {
    const { token } = await setup();

    await register(token);
    const second = await register(token, 'Otro');

    expect(second.statusCode).toBe(404);
    expect(await db.user.count({ where: { email: 'luis@example.com' } })).toBe(1);
  });

  it('dos usos simultáneos del mismo enlace: solo uno funciona', async () => {
    const { token } = await setup();

    const results = await Promise.all([register(token, 'Uno'), register(token, 'Dos')]);

    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 404]);
    expect(await db.user.count({ where: { email: 'luis@example.com' } })).toBe(1);
    expect(await db.membership.count({ where: { user: { email: 'luis@example.com' } } })).toBe(1);
  });

  it('409 si el correo ya tiene cuenta, sin gastar la invitación', async () => {
    const { token, invitation } = await setup();
    await userWithSession(db, 'luis@example.com');

    const response = await register(token);

    expect(response.statusCode).toBe(409);
    const row = await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(row.acceptedAt).toBeNull();
  });

  it.each([
    ['una contraseña corta', { name: 'Luis', password: 'corta' }],
    ['sin nombre', { name: '  ', password: PASSWORD }],
  ])('rechaza %s con 400 y no gasta la invitación', async (_caso, payload) => {
    const { token, invitation } = await setup();

    const response = await post('register', { token, ...payload });

    expect(response.statusCode).toBe(400);
    const row = await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(row.acceptedAt).toBeNull();
  });

  it('una invitación revocada no sirve', async () => {
    const { ana, ws, invitation, token } = await setup();
    await revokeInvitation(db, ana.user.id, ws.id, invitation.id);

    expect((await register(token)).statusCode).toBe(404);
    expect(await db.user.count({ where: { email: 'luis@example.com' } })).toBe(0);
  });
});

describe('POST /invitations/accept (ya tengo cuenta)', () => {
  it('con la sesión del correo invitado, suma el workspace con el rol', async () => {
    const { ws, token } = await setup('luis@example.com', 'ADMIN');
    const luis = await userWithSession(db, 'luis@example.com');

    const response = await post('accept', { token }, luis.cookies);

    expect(response.statusCode).toBe(200);
    const body = acceptInvitationResponseSchema.parse(response.json());
    expect(body.workspaceId).toBe(ws.id);
    expect(body.user.workspaces).toContainEqual({ id: ws.id, name: 'Equipo', role: 'ADMIN' });
  });

  it('sin sesión responde 401', async () => {
    const { token } = await setup();
    expect((await post('accept', { token })).statusCode).toBe(401);
  });

  it('con la sesión de otra persona: 403 y la invitación sigue pendiente', async () => {
    const { invitation, token } = await setup('luis@example.com');
    const eva = await userWithSession(db, 'eva@example.com');

    const response = await post('accept', { token }, eva.cookies);

    expect(response.statusCode).toBe(403);
    expect(await db.membership.count({ where: { userId: eva.user.id } })).toBe(0);
    const row = await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(row.acceptedAt).toBeNull();
  });

  it('si ya era miembro, no duplica la membresía', async () => {
    const { ws, token } = await setup('luis@example.com');
    const luis = await userWithSession(db, 'luis@example.com');
    await addMember(db, ws.id, luis.user.id, 'VIEWER');

    const response = await post('accept', { token }, luis.cookies);

    expect(response.statusCode).toBe(200);
    expect(await db.membership.count({ where: { userId: luis.user.id } })).toBe(1);
  });
});

describe('límite de intentos', () => {
  it('responde 429 tras 5 intentos por minuto con el mismo enlace', async () => {
    const fake = 'y'.repeat(43);
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await post('preview', { token: fake })).statusCode);

    expect(statuses).toEqual([404, 404, 404, 404, 404, 429]);
  });
});
