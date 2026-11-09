import { z } from 'zod';
import { nodeKindSchema } from './element-nodes.js';
import { roleHasPermission, type Permission } from './permissions.js';
import type { MembershipRole } from './workspaces.js';

export const trashKindSchema = z.enum(['element', 'node']);
export type TrashKind = z.infer<typeof trashKindSchema>;

/** Algo quitado (HU-07): qué es, de dónde y quién lo quitó */
export const trashItemSchema = z.object({
  kind: trashKindSchema,
  id: z.uuid(),
  name: z.string(),
  /** Capítulo, curso o actividad; null en los elementos */
  nodeKind: nodeKindSchema.nullable(),
  /** Elemento al que pertenece el nodo; null en los elementos */
  elementName: z.string().nullable(),
  /** Actividades que vuelven con él al restaurarlo (0 en una actividad) */
  activityCount: z.number().int(),
  deletedAt: z.iso.datetime(),
  deletedByName: z.string().nullable(),
});
export type TrashItem = z.infer<typeof trashItemSchema>;

/** Respuesta de GET /workspaces/:workspaceId/trash; lo más reciente primero */
export const trashListSchema = z.array(trashItemSchema);

/**
 * Quien pudo quitarlo lo ve en la papelera y lo restaura (HU-07): un elemento lo quita quien tiene
 * `element.delete`; un capítulo, curso o actividad, quien edita el elemento (`element.update`).
 * Borrarlo para siempre exige además `trash.manage` (solo el Admin).
 */
export function trashPermission(kind: TrashKind): Permission {
  return kind === 'element' ? 'element.delete' : 'element.update';
}

/** Qué clases de la papelera ve un rol; ninguna si no puede quitar nada */
export function visibleTrashKinds(role: MembershipRole): TrashKind[] {
  return trashKindSchema.options.filter((kind) => roleHasPermission(role, trashPermission(kind)));
}
