import {
  catalogItemListSchema,
  elementListSchema,
  elementSchema,
  elementTypeListSchema,
  type MembershipRole,
} from '@aprendizaje/shared';
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

type Cookies = Record<string, string>;

const url = (workspaceId: string, today?: string) =>
  `/api/v1/workspaces/${workspaceId}/elements${today ? `?today=${today}` : ''}`;
const elementUrl = (workspaceId: string, elementId: string, today?: string) =>
  `/api/v1/workspaces/${workspaceId}/elements/${elementId}${today ? `?today=${today}` : ''}`;

async function firstTypeId(cookies: Cookies, workspaceId: string) {
  const response = await app.inject({
    url: `/api/v1/workspaces/${workspaceId}/element-types`,
    cookies,
  });
  return elementTypeListSchema.parse(response.json())[0]!.id;
}

async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });
  const typeId = await firstTypeId(ana.cookies, ws.id);

  async function withRole(email: string, role: MembershipRole) {
    const user = await userWithSession(db, email);
    await addMember(db, ws.id, user.user.id, role);
    return user;
  }
  return { ana, ws, typeId, withRole };
}

function post(cookies: Cookies, workspaceId: string, payload: object, today?: string) {
  return app.inject({ method: 'POST', url: url(workspaceId, today), cookies, payload });
}

function put(
  cookies: Cookies,
  workspaceId: string,
  elementId: string,
  payload: object,
  today?: string,
) {
  return app.inject({
    method: 'PUT',
    url: elementUrl(workspaceId, elementId, today),
    cookies,
    payload,
  });
}

async function createOk(cookies: Cookies, workspaceId: string, payload: object, today?: string) {
  const response = await post(cookies, workspaceId, payload, today);
  expect(response.statusCode).toBe(201);
  return elementSchema.parse(response.json());
}

