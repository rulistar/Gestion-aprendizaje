import { memberListSchema, workspaceListSchema, workspaceSummarySchema } from '@aprendizaje/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { auditSoftDelete } from '../../db/audit.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession as createUser } from '../../test/users.js';
import { createWorkspace } from './workspaces.service.js';

const db = createTestDb();
const app = buildApp({ db });

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

const userWithSession = (email: string) => createUser(db, email);

function createWs(cookies: Record<string, string>, name: unknown) {
  return app.inject({ method: 'POST', url: '/api/v1/workspaces', cookies, payload: { name } });
}

/** Preparación: un espacio creado por `owner` (sin pasar por el endpoint, que es solo del Admin del sistema) */
function setupWs(owner: { user: { id: string } }, name: string) {
  return createWorkspace(db, owner.user.id, { name });
}

/** Usuario con sesión que es Admin del sistema */
async function systemAdminUser(email = 'root@example.com') {
  const admin = await userWithSession(email);
  await db.user.update({ where: { id: admin.user.id }, data: { isSystemAdmin: true } });
  return admin;
}

function listWs(cookies: Record<string, string>) {
  return app.inject({ method: 'GET', url: '/api/v1/workspaces', cookies });
}

describe('sin sesión', () => {
  it('no permite listar ni crear workspaces', async () => {
    expect((await listWs({})).statusCode).toBe(401);
    expect((await createWs({}, 'Equipo')).statusCode).toBe(401);
    expect(await db.workspace.count()).toBe(0);
  });
});

