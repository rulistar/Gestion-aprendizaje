import { elementTypeListSchema, elementTypeSchema, type MembershipRole } from '@aprendizaje/shared';
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

const url = (workspaceId: string) => `/api/v1/workspaces/${workspaceId}/element-types`;

function list(cookies: Cookies, workspaceId: string) {
  return app.inject({ url: url(workspaceId), cookies });
}

function create(cookies: Cookies, workspaceId: string, payload: object) {
  return app.inject({ method: 'POST', url: url(workspaceId), cookies, payload });
}

function update(cookies: Cookies, workspaceId: string, typeId: string, payload: object) {
  return app.inject({ method: 'PATCH', url: `${url(workspaceId)}/${typeId}`, cookies, payload });
}

async function createOk(cookies: Cookies, workspaceId: string, name: string) {
  const response = await create(cookies, workspaceId, { name });
  expect(response.statusCode).toBe(201);
  return elementTypeSchema.parse(response.json());
}

async function types(cookies: Cookies, workspaceId: string) {
  return elementTypeListSchema.parse((await list(cookies, workspaceId)).json());
}

describe('tipos iniciales', () => {
  it('un espacio nuevo trae Curso, Lectura y Otro; Lectura como la pidió el PO (HU-12)', async () => {
    const { ana, ws } = await setup();

    const items = await types(ana.cookies, ws.id);

    expect(items.map((t) => t.name)).toEqual(['Curso', 'Lectura', 'Otro']);
    expect(items[0]).toMatchObject({ labels: {}, hiddenFields: ['genre', 'pages'] });
    expect(items[1]).toMatchObject({
      labels: { name: 'Nombre del libro', platform: 'Editorial' },
      hiddenFields: ['sponsor', 'category', 'level', 'durationWeeks', 'daysPerWeek', 'hoursPerDay'],
    });
    expect(items[2]?.hiddenFields).toEqual(['genre', 'pages']);
  });

  it('el primer Admin también los recibe en su espacio', async () => {
    const { workspace } = await createFirstAdmin(db, {
      name: 'Ana',
      email: 'ana@example.com',
      password: 'una-clave-bien-larga',
    });

    expect(await db.elementType.count({ where: { workspaceId: workspace.id } })).toBe(3);
  });
});

describe('autorización', () => {
  it('sin sesión 401; sin membresía 404', async () => {
    const { ws } = await setup();
    const luis = await userWithSession(db, 'luis@example.com');

    expect((await list({}, ws.id)).statusCode).toBe(401);
    expect((await list(luis.cookies, ws.id)).statusCode).toBe(404);
    expect((await create(luis.cookies, ws.id, { name: 'Taller' })).statusCode).toBe(404);
  });

  it.each(['MEMBER', 'VIEWER'] as const)('un %s los ve, pero no los cambia (403)', async (role) => {
    const { ana, ws, withRole } = await setup();
    const user = await withRole('otro@example.com', role);
    const type = await createOk(ana.cookies, ws.id, 'Taller');

    expect((await list(user.cookies, ws.id)).statusCode).toBe(200);
    expect((await create(user.cookies, ws.id, { name: 'Charla' })).statusCode).toBe(403);
    expect(
      (await update(user.cookies, ws.id, type.id, { labels: { platform: 'Sede' } })).statusCode,
    ).toBe(403);
  });

  it('no se puede cambiar un tipo de otro espacio (404)', async () => {
    const { ana, ws } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const type = await createOk(ana.cookies, other.id, 'Taller');

    expect((await update(ana.cookies, ws.id, type.id, { name: 'Hackeado' })).statusCode).toBe(404);
    const row = await db.elementType.findUniqueOrThrow({ where: { id: type.id } });
    expect(row.name).toBe('Taller');
  });
});

describe('POST /workspaces/:workspaceId/element-types', () => {
  it('lo agrega al final, sin etiquetas propias, y registra quién lo creó', async () => {
    const { ana, ws } = await setup();

    const type = await createOk(ana.cookies, ws.id, '  Taller ');

    expect(type).toMatchObject({ name: 'Taller', labels: {}, position: 3, archived: false });
    const row = await db.elementType.findUniqueOrThrow({ where: { id: type.id } });
    expect(row).toMatchObject({ workspaceId: ws.id, createdById: ana.user.id });
  });

  it('409 si el nombre ya existe, sin distinguir mayúsculas', async () => {
    const { ana, ws } = await setup();

    expect((await create(ana.cookies, ws.id, { name: 'CURSO' })).statusCode).toBe(409);
  });

  it('dos peticiones a la vez con el mismo nombre: solo una lo crea', async () => {
    const { ana, ws } = await setup();

    const results = await Promise.all([
      create(ana.cookies, ws.id, { name: 'Taller' }),
      create(ana.cookies, ws.id, { name: 'Taller' }),
    ]);

    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
  });

  it('el mismo nombre puede estar en otro espacio', async () => {
    const { ana, ws } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });

    await createOk(ana.cookies, ws.id, 'Taller');
    await createOk(ana.cookies, other.id, 'Taller');
  });

  it.each([
    ['un nombre vacío', { name: '   ' }],
    ['un nombre muy largo', { name: 'x'.repeat(81) }],
    ['sin nombre', {}],
  ])('rechaza %s con 400', async (_caso, payload) => {
    const { ana, ws } = await setup();

    expect((await create(ana.cookies, ws.id, payload)).statusCode).toBe(400);
  });
});

