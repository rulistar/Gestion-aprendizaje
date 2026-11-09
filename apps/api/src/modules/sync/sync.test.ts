import {
  elementNodeSchema,
  elementSchema,
  elementTypeListSchema,
  SYNC_STATUS_REASON,
  syncStatusSchema,
} from '@aprendizaje/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import {
  createFakeProyectos,
  FAKE_ORIGIN,
  FAKE_TOKEN,
  FAKE_WORKSPACE_ID,
  type FakeProyectos,
} from '../../test/fake-proyectos.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { createWorkspace } from '../workspaces/workspaces.service.js';
import { DEBOUNCE_MS } from './outbox.js';
import { createProyectosClient } from './proyectos-client.js';
import { GIVE_UP_MS, processDue, retryDelayMs, startSyncWorker } from './sync.service.js';

const db = createTestDb();
const security = { rateLimitMax: 100000 };
const app = buildApp({ db, security, syncAvailable: true });
const appWithout = buildApp({ db, security });

afterAll(async () => {
  await Promise.all([app.close(), appWithout.close()]);
  await db.$disconnect();
});

let fake: FakeProyectos;
beforeEach(async () => {
  await resetDb(db);
  fake = createFakeProyectos();
});

const config = { url: FAKE_ORIGIN, token: FAKE_TOKEN, workspaceId: FAKE_WORKSPACE_ID };
const clientOf = (fetch = fake.fetch) => createProyectosClient({ config, fetch, minIntervalMs: 0 });

/** Un minuto después de ahora: ya pasó la espera de 30 s */
const later = (ms = DEBOUNCE_MS + 1000) => {
  const at = new Date(Date.now() + ms);
  return () => at;
};
/** Envía lo pendiente como si ya hubiera pasado la espera */
const flush = (ms?: number) => processDue(db, clientOf(), { now: later(ms) });

async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });
  const api = `/api/v1/workspaces/${ws.id}`;
  const types = await app.inject({ url: `${api}/element-types`, cookies: ana.cookies });
  const typeId = elementTypeListSchema.parse(types.json())[0]!.id;

  const response = await app.inject({
    method: 'POST',
    url: `${api}/elements`,
    cookies: ana.cookies,
    payload: { typeId, name: 'Curso de Go', estimatedStart: '2026-11-09' },
  });
  const elementId = elementSchema.parse(response.json()).id;
  const sync = `${api}/elements/${elementId}/sync`;

  async function node(payload: object) {
    const created = await app.inject({
      method: 'POST',
      url: `${api}/elements/${elementId}/nodes`,
      cookies: ana.cookies,
      payload,
    });
    expect(created.statusCode).toBe(201);
    return elementNodeSchema.parse(created.json()).id;
  }
  const nodeUrl = (nodeId: string) => `${api}/elements/${elementId}/nodes/${nodeId}`;

  return {
    ana,
    api,
    elementId,
    sync,
    chapter: (name: string, parentId: string | null = null) =>
      node({ kind: 'CHAPTER', parentId, content: { name } }),
    activity: (name: string, parentId: string | null = null, extra: object = {}) =>
      node({ kind: 'ACTIVITY', parentId, content: { name, ...extra } }),
    updateActivity: (nodeId: string, content: object) =>
      app.inject({
        method: 'PUT',
        url: nodeUrl(nodeId),
        cookies: ana.cookies,
        payload: { kind: 'ACTIVITY', content },
      }),
    renameChapter: (nodeId: string, name: string) =>
      app.inject({
        method: 'PUT',
        url: nodeUrl(nodeId),
        cookies: ana.cookies,
        payload: { kind: 'CHAPTER', content: { name } },
      }),
    moveUp: (nodeId: string) =>
      app.inject({
        method: 'POST',
        url: `${nodeUrl(nodeId)}/move`,
        cookies: ana.cookies,
        payload: { direction: 'up' },
      }),
    removeNode: (nodeId: string) =>
      app.inject({ method: 'DELETE', url: nodeUrl(nodeId), cookies: ana.cookies }),
    updateElement: (payload: object) =>
      app.inject({
        method: 'PUT',
        url: `${api}/elements/${elementId}`,
        cookies: ana.cookies,
        payload: { typeId, name: 'Curso de Go', ...payload },
      }),
    removeElement: () =>
      app.inject({ method: 'DELETE', url: `${api}/elements/${elementId}`, cookies: ana.cookies }),
    restore: (kind: string, id: string) =>
      app.inject({
        method: 'POST',
        url: `${api}/trash/${kind}/${id}/restore`,
        cookies: ana.cookies,
      }),
    purge: (kind: string, id: string) =>
      app.inject({ method: 'DELETE', url: `${api}/trash/${kind}/${id}`, cookies: ana.cookies }),
    enable: () => app.inject({ method: 'POST', url: sync, cookies: ana.cookies }),
    disable: () => app.inject({ method: 'DELETE', url: sync, cookies: ana.cookies }),
    retry: () => app.inject({ method: 'POST', url: `${sync}/retry`, cookies: ana.cookies }),
    status: async () => {
      const got = await app.inject({ url: sync, cookies: ana.cookies });
      expect(got.statusCode).toBe(200);
      return syncStatusSchema.parse(got.json());
    },
    withRole: async (email: string, role: 'MEMBER' | 'VIEWER') => {
      const user = await userWithSession(db, email);
      await addMember(db, ws.id, user.user.id, role);
      return user.cookies;
    },
  };
}

