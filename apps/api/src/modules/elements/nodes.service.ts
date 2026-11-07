import {
  allowedChildKinds,
  applyStatusDates,
  type ActivityContent,
  type ActivityStatus,
  type CreateNodeInput,
  type ElementNode,
  type ElementStatus,
  type MoveNodeInput,
  type NodeKind,
  type UpdateNodeInput,
} from '@aprendizaje/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditCreate, auditSoftDelete, auditUpdate, notDeleted } from '../../db/audit.js';
import { fromIsoDate, toIsoDate } from '../../db/dates.js';
import {
  assertReferences,
  fichaData,
  InvalidActualDatesError,
  InvalidReferenceError,
  toElement,
} from './elements.service.js';

/** El nodo no cabe en ese lugar del árbol, o se pidió cambiar su clase (→ 400) */
export class InvalidStructureError extends Error {}

const nodeSelect = {
  id: true,
  elementId: true,
  parentId: true,
  kind: true,
  level: true,
  position: true,
  name: true,
  typeId: true,
  platformId: true,
  sponsorId: true,
  categoryId: true,
  levelId: true,
  durationWeeks: true,
  daysPerWeek: true,
  hoursPerDay: true,
  manualTotalHours: true,
  estimatedStart: true,
  estimatedEnd: true,
  actualStart: true,
  actualEnd: true,
  status: true,
  notes: true,
  activityTypeId: true,
  durationMinutes: true,
  activityStatus: true,
  updatedAt: true,
} as const;

type Decimal = { toNumber(): number } | null;

interface NodeRow {
  id: string;
  elementId: string;
  parentId: string | null;
  kind: NodeKind;
  level: number;
  position: number;
  name: string;
  typeId: string | null;
  platformId: string | null;
  sponsorId: string | null;
  categoryId: string | null;
  levelId: string | null;
  durationWeeks: Decimal;
  daysPerWeek: number | null;
  hoursPerDay: Decimal;
  manualTotalHours: Decimal;
  estimatedStart: Date | null;
  estimatedEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  status: ElementStatus | null;
  notes: string | null;
  activityTypeId: string | null;
  durationMinutes: number | null;
  activityStatus: ActivityStatus | null;
  updatedAt: Date;
}

function toNode(row: NodeRow): ElementNode {
  const base = {
    id: row.id,
    elementId: row.elementId,
    parentId: row.parentId,
    level: row.level,
    position: row.position,
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.kind === 'CHAPTER') return { ...base, kind: 'CHAPTER' };
  if (row.kind === 'COURSE') {
    return {
      ...base,
      kind: 'COURSE',
      // Las columnas de la ficha siempre están llenas en un Curso: solo se escriben con su esquema
      ficha: toElement({
        ...row,
        typeId: row.typeId!,
        daysPerWeek: row.daysPerWeek!,
        status: row.status!,
      }),
    };
  }
  return {
    ...base,
    kind: 'ACTIVITY',
    activity: {
      name: row.name,
      activityTypeId: row.activityTypeId,
      durationMinutes: row.durationMinutes,
      status: row.activityStatus!,
      estimatedStart: toIsoDate(row.estimatedStart),
      estimatedEnd: toIsoDate(row.estimatedEnd),
      actualStart: toIsoDate(row.actualStart),
      actualEnd: toIsoDate(row.actualEnd),
    },
  };
}

/** El tipo de actividad debe ser del espacio y del catálogo correcto; lo archivado solo se conserva */
async function assertActivityType(
  tx: Tx,
  workspaceId: string,
  activityTypeId: string | null,
  previousId: string | null,
) {
  if (activityTypeId === null) return;
  const item = await tx.catalogItem.findFirst({
    where: { id: activityTypeId, workspaceId, kind: 'ACTIVITY_TYPE' },
    select: { archivedAt: true },
  });
  if (!item || (item.archivedAt !== null && previousId !== activityTypeId)) {
    throw new InvalidReferenceError('El tipo de actividad no está disponible');
  }
}

/** Las columnas de una actividad, con las fechas reales ya resueltas */
function activityData(activity: ActivityContent, previous: ActivityStatus | null, today: string) {
  const { actualStart, actualEnd } = applyStatusDates(previous, activity, today);
  if (actualStart && actualEnd && actualEnd < actualStart) {
    throw new InvalidActualDatesError();
  }
  return {
    name: activity.name,
    activityTypeId: activity.activityTypeId,
    durationMinutes: activity.durationMinutes,
    activityStatus: activity.status,
    estimatedStart: fromIsoDate(activity.estimatedStart),
    estimatedEnd: fromIsoDate(activity.estimatedEnd),
    actualStart: fromIsoDate(actualStart),
    actualEnd: fromIsoDate(actualEnd),
  };
}

function elementExists(db: Db | Tx, workspaceId: string, elementId: string) {
  return db.element.findFirst({
    where: { id: elementId, workspaceId, ...notDeleted },
    select: { id: true },
  });
}

/** Los nodos del elemento, sin los de la papelera. null si el elemento no está (→ 404) */
export async function listNodes(
  db: Db,
  workspaceId: string,
  elementId: string,
): Promise<ElementNode[] | null> {
  if (!(await elementExists(db, workspaceId, elementId))) return null;
  const rows = await db.elementNode.findMany({
    where: { elementId, workspaceId, ...notDeleted },
    select: nodeSelect,
    orderBy: [{ level: 'asc' }, { position: 'asc' }],
  });
  return rows.map(toNode);
}

