import {
  CATALOG_KINDS,
  DEFAULT_CATALOG_ITEMS,
  type CatalogItem,
  type CatalogKind,
  type CreateCatalogItemInput,
  type UpdateCatalogItemInput,
} from '@aprendizaje/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditCreate, auditUpdate } from '../../db/audit.js';
import { isUniqueViolation } from '../../db/errors.js';

/** Ya hay otro valor activo con ese nombre en el catálogo (→ 409) */
export class DuplicateCatalogItemError extends Error {}

const itemSelect = {
  id: true,
  kind: true,
  name: true,
  position: true,
  archivedAt: true,
} as const;

function toCatalogItem({
  archivedAt,
  ...row
}: {
  id: string;
  kind: CatalogKind;
  name: string;
  position: number;
  archivedAt: Date | null;
}): CatalogItem {
  return { ...row, archived: archivedAt !== null };
}

/** Valores iniciales de un espacio nuevo; va en la misma transacción que crea el espacio */
export async function seedCatalogs(tx: Tx, workspaceId: string, actorId: string | null) {
  await tx.catalogItem.createMany({
    data: CATALOG_KINDS.flatMap((kind) =>
      (DEFAULT_CATALOG_ITEMS[kind] ?? []).map((name, position) => ({
        workspaceId,
        kind,
        name,
        position,
        ...auditCreate(actorId),
      })),
    ),
  });
}

/** Todos los catálogos del espacio, archivados incluidos, en su orden */
export async function listCatalogItems(db: Db, workspaceId: string): Promise<CatalogItem[]> {
  const rows = await db.catalogItem.findMany({
    where: { workspaceId },
    select: itemSelect,
    orderBy: [{ kind: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toCatalogItem);
}

/** Sin distinguir mayúsculas: "Coursera" y "coursera" serían el mismo valor (ADR-0002) */
async function nameTaken(
  db: Db | Tx,
  workspaceId: string,
  kind: CatalogKind,
  name: string,
  exceptId?: string,
) {
  const found = await db.catalogItem.findFirst({
    where: {
      workspaceId,
      kind,
      archivedAt: null,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  });
  return found !== null;
}

export async function createCatalogItem(
  db: Db,
  actorId: string,
  workspaceId: string,
  { kind, name }: CreateCatalogItemInput,
): Promise<CatalogItem> {
  if (await nameTaken(db, workspaceId, kind, name)) throw new DuplicateCatalogItemError();
  const last = await db.catalogItem.aggregate({
    where: { workspaceId, kind },
    _max: { position: true },
  });
  try {
    const row = await db.catalogItem.create({
      data: {
        workspaceId,
        kind,
        name,
        position: (last._max.position ?? -1) + 1,
        ...auditCreate(actorId),
      },
      select: itemSelect,
    });
    return toCatalogItem(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateCatalogItemError();
    throw error;
  }
}

/** Renombra, archiva o reactiva. null si el valor no es de ese espacio (→ 404) */
export async function updateCatalogItem(
  db: Db,
  actorId: string,
  workspaceId: string,
  itemId: string,
  { name, archived }: UpdateCatalogItemInput,
): Promise<CatalogItem | null> {
  try {
    return await db.$transaction(async (tx) => {
      const item = await tx.catalogItem.findFirst({
        where: { id: itemId, workspaceId },
        select: { kind: true, name: true, archivedAt: true },
      });
      if (!item) return null;

      const willBeActive = archived === undefined ? item.archivedAt === null : !archived;
      if (
        willBeActive &&
        (await nameTaken(tx, workspaceId, item.kind, name ?? item.name, itemId))
      ) {
        throw new DuplicateCatalogItemError();
      }

      const row = await tx.catalogItem.update({
        where: { id: itemId },
        data: {
          ...(name !== undefined && { name }),
          ...(archived !== undefined && {
            // Archivar dos veces conserva la fecha original
            archivedAt: archived ? (item.archivedAt ?? new Date()) : null,
          }),
          ...auditUpdate(actorId),
        },
        select: itemSelect,
      });
      return toCatalogItem(row);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateCatalogItemError();
    throw error;
  }
}