/** El único proyecto activo del receptor */
function remoteProject() {
  const projects = fake.activeProjects();
  expect(projects).toHaveLength(1);
  return projects[0]!;
}

describe('estado y permisos (INT-02)', () => {
  it('sin conexión configurada: no se ofrece y enviar da 409', async () => {
    const t = await setup();
    const got = await appWithout.inject({ url: t.sync, cookies: t.ana.cookies });
    expect(syncStatusSchema.parse(got.json())).toMatchObject({ available: false, state: 'off' });

    const send = await appWithout.inject({ method: 'POST', url: t.sync, cookies: t.ana.cookies });
    expect(send.statusCode).toBe(409);
    const retry = await appWithout.inject({
      method: 'POST',
      url: `${t.sync}/retry`,
      cookies: t.ana.cookies,
    });
    expect(retry.statusCode).toBe(409);
  });

  it('el Lector ve el estado pero no lo cambia; el Miembro sí', async () => {
    const t = await setup();
    const viewer = await t.withRole('lector@example.com', 'VIEWER');
    expect((await app.inject({ url: t.sync, cookies: viewer })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: t.sync, cookies: viewer })).statusCode).toBe(
      403,
    );

    const member = await t.withRole('miembro@example.com', 'MEMBER');
    const send = await app.inject({ method: 'POST', url: t.sync, cookies: member });
    expect(send.statusCode).toBe(200);
    expect(syncStatusSchema.parse(send.json()).state).toBe('pending');
  });

  it('un elemento de otro espacio, en la papelera o con ID inválido da 404', async () => {
    const t = await setup();
    const foreign = `${t.api}/elements/0190f5a4-0000-7000-8000-0000000000ff/sync`;
    expect((await app.inject({ url: foreign, cookies: t.ana.cookies })).statusCode).toBe(404);
    const invalid = `${t.api}/elements/no-es-uuid/sync`;
    expect((await app.inject({ url: invalid, cookies: t.ana.cookies })).statusCode).toBe(404);

    await t.removeElement();
    expect((await t.enable()).statusCode).toBe(404);
  });
});

