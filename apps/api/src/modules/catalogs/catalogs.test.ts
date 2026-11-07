import { catalogItemListSchema, catalogItemSchema, type MembershipRole } from '@aprendizaje/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { createFirstAdmin } from '../setup/first-admin.js';
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

const url = (workspaceId: string) => `/api/v1/workspaces/${workspaceId}/catalogs`;

function list(cookies: Cookies, workspaceId: string) {
  return app.inject({ url: url(workspaceId), cookies });
}

function create(cookies: Cookies, workspaceId: string, payload: object) {
  return app.inject({ method: 'POST', url: url(workspaceId), cookies, payload });
}

function update(cookies: Cookies, workspaceId: string, itemId: string, payload: object) {
  return app.inject({ method: 'PATCH', url: `${url(workspaceId)}/${itemId}`, cookies, payload });
}

async function createOk(cookies: Cookies, workspaceId: string, kind: string, name: string) {
  const response = await create(cookies, workspaceId, { kind, name });
  expect(response.statusCode).toBe(201);
  return catalogItemSchema.parse(response.json());
}

describe('valores iniciales', () => {
  it('un espacio nuevo trae niveles y tipos de actividad; los demás catálogos, vacíos', async () => {
    const { ana, ws } = await setup();

    const items = catalogItemListSchema.parse((await list(ana.cookies, ws.id)).json());

    expect(items.filter((i) => i.kind === 'LEVEL').map((i) => i.name)).toEqual([
      'Básico',
      'Intermedio',
      'Avanzado',
    ]);
    expect(items.filter((i) => i.kind === 'ACTIVITY_TYPE').map((i) => i.name)).toEqual([
      'Video o lección',
      'Lectura',
      'Ejercicio',
      'Quiz',
      'Proyecto',
      'Examen',
    ]);
    expect(items.some((i) => ['PLATFORM', 'SPONSOR', 'CATEGORY'].includes(i.kind))).toBe(false);
  });

  it('el primer Admin también recibe los valores iniciales en su espacio', async () => {
    const { workspace } = await createFirstAdmin(db, {
      name: 'Ana',
      email: 'ana@example.com',
      password: 'una-clave-bien-larga',
    });

    expect(await db.catalogItem.count({ where: { workspaceId: workspace.id } })).toBe(9);
  });
});

describe('autorización', () => {
  it('sin sesión 401; sin membresía 404', async () => {
    const { ws } = await setup();
    const luis = await userWithSession(db, 'luis@example.com');

    expect((await list({}, ws.id)).statusCode).toBe(401);
    expect((await list(luis.cookies, ws.id)).statusCode).toBe(404);
    expect(
      (await create(luis.cookies, ws.id, { kind: 'PLATFORM', name: 'Coursera' })).statusCode,
    ).toBe(404);
  });

  it.each(['MEMBER', 'VIEWER'] as const)('un %s los ve, pero no los cambia (403)', async (role) => {
    const { ana, ws, withRole } = await setup();
    const user = await withRole('otro@example.com', role);
    const item = await createOk(ana.cookies, ws.id, 'PLATFORM', 'Coursera');

    expect((await list(user.cookies, ws.id)).statusCode).toBe(200);
    expect((await create(user.cookies, ws.id, { kind: 'PLATFORM', name: 'edX' })).statusCode).toBe(
      403,
    );
    expect((await update(user.cookies, ws.id, item.id, { archived: true })).statusCode).toBe(403);
  });

  it('no se puede cambiar un valor de otro espacio (404)', async () => {
    const { ana, ws } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const item = await createOk(ana.cookies, other.id, 'PLATFORM', 'Coursera');

    expect((await update(ana.cookies, ws.id, item.id, { name: 'Hackeado' })).statusCode).toBe(404);
    const row = await db.catalogItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.name).toBe('Coursera');
  });
});