describe('POST /workspaces', () => {
  it('un usuario que no es Admin del sistema recibe 403 y no se crea nada', async () => {
    const ana = await userWithSession('ana@example.com');

    const response = await createWs(ana.cookies, 'Equipo');

    expect(response.statusCode).toBe(403);
    expect(await db.workspace.count()).toBe(0);
  });

  it('el Admin del sistema crea el workspace y queda como Admin', async () => {
    const ana = await systemAdminUser('ana@example.com');

    const response = await createWs(ana.cookies, '  Equipo de cursos  ');

    expect(response.statusCode).toBe(201);
    const body = workspaceSummarySchema.parse(response.json());
    expect(body).toMatchObject({ name: 'Equipo de cursos', role: 'ADMIN' });

    const membership = await db.membership.findFirstOrThrow({ where: { workspaceId: body.id } });
    expect(membership).toMatchObject({ userId: ana.user.id, role: 'ADMIN' });
  });

  it('registra quién lo creó y cuándo', async () => {
    const ana = await systemAdminUser('ana@example.com');
    const before = new Date();

    const { id } = workspaceSummarySchema.parse((await createWs(ana.cookies, 'Equipo')).json());

    const workspace = await db.workspace.findUniqueOrThrow({ where: { id } });
    expect(workspace).toMatchObject({ createdById: ana.user.id, updatedById: ana.user.id });
    expect(workspace.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  it.each([
    ['vacío', '   '],
    ['demasiado largo', 'x'.repeat(81)],
    ['que no es texto', 42],
  ])('rechaza un nombre %s con 400 y no crea nada', async (_caso, name) => {
    const ana = await systemAdminUser('ana@example.com');

    const response = await createWs(ana.cookies, name);

    expect(response.statusCode).toBe(400);
    expect(await db.workspace.count()).toBe(0);
  });
});

describe('GET /workspaces', () => {
  it('muestra solo los workspaces de los que soy miembro', async () => {
    const ana = await userWithSession('ana@example.com');
    const luis = await userWithSession('luis@example.com');
    await setupWs(ana, 'De Ana');
    await setupWs(luis, 'De Luis');

    const anaList = workspaceListSchema.parse((await listWs(ana.cookies)).json());
    const luisList = workspaceListSchema.parse((await listWs(luis.cookies)).json());

    expect(anaList.map((w) => w.name)).toEqual(['De Ana']);
    expect(luisList.map((w) => w.name)).toEqual(['De Luis']);
  });

  it('no muestra workspaces ni membresías que están en la papelera', async () => {
    const ana = await userWithSession('ana@example.com');
    const kept = await setupWs(ana, 'Activo');
    const trashed = await setupWs(ana, 'Borrado');
    const left = await setupWs(ana, 'Me salí');

    await db.workspace.update({
      where: { id: trashed.id },
      data: auditSoftDelete(ana.user.id),
    });
    await db.membership.updateMany({
      where: { workspaceId: left.id },
      data: auditSoftDelete(ana.user.id),
    });

    const list = workspaceListSchema.parse((await listWs(ana.cookies)).json());
    expect(list).toEqual([kept]);
  });
});

describe('GET /workspaces/:workspaceId/members', () => {
  it('lista los miembros activos por nombre, sin los desactivados ni los que salieron', async () => {
    const ana = await userWithSession('ana@example.com');
    const ws = await setupWs(ana, 'Equipo');
    const luis = await userWithSession('luis@example.com');
    const eva = await userWithSession('eva@example.com');
    const leo = await userWithSession('leo@example.com');
    await addMember(db, ws.id, luis.user.id, 'VIEWER');
    await addMember(db, ws.id, eva.user.id, 'MEMBER');
    await addMember(db, ws.id, leo.user.id, 'MEMBER');
    await db.user.update({ where: { id: eva.user.id }, data: { status: 'DISABLED' } });
    await db.membership.updateMany({
      where: { userId: leo.user.id },
      data: auditSoftDelete(ana.user.id),
    });

    const response = await app.inject({
      url: `/api/v1/workspaces/${ws.id}/members`,
      cookies: luis.cookies,
    });

    // Luis es Lector: ve los nombres, pero no los correos
    expect(memberListSchema.parse(response.json())).toEqual([
      { userId: ana.user.id, name: 'ana@example.com', email: null, role: 'ADMIN' },
      { userId: luis.user.id, name: 'luis@example.com', email: null, role: 'VIEWER' },
    ]);
  });

  it('el Admin del espacio sí ve los correos', async () => {
    const ana = await userWithSession('ana@example.com');
    const ws = await setupWs(ana, 'Equipo');

    const response = await app.inject({
      url: `/api/v1/workspaces/${ws.id}/members`,
      cookies: ana.cookies,
    });

    expect(memberListSchema.parse(response.json())).toEqual([
      {
        userId: ana.user.id,
        name: 'ana@example.com',
        email: 'ana@example.com',
        role: 'ADMIN',
      },
    ]);
  });
});

describe('PATCH /workspaces/:workspaceId (renombrar)', () => {
  function rename(cookies: Record<string, string>, id: string, name: unknown) {
    return app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${id}`,
      cookies,
      payload: { name },
    });
  }

  it('el Admin lo renombra: cambia la etiqueta, no el ID, y queda registrado quién', async () => {
    const ana = await userWithSession('ana@example.com');
    const ws = await setupWs(ana, 'Mi aprendizaje');

    const response = await rename(ana.cookies, ws.id, '  Mi empresa ');

    expect(response.json()).toEqual({ id: ws.id, name: 'Mi empresa', role: 'ADMIN' });
    const row = await db.workspace.findUniqueOrThrow({ where: { id: ws.id } });
    expect(row.updatedById).toBe(ana.user.id);
  });

  it.each(['MEMBER', 'VIEWER'] as const)('un %s no puede renombrarlo (403)', async (role) => {
    const ana = await userWithSession('ana@example.com');
    const otro = await userWithSession('otro@example.com');
    const ws = await setupWs(ana, 'Original');
    await addMember(db, ws.id, otro.user.id, role);

    expect((await rename(otro.cookies, ws.id, 'Cambiado')).statusCode).toBe(403);
    const row = await db.workspace.findUniqueOrThrow({ where: { id: ws.id } });
    expect(row.name).toBe('Original');
  });

  it('rechaza un nombre vacío (400) y a quien no es miembro (404)', async () => {
    const ana = await userWithSession('ana@example.com');
    const luis = await userWithSession('luis@example.com');
    const ws = await setupWs(ana, 'Original');

    expect((await rename(ana.cookies, ws.id, '   ')).statusCode).toBe(400);
    expect((await rename(luis.cookies, ws.id, 'Intruso')).statusCode).toBe(404);
  });
});

describe('GET /workspaces/:workspaceId', () => {
  it('devuelve el workspace con mi rol', async () => {
    const ana = await userWithSession('ana@example.com');
    const luis = await userWithSession('luis@example.com');
    const ws = await setupWs(ana, 'Equipo');
    await addMember(db, ws.id, luis.user.id, 'VIEWER');

    const asAna = await app.inject({ url: `/api/v1/workspaces/${ws.id}`, cookies: ana.cookies });
    const asLuis = await app.inject({ url: `/api/v1/workspaces/${ws.id}`, cookies: luis.cookies });

    expect(workspaceSummarySchema.parse(asAna.json())).toEqual({
      id: ws.id,
      name: 'Equipo',
      role: 'ADMIN',
    });
    expect(workspaceSummarySchema.parse(asLuis.json())).toMatchObject({ role: 'VIEWER' });
  });

  it('responde 404 a quien no es miembro y a un ID no válido (no revela si existe)', async () => {
    const ana = await userWithSession('ana@example.com');
    const luis = await userWithSession('luis@example.com');
    const ws = await setupWs(ana, 'De Ana');

    const notMember = await app.inject({
      url: `/api/v1/workspaces/${ws.id}`,
      cookies: luis.cookies,
    });
    const invalid = await app.inject({
      url: '/api/v1/workspaces/no-es-un-id',
      cookies: ana.cookies,
    });

    expect(notMember.statusCode).toBe(404);
    expect(invalid.statusCode).toBe(404);
  });
});

describe('Admin del sistema (ve y entra a todos los espacios)', () => {
  const systemAdmin = () => systemAdminUser();

  it('lista todos los espacios, como Admin en los que no es miembro', async () => {
    const ana = await userWithSession('ana@example.com');
    const root = await systemAdmin();
    const deAna = await setupWs(ana, 'De Ana');
    const propio = await setupWs(root, 'Propio');

    const list = workspaceListSchema.parse((await listWs(root.cookies)).json());

    expect(list).toEqual([
      { id: propio.id, name: 'Propio', role: 'ADMIN' },
      { id: deAna.id, name: 'De Ana', role: 'ADMIN' },
    ]);
  });

  it('entra a un espacio ajeno con permisos de Admin', async () => {
    const ana = await userWithSession('ana@example.com');
    const root = await systemAdmin();
    const deAna = await setupWs(ana, 'De Ana');

    const detail = await app.inject({
      url: `/api/v1/workspaces/${deAna.id}`,
      cookies: root.cookies,
    });
    const invite = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${deAna.id}/invitations`,
      cookies: root.cookies,
      payload: { email: 'nuevo@example.com', role: 'MEMBER' },
    });

    expect(detail.json()).toMatchObject({ id: deAna.id, name: 'De Ana', role: 'ADMIN' });
    expect(invite.statusCode).toBe(201);
  });

  it('no ve los espacios en la papelera', async () => {
    const ana = await userWithSession('ana@example.com');
    const root = await systemAdmin();
    const borrado = await setupWs(ana, 'Borrado');
    await db.workspace.update({ where: { id: borrado.id }, data: auditSoftDelete(ana.user.id) });

    const list = workspaceListSchema.parse((await listWs(root.cookies)).json());
    const detail = await app.inject({
      url: `/api/v1/workspaces/${borrado.id}`,
      cookies: root.cookies,
    });

    expect(list).toEqual([]);
    expect(detail.statusCode).toBe(404);
  });

  it('un usuario normal sigue sin ver ni entrar a espacios ajenos', async () => {
    const ana = await userWithSession('ana@example.com');
    const luis = await userWithSession('luis@example.com');
    const deAna = await setupWs(ana, 'De Ana');

    const list = workspaceListSchema.parse((await listWs(luis.cookies)).json());
    const detail = await app.inject({
      url: `/api/v1/workspaces/${deAna.id}`,
      cookies: luis.cookies,
    });

    expect(list).toEqual([]);
    expect(detail.statusCode).toBe(404);
  });
});