describe('PATCH /workspaces/:workspaceId/element-types/:typeId', () => {
  it('cambia las etiquetas y registra quién lo cambió', async () => {
    const { ana, ws, withRole } = await setup();
    const luis = await withRole('luis@example.com', 'ADMIN');
    const type = await createOk(ana.cookies, ws.id, 'Taller');

    const response = await update(luis.cookies, ws.id, type.id, {
      labels: { platform: ' Sede ', notes: 'Notas' },
    });

    // Un nombre igual al de omisión no se guarda
    expect(elementTypeSchema.parse(response.json()).labels).toEqual({ platform: 'Sede' });
    const row = await db.elementType.findUniqueOrThrow({ where: { id: type.id } });
    expect(row.updatedById).toBe(luis.user.id);
  });

  it('las etiquetas se reemplazan completas: enviar {} vuelve a los nombres por omisión', async () => {
    const { ana, ws } = await setup();
    const lectura = (await types(ana.cookies, ws.id)).find((t) => t.name === 'Lectura');

    const response = await update(ana.cookies, ws.id, lectura!.id, { labels: {} });

    expect(elementTypeSchema.parse(response.json()).labels).toEqual({});
  });

  it.each([
    ['un campo que no existe', { passwordHash: 'x' }],
    ['el nombre de otro campo', { platform: 'nivel' }],
    ['un nombre vacío', { platform: '  ' }],
    ['un nombre muy largo', { platform: 'x'.repeat(61) }],
    ['algo que no es texto', { platform: 5 }],
  ])('rechaza etiquetas con %s (400)', async (_caso, labels) => {
    const { ana, ws } = await setup();
    const type = await createOk(ana.cookies, ws.id, 'Taller');

    expect((await update(ana.cookies, ws.id, type.id, { labels })).statusCode).toBe(400);
  });

  it('elige qué campos oculta, en el orden de la ficha, sin repetidos (HU-12)', async () => {
    const { ana, ws } = await setup();
    const type = await createOk(ana.cookies, ws.id, 'Taller');
    expect(type.hiddenFields).toEqual([]);

    const response = await update(ana.cookies, ws.id, type.id, {
      hiddenFields: ['notes', 'level', 'level'],
    });
    expect(elementTypeSchema.parse(response.json()).hiddenFields).toEqual(['level', 'notes']);

    const shown = await update(ana.cookies, ws.id, type.id, { hiddenFields: [] });
    expect(elementTypeSchema.parse(shown.json()).hiddenFields).toEqual([]);
  });

  it.each([
    ['el nombre', ['name']],
    ['el estado', ['status']],
    ['la prioridad', ['priority']],
    ['un campo que no existe', ['passwordHash']],
  ])('no deja ocultar %s (400)', async (_caso, hiddenFields) => {
    const { ana, ws } = await setup();
    const type = await createOk(ana.cookies, ws.id, 'Taller');
    expect((await update(ana.cookies, ws.id, type.id, { hiddenFields })).statusCode).toBe(400);
  });

  it('ocultar un campo no borra lo que ya tenían los elementos (HU-12)', async () => {
    const { ana, ws } = await setup();
    const curso = (await types(ana.cookies, ws.id)).find((t) => t.name === 'Curso')!;
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/elements`,
      cookies: ana.cookies,
      payload: { typeId: curso.id, name: 'Go', notes: 'Con práctica' },
    });
    await update(ana.cookies, ws.id, curso.id, { hiddenFields: ['notes'] });

    const element = await app.inject({
      url: `/api/v1/workspaces/${ws.id}/elements/${created.json<{ id: string }>().id}`,
      cookies: ana.cookies,
    });
    expect(element.json()).toMatchObject({ notes: 'Con práctica' });
  });

  it('renombrar no toca las etiquetas', async () => {
    const { ana, ws } = await setup();
    const lectura = (await types(ana.cookies, ws.id)).find((t) => t.name === 'Lectura');

    const response = await update(ana.cookies, ws.id, lectura!.id, { name: 'Libro' });

    expect(elementTypeSchema.parse(response.json())).toMatchObject({
      name: 'Libro',
      labels: { platform: 'Editorial' },
    });
  });

  it('409 al renombrar a un nombre que ya usa otro tipo activo', async () => {
    const { ana, ws } = await setup();
    const type = await createOk(ana.cookies, ws.id, 'Taller');

    expect((await update(ana.cookies, ws.id, type.id, { name: 'curso' })).statusCode).toBe(409);
  });

  it('archivar libera el nombre; reactivar lo rechaza si ya lo volvieron a usar', async () => {
    const { ana, ws } = await setup();
    const old = await createOk(ana.cookies, ws.id, 'Taller');

    const archived = await update(ana.cookies, ws.id, old.id, { archived: true });
    expect(elementTypeSchema.parse(archived.json()).archived).toBe(true);
    await createOk(ana.cookies, ws.id, 'Taller');

    expect((await update(ana.cookies, ws.id, old.id, { archived: false })).statusCode).toBe(409);
  });

  it('no se puede archivar el último tipo activo (409)', async () => {
    const { ana, ws } = await setup();
    const [curso, lectura, otro] = await types(ana.cookies, ws.id);
    await update(ana.cookies, ws.id, curso!.id, { archived: true });
    await update(ana.cookies, ws.id, lectura!.id, { archived: true });

    expect((await update(ana.cookies, ws.id, otro!.id, { archived: true })).statusCode).toBe(409);
    // Volver a archivar uno ya archivado no deja a nadie sin tipos
    expect((await update(ana.cookies, ws.id, curso!.id, { archived: true })).statusCode).toBe(200);
  });

  it('400 sin cambios; 404 con un ID que no es válido', async () => {
    const { ana, ws } = await setup();
    const type = await createOk(ana.cookies, ws.id, 'Taller');

    expect((await update(ana.cookies, ws.id, type.id, {})).statusCode).toBe(400);
    expect((await update(ana.cookies, ws.id, 'no-es-un-id', { name: 'X' })).statusCode).toBe(404);
  });
});
