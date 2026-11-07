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

/** Avance de todo el elemento, con la lista plana de sus nodos */
export function elementProgress(nodes: readonly ElementNode[]): Progress {
  return summarizeActivities(
    nodes.flatMap((node) => (node.kind === 'ACTIVITY' ? [node.activity.status] : [])),
  );
}

function activityStatuses(node: NodeTreeItem): ActivityStatus[] {
  return node.kind === 'ACTIVITY'
    ? [node.activity.status]
    : node.children.flatMap(activityStatuses);
}

/** Avance de un capítulo o un curso: el de las actividades que contiene, a cualquier profundidad */
export function nodeProgress(node: NodeTreeItem): Progress {
  return summarizeActivities(activityStatuses(node));
}
