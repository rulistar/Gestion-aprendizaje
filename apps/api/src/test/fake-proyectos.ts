import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/*
 * Receptor de prueba (INT-02, ADR-0004 §5): imita, en memoria, las rutas de la API /api/v1 de
 * Gestor de Proyectos que usa el envío, con sus reglas principales (token, largos, motivo al pausar
 * o cancelar, papelera). Se entrega como un `fetch`: el cliente real se prueba sin red.
 */

const status = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'CANCELLED', 'DONE']);
const taskStatus = z.enum(['PENDING', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED']);
const date = z.iso.date().nullable();

const projectInput = z.object({
  name: z.string().min(1).max(120),
  scope: z.enum(['WORK', 'PERSONAL']),
  status,
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  startDate: date,
  endDate: date,
});
const phaseInput = z.object({ name: z.string().min(1).max(120), parentId: z.uuid().nullable() });
const taskInput = z
  .object({
    title: z.string().min(1).max(200),
    status: taskStatus,
    estimatedMinutes: z.number().int().min(0).max(10_080).nullable(),
    startDate: date,
    endDate: date,
    statusReason: z.string().max(500).nullable(),
    phaseId: z.uuid().nullable(),
  })
  .refine((t) => !['PAUSED', 'CANCELLED'].includes(t.status) || t.statusReason !== null);

export interface FakeProject extends z.infer<typeof projectInput> {
  id: string;
  deleted: boolean;
}
export interface FakePhase {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  position: number;
  deleted: boolean;
}
export interface FakeTask extends z.infer<typeof taskInput> {
  id: string;
  projectId: string;
  deleted: boolean;
}

export const FAKE_ORIGIN = 'https://proyectos.prueba.test';
export const FAKE_TOKEN = 'token-de-prueba-del-receptor-0001';
export const FAKE_WORKSPACE_ID = '0190f5a4-0000-7000-8000-00000000ab01';

export function createFakeProyectos() {
  const projects = new Map<string, FakeProject>();
  const phases = new Map<string, FakePhase>();
  const tasks = new Map<string, FakeTask>();
  const calls: string[] = [];
  /** Lo que deben responder las próximas llamadas: un código HTTP o "sin red" */
  const failures: (number | 'network')[] = [];

  const json = (code: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status: code,
      headers: { 'content-type': 'application/json' },
    });

  function phasesOf(projectId: string) {
    return [...phases.values()].filter((p) => p.projectId === projectId && !p.deleted);
  }

  /** Una fase y sus subfases, con sus tareas, a la papelera */
  function deletePhaseTree(phase: FakePhase) {
    phase.deleted = true;
    for (const task of tasks.values()) if (task.phaseId === phase.id) task.deleted = true;
    for (const child of phasesOf(phase.projectId)) {
      if (child.parentId === phase.id) deletePhaseTree(child);
    }
  }

  function handle(method: string, path: string, body: unknown): Response {
    const parts = path.split('/').filter(Boolean);
    // /projects[/:id[/phases|tasks[/:id[/move]]]]
    if (parts[0] !== 'projects') return json(404);
    if (parts.length === 1) {
      if (method !== 'POST') return json(404);
      const input = projectInput.safeParse(body);
      if (!input.success) return json(400, { message: 'cuerpo inválido' });
      const project = { id: randomUUID(), ...input.data, deleted: false };
      projects.set(project.id, project);
      return json(201, { ...project, workspaceId: FAKE_WORKSPACE_ID });
    }
    const project = projects.get(parts[1]!);
    if (!project || project.deleted) return json(404);

    if (parts.length === 2) {
      if (method === 'DELETE') {
        project.deleted = true;
        for (const phase of phasesOf(project.id)) phase.deleted = true;
        for (const task of tasks.values()) if (task.projectId === project.id) task.deleted = true;
        return json(204);
      }
      if (method !== 'PUT') return json(404);
      const input = projectInput.safeParse(body);
      if (!input.success) return json(400, { message: 'cuerpo inválido' });
      Object.assign(project, input.data);
      return json(200, project);
    }

    if (parts[2] === 'phases') {
      if (parts.length === 3) {
        if (method === 'GET') return json(200, phasesOf(project.id));
        if (method !== 'POST') return json(404);
        const input = phaseInput.safeParse(body);
        if (!input.success) return json(400, { message: 'cuerpo inválido' });
        if (input.data.parentId && !phasesOf(project.id).some((p) => p.id === input.data.parentId))
          return json(400, { message: 'fase padre inválida' });
        const siblings = phasesOf(project.id).filter((p) => p.parentId === input.data.parentId);
        const phase = {
          id: randomUUID(),
          projectId: project.id,
          ...input.data,
          position: Math.max(-1, ...siblings.map((p) => p.position)) + 1,
          deleted: false,
        };
        phases.set(phase.id, phase);
        return json(201, phase);
      }
      const phase = phases.get(parts[3]!);
      if (!phase || phase.deleted || phase.projectId !== project.id) return json(404);
      if (parts[4] === 'move' && method === 'POST') {
        const up = (body as { direction?: string }).direction === 'up';
        const siblings = phasesOf(project.id)
          .filter((p) => p.parentId === phase.parentId)
          .sort((a, b) => a.position - b.position);
        const other = siblings[siblings.indexOf(phase) + (up ? -1 : 1)];
        if (other) [phase.position, other.position] = [other.position, phase.position];
        return json(204);
      }
      if (method === 'PATCH') {
        const input = phaseInput.pick({ name: true }).safeParse(body);
        if (!input.success) return json(400, { message: 'cuerpo inválido' });
        phase.name = input.data.name;
        return json(200, phase);
      }
      if (method === 'DELETE') {
        deletePhaseTree(phase);
        return json(204);
      }
      return json(404);
    }

    if (parts[2] === 'tasks') {
      const validTask = () => {
        const input = taskInput.safeParse(body);
        if (!input.success) return null;
        const { phaseId } = input.data;
        if (phaseId && !phasesOf(project.id).some((p) => p.id === phaseId)) return null;
        return input.data;
      };
      if (parts.length === 3) {
        if (method !== 'POST') return json(404);
        const input = validTask();
        if (!input) return json(400, { message: 'cuerpo inválido' });
        const task = { id: randomUUID(), projectId: project.id, ...input, deleted: false };
        tasks.set(task.id, task);
        return json(201, task);
      }
      const task = tasks.get(parts[3]!);
      if (!task || task.deleted || task.projectId !== project.id) return json(404);
      if (method === 'DELETE') {
        task.deleted = true;
        return json(204);
      }
      if (method !== 'PUT') return json(404);
      const input = validTask();
      if (!input) return json(400, { message: 'cuerpo inválido' });
      Object.assign(task, input);
      return json(200, task);
    }
    return json(404);
  }

  const fetch: typeof globalThis.fetch = (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = init.method ?? 'GET';
    const base = `/api/v1/workspaces/${FAKE_WORKSPACE_ID}`;
    const path = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : null;
    calls.push(`${method} ${path ?? url.pathname}`);

    const failure = failures.shift();
    if (failure === 'network') return Promise.reject(new TypeError('fetch failed'));
    if (failure !== undefined) return Promise.resolve(json(failure));

    const auth = new Headers(init.headers).get('authorization');
    if (url.origin !== FAKE_ORIGIN || auth !== `Bearer ${FAKE_TOKEN}`) {
      return Promise.resolve(json(401));
    }
    if (path === null) return Promise.resolve(json(404));
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    return Promise.resolve(handle(method, path, body));
  };

  return {
    fetch,
    projects,
    phases,
    tasks,
    calls,
    /** Las próximas llamadas responden esto, una por llamada */
    fail: (...next: (number | 'network')[]) => failures.push(...next),
    activeProjects: () => [...projects.values()].filter((p) => !p.deleted),
    activePhases: (projectId: string) =>
      phasesOf(projectId).sort(
        (a, b) => (a.parentId ?? '').localeCompare(b.parentId ?? '') || a.position - b.position,
      ),
    activeTasks: (projectId: string) =>
      [...tasks.values()].filter((t) => t.projectId === projectId && !t.deleted),
  };
}

export type FakeProyectos = ReturnType<typeof createFakeProyectos>;