/** Crea el nodo al final de sus hermanos. null si el elemento no está (→ 404) */
export async function createNode(
  db: Db,
  actorId: string,
  workspaceId: string,
  elementId: string,
  input: CreateNodeInput,
  today: string,
): Promise<ElementNode | null> {
  return db.$transaction(async (tx) => {
    if (!(await elementExists(tx, workspaceId, elementId))) return null;

    const parent = input.parentId
      ? await tx.elementNode.findFirst({
          where: { id: input.parentId, elementId, workspaceId, ...notDeleted },
          select: { kind: true, level: true },
        })
      : null;
    if (input.parentId && !parent) throw new InvalidStructureError('El nodo padre no existe');
    if (!allowedChildKinds(parent).includes(input.kind)) {
      throw new InvalidStructureError('Ese tipo de nodo no cabe en este lugar del árbol');
    }

    let content;
    if (input.kind === 'CHAPTER') {
      content = { name: input.content.name };
    } else if (input.kind === 'COURSE') {
      await assertReferences(tx, workspaceId, input.content, null);
      content = fichaData(input.content, null, today);
    } else {
      await assertActivityType(tx, workspaceId, input.content.activityTypeId, null);
      content = activityData(input.content, null, today);
    }

    const last = await tx.elementNode.aggregate({
      where: { elementId, parentId: input.parentId, ...notDeleted },
      _max: { position: true },
    });
    const row = await tx.elementNode.create({
      data: {
        workspaceId,
        elementId,
        parentId: input.parentId,
        kind: input.kind,
        level: (parent?.level ?? 0) + 1,
        position: (last._max.position ?? -1) + 1,
        ...content,
        ...auditCreate(actorId),
      },
      select: nodeSelect,
    });
    return toNode(row);
  });
}

function findNode(tx: Tx, workspaceId: string, elementId: string, nodeId: string) {
  return tx.elementNode.findFirst({
    where: { id: nodeId, elementId, workspaceId, ...notDeleted, element: notDeleted },
    select: nodeSelect,
  });
}

/** Reemplaza el contenido; la clase no cambia. null si el nodo no está (→ 404) */
export async function updateNode(
  db: Db,
  actorId: string,
  workspaceId: string,
  elementId: string,
  nodeId: string,
  input: UpdateNodeInput,
  today: string,
): Promise<ElementNode | null> {
  return db.$transaction(async (tx) => {
    const previous = await findNode(tx, workspaceId, elementId, nodeId);
    if (!previous) return null;
    if (previous.kind !== input.kind) {
      throw new InvalidStructureError('Un nodo no puede cambiar de clase');
    }

    let content;
    if (input.kind === 'CHAPTER') {
      content = { name: input.content.name };
    } else if (input.kind === 'COURSE') {
      await assertReferences(
        tx,
        workspaceId,
        input.content,
        // Solo se compara: un Curso siempre tiene tipo
        { ...previous, typeId: previous.typeId! },
      );
      content = fichaData(input.content, previous.status, today);
    } else {
      await assertActivityType(
        tx,
        workspaceId,
        input.content.activityTypeId,
        previous.activityTypeId,
      );
      content = activityData(input.content, previous.activityStatus, today);
    }

    const row = await tx.elementNode.update({
      where: { id: nodeId },
      data: { ...content, ...auditUpdate(actorId) },
      select: nodeSelect,
    });
    return toNode(row);
  });
}

/**
 * Intercambia el lugar con el hermano de al lado. En un extremo no hace nada: no es un error, y el
 * resultado es el que se pidió. false si el nodo no está (→ 404).
 */
export async function moveNode(
  db: Db,
  actorId: string,
  workspaceId: string,
  elementId: string,
  nodeId: string,
  { direction }: MoveNodeInput,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const node = await findNode(tx, workspaceId, elementId, nodeId);
    if (!node) return false;

    const sibling = await tx.elementNode.findFirst({
      where: {
        elementId,
        parentId: node.parentId,
        ...notDeleted,
        position: direction === 'up' ? { lt: node.position } : { gt: node.position },
      },
      select: { id: true, position: true },
      orderBy: { position: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!sibling) return true;

    await tx.elementNode.update({
      where: { id: node.id },
      data: { position: sibling.position, ...auditUpdate(actorId) },
    });
    await tx.elementNode.update({
      where: { id: sibling.id },
      data: { position: node.position, ...auditUpdate(actorId) },
    });
    return true;
  });
}

/**
 * Manda el nodo a la papelera con todo lo que contiene, con la misma fecha: así HU-07 podrá
 * restaurarlos juntos. false si el nodo no está (→ 404).
 */
export async function deleteNode(
  db: Db,
  actorId: string,
  workspaceId: string,
  elementId: string,
  nodeId: string,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const node = await findNode(tx, workspaceId, elementId, nodeId);
    if (!node) return false;

    const ids = [node.id];
    // Hasta 3 niveles: bastan dos pasadas para llegar a los nietos
    let parents = [node.id];
    for (let depth = 0; depth < 2 && parents.length > 0; depth++) {
      const children = await tx.elementNode.findMany({
        where: { parentId: { in: parents }, ...notDeleted },
        select: { id: true },
      });
      parents = children.map((child) => child.id);
      ids.push(...parents);
    }

    await tx.elementNode.updateMany({
      where: { id: { in: ids } },
      data: auditSoftDelete(actorId),
    });
    return true;
  });
}
