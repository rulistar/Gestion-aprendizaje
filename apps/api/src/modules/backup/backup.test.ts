import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupSchema,
  catalogItemListSchema,
  elementListSchema,
  elementNodeListSchema,
  elementTypeListSchema,
  importResultSchema,
  type Backup,
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

const base = (workspaceId: string) => `/api/v1/workspaces/${workspaceId}`;

function post(cookies: Cookies, url: string, payload: object) {
  return app.inject({ method: 'POST', url, cookies, payload });
}

async function typeIdOf(cookies: Cookies, workspaceId: string, name: string) {
  const response = await app.inject({ url: `${base(workspaceId)}/element-types`, cookies });
  const types = elementTypeListSchema.parse(response.json());
  return types.find((type) => type.name === name)!.id;
}

/** Un espacio con su Admin (quien lo crea) y un elemento con estructura: Go > Intro > Hola */
async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });

  async function withRole(email: string, role: MembershipRole) {
    const user = await userWithSession(db, email);
    await addMember(db, ws.id, user.user.id, role);
    return user;
  }

  async function createSample() {
    const url = base(ws.id);
    const typeId = await typeIdOf(ana.cookies, ws.id, 'Curso');
    const platform = await post(ana.cookies, `${url}/catalogs`, {
      kind: 'PLATFORM',
      name: 'Udemy',
    });
    const element = await post(ana.cookies, `${url}/elements`, {
      typeId,
      name: 'Go',
      platformId: platform.json<{ id: string }>().id,
      status: 'IN_PROGRESS',
    });
    expect(element.statusCode).toBe(201);
    const elementId = element.json<{ id: string }>().id;
    const chapter = await post(ana.cookies, `${url}/elements/${elementId}/nodes`, {
      kind: 'CHAPTER',
      parentId: null,
      content: { name: 'Intro' },
    });
    const activity = await post(ana.cookies, `${url}/elements/${elementId}/nodes`, {
      kind: 'ACTIVITY',
      parentId: chapter.json<{ id: string }>().id,
      content: { name: 'Hola', durationMinutes: 10 },
    });
    expect(activity.statusCode).toBe(201);
    return elementId;
  }

  async function exportJson(cookies: Cookies = ana.cookies) {
    const response = await app.inject({ url: `${base(ws.id)}/export`, cookies });
    expect(response.statusCode).toBe(200);
    return backupSchema.parse(response.json());
  }

  return { ana, ws, withRole, createSample, exportJson };
}

/** Un segundo espacio, de otra persona, para llevarle el respaldo del primero */
async function otherWorkspace() {
  const bea = await userWithSession(db, 'bea@example.com');
  const ws = await createWorkspace(db, bea.user.id, { name: 'Otro' });
  return { bea, ws };
}

function importUrl(workspaceId: string, preview = false) {
  return `${base(workspaceId)}/import${preview ? '/preview' : ''}`;
}

