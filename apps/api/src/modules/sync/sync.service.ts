import { createHash } from 'node:crypto';
import { phaseMoves, phaseName, projectBody, taskBody, type SyncStatus } from '@aprendizaje/shared';
import type { SyncTarget } from '../../generated/prisma/client.js';
import type { Db } from '../../db/client.js';
import { notDeleted } from '../../db/audit.js';
import { toIsoDate } from '../../db/dates.js';
import { isNotFound, ProyectosError, type ProyectosClient } from './proyectos-client.js';

/** Tras 24 h fallando, el envío se marca fallido y espera a que lo reintenten (ADR-0004 §2) */
export const GIVE_UP_MS = 24 * 60 * 60_000;

/** Reintentos: a 1, 5 y 15 min, y después cada hora */
export function retryDelayMs(attempts: number): number {
  const minutes = [1, 5, 15][attempts - 1] ?? 60;
  return minutes * 60_000;
}

/** Huella de lo enviado: si no cambió, no se vuelve a enviar */
function hashOf(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

/** Borrar en Proyectos lo que ya no está: si allá ya no existe, ya quedó como se quería */
async function removeRemote(request: Promise<unknown>) {
  try {
    await request;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

interface LinkRow {
  id: string;
  nodeId: string | null;
  target: SyncTarget;
  remoteId: string;
  sentHash: string;
}

/**
 * Deja un elemento en Proyectos igual que está aquí AHORA (ADR-0004 §2): se envía el estado, no
 * los eventos. Repetirlo no duplica nada, y lo que ya se había enviado igual no se vuelve a enviar.
 * Si algo falla a medias, lo ya enviado queda vinculado y el reintento sigue desde ahí.
 */
export async function syncElement(
  db: Db,
  client: ProyectosClient,
  elementId: string,
  now: () => Date = () => new Date(),
): Promise<void> {
  const element = await db.element.findUnique({
    where: { id: elementId },
    select: {
      workspaceId: true,
      name: true,
      status: true,
      priority: true,
      estimatedStart: true,
      estimatedEnd: true,
      deletedAt: true,
      syncEnabled: true,
    },
  });
  const links: LinkRow[] = await db.syncLink.findMany({
    where: { elementId },
    select: { id: true, nodeId: true, target: true, remoteId: true, sentHash: true },
  });
  let projectLink = links.find((link) => link.nodeId === null);

  // Dejó de sincronizarse: se olvidan los vínculos y no se toca nada en Proyectos
  if (element && !element.syncEnabled) {
    await db.syncLink.deleteMany({ where: { elementId } });
    return;
  }
  // En la papelera o borrado para siempre: a la papelera de Proyectos, con todo lo que contiene
  if (!element || element.deletedAt) {
    if (projectLink) await removeRemote(client.deleteProject(projectLink.remoteId));
    await db.syncLink.deleteMany({ where: { elementId } });
    return;
  }
  const { workspaceId } = element;

  async function saveLink(
    link: LinkRow | undefined,
    data: { nodeId: string | null; target: SyncTarget; remoteId: string; sentHash: string },
  ) {
    const values = { ...data, sentAt: now() };
    if (link) {
      await db.syncLink.update({ where: { id: link.id }, data: values });
      return { ...link, ...data };
    }
    const created = await db.syncLink.create({
      data: { workspaceId, elementId, ...values },
      select: { id: true },
    });
    return { id: created.id, ...data };
  }

  // 1. El proyecto
  const project = projectBody({
    name: element.name,
    status: element.status,
    priority: element.priority,
    estimatedStart: toIsoDate(element.estimatedStart),
    estimatedEnd: toIsoDate(element.estimatedEnd),
  });
  const projectHash = hashOf(project);
  if (projectLink && projectLink.sentHash !== projectHash) {
    try {
      await client.updateProject(projectLink.remoteId, project);
    } catch (error) {
      if (!isNotFound(error)) throw error;
      // Lo borraron en Proyectos, y con él sus fases y tareas: se crea todo de nuevo
      await db.syncLink.deleteMany({ where: { elementId } });
      links.length = 0;
      projectLink = undefined;
    }
  }
  const projectId = projectLink ? projectLink.remoteId : (await client.createProject(project)).id;
  await saveLink(projectLink, {
    nodeId: null,
    target: 'PROJECT',
    remoteId: projectId,
    sentHash: projectHash,
  });

  const nodes = await db.elementNode.findMany({
    where: { elementId, ...notDeleted },
    select: {
      id: true,
      parentId: true,
      kind: true,
      position: true,
      name: true,
      durationMinutes: true,
      activityStatus: true,
      estimatedStart: true,
      estimatedEnd: true,
    },
    orderBy: [{ level: 'asc' }, { position: 'asc' }],
  });
  const active = new Set(nodes.map((node) => node.id));
  const linkOf = new Map(
    links.filter((link) => link.nodeId !== null).map((link) => [link.nodeId!, link]),
  );

  // 2. Lo que se quitó aquí, a la papelera de Proyectos (si se restaura, se crea otra vez)
  for (const [nodeId, link] of linkOf) {
    if (active.has(nodeId)) continue;
    await removeRemote(
      link.target === 'TASK'
        ? client.deleteTask(projectId, link.remoteId)
        : client.deletePhase(projectId, link.remoteId),
    );
    await db.syncLink.delete({ where: { id: link.id } });
    linkOf.delete(nodeId);
  }

  // 3. Capítulos y cursos como fases, de arriba hacia abajo: el padre siempre existe ya
  const remoteOf = new Map<string, string>();
  const createdPhases = new Set<string>();
  let reorder = false;
  for (const node of nodes) {
    if (node.kind === 'ACTIVITY') continue;
    const parentId = node.parentId ? remoteOf.get(node.parentId)! : null;
    const name = phaseName(node);
    const hash = hashOf({ name, parentId, position: node.position });
    let link = linkOf.get(node.id);
    // Si su padre se creó de nuevo, la fase vieja se quedó con él en la papelera de Proyectos
    if (link && node.parentId && createdPhases.has(node.parentId)) link = await dropLink(link);
    if (link && link.sentHash !== hash) {
      try {
        await client.renamePhase(projectId, link.remoteId, name);
        reorder = true;
      } catch (error) {
        if (!isNotFound(error)) throw error;
        link = await dropLink(link);
      }
    }
    if (!link) {
      const created = await client.createPhase(projectId, { name, parentId });
      createdPhases.add(node.id);
      reorder = true;
      link = await saveLink(undefined, {
        nodeId: node.id,
        target: 'PHASE',
        remoteId: created.id,
        sentHash: hash,
      });
    } else if (link.sentHash !== hash) {
      link = await saveLink(link, {
        nodeId: node.id,
        target: 'PHASE',
        remoteId: link.remoteId,
        sentHash: hash,
      });
    }
    remoteOf.set(node.id, link.remoteId);
  }

  // 4. El orden de las fases: Proyectos solo sube o baja de una en una
  if (reorder) {
    const remote = await client.listPhases(projectId);
    const parents = new Set(nodes.filter((n) => n.kind !== 'ACTIVITY').map((n) => n.parentId));
    for (const parent of parents) {
      const remoteParent = parent ? remoteOf.get(parent)! : null;
      const current = remote
        .filter((phase) => phase.parentId === remoteParent)
        .sort((a, b) => a.position - b.position)
        .map((phase) => phase.id);
      const wanted = nodes
        .filter((n) => n.kind !== 'ACTIVITY' && n.parentId === parent)
        .map((n) => remoteOf.get(n.id)!);
      for (const phaseId of phaseMoves(current, wanted)) {
        await client.movePhaseUp(projectId, phaseId);
      }
    }
  }

  // 5. Actividades como tareas, en la fase de su padre
  for (const node of nodes) {
    if (node.kind !== 'ACTIVITY') continue;
    const body = taskBody(
      {
        name: node.name,
        status: node.activityStatus!,
        durationMinutes: node.durationMinutes,
        estimatedStart: toIsoDate(node.estimatedStart),
        estimatedEnd: toIsoDate(node.estimatedEnd),
      },
      node.parentId ? remoteOf.get(node.parentId)! : null,
    );
    const hash = hashOf(body);
    let link = linkOf.get(node.id);
    if (link && link.sentHash === hash) continue;
    if (link) {
      try {
        await client.updateTask(projectId, link.remoteId, body);
      } catch (error) {
        if (!isNotFound(error)) throw error;
        link = await dropLink(link);
      }
    }
    const remoteId = link ? link.remoteId : (await client.createTask(projectId, body)).id;
    await saveLink(link, { nodeId: node.id, target: 'TASK', remoteId, sentHash: hash });
  }

  async function dropLink(link: LinkRow): Promise<undefined> {
    await db.syncLink.delete({ where: { id: link.id } });
    return undefined;
  }
}

export interface ProcessOptions {
  now?: () => Date;
  /** Elementos por vuelta */
  limit?: number;
  onError?: (error: unknown) => void;
}

/**
 * Envía lo que ya toca de la bandeja de salida. Devuelve cuántos elementos intentó. Lo que falla
 * se reprograma (1, 5, 15 min y cada hora) y, tras 24 h fallando, queda como fallido.
 */
export async function processDue(
  db: Db,
  client: ProyectosClient,
  { now = () => new Date(), limit = 5, onError }: ProcessOptions = {},
): Promise<number> {
  const due = await db.syncOutbox.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: now() } },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
  });
  for (const item of due) {
    try {
      await syncElement(db, client, item.elementId, now);
      // Si cambió durante el envío, el renglón se queda para el siguiente (ya con su espera)
      const { count } = await db.syncOutbox.deleteMany({
        where: { id: item.id, changedAt: item.changedAt },
      });
      if (count === 0) {
        await db.syncOutbox.updateMany({
          where: { id: item.id },
          data: { attempts: 0, failingSince: null, lastError: null },
        });
      }
    } catch (error) {
      // Un error nuestro (no de Proyectos) no se muestra tal cual en la ficha: se registra aparte
      if (!(error instanceof ProyectosError)) onError?.(error);
      const failedAt = now();
      const attempts = item.attempts + 1;
      const failingSince = item.failingSince ?? failedAt;
      const givenUp = failedAt.getTime() - failingSince.getTime() >= GIVE_UP_MS;
      await db.syncOutbox.updateMany({
        where: { id: item.id },
        data: {
          attempts,
          failingSince,
          lastError:
            error instanceof ProyectosError ? error.message : 'Error interno al enviar el elemento',
          status: givenUp ? 'FAILED' : 'PENDING',
          nextAttemptAt: new Date(failedAt.getTime() + retryDelayMs(attempts)),
        },
      });
    }
  }
  return due.length;
}