describe('enviar a Gestor de Proyectos (INT-02)', () => {
  it('envía el elemento con su estructura: proyecto, fases, subfases y tareas', async () => {
    const t = await setup();
    const intro = await t.chapter('Introducción');
    const basics = await t.chapter('Lo básico', intro);
    await t.activity('Instalar Go', basics, { durationMinutes: 45, estimatedStart: '2026-11-10' });
    await t.activity('Repaso suelto', null, { status: 'PAUSED' });

    const enabled = await t.enable();
    expect(enabled.statusCode).toBe(200);
    expect(syncStatusSchema.parse(enabled.json())).toMatchObject({
      available: true,
      state: 'pending',
    });
    // El primer envío sale ya, sin esperar los 30 s
    expect(await processDue(db, clientOf())).toBe(1);

    const project = remoteProject();
    expect(project).toMatchObject({
      name: 'Curso de Go',
      scope: 'PERSONAL',
      status: 'NOT_STARTED',
      startDate: '2026-11-09',
    });
    const phases = fake.activePhases(project.id);
    const top = phases.find((p) => p.name === 'Introducción')!;
    const sub = phases.find((p) => p.name === 'Lo básico')!;
    expect(top.parentId).toBeNull();
    expect(sub.parentId).toBe(top.id);

    const tasks = fake.activeTasks(project.id);
    expect(tasks).toHaveLength(2);
    expect(tasks.find((task) => task.title === 'Instalar Go')).toMatchObject({
      phaseId: sub.id,
      estimatedMinutes: 45,
      startDate: '2026-11-10',
      status: 'PENDING',
    });
    // Proyectos exige motivo al pausar: se manda uno fijo
    expect(tasks.find((task) => task.title === 'Repaso suelto')).toMatchObject({
      phaseId: null,
      status: 'PAUSED',
      statusReason: SYNC_STATUS_REASON,
    });

    const status = await t.status();
    expect(status.state).toBe('synced');
    expect(status.lastSentAt).not.toBeNull();
  });

  it('los cambios esperan 30 s, se juntan en un envío y solo viaja lo que cambió', async () => {
    const t = await setup();
    const first = await t.activity('Ver el video');
    await t.activity('Hacer el ejercicio');
    await t.enable();
    await processDue(db, clientOf());
    fake.calls.length = 0;

    await t.updateActivity(first, { name: 'Ver el video', status: 'IN_PROGRESS' });
    await t.updateActivity(first, { name: 'Ver el video', status: 'DONE' });
    expect((await t.status()).state).toBe('pending');

    // Aún no pasan los 30 s
    expect(await processDue(db, clientOf())).toBe(0);
    expect(await flush()).toBe(1);

    const task = fake.activeTasks(remoteProject().id).find((x) => x.title === 'Ver el video')!;
    expect(task.status).toBe('DONE');
    expect(fake.calls).toEqual([`PUT /projects/${remoteProject().id}/tasks/${task.id}`]);
    expect((await t.status()).state).toBe('synced');
  });

  it('cambios en un elemento no sincronizado no dejan nada pendiente', async () => {
    const t = await setup();
    await t.activity('Ver el video');
    await t.updateElement({ status: 'IN_PROGRESS' });
    expect(await db.syncOutbox.count()).toBe(0);
    expect((await t.status()).state).toBe('off');
  });

  it('el estado, la prioridad y las fechas del elemento llegan al proyecto', async () => {
    const t = await setup();
    await t.enable();
    await processDue(db, clientOf());

    await t.updateElement({
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      estimatedStart: '2026-11-09',
      estimatedEnd: '2026-12-20',
    });
    await flush();
    expect(remoteProject()).toMatchObject({
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      endDate: '2026-12-20',
    });
  });

  it('renombrar y reordenar capítulos se refleja en las fases', async () => {
    const t = await setup();
    const a = await t.chapter('A');
    await t.chapter('B');
    const c = await t.chapter('C');
    await t.enable();
    await processDue(db, clientOf());

    await t.renameChapter(a, 'A bis');
    await t.moveUp(c);
    await t.moveUp(c);
    await flush();

    const names = fake.activePhases(remoteProject().id).map((p) => p.name);
    expect(names).toEqual(['C', 'A bis', 'B']);
  });

  it('quitar un capítulo lo manda a la papelera de Proyectos; restaurarlo lo crea de nuevo', async () => {
    const t = await setup();
    const chapter = await t.chapter('Capítulo 1');
    await t.activity('Leer', chapter);
    await t.enable();
    await processDue(db, clientOf());
    const project = remoteProject();

    await t.removeNode(chapter);
    await flush();
    expect(fake.activePhases(project.id)).toEqual([]);
    expect(fake.activeTasks(project.id)).toEqual([]);

    await t.restore('node', chapter);
    await flush();
    expect(fake.activePhases(project.id).map((p) => p.name)).toEqual(['Capítulo 1']);
    expect(fake.activeTasks(project.id).map((x) => x.title)).toEqual(['Leer']);
  });

  it('quitar el elemento manda el proyecto a la papelera; restaurarlo lo vuelve a crear', async () => {
    const t = await setup();
    await t.activity('Leer');
    await t.enable();
    await processDue(db, clientOf());
    const first = remoteProject();

    await t.removeElement();
    await flush();
    expect(fake.activeProjects()).toEqual([]);

    await t.restore('element', t.elementId);
    await flush();
    const again = remoteProject();
    expect(again.id).not.toBe(first.id);
    expect(fake.activeTasks(again.id).map((x) => x.title)).toEqual(['Leer']);
  });

  it('borrarlo para siempre antes de que se envíe la baja también lo quita en Proyectos', async () => {
    const t = await setup();
    await t.enable();
    await processDue(db, clientOf());

    await t.removeElement();
    expect((await t.purge('element', t.elementId)).statusCode).toBe(204);
    await flush();
    expect(fake.activeProjects()).toEqual([]);
    expect(await db.syncLink.count()).toBe(0);
    expect(await db.syncOutbox.count()).toBe(0);
  });

  it('si borraron el proyecto en Proyectos, el siguiente cambio lo crea de nuevo', async () => {
    const t = await setup();
    await t.activity('Leer');
    await t.enable();
    await processDue(db, clientOf());
    remoteProject().deleted = true;

    await t.updateElement({ status: 'IN_PROGRESS' });
    await flush();
    expect(remoteProject()).toMatchObject({ status: 'IN_PROGRESS' });
    expect(fake.activeTasks(remoteProject().id)).toHaveLength(1);
  });

  it('enviar de nuevo sin cambios no duplica ni llama a Proyectos', async () => {
    const t = await setup();
    await t.chapter('A');
    await t.activity('Leer');
    await t.enable();
    await processDue(db, clientOf());
    fake.calls.length = 0;

    await t.enable();
    await processDue(db, clientOf());
    expect(fake.calls).toEqual([]);
    expect(fake.activeProjects()).toHaveLength(1);
  });

  it('dejar de sincronizar no borra nada en Proyectos y los cambios ya no se envían', async () => {
    const t = await setup();
    await t.activity('Leer');
    await t.enable();
    await processDue(db, clientOf());

    const off = await t.disable();
    expect(syncStatusSchema.parse(off.json())).toMatchObject({ state: 'off', lastSentAt: null });
    await t.updateElement({ status: 'DONE' });
    expect(await flush()).toBe(0);
    expect(remoteProject().status).toBe('NOT_STARTED');
    expect(await db.syncLink.count()).toBe(0);
  });
});