describe('gestionar miembros', () => {
  async function team() {
    const ana = await userWithSession('ana@example.com');
    const ws = await setupWs(ana, 'Equipo');
    const luis = await userWithSession('luis@example.com');
    await addMember(db, ws.id, luis.user.id, 'VIEWER');
    return { ana, ws, luis };
  }

  const memberUrl = (ws: string, user: string) => `/api/v1/workspaces/${ws}/members/${user}`;

  function setRole(cookies: Record<string, string>, ws: string, user: string, role: string) {
    return app.inject({ method: 'PATCH', url: memberUrl(ws, user), cookies, payload: { role } });
  }

  function remove(cookies: Record<string, string>, ws: string, user: string) {
    return app.inject({ method: 'DELETE', url: memberUrl(ws, user), cookies });
  }

  it('el Admin cambia el rol y queda registrado quién', async () => {
    const { ana, ws, luis } = await team();

    const response = await setRole(ana.cookies, ws.id, luis.user.id, 'MEMBER');

    expect(response.statusCode).toBe(204);
    const row = await db.membership.findFirstOrThrow({ where: { userId: luis.user.id } });
    expect(row).toMatchObject({ role: 'MEMBER', updatedById: ana.user.id });
  });

  it('quitar a un miembro le quita el acceso al instante', async () => {
    const { ana, ws, luis } = await team();
    expect(
      (await app.inject({ url: `/api/v1/workspaces/${ws.id}`, cookies: luis.cookies })).statusCode,
    ).toBe(200);

    const response = await remove(ana.cookies, ws.id, luis.user.id);

    expect(response.statusCode).toBe(204);
    const after = await app.inject({ url: `/api/v1/workspaces/${ws.id}`, cookies: luis.cookies });
    expect(after.statusCode).toBe(404);
    const row = await db.membership.findFirstOrThrow({ where: { userId: luis.user.id } });
    expect(row).toMatchObject({ deletedById: ana.user.id });
  });

  it('nunca se puede quitar ni degradar al último Admin (409)', async () => {
    const { ana, ws } = await team();

    expect((await setRole(ana.cookies, ws.id, ana.user.id, 'MEMBER')).statusCode).toBe(409);
    expect((await remove(ana.cookies, ws.id, ana.user.id)).statusCode).toBe(409);
    const row = await db.membership.findFirstOrThrow({ where: { userId: ana.user.id } });
    expect(row).toMatchObject({ role: 'ADMIN', deletedAt: null });
  });

  it('con otro Admin, sí se puede degradar a uno de los dos', async () => {
    const { ana, ws, luis } = await team();
    await setRole(ana.cookies, ws.id, luis.user.id, 'ADMIN');

    expect((await setRole(ana.cookies, ws.id, ana.user.id, 'MEMBER')).statusCode).toBe(204);
  });

  it('un Miembro o Lector no puede gestionar miembros (403)', async () => {
    const { ana, ws, luis } = await team();

    expect((await setRole(luis.cookies, ws.id, ana.user.id, 'VIEWER')).statusCode).toBe(403);
    expect((await remove(luis.cookies, ws.id, ana.user.id)).statusCode).toBe(403);
  });

  it('404 a quien no es miembro y 400 a un rol desconocido', async () => {
    const { ana, ws, luis } = await team();
    const eva = await userWithSession('eva@example.com');

    expect((await remove(ana.cookies, ws.id, eva.user.id)).statusCode).toBe(404);
    expect((await setRole(ana.cookies, ws.id, luis.user.id, 'OWNER')).statusCode).toBe(400);
  });
});
