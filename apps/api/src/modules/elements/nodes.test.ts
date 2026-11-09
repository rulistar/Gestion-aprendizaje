import {
  catalogItemListSchema,
  elementListSchema,
  elementNodeListSchema,
  elementNodeSchema,
  elementSchema,
  elementTypeListSchema,
  type ElementNode,
  type MembershipRole,
} from '@aprendizaje/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { createWorkspace } from '../workspaces/workspaces.service.js';

const db = createTestDb();
// Este archivo hace muchas peticiones desde la misma IP: el límite por minuto no es lo que se prueba aquí
const app = buildApp({ db, security: { rateLimitMax: 100000 } });

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

type Cookies = Record<string, string>;

async function elementIn(cookies: Cookies, workspaceId: string) {
  const types = await app.inject({
    url: `/api/v1/workspaces/${workspaceId}/element-types`,
    cookies,
  });
  const typeId = elementTypeListSchema.parse(types.json())[0]!.id;
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/workspaces/${workspaceId}/elements`,
    cookies,
    payload: { typeId, name: 'Elemento' },
  });
  return { typeId, elementId: elementSchema.parse(response.json()).id };
}

async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });
  const { typeId, elementId } = await elementIn(ana.cookies, ws.id);
  const base = `/api/v1/workspaces/${ws.id}/elements/${elementId}/nodes`;

  async function withRole(email: string, role: MembershipRole) {
    const user = await userWithSession(db, email);
    await addMember(db, ws.id, user.user.id, role);
    return user;
  }
  const post = (payload: object, cookies: Cookies = ana.cookies, today?: string) =>
    app.inject({
      method: 'POST',
      url: `${base}${today ? `?today=${today}` : ''}`,
      cookies,
      payload,
    });
  const put = (nodeId: string, payload: object, cookies: Cookies = ana.cookies, today?: string) =>
    app.inject({
      method: 'PUT',
      url: `${base}/${nodeId}${today ? `?today=${today}` : ''}`,
      cookies,
      payload,
    });
  const move = (nodeId: string, direction: string, cookies: Cookies = ana.cookies) =>
    app.inject({
      method: 'POST',
      url: `${base}/${nodeId}/move`,
      cookies,
      payload: { direction },
    });
  const remove = (nodeId: string, cookies: Cookies = ana.cookies) =>
    app.inject({ method: 'DELETE', url: `${base}/${nodeId}`, cookies });
  const list = async () =>
    elementNodeListSchema.parse((await app.inject({ url: base, cookies: ana.cookies })).json());

  async function add(payload: object): Promise<ElementNode> {
    const response = await post(payload);
    expect(response.statusCode).toBe(201);
    return elementNodeSchema.parse(response.json());
  }
  const chapter = (name: string, parentId: string | null = null) =>
    add({ kind: 'CHAPTER', parentId, content: { name } });
  const activity = (name: string, parentId: string | null = null) =>
    add({ kind: 'ACTIVITY', parentId, content: { name } });
  const course = (name: string, parentId: string | null = null) =>
    add({ kind: 'COURSE', parentId, content: { typeId, name } });

  return {
    ana,
    ws,
    typeId,
    elementId,
    base,
    withRole,
    post,
    put,
    move,
    remove,
    list,
    chapter,
    activity,
    course,
  };
}

describe('autorización', () => {
  it('sin sesión 401; sin membresía 404', async () => {
    const { base, post } = await setup();
    const luis = await userWithSession(db, 'luis@example.com');

    expect((await app.inject({ url: base })).statusCode).toBe(401);
    expect((await app.inject({ url: base, cookies: luis.cookies })).statusCode).toBe(404);
    expect((await post({ kind: 'CHAPTER', content: { name: 'X' } }, luis.cookies)).statusCode).toBe(
      404,
    );
  });

  it('un Lector ve el árbol, pero no lo cambia (403)', async () => {
    const { base, withRole, post, put, move, remove, chapter } = await setup();
    const lector = await withRole('lector@example.com', 'VIEWER');
    const node = await chapter('Uno');
    const content = { kind: 'CHAPTER', content: { name: 'X' } };

    expect((await app.inject({ url: base, cookies: lector.cookies })).statusCode).toBe(200);
    expect((await post(content, lector.cookies)).statusCode).toBe(403);
    expect((await put(node.id, content, lector.cookies)).statusCode).toBe(403);
    expect((await move(node.id, 'up', lector.cookies)).statusCode).toBe(403);
    expect((await remove(node.id, lector.cookies)).statusCode).toBe(403);
  });

  it('un Miembro la arma y queda registrado quién lo hizo', async () => {
    const { withRole, post, remove } = await setup();
    const miembro = await withRole('miembro@example.com', 'MEMBER');

    const response = await post({ kind: 'CHAPTER', content: { name: 'Uno' } }, miembro.cookies);
    expect(response.statusCode).toBe(201);
    const { id } = elementNodeSchema.parse(response.json());
    expect((await remove(id, miembro.cookies)).statusCode).toBe(204);

    const row = await db.elementNode.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ createdById: miembro.user.id, deletedById: miembro.user.id });
  });

  it('un elemento o nodo de otro espacio da 404', async () => {
    const { ana, ws, elementId, chapter } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const foreign = await elementIn(ana.cookies, other.id);
    const node = await chapter('Uno');
    const payload = { kind: 'CHAPTER', content: { name: 'Hackeado' } };

    // El elemento ajeno, con la URL del espacio propio
    const viaOwnWorkspace = `/api/v1/workspaces/${ws.id}/elements/${foreign.elementId}/nodes`;
    expect((await app.inject({ url: viaOwnWorkspace, cookies: ana.cookies })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: 'POST', url: viaOwnWorkspace, cookies: ana.cookies, payload }))
        .statusCode,
    ).toBe(404);

    // El nodo propio, con la URL de otro elemento
    const viaOtherElement = `/api/v1/workspaces/${other.id}/elements/${foreign.elementId}/nodes/${node.id}`;
    expect(
      (await app.inject({ method: 'PUT', url: viaOtherElement, cookies: ana.cookies, payload }))
        .statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'DELETE', url: viaOtherElement, cookies: ana.cookies }))
        .statusCode,
    ).toBe(404);
    const row = await db.elementNode.findUniqueOrThrow({ where: { id: node.id } });
    expect(row).toMatchObject({ name: 'Uno', elementId, deletedAt: null });
  });
});

describe('reglas del árbol', () => {
  it('arma los 3 niveles y calcula el nivel de cada nodo', async () => {
    const { chapter, course, activity, list } = await setup();

    const one = await chapter('Capítulo');
    const two = await course('Curso', one.id);
    const three = await activity('Actividad', two.id);

    expect([one.level, two.level, three.level]).toEqual([1, 2, 3]);
    expect((await list()).map((node) => node.name)).toEqual(['Capítulo', 'Curso', 'Actividad']);
  });

  it.each([
    ['CHAPTER', { name: 'X' }],
    ['COURSE', null],
  ])('en el nivel 3 no cabe un %s, solo actividades', async (kind, content) => {
    const { typeId, post, chapter } = await setup();
    const one = await chapter('Uno');
    const two = await chapter('Dos', one.id);

    const response = await post({
      kind,
      parentId: two.id,
      content: content ?? { typeId, name: 'X' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('no cabe nada en un cuarto nivel', async () => {
    const { post, chapter, activity } = await setup();
    const one = await chapter('Uno');
    const two = await chapter('Dos', one.id);
    const three = await activity('Tres', two.id);

    const response = await post({
      kind: 'ACTIVITY',
      parentId: three.id,
      content: { name: 'Cuatro' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('una actividad no tiene hijos', async () => {
    const { post, activity } = await setup();
    const leaf = await activity('Hoja');

    const response = await post({ kind: 'ACTIVITY', parentId: leaf.id, content: { name: 'X' } });

    expect(response.statusCode).toBe(400);
  });

  it('el padre debe ser de este elemento y seguir vigente', async () => {
    const { ana, ws, post, remove, chapter } = await setup();
    const foreign = await elementIn(ana.cookies, ws.id);
    const foreignNode = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/elements/${foreign.elementId}/nodes`,
      cookies: ana.cookies,
      payload: { kind: 'CHAPTER', content: { name: 'Ajeno' } },
    });
    const foreignId = elementNodeSchema.parse(foreignNode.json()).id;
    const gone = await chapter('Borrado');
    await remove(gone.id);
    const child = (parentId: string) => ({
      kind: 'ACTIVITY',
      parentId,
      content: { name: 'X' },
    });

    expect((await post(child(foreignId))).statusCode).toBe(400);
    expect((await post(child(gone.id))).statusCode).toBe(400);
  });

  it('un nodo no cambia de clase', async () => {
    const { put, chapter } = await setup();
    const node = await chapter('Uno');

    const response = await put(node.id, { kind: 'ACTIVITY', content: { name: 'X' } });

    expect(response.statusCode).toBe(400);
  });

  it('los hermanos se agregan al final', async () => {
    const { chapter } = await setup();

    const first = await chapter('Uno');
    const second = await chapter('Dos');

    expect([first.position, second.position]).toEqual([0, 1]);
  });

  it('si el elemento está en la papelera, su árbol da 404', async () => {
    const { ana, elementId, base, post } = await setup();
    await db.element.update({ where: { id: elementId }, data: { deletedAt: new Date() } });

    expect((await post({ kind: 'CHAPTER', content: { name: 'X' } })).statusCode).toBe(404);
    expect((await app.inject({ url: base, cookies: ana.cookies })).statusCode).toBe(404);
  });
});