describe('POST /workspaces/:workspaceId/catalogs', () => {
  it('agrega el valor al final de su catálogo y registra quién lo creó', async () => {
    const { ana, ws } = await setup();

    const item = await createOk(ana.cookies, ws.id, 'LEVEL', '  Experto ');

    expect(item).toMatchObject({ kind: 'LEVEL', name: 'Experto', position: 3, archived: false });
    const row = await db.catalogItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row).toMatchObject({ workspaceId: ws.id, createdById: ana.user.id });
  });

  it('409 si el nombre ya existe, sin distinguir mayúsculas', async () => {
    const { ana, ws } = await setup();
    await createOk(ana.cookies, ws.id, 'PLATFORM', 'Coursera');

    const response = await create(ana.cookies, ws.id, { kind: 'PLATFORM', name: 'COURSERA' });

    expect(response.statusCode).toBe(409);
  });

  it('dos peticiones a la vez con el mismo nombre: solo una lo crea', async () => {
    const { ana, ws } = await setup();
    const payload = { kind: 'PLATFORM', name: 'Coursera' };

    const results = await Promise.all([
      create(ana.cookies, ws.id, payload),
      create(ana.cookies, ws.id, payload),
    ]);

    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
  });

  it('el mismo nombre puede estar en otro catálogo o en otro espacio', async () => {
    const { ana, ws } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    await createOk(ana.cookies, ws.id, 'PLATFORM', 'Acme');

    await createOk(ana.cookies, ws.id, 'SPONSOR', 'Acme');
    await createOk(ana.cookies, other.id, 'PLATFORM', 'Acme');
  });

  it.each([
    ['un nombre vacío', { kind: 'PLATFORM', name: '   ' }],
    ['un nombre muy largo', { kind: 'PLATFORM', name: 'x'.repeat(81) }],
    ['un catálogo desconocido', { kind: 'OTRO', name: 'Coursera' }],
    ['sin catálogo', { name: 'Coursera' }],
  ])('rechaza %s con 400', async (_caso, payload) => {
    const { ana, ws } = await setup();

    expect((await create(ana.cookies, ws.id, payload)).statusCode).toBe(400);
  });
});

describe('PATCH /workspaces/:workspaceId/catalogs/:itemId', () => {
  it('renombra y registra quién lo cambió', async () => {
    const { ana, ws, withRole } = await setup();
    const luis = await withRole('luis@example.com', 'ADMIN');
    const item = await createOk(ana.cookies, ws.id, 'PLATFORM', 'Coursera');

    const response = await update(luis.cookies, ws.id, item.id, { name: ' Coursera Plus ' });

    expect(catalogItemSchema.parse(response.json()).name).toBe('Coursera Plus');
    const row = await db.catalogItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.updatedById).toBe(luis.user.id);
  });

  it('se puede cambiar solo las mayúsculas de su propio nombre', async () => {
    const { ana, ws } = await setup();
    const item = await createOk(ana.cookies, ws.id, 'PLATFORM', 'coursera');

    expect((await update(ana.cookies, ws.id, item.id, { name: 'Coursera' })).statusCode).toBe(200);
  });

  it('409 al renombrar a un nombre que ya usa otro valor activo', async () => {
    const { ana, ws } = await setup();
    await createOk(ana.cookies, ws.id, 'PLATFORM', 'Coursera');
    const edx = await createOk(ana.cookies, ws.id, 'PLATFORM', 'edX');

    expect((await update(ana.cookies, ws.id, edx.id, { name: 'coursera' })).statusCode).toBe(409);
  });

  it('archivar libera el nombre; reactivar lo rechaza si ya lo volvieron a usar', async () => {
    const { ana, ws } = await setup();
    const old = await createOk(ana.cookies, ws.id, 'PLATFORM', 'Coursera');

    const archived = await update(ana.cookies, ws.id, old.id, { archived: true });
    expect(catalogItemSchema.parse(archived.json()).archived).toBe(true);
    await createOk(ana.cookies, ws.id, 'PLATFORM', 'Coursera');

    expect((await update(ana.cookies, ws.id, old.id, { archived: false })).statusCode).toBe(409);
  });

  it('un valor archivado sigue en la lista y se puede reactivar', async () => {
    const { ana, ws } = await setup();
    const item = await createOk(ana.cookies, ws.id, 'PLATFORM', 'Coursera');
    await update(ana.cookies, ws.id, item.id, { archived: true });

    const items = catalogItemListSchema.parse((await list(ana.cookies, ws.id)).json());
    expect(items.find((i) => i.id === item.id)?.archived).toBe(true);

    const restored = await update(ana.cookies, ws.id, item.id, { archived: false });
    expect(catalogItemSchema.parse(restored.json()).archived).toBe(false);
  });

  it('400 sin cambios o con nombre vacío; 404 con un ID que no es válido', async () => {
    const { ana, ws } = await setup();
    const item = await createOk(ana.cookies, ws.id, 'PLATFORM', 'Coursera');

    expect((await update(ana.cookies, ws.id, item.id, {})).statusCode).toBe(400);
    expect((await update(ana.cookies, ws.id, item.id, { name: '  ' })).statusCode).toBe(400);
    expect((await update(ana.cookies, ws.id, 'no-es-un-id', { name: 'X' })).statusCode).toBe(404);
  });
});