describe('exportar', () => {
  it('sin sesión 401; sin membresía 404; un Lector no puede exportar (403)', async () => {
    const { ws, withRole } = await setup();
    const luis = await userWithSession(db, 'luis@example.com');
    const lector = await withRole('lector@example.com', 'VIEWER');

    expect((await app.inject({ url: `${base(ws.id)}/export` })).statusCode).toBe(401);
    const stranger = await app.inject({ url: `${base(ws.id)}/export`, cookies: luis.cookies });
    expect(stranger.statusCode).toBe(404);
    const viewer = await app.inject({ url: `${base(ws.id)}/export`, cookies: lector.cookies });
    expect(viewer.statusCode).toBe(403);
  });

  it('un Miembro exporta en JSON, con los nombres y la estructura en orden', async () => {
    const { ws, withRole, createSample } = await setup();
    await createSample();
    const miembro = await withRole('miembro@example.com', 'MEMBER');

    const response = await app.inject({ url: `${base(ws.id)}/export`, cookies: miembro.cookies });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="gestor-aprendizaje-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    const backup = backupSchema.parse(response.json());
    expect(backup.elements).toHaveLength(1);
    expect(backup.elements[0]).toMatchObject({
      name: 'Go',
      type: 'Curso',
      platform: 'Udemy',
      status: 'IN_PROGRESS',
    });
    expect(backup.elements[0]!.nodes).toMatchObject([
      { kind: 'CHAPTER', depth: 1, name: 'Intro' },
      { kind: 'ACTIVITY', depth: 2, name: 'Hola', durationMinutes: 10 },
    ]);
  });

  it('en CSV: con BOM, nombre de archivo .csv y una fila por elemento y nodo', async () => {
    const { ws, ana, createSample } = await setup();
    await createSample();

    const response = await app.inject({
      url: `${base(ws.id)}/export?format=csv`,
      cookies: ana.cookies,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('.csv"');
    expect(response.body.startsWith('\uFEFF')).toBe(true);
    // Encabezado + elemento + capítulo + actividad
    expect(response.body.trim().split('\r\n')).toHaveLength(4);
  });

  it('un formato desconocido da 400', async () => {
    const { ws, ana } = await setup();
    const response = await app.inject({
      url: `${base(ws.id)}/export?format=xml`,
      cookies: ana.cookies,
    });
    expect(response.statusCode).toBe(400);
  });

  it('no incluye lo que está en la papelera', async () => {
    const { ws, ana, createSample, exportJson } = await setup();
    const elementId = await createSample();
    const removed = await app.inject({
      method: 'DELETE',
      url: `${base(ws.id)}/elements/${elementId}`,
      cookies: ana.cookies,
    });
    expect(removed.statusCode).toBe(204);

    expect((await exportJson()).elements).toEqual([]);
  });
});

describe('importar', () => {
  it('solo el Admin importa; un Miembro o un Lector reciben 403', async () => {
    const { ws, withRole, exportJson } = await setup();
    const backup = await exportJson();
    const miembro = await withRole('miembro@example.com', 'MEMBER');
    const lector = await withRole('lector@example.com', 'VIEWER');

    for (const user of [miembro, lector]) {
      for (const preview of [true, false]) {
        const response = await post(user.cookies, importUrl(ws.id, preview), backup);
        expect(response.statusCode).toBe(403);
      }
    }
  });

  it('un archivo que no es un respaldo da 400 con la razón', async () => {
    const { ws, ana } = await setup();
    const response = await post(ana.cookies, importUrl(ws.id), { format: 'otro', elements: [] });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ message: string }>().message).toContain('No es un respaldo');
  });

  it('la vista previa dice qué pasaría y no escribe nada', async () => {
    const { createSample, exportJson } = await setup();
    await createSample();
    const backup = await exportJson();
    const { bea, ws } = await otherWorkspace();

    const response = await post(bea.cookies, importUrl(ws.id, true), backup);
    expect(response.statusCode).toBe(200);
    expect(importResultSchema.parse(response.json())).toEqual({
      applied: false,
      elements: 1,
      nodes: 2,
      skipped: [],
      newTypes: [],
      newCatalogItems: [{ kind: 'PLATFORM', name: 'Udemy' }],
    });

    const elements = await app.inject({ url: `${base(ws.id)}/elements`, cookies: bea.cookies });
    expect(elementListSchema.parse(elements.json())).toEqual([]);
    const catalogs = await app.inject({ url: `${base(ws.id)}/catalogs`, cookies: bea.cookies });
    const platforms = catalogItemListSchema
      .parse(catalogs.json())
      .filter((item) => item.kind === 'PLATFORM');
    expect(platforms).toEqual([]);
  });

  it('importa a otro espacio: elementos, estructura y catálogos nuevos', async () => {
    const { createSample, exportJson } = await setup();
    await createSample();
    const backup = await exportJson();
    const { bea, ws } = await otherWorkspace();

    const response = await post(bea.cookies, importUrl(ws.id), backup);
    expect(response.statusCode).toBe(200);
    expect(importResultSchema.parse(response.json())).toMatchObject({
      applied: true,
      elements: 1,
      nodes: 2,
    });

    const list = await app.inject({ url: `${base(ws.id)}/elements`, cookies: bea.cookies });
    const [element] = elementListSchema.parse(list.json());
    expect(element).toMatchObject({ name: 'Go', status: 'IN_PROGRESS' });
    // La actividad quedó sin hacer: el avance se calcula con lo importado
    expect(element!.progress).toMatchObject({ total: 1, done: 0 });

    const nodes = await app.inject({
      url: `${base(ws.id)}/elements/${element!.id}/nodes`,
      cookies: bea.cookies,
    });
    const [chapter, activity] = elementNodeListSchema.parse(nodes.json());
    expect(chapter).toMatchObject({ kind: 'CHAPTER', name: 'Intro', parentId: null, level: 1 });
    expect(activity).toMatchObject({ kind: 'ACTIVITY', parentId: chapter!.id, level: 2 });

    // Exportar de nuevo da lo mismo: nada se perdió por el camino
    const again = await app.inject({ url: `${base(ws.id)}/export`, cookies: bea.cookies });
    expect(backupSchema.parse(again.json()).elements).toEqual(backup.elements);
  });

  it('volver a cargar el mismo archivo no duplica nada', async () => {
    const { createSample, exportJson } = await setup();
    await createSample();
    const backup = await exportJson();
    const { bea, ws } = await otherWorkspace();

    await post(bea.cookies, importUrl(ws.id), backup);
    const second = await post(bea.cookies, importUrl(ws.id), backup);
    expect(importResultSchema.parse(second.json())).toEqual({
      applied: true,
      elements: 0,
      nodes: 0,
      skipped: [{ name: 'Go', reason: 'EXISTS' }],
      newTypes: [],
      newCatalogItems: [],
    });

    const list = await app.inject({ url: `${base(ws.id)}/elements`, cookies: bea.cookies });
    expect(elementListSchema.parse(list.json())).toHaveLength(1);
    const catalogs = await app.inject({ url: `${base(ws.id)}/catalogs`, cookies: bea.cookies });
    const platforms = catalogItemListSchema
      .parse(catalogs.json())
      .filter((item) => item.kind === 'PLATFORM');
    expect(platforms).toHaveLength(1);
  });

  it('un elemento repetido dentro del archivo se carga una sola vez', async () => {
    const { ana, ws, createSample, exportJson } = await setup();
    await createSample();
    const { elements } = await exportJson();
    const doubled: Backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      elements: [elements[0]!, elements[0]!],
    };
    const other = await otherWorkspace();

    const response = await post(other.bea.cookies, importUrl(other.ws.id), doubled);
    expect(importResultSchema.parse(response.json())).toMatchObject({
      elements: 1,
      skipped: [{ name: 'Go', reason: 'REPEATED' }],
    });
    // El espacio de origen no se tocó
    const list = await app.inject({ url: `${base(ws.id)}/elements`, cookies: ana.cookies });
    expect(elementListSchema.parse(list.json())).toHaveLength(1);
  });

  it('crea los tipos que faltan y reutiliza los valores de catálogo sin distinguir mayúsculas', async () => {
    const { bea, ws } = await otherWorkspace();
    const existing = await post(bea.cookies, `${base(ws.id)}/catalogs`, {
      kind: 'PLATFORM',
      name: 'udemy',
    });
    expect(existing.statusCode).toBe(201);

    const backup = backupSchema.parse({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      elements: [
        { name: 'Algoritmos', type: 'Diplomado', platform: 'Udemy', author: 'Knuth', nodes: [] },
      ],
    });
    const response = await post(bea.cookies, importUrl(ws.id), backup);
    expect(importResultSchema.parse(response.json())).toMatchObject({
      elements: 1,
      newTypes: ['Diplomado'],
      newCatalogItems: [{ kind: 'AUTHOR', name: 'Knuth' }],
    });

    const types = await app.inject({ url: `${base(ws.id)}/element-types`, cookies: bea.cookies });
    expect(elementTypeListSchema.parse(types.json()).map((type) => type.name)).toContain(
      'Diplomado',
    );
  });
});
