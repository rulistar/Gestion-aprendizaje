import {
  applyStatusDates,
  computeTotalHours,
  summarizeActivities,
  type ActivityStatus,
  type CatalogKind,
  type Element,
  type ElementFicha,
  type ElementListItem,
  type ElementStatus,
} from '@aprendizaje/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditCreate, auditSoftDelete, auditUpdate, notDeleted } from '../../db/audit.js';
import { fromIsoDate, toIsoDate } from '../../db/dates.js';
import { markChanged } from '../sync/outbox.js';

/** El tipo o un valor de catálogo no sirve para esta ficha (→ 400) */
export class InvalidReferenceError extends Error {}
/** Al llenar la fecha real automática, el fin quedaría antes del inicio (→ 400) */
export class InvalidActualDatesError extends Error {}

const CATALOG_REFS = [
  ['platformId', 'PLATFORM', 'La plataforma'],
  ['sponsorId', 'SPONSOR', 'El patrocinador'],
  ['categoryId', 'CATEGORY', 'La categoría'],
  ['levelId', 'LEVEL', 'El nivel'],
] as const satisfies readonly (readonly [keyof ElementFicha, CatalogKind, string])[];

type Reference = Pick<
  ElementFicha,
  'typeId' | 'platformId' | 'sponsorId' | 'categoryId' | 'levelId'
>;

const elementSelect = {
  id: true,
  typeId: true,
  name: true,
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
  updatedAt: true,
} as const;

/** Prisma entrega los NUMERIC como Decimal; la API habla en números */
function toNumber(value: { toNumber(): number } | null): number | null {
  return value === null ? null : value.toNumber();
}