describe('reintentos (INT-02)', () => {
  it('si Proyectos falla, reintenta a 1, 5 y 15 min, y luego cada hora', () => {
    expect([1, 2, 3, 4, 9].map(retryDelayMs)).toEqual([
      60_000, 300_000, 900_000, 3_600_000, 3_600_000,
    ]);
  });

  it('guarda el error, reprograma y, al responder, termina el envío', async () => {
    const t = await setup();
    await t.activity('Leer');
    await t.enable();
    fake.fail(503);

    const at = new Date();
    await processDue(db, clientOf(), { now: () => at });
    const pending = await db.syncOutbox.findFirstOrThrow();
    expect(pending).toMatchObject({ attempts: 1, lastError: 'Gestor de Proyectos respondió 503' });
    expect(pending.nextAttemptAt.getTime()).toBe(at.getTime() + 60_000);
    expect(await t.status()).toMatchObject({ state: 'pending', attempts: 1 });

    // Antes del minuto no lo intenta; después, sí
    expect(await processDue(db, clientOf(), { now: () => at })).toBe(0);
    expect(await processDue(db, clientOf(), { now: () => new Date(at.getTime() + 60_000) })).toBe(
      1,
    );
    expect(await t.status()).toMatchObject({ state: 'synced', attempts: 0, lastError: null });
  });

  it('sin red o con un token rechazado, también reintenta', async () => {
    const t = await setup();
    await t.enable();
    fake.fail('network');
    await processDue(db, clientOf());
    expect((await t.status()).lastError).toBe('No se pudo conectar con Gestor de Proyectos');

    const wrongToken = createProyectosClient({
      config: { ...config, token: 'otro-token-que-no-es-el-bueno' },
      fetch: fake.fetch,
      minIntervalMs: 0,
    });
    await processDue(db, wrongToken, { now: later(retryDelayMs(1)) });
    expect((await t.status()).lastError).toBe('Gestor de Proyectos respondió 401');
  });

  it('tras 24 h fallando queda fallido hasta que alguien lo reintente', async () => {
    const t = await setup();
    await t.enable();
    const start = new Date();
    fake.fail(500, 500);
    await processDue(db, clientOf(), { now: () => start });
    await processDue(db, clientOf(), { now: () => new Date(start.getTime() + GIVE_UP_MS) });
    expect((await t.status()).state).toBe('failed');

    // Fallido no se intenta solo, ni con cambios
    await t.updateElement({ status: 'IN_PROGRESS' });
    expect(await flush(GIVE_UP_MS * 2)).toBe(0);
    expect((await t.status()).state).toBe('failed');

    const retried = await t.retry();
    expect(syncStatusSchema.parse(retried.json())).toMatchObject({ state: 'pending', attempts: 0 });
    await processDue(db, clientOf());
    expect(remoteProject().status).toBe('IN_PROGRESS');
    expect((await t.status()).state).toBe('synced');
  });

  it('un cambio durante un envío queda pendiente para el siguiente', async () => {
    const t = await setup();
    await t.enable();
    // El receptor recibe la llamada y, mientras, alguien cambia el elemento
    const slowFetch: typeof fetch = async (input, init) => {
      await t.updateElement({ status: 'DONE' });
      return fake.fetch(input, init);
    };
    await processDue(db, clientOf(slowFetch));
    expect((await t.status()).state).toBe('pending');
    await flush();
    expect(remoteProject().status).toBe('DONE');
  });
});

describe('proceso de envío (INT-02)', () => {
  it('al arrancar revisa lo pendiente y se detiene limpio', async () => {
    const t = await setup();
    await t.enable();
    const stop = startSyncWorker({
      db,
      client: clientOf(),
      onError: (error) => {
        throw error;
      },
      intervalMs: 60_000,
    });
    await stop();
    expect(fake.activeProjects()).toHaveLength(1);
    expect((await t.status()).state).toBe('synced');
  });
});
