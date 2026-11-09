import {
  elementListSchema,
  elementNodeListSchema,
  elementNodeSchema,
  elementSchema,
  elementTypeListSchema,
  trashListSchema,
  type MembershipRole,
} from '@aprendizaje/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { createWorkspace } from '../workspaces/workspaces.service.js';

const db = createTestDb();
// Muchas peticiones desde la misma IP: el límite por minuto no es lo que se prueba aquí
const app = buildApp({ db, security: { rateLimitMax: 100000 } });

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
  const api = `/api/v1/workspaces/${ws.id}`;
  const types = await app.inject({ url: `${api}/element-types`, cookies: ana.cookies });
  const typeId = elementTypeListSchema.parse(types.json())[0]!.id;

  async function withRole(email: string, role: MembershipRole) {
    const user = await userWithSession(db, email);
    await addMember(db, ws.id, user.user.id, role);
    return user.cookies;
  }

  async function element(name: string) {
    const response = await app.inject({
      method: 'POST',
      url: `${api}/elements`,
      cookies: ana.cookies,
      payload: { typeId, name },
    });
    return elementSchema.parse(response.json()).id;
  }

  async function node(elementId: string, payload: object) {
    const response = await app.inject({
      method: 'POST',
      url: `${api}/elements/${elementId}/nodes`,
      cookies: ana.cookies,
      payload,
    });
    expect(response.statusCode).toBe(201);
    return elementNodeSchema.parse(response.json()).id;
  }
  const chapter = (elementId: string, name: string, parentId: string | null = null) =>
    node(elementId, { kind: 'CHAPTER', parentId, content: { name } });
  const activity = (elementId: string, name: string, parentId: string | null = null) =>
    node(elementId, { kind: 'ACTIVITY', parentId, content: { name } });

  const removeElement = (elementId: string, cookies: Cookies = ana.cookies) =>
    app.inject({ method: 'DELETE', url: `${api}/elements/${elementId}`, cookies });
  const removeNode = (elementId: string, nodeId: string, cookies: Cookies = ana.cookies) =>
    app.inject({ method: 'DELETE', url: `${api}/elements/${elementId}/nodes/${nodeId}`, cookies });
  const trash = async (cookies: Cookies = ana.cookies) => {
    const response = await app.inject({ url: `${api}/trash`, cookies });
    expect(response.statusCode).toBe(200);
    return trashListSchema.parse(response.json());
  };
  const restore = (kind: string, id: string, cookies: Cookies = ana.cookies) =>
    app.inject({ method: 'POST', url: `${api}/trash/${kind}/${id}/restore`, cookies });
  const purge = (kind: string, id: string, cookies: Cookies = ana.cookies) =>
    app.inject({ method: 'DELETE', url: `${api}/trash/${kind}/${id}`, cookies });
  const elements = async () =>
    elementListSchema.parse(
      (await app.inject({ url: `${api}/elements`, cookies: ana.cookies })).json(),
    );
  const nodes = async (elementId: string) =>
    elementNodeListSchema.parse(
      (
        await app.inject({ url: `${api}/elements/${elementId}/nodes`, cookies: ana.cookies })
      ).json(),
    );

  return {
    ana,
    ws,
    api,
    withRole,
    element,
    chapter,
    activity,
    removeElement,
    removeNode,
    trash,
    restore,
    purge,
    elements,
    nodes,
  };
}