export interface SyncWorkerOptions {
  db: Db;
  client: ProyectosClient;
  onError: (error: unknown) => void;
  intervalMs?: number;
}

/**
 * Proceso de envío dentro de la misma app (el plan gratuito no tiene procesos aparte). Revisa lo
 * pendiente al arrancar y después cada 10 s. Devuelve la función que lo detiene.
 */
export function startSyncWorker({ db, client, onError, intervalMs = 10_000 }: SyncWorkerOptions) {
  let current: Promise<void> | null = null;
  const tick = () => {
    current ??= (async () => {
      try {
        // Mientras haya algo que ya toca, sigue (de 5 en 5)
        while ((await processDue(db, client, { onError })) > 0);
      } catch (error) {
        onError(error);
      } finally {
        current = null;
      }
    })();
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await current;
  };
}

/** Elemento del espacio, fuera de la papelera; null si no (→ 404) */
function findElement(db: Db, workspaceId: string, elementId: string) {
  return db.element.findFirst({
    where: { id: elementId, workspaceId, ...notDeleted },
    select: { id: true, syncEnabled: true },
  });
}

/** Cómo va un elemento con Proyectos, para la ficha. null si el elemento no está (→ 404) */
export async function getSyncStatus(
  db: Db,
  available: boolean,
  workspaceId: string,
  elementId: string,
): Promise<SyncStatus | null> {
  const element = await findElement(db, workspaceId, elementId);
  if (!element) return null;
  const [pending, project] = await Promise.all([
    db.syncOutbox.findUnique({ where: { elementId } }),
    db.syncLink.findFirst({ where: { elementId, nodeId: null }, select: { sentAt: true } }),
  ]);
  return {
    available,
    state: !element.syncEnabled
      ? 'off'
      : pending?.status === 'FAILED'
        ? 'failed'
        : pending
          ? 'pending'
          : 'synced',
    lastSentAt: element.syncEnabled ? (project?.sentAt.toISOString() ?? null) : null,
    attempts: pending?.attempts ?? 0,
    lastError: pending?.lastError ?? null,
  };
}