/** Agrega un valor al catálogo y devuelve su ID */
async function catalogItem(cookies: Cookies, workspaceId: string, kind: string, name: string) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/workspaces/${workspaceId}/catalogs`,
    cookies,
    payload: { kind, name },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string }>().id;
}

function archiveCatalogItem(cookies: Cookies, workspaceId: string, itemId: string) {
  return app.inject({
    method: 'PATCH',
    url: `/api/v1/workspaces/${workspaceId}/catalogs/${itemId}`,
    cookies,
    payload: { archived: true },
  });
}

describe('autorización', () => {
  it('sin sesión 401; sin membresía 404', async () => {
    const { ws, typeId } = await setup();
    const luis = await userWithSession(db, 'luis@example.com');

    expect((await app.inject({ url: url(ws.id) })).statusCode).toBe(401);
    expect((await app.inject({ url: url(ws.id), cookies: luis.cookies })).statusCode).toBe(404);
    expect((await post(luis.cookies, ws.id, { typeId, name: 'X' })).statusCode).toBe(404);
  });

  it('un Lector los ve, pero no crea ni modifica (403)', async () => {
    const { ana, ws, typeId, withRole } = await setup();
    const lector = await withRole('lector@example.com', 'VIEWER');
    const element = await createOk(ana.cookies, ws.id, { typeId, name: 'SQL' });

    const detail = await app.inject({
      url: elementUrl(ws.id, element.id),
      cookies: lector.cookies,
    });
    expect(detail.statusCode).toBe(200);
    expect((await post(lector.cookies, ws.id, { typeId, name: 'X' })).statusCode).toBe(403);
    expect((await put(lector.cookies, ws.id, element.id, { typeId, name: 'X' })).statusCode).toBe(
      403,
    );
  });

  it('un Miembro crea y modifica, y queda registrado quién lo hizo', async () => {
    const { ana, ws, typeId, withRole } = await setup();
    const miembro = await withRole('miembro@example.com', 'MEMBER');

    const created = await createOk(miembro.cookies, ws.id, { typeId, name: 'SQL' });
    await put(ana.cookies, ws.id, created.id, { typeId, name: 'SQL avanzado' });

    const row = await db.element.findUniqueOrThrow({ where: { id: created.id } });
    expect(row).toMatchObject({
      name: 'SQL avanzado',
      workspaceId: ws.id,
      createdById: miembro.user.id,
      updatedById: ana.user.id,
    });
  });

  it('un elemento de otro espacio da 404 y no cambia', async () => {
    const { ana, ws, typeId } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const otherType = await firstTypeId(ana.cookies, other.id);
    const element = await createOk(ana.cookies, other.id, { typeId: otherType, name: 'Ajeno' });

    expect(
      (await app.inject({ url: elementUrl(ws.id, element.id), cookies: ana.cookies })).statusCode,
    ).toBe(404);
    expect((await put(ana.cookies, ws.id, element.id, { typeId, name: 'X' })).statusCode).toBe(404);
    const row = await db.element.findUniqueOrThrow({ where: { id: element.id } });
    expect(row.name).toBe('Ajeno');
  });
});

describe('la ficha', () => {
  it('guarda todos los campos y devuelve las horas calculadas', async () => {
    const { ana, ws, typeId } = await setup();
    const platformId = await catalogItem(ana.cookies, ws.id, 'PLATFORM', 'Coursera');
    const sponsorId = await catalogItem(ana.cookies, ws.id, 'SPONSOR', 'Mi empresa');
    const categoryId = await catalogItem(ana.cookies, ws.id, 'CATEGORY', 'Datos');
    const levels = catalogItemListSchema
      .parse(
        (
          await app.inject({ url: `/api/v1/workspaces/${ws.id}/catalogs`, cookies: ana.cookies })
        ).json(),
      )
      .filter((item) => item.kind === 'LEVEL');

    const element = await createOk(ana.cookies, ws.id, {
      typeId,
      name: '  SQL ',
      platformId,
      sponsorId,
      categoryId,
      levelId: levels[0]!.id,
      durationWeeks: 1.5,
      daysPerWeek: 3,
      hoursPerDay: 1.25,
      estimatedStart: '2026-11-10',
      estimatedEnd: '2026-12-10',
      notes: ' Con práctica ',
    });

    expect(element).toMatchObject({
      name: 'SQL',
      platformId,
      durationWeeks: 1.5,
      daysPerWeek: 3,
      hoursPerDay: 1.25,
      manualTotalHours: null,
      totalHours: 5.63,
      estimatedStart: '2026-11-10',
      estimatedEnd: '2026-12-10',
      status: 'NOT_STARTED',
      notes: 'Con práctica',
    });
  });

  it('las horas capturadas mandan, y al borrarlas vuelve el cálculo', async () => {
    const { ana, ws, typeId } = await setup();
    const hours = { typeId, name: 'SQL', durationWeeks: 4, daysPerWeek: 5, hoursPerDay: 2 };
    const element = await createOk(ana.cookies, ws.id, { ...hours, manualTotalHours: 12 });
    expect(element.totalHours).toBe(12);

    const response = await put(ana.cookies, ws.id, element.id, hours);

    expect(elementSchema.parse(response.json())).toMatchObject({
      manualTotalHours: null,
      totalHours: 40,
    });
  });

  it('sin los datos para calcular, las horas totales quedan vacías', async () => {
    const { ana, ws, typeId } = await setup();

    const element = await createOk(ana.cookies, ws.id, { typeId, name: 'SQL', durationWeeks: 4 });

    expect(element.totalHours).toBeNull();
    expect(element.daysPerWeek).toBe(5);
  });

  it.each([
    ['sin nombre', { name: ' ' }],
    ['un fin antes del inicio', { estimatedStart: '2026-02-02', estimatedEnd: '2026-02-01' }],
    ['8 días por semana', { daysPerWeek: 8 }],
    ['un estado desconocido', { status: 'OTRO' }],
  ])('rechaza %s con 400', async (_caso, change) => {
    const { ana, ws, typeId } = await setup();

    expect((await post(ana.cookies, ws.id, { typeId, name: 'SQL', ...change })).statusCode).toBe(
      400,
    );
  });

  it('la prioridad es Media por omisión, se cambia y viaja en la lista (HU-10)', async () => {
    const { ana, ws, typeId } = await setup();
    const created = await createOk(ana.cookies, ws.id, { typeId, name: 'Curso de Go' });
    expect(created.priority).toBe('MEDIUM');

    const updated = await put(ana.cookies, ws.id, created.id, {
      typeId,
      name: 'Curso de Go',
      priority: 'HIGH',
    });
    expect(elementSchema.parse(updated.json()).priority).toBe('HIGH');
    const list = await app.inject({ url: url(ws.id), cookies: ana.cookies });
    expect(elementListSchema.parse(list.json())[0]!.priority).toBe('HIGH');

    const invalid = await post(ana.cookies, ws.id, { typeId, name: 'Otro', priority: 'URGENTE' });
    expect(invalid.statusCode).toBe(400);
  });

  it('la lista trae lo más reciente primero', async () => {
    const { ana, ws, typeId } = await setup();
    await createOk(ana.cookies, ws.id, { typeId, name: 'Primero' });
    await createOk(ana.cookies, ws.id, { typeId, name: 'Segundo' });

    const response = await app.inject({ url: url(ws.id), cookies: ana.cookies });

    expect(elementListSchema.parse(response.json()).map((e) => e.name)).toEqual([
      'Segundo',
      'Primero',
    ]);
  });

  it('lo que está en la papelera no aparece ni se modifica', async () => {
    const { ana, ws, typeId } = await setup();
    const element = await createOk(ana.cookies, ws.id, { typeId, name: 'SQL' });
    await db.element.update({ where: { id: element.id }, data: { deletedAt: new Date() } });

    const list = await app.inject({ url: url(ws.id), cookies: ana.cookies });
    expect(elementListSchema.parse(list.json())).toEqual([]);
    expect(
      (await app.inject({ url: elementUrl(ws.id, element.id), cookies: ana.cookies })).statusCode,
    ).toBe(404);
    expect((await put(ana.cookies, ws.id, element.id, { typeId, name: 'X' })).statusCode).toBe(404);
  });

  it('404 con un ID que no es válido', async () => {
    const { ana, ws, typeId } = await setup();

    expect((await put(ana.cookies, ws.id, 'no-es-un-id', { typeId, name: 'X' })).statusCode).toBe(
      404,
    );
  });
});

describe('referencias', () => {
  it('rechaza un tipo o un catálogo de otro espacio', async () => {
    const { ana, ws, typeId } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const otherType = await firstTypeId(ana.cookies, other.id);
    const otherPlatform = await catalogItem(ana.cookies, other.id, 'PLATFORM', 'Ajena');

    expect((await post(ana.cookies, ws.id, { typeId: otherType, name: 'X' })).statusCode).toBe(400);
    expect(
      (await post(ana.cookies, ws.id, { typeId, name: 'X', platformId: otherPlatform })).statusCode,
    ).toBe(400);
  });

  it('rechaza un valor de otro catálogo: un patrocinador no es una plataforma', async () => {
    const { ana, ws, typeId } = await setup();
    const sponsor = await catalogItem(ana.cookies, ws.id, 'SPONSOR', 'Mi empresa');

    const response = await post(ana.cookies, ws.id, { typeId, name: 'X', platformId: sponsor });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ message: string }>().message).toContain('plataforma');
  });

  it('lo archivado no se elige para lo nuevo, pero quien ya lo usa lo conserva', async () => {
    const { ana, ws, typeId } = await setup();
    const platformId = await catalogItem(ana.cookies, ws.id, 'PLATFORM', 'Coursera');
    const element = await createOk(ana.cookies, ws.id, { typeId, name: 'SQL', platformId });
    await archiveCatalogItem(ana.cookies, ws.id, platformId);

    expect((await post(ana.cookies, ws.id, { typeId, name: 'X', platformId })).statusCode).toBe(
      400,
    );
    const kept = await put(ana.cookies, ws.id, element.id, { typeId, name: 'SQL 2', platformId });
    expect(kept.statusCode).toBe(200);
  });

  it('un tipo archivado tampoco se elige, pero se conserva', async () => {
    const { ana, ws, typeId } = await setup();
    const element = await createOk(ana.cookies, ws.id, { typeId, name: 'SQL' });
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${ws.id}/element-types/${typeId}`,
      cookies: ana.cookies,
      payload: { archived: true },
    });

    expect((await post(ana.cookies, ws.id, { typeId, name: 'X' })).statusCode).toBe(400);
    expect((await put(ana.cookies, ws.id, element.id, { typeId, name: 'SQL 2' })).statusCode).toBe(
      200,
    );
  });
});