export function toElement(row: {
  id: string;
  typeId: string;
  name: string;
  platformId: string | null;
  sponsorId: string | null;
  categoryId: string | null;
  levelId: string | null;
  durationWeeks: { toNumber(): number } | null;
  daysPerWeek: number;
  hoursPerDay: { toNumber(): number } | null;
  manualTotalHours: { toNumber(): number } | null;
  estimatedStart: Date | null;
  estimatedEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  status: ElementStatus;
  notes: string | null;
  updatedAt: Date;
}): Element {
  const hours = {
    durationWeeks: toNumber(row.durationWeeks),
    daysPerWeek: row.daysPerWeek,
    hoursPerDay: toNumber(row.hoursPerDay),
    manualTotalHours: toNumber(row.manualTotalHours),
  };
  return {
    id: row.id,
    typeId: row.typeId,
    name: row.name,
    platformId: row.platformId,
    sponsorId: row.sponsorId,
    categoryId: row.categoryId,
    levelId: row.levelId,
    ...hours,
    totalHours: computeTotalHours(hours),
    estimatedStart: toIsoDate(row.estimatedStart),
    estimatedEnd: toIsoDate(row.estimatedEnd),
    actualStart: toIsoDate(row.actualStart),
    actualEnd: toIsoDate(row.actualEnd),
    status: row.status,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Todo lo que la ficha referencia debe ser de este espacio y del catálogo correcto (un ID de otro
 * espacio no debe colarse). Lo archivado no se ofrece para lo nuevo, pero quien ya lo usa lo conserva.
 */
export async function assertReferences(
  tx: Tx,
  workspaceId: string,
  ficha: Reference,
  previous: Reference | null,
) {
  const type = await tx.elementType.findFirst({
    where: { id: ficha.typeId, workspaceId },
    select: { archivedAt: true },
  });
  if (!type || (type.archivedAt !== null && previous?.typeId !== ficha.typeId)) {
    throw new InvalidReferenceError('El tipo de elemento no está disponible');
  }

  for (const [field, kind, label] of CATALOG_REFS) {
    const id = ficha[field];
    if (id === null) continue;
    const item = await tx.catalogItem.findFirst({
      where: { id, workspaceId, kind },
      select: { archivedAt: true },
    });
    if (!item || (item.archivedAt !== null && previous?.[field] !== id)) {
      throw new InvalidReferenceError(`${label} no está disponible`);
    }
  }
}

/** Las columnas de la ficha, con las fechas reales ya resueltas */
export function fichaData(ficha: ElementFicha, previous: ElementStatus | null, today: string) {
  const { actualStart, actualEnd } = applyStatusDates(previous, ficha, today);
  if (actualStart && actualEnd && actualEnd < actualStart) {
    throw new InvalidActualDatesError();
  }
  return {
    ...ficha,
    estimatedStart: fromIsoDate(ficha.estimatedStart),
    estimatedEnd: fromIsoDate(ficha.estimatedEnd),
    actualStart: fromIsoDate(actualStart),
    actualEnd: fromIsoDate(actualEnd),
  };
}

/** Los elementos del espacio con su avance, sin los de la papelera; los más recientes primero */
export async function listElements(db: Db, workspaceId: string): Promise<ElementListItem[]> {
  const rows = await db.element.findMany({
    where: { workspaceId, ...notDeleted },
    select: elementSelect,
    orderBy: { createdAt: 'desc' },
  });
  const activities = await db.elementNode.findMany({
    where: { workspaceId, kind: 'ACTIVITY', ...notDeleted },
    select: { elementId: true, activityStatus: true },
  });
  const statuses = new Map<string, ActivityStatus[]>();
  for (const { elementId, activityStatus } of activities) {
    if (activityStatus)
      statuses.set(elementId, [...(statuses.get(elementId) ?? []), activityStatus]);
  }
  return rows.map((row) => ({
    ...toElement(row),
    progress: summarizeActivities(statuses.get(row.id) ?? []),
  }));
}

export async function getElement(
  db: Db,
  workspaceId: string,
  elementId: string,
): Promise<Element | null> {
  const row = await db.element.findFirst({
    where: { id: elementId, workspaceId, ...notDeleted },
    select: elementSelect,
  });
  return row && toElement(row);
}

export async function createElement(
  db: Db,
  actorId: string,
  workspaceId: string,
  ficha: ElementFicha,
  today: string,
): Promise<Element> {
  return db.$transaction(async (tx) => {
    await assertReferences(tx, workspaceId, ficha, null);
    const row = await tx.element.create({
      data: { workspaceId, ...fichaData(ficha, null, today), ...auditCreate(actorId) },
      select: elementSelect,
    });
    return toElement(row);
  });
}

/**
 * Manda el elemento a la papelera (HU-07). Su estructura no se toca: deja de verse porque el
 * elemento no está, y vuelve completa al restaurarlo. false si no está (→ 404).
 */
export async function deleteElement(
  db: Db,
  actorId: string,
  workspaceId: string,
  elementId: string,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.element.updateMany({
      where: { id: elementId, workspaceId, ...notDeleted },
      data: auditSoftDelete(actorId),
    });
    if (count > 0) await markChanged(tx, elementId);
    return count > 0;
  });
}

/** Reemplaza la ficha completa. null si no es de ese espacio o está en la papelera (→ 404) */
export async function updateElement(
  db: Db,
  actorId: string,
  workspaceId: string,
  elementId: string,
  ficha: ElementFicha,
  today: string,
): Promise<Element | null> {
  return db.$transaction(async (tx) => {
    const previous = await tx.element.findFirst({
      where: { id: elementId, workspaceId, ...notDeleted },
      select: {
        status: true,
        typeId: true,
        platformId: true,
        sponsorId: true,
        categoryId: true,
        levelId: true,
      },
    });
    if (!previous) return null;

    await assertReferences(tx, workspaceId, ficha, previous);
    const row = await tx.element.update({
      where: { id: elementId },
      data: { ...fichaData(ficha, previous.status, today), ...auditUpdate(actorId) },
      select: elementSelect,
    });
    await markChanged(tx, elementId);
    return toElement(row);
  });
}