describe('quitar un elemento (HU-07)', () => {
  it('el Admin lo manda a la papelera: deja de verse en la lista y en su ficha', async () => {
    const t = await setup();
    const id = await t.element('Curso de Go');

    expect((await t.removeElement(id)).statusCode).toBe(204);

    expect(await t.elements()).toEqual([]);
    const ficha = await app.inject({ url: `${t.api}/elements/${id}`, cookies: t.ana.cookies });
    expect(ficha.statusCode).toBe(404);
    const row = await db.element.findUniqueOrThrow({ where: { id } });
    expect(row.deletedById).toBe(t.ana.user.id);
    expect((await t.removeElement(id)).statusCode).toBe(404);
  });

  it('un Miembro o un Lector no pueden quitar elementos', async () => {
    const t = await setup();
    const id = await t.element('Curso de Go');

    for (const role of ['MEMBER', 'VIEWER'] as const) {
      const cookies = await t.withRole(`${role}@example.com`, role);
      expect((await t.removeElement(id, cookies)).statusCode).toBe(403);
    }
    expect(await t.elements()).toHaveLength(1);
  });

  it('un elemento de otro espacio da 404', async () => {
    const t = await setup();
    const luis = await userWithSession(db, 'luis@example.com');
    const other = await createWorkspace(db, luis.user.id, { name: 'Otro' });
    const id = await t.element('Curso de Go');

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${other.id}/elements/${id}`,
      cookies: luis.cookies,
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('ver la papelera', () => {
  it('lista lo quitado, lo más reciente primero, con su elemento, actividades y quién lo quitó', async () => {
    const t = await setup();
    const go = await t.element('Curso de Go');
    const intro = await t.chapter(go, 'Introducción');
    await t.activity(go, 'Video 1', intro);
    await t.activity(go, 'Video 2', intro);
    const rust = await t.element('Curso de Rust');
    await t.activity(rust, 'Lectura');

    await t.removeNode(go, intro);
    await t.removeElement(rust);

    const items = await t.trash();
    expect(items.map((item) => [item.kind, item.name, item.elementName])).toEqual([
      ['element', 'Curso de Rust', null],
      ['node', 'Introducción', 'Curso de Go'],
    ]);
    expect(items[0]).toMatchObject({ activityCount: 1, nodeKind: null });
    expect(items[1]).toMatchObject({ activityCount: 2, nodeKind: 'CHAPTER' });
    expect(items[0]!.deletedByName).toBe('ana@example.com');
  });

  it('lo que se fue con su capítulo o su elemento no se lista aparte', async () => {
    const t = await setup();
    const go = await t.element('Curso de Go');
    const intro = await t.chapter(go, 'Introducción');
    await t.activity(go, 'Video 1', intro);
    const rust = await t.element('Curso de Rust');
    const leccion = await t.activity(rust, 'Lección');
    await t.removeNode(rust, leccion);

    await t.removeNode(go, intro);
    await t.removeElement(rust);

    expect((await t.trash()).map((item) => item.name).sort()).toEqual([
      'Curso de Rust',
      'Introducción',
    ]);
  });

  it('cada rol ve solo lo que pudo quitar', async () => {
    const t = await setup();
    const go = await t.element('Curso de Go');
    const intro = await t.chapter(go, 'Introducción');
    await t.removeNode(go, intro);
    await t.removeElement(await t.element('Curso de Rust'));

    const member = await t.withRole('miembro@example.com', 'MEMBER');
    const viewer = await t.withRole('lector@example.com', 'VIEWER');
    expect((await t.trash(member)).map((item) => item.kind)).toEqual(['node']);
    expect(await t.trash(viewer)).toEqual([]);
  });

  it('quien no es miembro recibe 404', async () => {
    const t = await setup();
    const luis = await userWithSession(db, 'luis@example.com');

    const response = await app.inject({ url: `${t.api}/trash`, cookies: luis.cookies });
    expect(response.statusCode).toBe(404);
  });
});

describe('restaurar', () => {
  it('un elemento vuelve con toda su estructura y su avance', async () => {
    const t = await setup();
    const go = await t.element('Curso de Go');
    await t.activity(go, 'Video 1');
    await t.removeElement(go);

    expect((await t.restore('element', go)).statusCode).toBe(204);

    const [restored] = await t.elements();
    expect(restored).toMatchObject({ id: go, progress: { total: 1, done: 0 } });
    expect(await t.trash()).toEqual([]);
  });

  it('un capítulo vuelve con lo que se fue con él; lo quitado antes se queda en la papelera', async () => {
    const t = await setup();
    const go = await t.element('Curso de Go');
    const intro = await t.chapter(go, 'Introducción');
    const video = await t.activity(go, 'Video 1', intro);
    const quiz = await t.activity(go, 'Quiz', intro);
    await t.removeNode(go, quiz);
    await t.removeNode(go, intro);

    expect((await t.restore('node', intro)).statusCode).toBe(204);

    expect((await t.nodes(go)).map((n) => n.id).sort()).toEqual([intro, video].sort());
    // Su capítulo ya está activo: ahora el quiz se ve solo en la papelera
    expect((await t.trash()).map((item) => item.id)).toEqual([quiz]);
  });

  it('un nodo cuyo capítulo sigue en la papelera no se restaura solo', async () => {
    const t = await setup();
    const go = await t.element('Curso de Go');
    const intro = await t.chapter(go, 'Introducción');
    const video = await t.activity(go, 'Video 1', intro);
    await t.removeNode(go, video);
    await t.removeNode(go, intro);

    expect((await t.restore('node', video)).statusCode).toBe(404);
  });

  it('un Miembro restaura nodos, pero no elementos; un Lector, nada', async () => {
    const t = await setup();
    const go = await t.element('Curso de Go');
    const intro = await t.chapter(go, 'Introducción');
    await t.removeNode(go, intro);
    const rust = await t.element('Curso de Rust');
    await t.removeElement(rust);
    const member = await t.withRole('miembro@example.com', 'MEMBER');
    const viewer = await t.withRole('lector@example.com', 'VIEWER');

    expect((await t.restore('element', rust, member)).statusCode).toBe(404);
    expect((await t.restore('node', intro, viewer)).statusCode).toBe(404);
    expect((await t.restore('node', intro, member)).statusCode).toBe(204);
  });

  it('lo que no está en la papelera, o un kind inválido, da 404', async () => {
    const t = await setup();
    const go = await t.element('Curso de Go');

    expect((await t.restore('element', go)).statusCode).toBe(404);
    expect((await t.restore('proyecto', go)).statusCode).toBe(404);
    expect((await t.restore('element', 'no-es-uuid')).statusCode).toBe(404);
  });
});

describe('borrar para siempre', () => {
  it('el Admin borra un elemento con toda su estructura', async () => {
    const t = await setup();
    const go = await t.element('Curso de Go');
    const intro = await t.chapter(go, 'Introducción');
    await t.activity(go, 'Video 1', intro);
    await t.removeElement(go);

    expect((await t.purge('element', go)).statusCode).toBe(204);

    expect(await db.element.count()).toBe(0);
    expect(await db.elementNode.count()).toBe(0);
    expect(await t.trash()).toEqual([]);
  });

  it('un capítulo se lleva lo que contiene, incluso lo quitado antes; lo demás sigue', async () => {
    const t = await setup();
    const go = await t.element('Curso de Go');
    const intro = await t.chapter(go, 'Introducción');
    const quiz = await t.activity(go, 'Quiz', intro);
    const other = await t.activity(go, 'Otra');
    await t.removeNode(go, quiz);
    await t.removeNode(go, intro);

    expect((await t.purge('node', intro)).statusCode).toBe(204);

    expect((await db.elementNode.findMany({ select: { id: true } })).map((n) => n.id)).toEqual([
      other,
    ]);
  });

  it('solo el Admin borra para siempre, y solo lo que ya está en la papelera', async () => {
    const t = await setup();
    const go = await t.element('Curso de Go');
    const intro = await t.chapter(go, 'Introducción');
    await t.removeNode(go, intro);
    const member = await t.withRole('miembro@example.com', 'MEMBER');

    expect((await t.purge('node', intro, member)).statusCode).toBe(403);
    expect((await t.purge('element', go)).statusCode).toBe(404);
    expect(await db.elementNode.count()).toBe(1);
  });

  it('no alcanza la papelera de otro espacio', async () => {
    const t = await setup();
    const go = await t.element('Curso de Go');
    await t.removeElement(go);
    const luis = await userWithSession(db, 'luis@example.com');
    const other = await createWorkspace(db, luis.user.id, { name: 'Otro' });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${other.id}/trash/element/${go}`,
      cookies: luis.cookies,
    });
    expect(response.statusCode).toBe(404);
    expect(await db.element.count()).toBe(1);
  });
});