describe('contenido', () => {
  it('un capítulo se renombra', async () => {
    const { put, chapter } = await setup();
    const node = await chapter('Uno');

    const response = await put(node.id, { kind: 'CHAPTER', content: { name: ' Dos ' } });

    expect(elementNodeSchema.parse(response.json()).name).toBe('Dos');
  });

  it('un Curso usa la misma ficha que el elemento: horas y fechas reales', async () => {
    const { typeId, post, put } = await setup();
    const content = {
      typeId,
      name: 'SQL',
      durationWeeks: 4,
      daysPerWeek: 5,
      hoursPerDay: 2,
      status: 'IN_PROGRESS',
    };

    const created = elementNodeSchema.parse(
      (await post({ kind: 'COURSE', content }, undefined, '2026-03-15')).json(),
    );
    if (created.kind !== 'COURSE') throw new Error('Debe ser un Curso');
    expect(created.ficha).toMatchObject({
      id: created.id,
      totalHours: 40,
      actualStart: '2026-03-15',
      priority: 'MEDIUM',
    });

    const updated = elementNodeSchema.parse(
      (
        await put(
          created.id,
          {
            kind: 'COURSE',
            content: {
              ...content,
              status: 'DONE',
              priority: 'LOW',
              manualTotalHours: 12,
              actualStart: '2026-03-15',
            },
          },
          undefined,
          '2026-03-20',
        )
      ).json(),
    );
    if (updated.kind !== 'COURSE') throw new Error('Debe ser un Curso');
    expect(updated.ficha).toMatchObject({
      totalHours: 12,
      actualEnd: '2026-03-20',
      priority: 'LOW',
    });
  });

  it('un Curso rechaza un tipo de otro espacio y conserva uno archivado', async () => {
    const { ana, ws, typeId, post, put, course } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const foreign = await elementIn(ana.cookies, other.id);
    const node = await course('SQL');

    expect(
      (await post({ kind: 'COURSE', content: { typeId: foreign.typeId, name: 'X' } })).statusCode,
    ).toBe(400);

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${ws.id}/element-types/${typeId}`,
      cookies: ana.cookies,
      payload: { archived: true },
    });
    expect((await post({ kind: 'COURSE', content: { typeId, name: 'X' } })).statusCode).toBe(400);
    expect(
      (await put(node.id, { kind: 'COURSE', content: { typeId, name: 'SQL 2' } })).statusCode,
    ).toBe(200);
  });

  it('una actividad guarda sus campos y llena sus fechas reales', async () => {
    const { ana, ws, post, put } = await setup();
    const catalogs = catalogItemListSchema.parse(
      (
        await app.inject({ url: `/api/v1/workspaces/${ws.id}/catalogs`, cookies: ana.cookies })
      ).json(),
    );
    const activityTypeId = catalogs.find((item) => item.kind === 'ACTIVITY_TYPE')!.id;
    const content = { name: 'Video', activityTypeId, durationMinutes: 30 };

    const created = elementNodeSchema.parse((await post({ kind: 'ACTIVITY', content })).json());
    if (created.kind !== 'ACTIVITY') throw new Error('Debe ser una actividad');
    expect(created.activity).toMatchObject({
      activityTypeId,
      durationMinutes: 30,
      status: 'PENDING',
      actualStart: null,
    });

    const done = elementNodeSchema.parse(
      (
        await put(
          created.id,
          { kind: 'ACTIVITY', content: { ...content, status: 'DONE' } },
          undefined,
          '2026-03-15',
        )
      ).json(),
    );
    if (done.kind !== 'ACTIVITY') throw new Error('Debe ser una actividad');
    expect(done.activity).toMatchObject({ actualStart: '2026-03-15', actualEnd: '2026-03-15' });
  });

  it('el tipo de actividad debe ser de ese catálogo y de este espacio', async () => {
    const { ana, ws, post } = await setup();
    const catalogs = catalogItemListSchema.parse(
      (
        await app.inject({ url: `/api/v1/workspaces/${ws.id}/catalogs`, cookies: ana.cookies })
      ).json(),
    );
    const level = catalogs.find((item) => item.kind === 'LEVEL')!.id;

    const response = await post({
      kind: 'ACTIVITY',
      content: { name: 'X', activityTypeId: level },
    });

    expect(response.statusCode).toBe(400);
  });

  it.each([
    ['sin nombre', { kind: 'CHAPTER', content: { name: ' ' } }],
    ['una clase desconocida', { kind: 'OTRA', content: { name: 'X' } }],
    ['un Curso sin tipo', { kind: 'COURSE', content: { name: 'X' } }],
    ['minutos negativos', { kind: 'ACTIVITY', content: { name: 'X', durationMinutes: -1 } }],
  ])('rechaza %s con 400', async (_caso, payload) => {
    const { post } = await setup();

    expect((await post(payload)).statusCode).toBe(400);
  });
});

describe('ordenar', () => {
  it('sube y baja entre sus hermanos; en un extremo no cambia nada', async () => {
    const { move, list, chapter } = await setup();
    await chapter('Uno');
    const two = await chapter('Dos');
    const names = async () =>
      (await list()).sort((a, b) => a.position - b.position).map((node) => node.name);

    expect((await move(two.id, 'up')).statusCode).toBe(204);
    expect(await names()).toEqual(['Dos', 'Uno']);

    expect((await move(two.id, 'up')).statusCode).toBe(204);
    expect(await names()).toEqual(['Dos', 'Uno']);

    expect((await move(two.id, 'down')).statusCode).toBe(204);
    expect(await names()).toEqual(['Uno', 'Dos']);
  });

  it('solo se mueve entre los de su mismo padre, saltando lo borrado', async () => {
    const { move, remove, list, chapter, activity } = await setup();
    const parent = await chapter('Padre');
    await activity('A', parent.id);
    const b = await activity('B', parent.id);
    const c = await activity('C', parent.id);
    await chapter('Otro de la raíz');
    await remove(b.id);

    await move(c.id, 'up');

    const children = (await list())
      .filter((node) => node.parentId === parent.id)
      .sort((x, y) => x.position - y.position);
    expect(children.map((node) => node.name)).toEqual(['C', 'A']);
  });

  it('400 con una dirección desconocida', async () => {
    const { move, chapter } = await setup();
    const node = await chapter('Uno');

    expect((await move(node.id, 'izquierda')).statusCode).toBe(400);
  });
});

describe('quitar', () => {
  it('manda a la papelera el nodo con todo lo que contiene, con la misma fecha', async () => {
    const { remove, list, chapter, activity } = await setup();
    const keep = await chapter('Se queda');
    const one = await chapter('Uno');
    const two = await chapter('Dos', one.id);
    const three = await activity('Tres', two.id);

    expect((await remove(one.id)).statusCode).toBe(204);

    expect((await list()).map((node) => node.id)).toEqual([keep.id]);
    const rows = await db.elementNode.findMany({
      where: { id: { in: [one.id, two.id, three.id] } },
      select: { deletedAt: true },
    });
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.deletedAt?.getTime())).size).toBe(1);
    expect(rows[0]?.deletedAt).not.toBeNull();
  });

  it('un nodo quitado ya no se edita, ni se mueve, ni se vuelve a quitar (404)', async () => {
    const { put, move, remove, chapter } = await setup();
    const node = await chapter('Uno');
    await remove(node.id);

    expect((await put(node.id, { kind: 'CHAPTER', content: { name: 'X' } })).statusCode).toBe(404);
    expect((await move(node.id, 'up')).statusCode).toBe(404);
    expect((await remove(node.id)).statusCode).toBe(404);
  });
});

describe('avance en la lista de elementos (HU-05)', () => {
  const setStatus = (setupResult: Awaited<ReturnType<typeof setup>>, id: string, status: string) =>
    setupResult.put(id, { kind: 'ACTIVITY', content: { name: 'Actividad', status } });
  const progressOf = async (
    { ana, ws }: Awaited<ReturnType<typeof setup>>,
    elementId: string,
    cookies: Cookies = ana.cookies,
  ) => {
    const response = await app.inject({ url: `/api/v1/workspaces/${ws.id}/elements`, cookies });
    return elementListSchema.parse(response.json()).find((e) => e.id === elementId)!.progress;
  };

  it('sin actividades es 0 %', async () => {
    const context = await setup();
    await context.chapter('Solo un capítulo');

    expect(await progressOf(context, context.elementId)).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it('cuenta las actividades de todos los niveles; una cancelada no cuenta y una pausada sí', async () => {
    const context = await setup();
    const first = await context.chapter('Capítulo');
    const second = await context.chapter('Subcapítulo', first.id);
    const done = await context.activity('Hecha', second.id);
    const paused = await context.activity('Pausada', first.id);
    const cancelled = await context.activity('Cancelada');
    await setStatus(context, done.id, 'DONE');
    await setStatus(context, paused.id, 'PAUSED');
    await setStatus(context, cancelled.id, 'CANCELLED');

    expect(await progressOf(context, context.elementId)).toEqual({
      total: 2,
      done: 1,
      percent: 50,
    });
  });

  it('lo quitado deja de contar, también lo que contenía', async () => {
    const context = await setup();
    const first = await context.chapter('Capítulo');
    const inside = await context.activity('Dentro', first.id);
    const outside = await context.activity('Fuera');
    await setStatus(context, inside.id, 'DONE');
    await setStatus(context, outside.id, 'PENDING');
    expect((await progressOf(context, context.elementId)).percent).toBe(50);

    expect((await context.remove(first.id)).statusCode).toBe(204);

    expect(await progressOf(context, context.elementId)).toEqual({ total: 1, done: 0, percent: 0 });
  });

  it('cada elemento cuenta solo sus actividades, y un Lector también ve el avance', async () => {
    const context = await setup();
    const other = await elementIn(context.ana.cookies, context.ws.id);
    const activity = await context.activity('Del primero');
    await setStatus(context, activity.id, 'DONE');
    const reader = await context.withRole('lector@example.com', 'VIEWER');

    expect((await progressOf(context, context.elementId, reader.cookies)).percent).toBe(100);
    expect((await progressOf(context, other.elementId, reader.cookies)).total).toBe(0);
  });
});
