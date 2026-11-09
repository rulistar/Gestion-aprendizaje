import type { TrashItem, TrashKind } from '@aprendizaje/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditRestore, notDeleted } from '../../db/audit.js';
import { markChanged, markPurged } from '../sync/outbox.js';

/** Lo que está en la papelera; `deletedAt` no es null */
const inTrash = { deletedAt: { not: null } } as const;

/**
 * Nodo de la papelera que se ve solo: su elemento y su padre están activos. Lo que se quitó junto
 * con un padre no se lista aparte: se fue con él y vuelve con él.
 */
const nodeShown = { element: notDeleted, OR: [{ parentId: null }, { parent: notDeleted }] };

const deletedBySelect = { deletedAt: true, deletedBy: { select: { name: true } } } as const;

/** Un nodo y todo lo que contiene, a cualquier profundidad (son hasta 3 niveles) */
function descendantIds(
  nodes: readonly { id: string; parentId: string | null }[],
  rootId: string,
): string[] {
  const ids = [rootId];
  for (let index = 0; index < ids.length; index++) {
    for (const node of nodes) if (node.parentId === ids[index]) ids.push(node.id);
  }
  return ids;
}

/**
 * Lo que se fue con un nodo (ADR-0002): él y lo que contenía, con su misma fecha de baja. Lo que ya
 * estaba en la papelera antes tiene otra fecha y se queda ahí.
 */
async function nodeBundle(db: Db | Tx, elementId: string, nodeId: string, deletedAt: Date) {
  const nodes = await db.elementNode.findMany({
    where: { elementId },
    select: { id: true, parentId: true, kind: true, deletedAt: true },
  });
  const inside = new Set(descendantIds(nodes, nodeId));
  return nodes.filter(
    (node) => inside.has(node.id) && node.deletedAt?.getTime() === deletedAt.getTime(),
  );
}

/** La papelera del espacio, lo más reciente primero, solo con las clases que puede ver quien pide */
export async function listTrash(
  db: Db,
  workspaceId: string,
  kinds: readonly TrashKind[],
): Promise<TrashItem[]> {
  const [elements, nodes] = await Promise.all([
    kinds.includes('element')
      ? db.element.findMany({
          where: { workspaceId, ...inTrash },
          select: {
            id: true,
            name: true,
            ...deletedBySelect,
            _count: { select: { nodes: { where: { kind: 'ACTIVITY', ...notDeleted } } } },
          },
        })
      : [],
    kinds.includes('node')
      ? db.elementNode.findMany({
          where: { workspaceId, ...inTrash, ...nodeShown },
          select: {
            id: true,
            name: true,
            kind: true,
            elementId: true,
            element: { select: { name: true } },
            ...deletedBySelect,
          },
        })
      : [],
  ]);
  const nodeActivities = await Promise.all(
    nodes.map(async (node) => {
      const bundle = await nodeBundle(db, node.elementId, node.id, node.deletedAt!);
      return bundle.filter((n) => n.kind === 'ACTIVITY' && n.id !== node.id).length;
    }),
  );

  const items: TrashItem[] = [
    ...elements.map((element) => ({
      kind: 'element' as const,
      id: element.id,
      name: element.name,
      nodeKind: null,
      elementName: null,
      activityCount: element._count.nodes,
      deletedAt: element.deletedAt!.toISOString(),
      deletedByName: element.deletedBy?.name ?? null,
    })),
    ...nodes.map((node, index) => ({
      kind: 'node' as const,
      id: node.id,
      name: node.name,
      nodeKind: node.kind,
      elementName: node.element.name,
      activityCount: nodeActivities[index]!,
      deletedAt: node.deletedAt!.toISOString(),
      deletedByName: node.deletedBy?.name ?? null,
    })),
  ];
  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/** Saca algo de la papelera con lo que se fue con él; false si no está en la de ese espacio (→ 404) */
export async function restoreFromTrash(
  db: Db,
  actorId: string,
  workspaceId: string,
  kind: TrashKind,
  id: string,
): Promise<boolean> {
  const data = auditRestore(actorId);
  if (kind === 'element') {
    return db.$transaction(async (tx) => {
      const { count } = await tx.element.updateMany({
        where: { id, workspaceId, ...inTrash },
        data,
      });
      // Si estaba sincronizado, vuelve a crearse en Proyectos (ADR-0004 §1)
      if (count > 0) await markChanged(tx, id);
      return count > 0;
    });
  }
  return db.$transaction(async (tx) => {
    const node = await tx.elementNode.findFirst({
      where: { id, workspaceId, ...inTrash, ...nodeShown },
      select: { elementId: true, deletedAt: true },
    });
    if (!node) return false;
    const bundle = await nodeBundle(tx, node.elementId, id, node.deletedAt!);
    await tx.elementNode.updateMany({ where: { id: { in: bundle.map((n) => n.id) } }, data });
    await markChanged(tx, node.elementId);
    return true;
  });
}

/**
 * Borrado definitivo, solo de lo que ya está en la papelera (HU-07). Un elemento se lleva toda su
 * estructura (onDelete: Cascade); un nodo, todo lo que contiene, aunque se hubiera quitado antes.
 * false si no está en la papelera de ese espacio (→ 404).
 */
export async function purgeFromTrash(
  db: Db,
  workspaceId: string,
  kind: TrashKind,
  id: string,
): Promise<boolean> {
  if (kind === 'element') {
    return db.$transaction(async (tx) => {
      const { count } = await tx.element.deleteMany({ where: { id, workspaceId, ...inTrash } });
      if (count === 0) return false;
      // La marca dice al envío que lo quite también en Proyectos, si aún no lo había hecho
      await markPurged(tx, workspaceId, id);
      return true;
    });
  }
  return db.$transaction(async (tx) => {
    const node = await tx.elementNode.findFirst({
      where: { id, workspaceId, ...inTrash, ...nodeShown },
      select: { elementId: true },
    });
    if (!node) return false;
    const nodes = await tx.elementNode.findMany({
      where: { elementId: node.elementId },
      select: { id: true, parentId: true },
    });
    // Una sola sentencia: PostgreSQL revisa la relación padre-hijo al final, ya sin huérfanos
    await tx.elementNode.deleteMany({ where: { id: { in: descendantIds(nodes, id) } } });
    await markChanged(tx, node.elementId);
    return true;
  });
}
