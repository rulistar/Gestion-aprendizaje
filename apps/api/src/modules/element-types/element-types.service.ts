import {
  DEFAULT_ELEMENT_TYPES,
  fieldLabelsSchema,
  type CreateElementTypeInput,
  type ElementType,
  type UpdateElementTypeInput,
} from '@aprendizaje/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditCreate, auditUpdate } from '../../db/audit.js';
import { isUniqueViolation } from '../../db/errors.js';

/** Ya hay otro tipo activo con ese nombre (→ 409) */
export class DuplicateElementTypeError extends Error {}
/** Archivarlo dejaría al espacio sin tipos para elegir en la ficha (→ 409) */
export class LastElementTypeError extends Error {}

const typeSelect = {
  id: true,
  name: true,
  labels: true,
  position: true,
  archivedAt: true,
} as const;

function toElementType({
  archivedAt,
  labels,
  ...row
}: {
  id: string;
  name: string;
  labels: unknown;
  position: number;
  archivedAt: Date | null;
}): ElementType {
  return { ...row, labels: fieldLabelsSchema.parse(labels), archived: archivedAt !== null };
}

/** Tipos iniciales de un espacio nuevo; va en la misma transacción que crea el espacio */
export async function seedElementTypes(tx: Tx, workspaceId: string, actorId: string | null) {
  await tx.elementType.createMany({
    data: DEFAULT_ELEMENT_TYPES.map(({ name, labels }, position) => ({
      workspaceId,
      name,
      labels,
      position,
      ...auditCreate(actorId),
    })),
  });
}

/** Todos los tipos del espacio, archivados incluidos, en su orden */
export async function listElementTypes(db: Db, workspaceId: string): Promise<ElementType[]> {
  const rows = await db.elementType.findMany({
    where: { workspaceId },
    select: typeSelect,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toElementType);
}

/** Sin distinguir mayúsculas, como los catálogos */
async function nameTaken(db: Db | Tx, workspaceId: string, name: string, exceptId?: string) {
  const found = await db.elementType.findFirst({
    where: {
      workspaceId,
      archivedAt: null,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  });
  return found !== null;
}

export async function createElementType(
  db: Db,
  actorId: string,
  workspaceId: string,
  { name }: CreateElementTypeInput,
): Promise<ElementType> {
  if (await nameTaken(db, workspaceId, name)) throw new DuplicateElementTypeError();
  const last = await db.elementType.aggregate({
    where: { workspaceId },
    _max: { position: true },
  });
  try {
    const row = await db.elementType.create({
      data: {
        workspaceId,
        name,
        labels: {},
        position: (last._max.position ?? -1) + 1,
        ...auditCreate(actorId),
      },
      select: typeSelect,
    });
    return toElementType(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateElementTypeError();
    throw error;
  }
}

/** Renombra, cambia etiquetas, archiva o reactiva. null si no es de ese espacio (→ 404) */
export async function updateElementType(
  db: Db,
  actorId: string,
  workspaceId: string,
  typeId: string,
  { name, labels, archived }: UpdateElementTypeInput,
): Promise<ElementType | null> {
  try {
    return await db.$transaction(async (tx) => {
      const type = await tx.elementType.findFirst({
        where: { id: typeId, workspaceId },
        select: { name: true, archivedAt: true },
      });
      if (!type) return null;

      const willBeActive = archived === undefined ? type.archivedAt === null : !archived;
      if (willBeActive && (await nameTaken(tx, workspaceId, name ?? type.name, typeId))) {
        throw new DuplicateElementTypeError();
      }
      if (archived === true && type.archivedAt === null) {
        const others = await tx.elementType.count({
          where: { workspaceId, archivedAt: null, id: { not: typeId } },
        });
        if (others === 0) throw new LastElementTypeError();
      }

      const row = await tx.elementType.update({
        where: { id: typeId },
        data: {
          ...(name !== undefined && { name }),
          ...(labels !== undefined && { labels }),
          ...(archived !== undefined && {
            // Archivar dos veces conserva la fecha original
            archivedAt: archived ? (type.archivedAt ?? new Date()) : null,
          }),
          ...auditUpdate(actorId),
        },
        select: typeSelect,
      });
      return toElementType(row);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateElementTypeError();
    throw error;
  }
}
