import { randomBytes } from 'node:crypto';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  DEFAULT_DAYS_PER_WEEK,
  type Backup,
  type BackupElement,
  type BackupFicha,
  type BackupNode,
  type CatalogKind,
  type ElementPriority,
  type ElementStatus,
  type ImportResult,
} from '@aprendizaje/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../db/client.js';
import { auditCreate, notDeleted } from '../../db/audit.js';
import { fromIsoDate, toIsoDate } from '../../db/dates.js';

type Decimal = { toNumber(): number } | null;

const toNumber = (value: Decimal) => (value === null ? null : value.toNumber());

/**
 * UUID v7 (ADR-0001): la hora en los primeros 48 bits y el resto al azar. Al importar se asignan
 * aquí para insertar elementos y nodos de golpe, con sus padres ya referenciados.
 */
function uuidV7(): string {
  const bytes = randomBytes(16);
  const time = BigInt(Date.now());
  for (let i = 0; i < 6; i++) bytes[i] = Number((time >> BigInt(8 * (5 - i))) & 0xffn);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [0, 8, 12, 16, 20].map((from, i, all) => hex.slice(from, all[i + 1])).join('-');
}

// ───────────────────────── Exportar ─────────────────────────

/** Lo que tienen en común la ficha de un elemento y la de un nodo Curso */
interface FichaRow {
  name: string;
  typeId: string | null;
  platformId: string | null;
  sponsorId: string | null;
  categoryId: string | null;
  levelId: string | null;
  authorId: string | null;
  genreId: string | null;
  pages: number | null;
  durationWeeks: Decimal;
  daysPerWeek: number | null;
  hoursPerDay: Decimal;
  manualTotalHours: Decimal;
  actualHours: Decimal;
  estimatedStart: Date | null;
  estimatedEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  status: ElementStatus | null;
  priority: ElementPriority | null;
  notes: string | null;
}

/**
 * Todo lo del espacio que se ve (sin la papelera) como un respaldo: nombres en lugar de IDs y la
 * estructura de cada elemento en orden de lectura. Los valores de catálogo archivados también
 * viajan por su nombre, para que lo que ya los usa no se pierda.
 */
export async function buildBackup(db: Db, workspaceId: string): Promise<Backup> {
  const [types, catalogs, elements, nodes] = await Promise.all([
    db.elementType.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
    db.catalogItem.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
    db.element.findMany({ where: { workspaceId, ...notDeleted }, orderBy: { createdAt: 'asc' } }),
    db.elementNode.findMany({
      where: { workspaceId, ...notDeleted, element: notDeleted },
      orderBy: [{ level: 'asc' }, { position: 'asc' }],
    }),
  ]);
  const typeNames = new Map<string, string>(types.map((type) => [type.id, type.name]));
  const catalogNames = new Map<string, string>(catalogs.map((item) => [item.id, item.name]));
  const catalogName = (id: string | null) => (id === null ? null : (catalogNames.get(id) ?? null));

  const ficha = (row: FichaRow): BackupFicha => ({
    name: row.name,
    type: (row.typeId && typeNames.get(row.typeId)) || '',
    platform: catalogName(row.platformId),
    sponsor: catalogName(row.sponsorId),
    category: catalogName(row.categoryId),
    level: catalogName(row.levelId),
    author: catalogName(row.authorId),
    genre: catalogName(row.genreId),
    pages: row.pages,
    durationWeeks: toNumber(row.durationWeeks),
    daysPerWeek: row.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK,
    hoursPerDay: toNumber(row.hoursPerDay),
    manualTotalHours: toNumber(row.manualTotalHours),
    actualHours: toNumber(row.actualHours),
    estimatedStart: toIsoDate(row.estimatedStart),
    estimatedEnd: toIsoDate(row.estimatedEnd),
    actualStart: toIsoDate(row.actualStart),
    actualEnd: toIsoDate(row.actualEnd),
    status: row.status ?? 'NOT_STARTED',
    priority: row.priority ?? 'MEDIUM',
    notes: row.notes,
  });

  type NodeRow = (typeof nodes)[number];
  const toNode = (node: NodeRow): BackupNode => {
    if (node.kind === 'CHAPTER') return { kind: 'CHAPTER', depth: node.level, name: node.name };
    if (node.kind === 'COURSE') return { kind: 'COURSE', depth: node.level, ...ficha(node) };
    return {
      kind: 'ACTIVITY',
      depth: node.level,
      name: node.name,
      activityType: catalogName(node.activityTypeId),
      durationMinutes: node.durationMinutes,
      status: node.activityStatus ?? 'PENDING',
      estimatedStart: toIsoDate(node.estimatedStart),
      estimatedEnd: toIsoDate(node.estimatedEnd),
      actualStart: toIsoDate(node.actualStart),
      actualEnd: toIsoDate(node.actualEnd),
    };
  };

  // Cada elemento: sus nodos en orden de lectura (cada padre seguido de lo que contiene)
  const childrenOf = new Map<string, NodeRow[]>();
  for (const node of nodes) {
    const key = `${node.elementId}|${node.parentId ?? ''}`;
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), node]);
  }
  const nodesOf = (elementId: string) => {
    const ordered: BackupNode[] = [];
    const visit = (parentId: string) => {
      for (const node of childrenOf.get(`${elementId}|${parentId}`) ?? []) {
        ordered.push(toNode(node));
        visit(node.id);
      }
    };
    visit('');
    return ordered;
  };

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    elements: elements.map((element) => ({
      ...ficha(element),
      nodes: nodesOf(element.id),
    })),
  };
}