/**
 * Enviar a Gestor de Proyectos: desde ahora cada cambio se envía solo. El primer envío sale ya,
 * sin la espera de 30 s. false si el elemento no está (→ 404).
 */
export async function enableSync(db: Db, actorId: string, workspaceId: string, elementId: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.element.updateMany({
      where: { id: elementId, workspaceId, ...notDeleted },
      data: { syncEnabled: true, updatedById: actorId },
    });
    if (count === 0) return false;
    const now = new Date();
    await tx.syncOutbox.upsert({
      where: { elementId },
      create: { workspaceId, elementId, changedAt: now, nextAttemptAt: now },
      update: {
        status: 'PENDING',
        changedAt: now,
        nextAttemptAt: now,
        attempts: 0,
        failingSince: null,
        lastError: null,
      },
    });
    return true;
  });
}

/**
 * Dejar de sincronizar: se olvidan los vínculos y lo pendiente. En Proyectos no se borra nada
 * (ADR-0004 §1); si se vuelve a enviar, se crea un proyecto nuevo. false si no está (→ 404).
 */
export async function disableSync(db: Db, actorId: string, workspaceId: string, elementId: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.element.updateMany({
      where: { id: elementId, workspaceId, ...notDeleted },
      data: { syncEnabled: false, updatedById: actorId },
    });
    if (count === 0) return false;
    await tx.syncLink.deleteMany({ where: { elementId } });
    await tx.syncOutbox.deleteMany({ where: { elementId } });
    return true;
  });
}

/** Reintentar un envío fallido ya, desde cero. false si el elemento no está (→ 404) */
export async function retrySync(db: Db, workspaceId: string, elementId: string) {
  if (!(await findElement(db, workspaceId, elementId))) return false;
  await db.syncOutbox.updateMany({
    where: { elementId, status: 'FAILED' },
    data: {
      status: 'PENDING',
      nextAttemptAt: new Date(),
      attempts: 0,
      failingSince: null,
      lastError: null,
    },
  });
  return true;
}
