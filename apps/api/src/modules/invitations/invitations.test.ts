import {
  createInvitationResponseSchema,
  invitationListSchema,
  type MembershipRole,
} from '@aprendizaje/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { hashToken } from '../auth/tokens.js';
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

type Cookies = Record<string, string>;

async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });

  async function withRole(email: string, role: MembershipRole) {
    const user = await userWithSession(db, email);
    await addMember(db, ws.id, user.user.id, role);
    return user;
  }
  return { ana, ws, withRole };
}

const url = (workspaceId: string) => `/api/v1/workspaces/${workspaceId}/invitations`;

function invite(cookies: Cookies, workspaceId: string, payload: object) {
  return app.inject({ method: 'POST', url: url(workspaceId), cookies, payload });
}

async function inviteOk(cookies: Cookies, workspaceId: string, payload: object) {
  const response = await invite(cookies, workspaceId, payload);
  expect(response.statusCode).toBe(201);
  return createInvitationResponseSchema.parse(response.json());
}

function list(cookies: Cookies, workspaceId: string) {
  return app.inject({ url: url(workspaceId), cookies });
}

function revoke(cookies: Cookies, workspaceId: string, invitationId: string) {
  return app.inject({ method: 'DELETE', url: `${url(workspaceId)}/${invitationId}`, cookies });
}

describe('autorización (solo el Admin gestiona miembros)', () => {
  it('sin sesión 401; sin membresía 404', async () => {
    const { ws } = await setup();
    const luis = await userWithSession(db, 'luis@example.com');

    expect((await invite({}, ws.id, { email: 'x@example.com', role: 'MEMBER' })).statusCode).toBe(
      401,
    );
    expect((await list(luis.cookies, ws.id)).statusCode).toBe(404);
  });

  it.each(['MEMBER', 'VIEWER'] as const)(
    'un %s no puede invitar, listar ni revocar (403)',
    async (role) => {
      const { ana, ws, withRole } = await setup();
      const user = await withRole('otro@example.com', role);
      const { invitation } = await inviteOk(ana.cookies, ws.id, {
        email: 'nuevo@example.com',
        role: 'MEMBER',
      });

      const created = await invite(user.cookies, ws.id, { email: 'x@example.com', role: 'ADMIN' });
      const listed = await list(user.cookies, ws.id);
      const revoked = await revoke(user.cookies, ws.id, invitation.id);

      expect([created.statusCode, listed.statusCode, revoked.statusCode]).toEqual([403, 403, 403]);
      expect(await db.invitation.count()).toBe(1);
    },
  );
});

