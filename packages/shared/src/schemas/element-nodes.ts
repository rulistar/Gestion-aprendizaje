import { z } from 'zod';
import { checkDateOrder, elementFichaSchema, elementSchema, fromFormValues } from './elements.js';

/** Clases de nodo del árbol de un elemento (ADR-0002 §1 y §2) */
export const NODE_KINDS = ['CHAPTER', 'COURSE', 'ACTIVITY'] as const;
export const nodeKindSchema = z.enum(NODE_KINDS);
export type NodeKind = z.infer<typeof nodeKindSchema>;

export const MAX_NODE_LEVEL = 3;

/** El nombre de cada clase; un capítulo dentro de otro nodo es un subcapítulo */
export function nodeKindLabel(kind: NodeKind, level: number): string {
  if (kind === 'CHAPTER') return level > 1 ? 'Subcapítulo' : 'Capítulo';
  return kind === 'COURSE' ? 'Curso' : 'Actividad';
}

/**
 * Qué se puede agregar dentro de un nodo; `parent` null es la raíz del elemento. Una actividad no
 * tiene hijos, y en el nivel 3 solo caben actividades: un capítulo ahí quedaría vacío.
 */
export function allowedChildKinds(
  parent: { kind: NodeKind; level: number } | null,
): readonly NodeKind[] {
  if (parent === null) return NODE_KINDS;
  if (parent.kind === 'ACTIVITY' || parent.level >= MAX_NODE_LEVEL) return [];
  return parent.level === MAX_NODE_LEVEL - 1 ? ['ACTIVITY'] : NODE_KINDS;
}

/** Estados de una actividad: los mismos de las tareas en Gestor de Proyectos */
export const ACTIVITY_STATUSES = ['PENDING', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED'] as const;
export const activityStatusSchema = z.enum(ACTIVITY_STATUSES);
export type ActivityStatus = z.infer<typeof activityStatusSchema>;

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En curso',
  PAUSED: 'Pausada',
  DONE: 'Hecha',
  CANCELLED: 'Cancelada',
};

const nodeName = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(200, 'Máximo 200 caracteres');
const isoDate = z.iso.date('Fecha no válida');
const optionalDate = isoDate.nullable().default(null);

/** Un capítulo solo agrupa */
export const chapterContentSchema = z.object({ name: nodeName });
export type ChapterContent = z.infer<typeof chapterContentSchema>;

/** Una actividad es la hoja: lo que se hace */
export const activityContentSchema = z
  .object({
    name: nodeName,
    activityTypeId: z.uuid('Valor no válido').nullable().default(null),
    durationMinutes: z
      .number({ error: 'Escribe un número' })
      .int('Debe ser un número entero')
      .positive('Debe ser mayor que 0')
      .max(100000, 'Máximo 100000')
      .nullable()
      .default(null),
    status: activityStatusSchema.default('PENDING'),
    estimatedStart: optionalDate,
    estimatedEnd: optionalDate,
    actualStart: optionalDate,
    actualEnd: optionalDate,
  })
  .superRefine(checkDateOrder);
export type ActivityContent = z.infer<typeof activityContentSchema>;

export const ACTIVITY_FORM_FIELDS = [
  'name',
  'activityTypeId',
  'durationMinutes',
  'status',
  'estimatedStart',
  'estimatedEnd',
  'actualStart',
  'actualEnd',
] as const;

export const activityContentFormSchema = z.preprocess(fromFormValues, activityContentSchema);

const parentId = z.uuid('Nodo no válido').nullable().default(null);

/** Cuerpo de POST .../nodes. Un nodo Curso usa la misma ficha que el elemento (ADR-0002 §2) */
export const createNodeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CHAPTER'), parentId, content: chapterContentSchema }),
  z.object({ kind: z.literal('COURSE'), parentId, content: elementFichaSchema }),
  z.object({ kind: z.literal('ACTIVITY'), parentId, content: activityContentSchema }),
]);
export type CreateNodeInput = z.infer<typeof createNodeSchema>;

/** Cuerpo de PUT .../nodes/:nodeId: reemplaza el contenido; la clase y el lugar no cambian */
export const updateNodeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CHAPTER'), content: chapterContentSchema }),
  z.object({ kind: z.literal('COURSE'), content: elementFichaSchema }),
  z.object({ kind: z.literal('ACTIVITY'), content: activityContentSchema }),
]);
export type UpdateNodeInput = z.infer<typeof updateNodeSchema>;

/** Cuerpo de POST .../nodes/:nodeId/move: subir o bajar entre sus hermanos */
export const moveNodeSchema = z.object({ direction: z.enum(['up', 'down']) });
export type MoveNodeInput = z.infer<typeof moveNodeSchema>;

const nodeBase = {
  id: z.uuid(),
  elementId: z.uuid(),
  parentId: z.uuid().nullable(),
  level: z.number().int(),
  position: z.number().int(),
  name: z.string(),
  updatedAt: z.iso.datetime(),
};

export const activitySchema = z.object({
  name: z.string(),
  activityTypeId: z.uuid().nullable(),
  durationMinutes: z.number().int().nullable(),
  status: activityStatusSchema,
  estimatedStart: isoDate.nullable(),
  estimatedEnd: isoDate.nullable(),
  actualStart: isoDate.nullable(),
  actualEnd: isoDate.nullable(),
});
export type Activity = z.infer<typeof activitySchema>;

export const elementNodeSchema = z.discriminatedUnion('kind', [
  z.object({ ...nodeBase, kind: z.literal('CHAPTER') }),
  z.object({ ...nodeBase, kind: z.literal('COURSE'), ficha: elementSchema }),
  z.object({ ...nodeBase, kind: z.literal('ACTIVITY'), activity: activitySchema }),
]);
export type ElementNode = z.infer<typeof elementNodeSchema>;

/** Respuesta de GET .../nodes: lista plana; la web arma el árbol con buildNodeTree */
export const elementNodeListSchema = z.array(elementNodeSchema);

export type NodeTreeItem = ElementNode & { children: NodeTreeItem[] };

/** De la lista plana al árbol, con los hermanos en su orden. Un nodo sin padre visible se omite */
export function buildNodeTree(nodes: readonly ElementNode[]): NodeTreeItem[] {
  const childrenOf = new Map<string | null, ElementNode[]>();
  for (const node of nodes) {
    childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node]);
  }
  const branch = (parentId: string | null): NodeTreeItem[] =>
    (childrenOf.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((node) => ({ ...node, children: branch(node.id) }));
  return branch(null);
}