describe('fechas reales', () => {
  const TODAY = '2026-03-15';

  it('se llenan con el día del usuario al avanzar, sin pisar lo capturado', async () => {
    const { ana, ws, typeId } = await setup();
    const base = { typeId, name: 'SQL' };
    const element = await createOk(ana.cookies, ws.id, base);
    expect(element.actualStart).toBeNull();

    const started = elementSchema.parse(
      (await put(ana.cookies, ws.id, element.id, { ...base, status: 'IN_PROGRESS' }, TODAY)).json(),
    );
    expect(started.actualStart).toBe(TODAY);

    const done = elementSchema.parse(
      (
        await put(
          ana.cookies,
          ws.id,
          element.id,
          { ...base, status: 'DONE', actualStart: '2026-03-01' },
          '2026-03-20',
        )
      ).json(),
    );
    expect(done).toMatchObject({ actualStart: '2026-03-01', actualEnd: '2026-03-20' });
  });

  it('se pueden corregir o borrar sin que regresen', async () => {
    const { ana, ws, typeId } = await setup();
    const base = { typeId, name: 'SQL', status: 'IN_PROGRESS' };
    const element = await createOk(ana.cookies, ws.id, base, TODAY);
    expect(element.actualStart).toBe(TODAY);

    const cleared = await put(ana.cookies, ws.id, element.id, base, TODAY);

    expect(elementSchema.parse(cleared.json()).actualStart).toBeNull();
  });

  it('reabrir quita el fin', async () => {
    const { ana, ws, typeId } = await setup();
    const base = { typeId, name: 'SQL' };
    const element = await createOk(ana.cookies, ws.id, { ...base, status: 'DONE' }, TODAY);
    expect(element.actualEnd).toBe(TODAY);

    const reopened = await put(
      ana.cookies,
      ws.id,
      element.id,
      { ...base, status: 'IN_PROGRESS', actualStart: TODAY, actualEnd: TODAY },
      TODAY,
    );

    expect(elementSchema.parse(reopened.json())).toMatchObject({
      actualStart: TODAY,
      actualEnd: null,
    });
  });

  it('400 si terminar hoy dejaría el fin antes de un inicio futuro', async () => {
    const { ana, ws, typeId } = await setup();

    const response = await post(
      ana.cookies,
      ws.id,
      { typeId, name: 'SQL', status: 'DONE', actualStart: '2026-04-01' },
      TODAY,
    );

    expect(response.statusCode).toBe(400);
  });

  it('sin ?today usa el día del servidor; un ?today inválido se ignora', async () => {
    const { ana, ws, typeId } = await setup();
    const payload = { typeId, name: 'SQL', status: 'IN_PROGRESS' };
    const serverToday = new Date().toISOString().slice(0, 10);

    const plain = await createOk(ana.cookies, ws.id, payload);
    const invalid = await createOk(ana.cookies, ws.id, payload, 'mañana');

    expect(plain.actualStart).toBe(serverToday);
    expect(invalid.actualStart).toBe(serverToday);
  });
});