describe('POST /workspaces/:workspaceId/invitations', () => {
  it('crea la invitación: devuelve el token una vez y guarda solo su hash', async () => {
    const { ana, ws } = await setup();

    const { invitation, token } = await inviteOk(ana.cookies, ws.id, {
      email: '  Luis@Example.com ',
      role: 'VIEWER',
    });

    expect(invitation).toMatchObject({ email: 'luis@example.com', role: 'VIEWER' });
    const row = await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toContain(token);
    expect(row).toMatchObject({ createdById: ana.user.id, acceptedAt: null, revokedAt: null });
  });

  it('caduca a las 48 horas', async () => {
    const { ana, ws } = await setup();
    const before = Date.now();

    const { invitation } = await inviteOk(ana.cookies, ws.id, {
      email: 'luis@example.com',
      role: 'MEMBER',
    });

    const hours = (Date.parse(invitation.expiresAt) - before) / 3_600_000;
    expect(hours).toBeGreaterThan(47.99);
    expect(hours).toBeLessThan(48.01);
  });

  it('cada invitación lleva un token distinto', async () => {
    const { ana, ws } = await setup();
    const a = await inviteOk(ana.cookies, ws.id, { email: 'a@example.com', role: 'MEMBER' });
    const b = await inviteOk(ana.cookies, ws.id, { email: 'b@example.com', role: 'MEMBER' });
    expect(a.token).not.toBe(b.token);
  });

  it('409 si el correo ya es miembro del workspace', async () => {
    const { ana, ws, withRole } = await setup();
    await withRole('luis@example.com', 'VIEWER');

    const response = await invite(ana.cookies, ws.id, { email: 'LUIS@example.com', role: 'ADMIN' });

    expect(response.statusCode).toBe(409);
    expect(await db.invitation.count()).toBe(0);
  });

  it('409 si ya hay una invitación pendiente; tras revocarla se puede invitar de nuevo', async () => {
    const { ana, ws } = await setup();
    const first = await inviteOk(ana.cookies, ws.id, { email: 'luis@example.com', role: 'MEMBER' });

    const duplicated = await invite(ana.cookies, ws.id, {
      email: 'luis@example.com',
      role: 'ADMIN',
    });
    await revoke(ana.cookies, ws.id, first.invitation.id);
    const again = await invite(ana.cookies, ws.id, { email: 'luis@example.com', role: 'ADMIN' });

    expect(duplicated.statusCode).toBe(409);
    expect(again.statusCode).toBe(201);
  });

  it('si la anterior caducó, se puede invitar de nuevo', async () => {
    const { ana, ws } = await setup();
    const first = await inviteOk(ana.cookies, ws.id, { email: 'luis@example.com', role: 'MEMBER' });
    await db.invitation.update({
      where: { id: first.invitation.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(
      (await invite(ana.cookies, ws.id, { email: 'luis@example.com', role: 'MEMBER' })).statusCode,
    ).toBe(201);
  });

  it.each([
    ['un correo no válido', { email: 'no-es-correo', role: 'MEMBER' }],
    ['un rol desconocido', { email: 'luis@example.com', role: 'OWNER' }],
    ['sin rol', { email: 'luis@example.com' }],
  ])('rechaza %s con 400', async (_caso, payload) => {
    const { ana, ws } = await setup();
    expect((await invite(ana.cookies, ws.id, payload)).statusCode).toBe(400);
  });
});

describe('GET /workspaces/:workspaceId/invitations', () => {
  it('lista solo las pendientes de este workspace (sin aceptadas, revocadas ni caducadas)', async () => {
    const { ana, ws } = await setup();
    const otherWs = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const pending = await inviteOk(ana.cookies, ws.id, { email: 'p@example.com', role: 'MEMBER' });
    const revoked = await inviteOk(ana.cookies, ws.id, { email: 'r@example.com', role: 'MEMBER' });
    const expired = await inviteOk(ana.cookies, ws.id, { email: 'e@example.com', role: 'MEMBER' });
    const accepted = await inviteOk(ana.cookies, ws.id, { email: 'a@example.com', role: 'MEMBER' });
    await inviteOk(ana.cookies, otherWs.id, { email: 'o@example.com', role: 'MEMBER' });
    await revoke(ana.cookies, ws.id, revoked.invitation.id);
    await db.invitation.update({
      where: { id: expired.invitation.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await db.invitation.update({
      where: { id: accepted.invitation.id },
      data: { acceptedAt: new Date() },
    });

    const response = await list(ana.cookies, ws.id);

    expect(invitationListSchema.parse(response.json())).toEqual([pending.invitation]);
    // La lista nunca expone el token ni su hash
    expect(response.body).not.toContain(pending.token);
    expect(response.body).not.toContain('tokenHash');
  });
});

describe('DELETE /workspaces/:workspaceId/invitations/:invitationId', () => {
  it('revoca la invitación y registra quién lo hizo', async () => {
    const { ana, ws } = await setup();
    const { invitation } = await inviteOk(ana.cookies, ws.id, {
      email: 'luis@example.com',
      role: 'MEMBER',
    });

    const response = await revoke(ana.cookies, ws.id, invitation.id);

    expect(response.statusCode).toBe(204);
    const row = await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(row.revokedAt).not.toBeNull();
    expect(row.revokedById).toBe(ana.user.id);
  });

  it('404 si ya estaba revocada, si es de otro workspace o si el ID no es válido', async () => {
    const { ana, ws } = await setup();
    const otherWs = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const mine = await inviteOk(ana.cookies, ws.id, { email: 'a@example.com', role: 'MEMBER' });
    const other = await inviteOk(ana.cookies, otherWs.id, {
      email: 'b@example.com',
      role: 'MEMBER',
    });
    await revoke(ana.cookies, ws.id, mine.invitation.id);

    expect((await revoke(ana.cookies, ws.id, mine.invitation.id)).statusCode).toBe(404);
    expect((await revoke(ana.cookies, ws.id, other.invitation.id)).statusCode).toBe(404);
    expect((await revoke(ana.cookies, ws.id, 'no-es-un-id')).statusCode).toBe(404);
  });
});
