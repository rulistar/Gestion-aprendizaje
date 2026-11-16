import { z } from 'zod';
import type { ActivityStatus, ElementNode, NodeTreeItem } from './element-nodes.js';

/** Avance calculado de un elemento o de un nodo (ADR-0002 §4); no se guarda */
export const progressSchema = z.object({
  /** Actividades que cuentan: las no canceladas */
  total: z.number().int(),
  done: z.number().int(),
  /** % de Hechas sobre las que cuentan, redondeado; 0 si no hay */
  percent: z.number().int().min(0).max(100),
});
export type Progress = z.infer<typeof progressSchema>;

/**
 * Las mismas reglas de Gestor de Proyectos, para que el avance sincronizado signifique lo mismo:
 * una Cancelada no cuenta y una Pausada sí, porque sigue siendo trabajo pendiente.
 */
export function summarizeActivities(statuses: readonly ActivityStatus[]): Progress {
  const counted = statuses.filter((status) => status !== 'CANCELLED');
  const done = counted.filter((status) => status === 'DONE').length;
  return {
    total: counted.length,
    done,
    percent: counted.length === 0 ? 0 : Math.round((done / counted.length) * 100),
  };
}

/**
 * Estado con el que cuenta cada actividad de un nodo (HU-20). Un capítulo Terminado a mano cuenta
 * todo lo que contiene como hecho y uno Cancelado lo deja fuera, sin tocar las actividades; Pausado
 * no cambia nada. Si hay varios a la vez, Cancelado manda sobre Terminado y entre dos iguales o
 * Terminados el más cercano a la actividad no importa porque dan lo mismo.
 */
export function effectiveActivityStatuses(
  node: NodeTreeItem,
  inherited: 'DONE' | 'CANCELLED' | null = null,
): ActivityStatus[] {
  if (node.kind === 'ACTIVITY') return [inherited ?? node.activity.status];
  let forced = inherited;
  if (node.kind === 'CHAPTER' && inherited !== 'CANCELLED') {
    if (node.status === 'CANCELLED' || node.status === 'DONE') forced = node.status;
  }
  return node.children.flatMap((child) => effectiveActivityStatuses(child, forced));
}

/** Lo mínimo de un nodo para calcular el avance con la lista plana, sin armar el árbol */
export interface ProgressRow {
  id: string;
  parentId: string | null;
  kind: 'CHAPTER' | 'COURSE' | 'ACTIVITY';
  /** Estado a mano; solo cuenta en un capítulo */
  chapterStatus: 'PAUSED' | 'CANCELLED' | 'DONE' | null;
  activityStatus: ActivityStatus | null;
}

/** El estado con que cuenta cada actividad de la lista plana, por su ID (mismas reglas que el árbol) */
export function effectiveStatusById(rows: readonly ProgressRow[]): Map<string, ActivityStatus> {
  const byId = new Map(rows.map((row) => [row.id, row] as const));
  const statuses = new Map<string, ActivityStatus>();
  for (const row of rows) {
    if (row.kind !== 'ACTIVITY' || !row.activityStatus) continue;
    let forced: 'DONE' | 'CANCELLED' | null = null;
    let up = row.parentId ? byId.get(row.parentId) : undefined;
    while (up) {
      if (up.kind === 'CHAPTER') {
        if (up.chapterStatus === 'CANCELLED') forced = 'CANCELLED';
        else if (up.chapterStatus === 'DONE' && forced === null) forced = 'DONE';
      }
      up = up.parentId ? byId.get(up.parentId) : undefined;
    }
    statuses.set(row.id, forced ?? row.activityStatus);
  }
  return statuses;
}

/** Los estados con que cuentan las actividades de la lista plana */
export function effectiveStatusesOf(rows: readonly ProgressRow[]): ActivityStatus[] {
  return [...effectiveStatusById(rows).values()];
}

/** Avance de todo el elemento, con la lista plana de sus nodos */
export function elementProgress(nodes: readonly ElementNode[]): Progress {
  return summarizeActivities(
    effectiveStatusesOf(
      nodes.map((node) => ({
        id: node.id,
        parentId: node.parentId,
        kind: node.kind,
        chapterStatus: node.kind === 'CHAPTER' ? node.status : null,
        activityStatus: node.kind === 'ACTIVITY' ? node.activity.status : null,
      })),
    ),
  );
}

/**
 * Avance de un capítulo o un curso: el de las actividades que contiene, a cualquier profundidad.
 * Si el propio capítulo está Terminado muestra 100 % y si está Cancelado queda fuera (0 de 0).
 */
export function nodeProgress(node: NodeTreeItem): Progress {
  const progress = summarizeActivities(effectiveActivityStatuses(node));
  // Terminado a mano sin actividades también muestra 100 %
  if (node.kind === 'CHAPTER' && node.status === 'DONE' && progress.total === 0) {
    return { ...progress, percent: 100 };
  }
  return progress;
}