// ───────────────────────── Importar ─────────────────────────

/** Tipos y catálogos se comparan sin distinguir mayúsculas, como en sus pantallas */
const lower = (name: string) => name.toLowerCase();
const key = (...parts: string[]) => parts.map(lower).join('\u0000');

const CATALOG_FIELDS = {
  platform: 'PLATFORM',
  sponsor: 'SPONSOR',
  category: 'CATEGORY',
  level: 'LEVEL',
  author: 'AUTHOR',
  genre: 'GENRE',
} as const satisfies Record<string, CatalogKind>;

/**
 * Importa un respaldo, o solo muestra qué pasaría (`apply` en false). Nunca borra ni sobrescribe:
 * agrega elementos nuevos con su estructura. Un elemento que ya existe (mismo tipo y nombre) o que
 * se repite en el archivo se omite, así volver a cargar el mismo archivo no duplica nada. Los
 * tipos y valores de catálogo que no existen se crean; todo en una sola transacción.
 */
export async function importBackup(
  db: Db,
  actorId: string,
  workspaceId: string,
  backup: Backup,
  apply: boolean,
): Promise<ImportResult> {
  return db.$transaction(
    async (tx) => {
      const [types, items, existing] = await Promise.all([
        tx.elementType.findMany({
          where: { workspaceId },
          select: { id: true, name: true, archivedAt: true },
        }),
        tx.catalogItem.findMany({
          where: { workspaceId, archivedAt: null },
          select: { id: true, kind: true, name: true },
        }),
        tx.element.findMany({
          where: { workspaceId, ...notDeleted },
          select: { name: true, typeId: true },
        }),
      ]);

      // Lo que ya existe (activo) por nombre; lo que falte se registra aquí con su ID nuevo
      const typeIds = new Map<string, string>(
        types.filter((type) => type.archivedAt === null).map((type) => [key(type.name), type.id]),
      );
      const catalogIds = new Map<string, string>(
        items.map((item) => [key(item.kind, item.name), item.id]),
      );
      const newTypes: { id: string; name: string }[] = [];
      const newItems: { id: string; kind: CatalogKind; name: string }[] = [];

      const typeId = (name: string) => {
        let id = typeIds.get(key(name));
        if (!id) {
          id = uuidV7();
          typeIds.set(key(name), id);
          newTypes.push({ id, name });
        }
        return id;
      };
      const catalogId = (kind: CatalogKind, name: string | null) => {
        if (name === null) return null;
        let id = catalogIds.get(key(kind, name));
        if (!id) {
          id = uuidV7();
          catalogIds.set(key(kind, name), id);
          newItems.push({ id, kind, name });
        }
        return id;
      };

      /** Las columnas de una ficha (elemento o nodo Curso) con sus referencias ya resueltas */
      const fichaColumns = (ficha: BackupFicha) => ({
        name: ficha.name,
        typeId: typeId(ficha.type),
        platformId: catalogId(CATALOG_FIELDS.platform, ficha.platform),
        sponsorId: catalogId(CATALOG_FIELDS.sponsor, ficha.sponsor),
        categoryId: catalogId(CATALOG_FIELDS.category, ficha.category),
        levelId: catalogId(CATALOG_FIELDS.level, ficha.level),
        authorId: catalogId(CATALOG_FIELDS.author, ficha.author),
        genreId: catalogId(CATALOG_FIELDS.genre, ficha.genre),
        pages: ficha.pages,
        durationWeeks: ficha.durationWeeks,
        daysPerWeek: ficha.daysPerWeek,
        hoursPerDay: ficha.hoursPerDay,
        manualTotalHours: ficha.manualTotalHours,
        actualHours: ficha.actualHours,
        estimatedStart: fromIsoDate(ficha.estimatedStart),
        estimatedEnd: fromIsoDate(ficha.estimatedEnd),
        actualStart: fromIsoDate(ficha.actualStart),
        actualEnd: fromIsoDate(ficha.actualEnd),
        status: ficha.status,
        priority: ficha.priority,
        notes: ficha.notes,
      });

      // Qué elementos ya existen: mismo tipo y mismo nombre
      const typeNameById = new Map<string, string>(types.map((type) => [type.id, type.name]));
      const existingKeys = new Set(
        existing.map((element) => key(typeNameById.get(element.typeId) ?? '', element.name)),
      );
      const inFile = new Set<string>();
      const skipped: ImportResult['skipped'] = [];
      const fresh: BackupElement[] = [];
      for (const element of backup.elements) {
        const id = key(element.type, element.name);
        if (existingKeys.has(id)) {
          skipped.push({ name: element.name, reason: 'EXISTS' });
        } else if (inFile.has(id)) {
          skipped.push({ name: element.name, reason: 'REPEATED' });
        } else {
          inFile.add(id);
          fresh.push(element);
        }
      }

      const now = Date.now();
      const elementRows: Prisma.ElementCreateManyInput[] = [];
      const nodeRows: Prisma.ElementNodeCreateManyInput[] = [];
      for (const [order, element] of fresh.entries()) {
        const elementId = uuidV7();
        elementRows.push({
          id: elementId,
          workspaceId,
          ...fichaColumns(element),
          // Un milisegundo entre uno y otro: la lista los ordena por fecha de alta, y así
          // conservan el orden del archivo
          createdAt: new Date(now + order),
          ...auditCreate(actorId),
        });

        const path: string[] = [];
        const positions = new Map<string, number>();
        for (const node of element.nodes) {
          const parentId = node.depth === 1 ? null : (path[node.depth - 2] ?? null);
          const slot = parentId ?? '';
          const position = positions.get(slot) ?? 0;
          positions.set(slot, position + 1);
          const id = uuidV7();
          path[node.depth - 1] = id;
          path.length = node.depth;

          const base = {
            id,
            workspaceId,
            elementId,
            parentId,
            level: node.depth,
            position,
            ...auditCreate(actorId),
          };
          if (node.kind === 'CHAPTER') {
            nodeRows.push({ ...base, kind: 'CHAPTER', name: node.name });
          } else if (node.kind === 'COURSE') {
            nodeRows.push({ ...base, kind: 'COURSE', ...fichaColumns(node) });
          } else {
            nodeRows.push({
              ...base,
              kind: 'ACTIVITY',
              name: node.name,
              activityTypeId: catalogId('ACTIVITY_TYPE', node.activityType),
              durationMinutes: node.durationMinutes,
              activityStatus: node.status,
              estimatedStart: fromIsoDate(node.estimatedStart),
              estimatedEnd: fromIsoDate(node.estimatedEnd),
              actualStart: fromIsoDate(node.actualStart),
              actualEnd: fromIsoDate(node.actualEnd),
            });
          }
        }
      }

      if (apply) {
        if (newTypes.length > 0) {
          const last = await tx.elementType.aggregate({
            where: { workspaceId },
            _max: { position: true },
          });
          await tx.elementType.createMany({
            data: newTypes.map(({ id, name }, index) => ({
              id,
              workspaceId,
              name,
              labels: {},
              position: (last._max.position ?? -1) + 1 + index,
              ...auditCreate(actorId),
            })),
          });
        }
        for (const kind of new Set(newItems.map((item) => item.kind))) {
          const last = await tx.catalogItem.aggregate({
            where: { workspaceId, kind },
            _max: { position: true },
          });
          await tx.catalogItem.createMany({
            data: newItems
              .filter((item) => item.kind === kind)
              .map(({ id, name }, index) => ({
                id,
                workspaceId,
                kind,
                name,
                position: (last._max.position ?? -1) + 1 + index,
                ...auditCreate(actorId),
              })),
          });
        }
        if (elementRows.length > 0) await tx.element.createMany({ data: elementRows });
        // Los padres van antes que sus hijos en la lista: se insertan en ese orden
        if (nodeRows.length > 0) await tx.elementNode.createMany({ data: nodeRows });
      }

      return {
        applied: apply,
        elements: elementRows.length,
        nodes: nodeRows.length,
        skipped,
        newTypes: newTypes.map((type) => type.name),
        newCatalogItems: newItems.map(({ kind, name }) => ({ kind, name })),
      };
    },
    // Un respaldo grande son miles de filas: más que los 5 s que Prisma da por omisión
    { timeout: 60_000 },
  );
}
