import { z } from 'zod';
import type { ActivityStatus } from './element-nodes.js';
import type { ElementPriority, ElementStatus } from './elements.js';

/*
 * Integración con Gestor de Proyectos (INT-02, ADR-0004). Aquí está lo que se envía a su API
 * /api/v1 y lo que se lee de sus respuestas: una copia de sus esquemas, solo con los campos que se
 * usan (ADR-0004 §5). Cada repo es independiente: si Proyectos cambia su contrato, se cambia aquí.
 */

/** Largo máximo en Proyectos: proyecto y fase 120, tarea 200 (en Aprendizaje, todo es 200) */
export const PROYECTOS_NAME_MAX = 120;
export const PROYECTOS_TITLE_MAX = 200;
/** Proyectos acepta hasta una semana de trabajo continuo por tarea */
export const PROYECTOS_MAX_MINUTES = 10_080;
/** Proyectos exige motivo al pausar o cancelar una tarea; Aprendizaje no lo pide */
export const SYNC_STATUS_REASON = 'Desde Gestor de Aprendizaje';

/** Recorta al largo de Proyectos, con "…" para que se note */
export function fitText(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/** Cuerpo de POST y PUT .../projects: solo lo que tiene equivalente (ADR-0004 §1) */
export interface ProyectosProjectBody {
  name: string;
  scope: 'PERSONAL';
  status: ElementStatus;
  priority: ElementPriority;
  startDate: string | null;
  endDate: string | null;
}

/**
 * Un elemento como proyecto. Va como personal: es aprendizaje propio. Las fechas reales no viajan:
 * en Proyectos las pone el sistema al cambiar el estado (su ADR-0004 §2.1).
 */
export function projectBody(element: {
  name: string;
  status: ElementStatus;
  priority: ElementPriority;
  estimatedStart: string | null;
  estimatedEnd: string | null;
}): ProyectosProjectBody {
  return {
    name: fitText(element.name, PROYECTOS_NAME_MAX),
    scope: 'PERSONAL',
    status: element.status,
    priority: element.priority,
    startDate: element.estimatedStart,
    endDate: element.estimatedEnd,
  };
}

/** Cuerpo de POST .../phases (al crear) y PATCH .../phases/:id (solo el nombre) */
export function phaseName(node: { name: string }): string {
  return fitText(node.name, PROYECTOS_NAME_MAX);
}

/** Cuerpo de POST y PUT .../tasks */
export interface ProyectosTaskBody {
  title: string;
  status: ActivityStatus;
  estimatedMinutes: number | null;
  startDate: string | null;
  endDate: string | null;
  statusReason: string | null;
  /** Fase de Proyectos de su padre; null = suelta (la actividad está en la raíz del elemento) */
  phaseId: string | null;
}

/** Una actividad como tarea, en la fase que corresponde a su padre */
export function taskBody(
  activity: {
    name: string;
    status: ActivityStatus;
    durationMinutes: number | null;
    estimatedStart: string | null;
    estimatedEnd: string | null;
  },
  phaseId: string | null,
): ProyectosTaskBody {
  const needsReason = activity.status === 'PAUSED' || activity.status === 'CANCELLED';
  return {
    title: fitText(activity.name, PROYECTOS_TITLE_MAX),
    status: activity.status,
    estimatedMinutes:
      activity.durationMinutes === null
        ? null
        : Math.min(activity.durationMinutes, PROYECTOS_MAX_MINUTES),
    startDate: activity.estimatedStart,
    endDate: activity.estimatedEnd,
    statusReason: needsReason ? SYNC_STATUS_REASON : null,
    phaseId,
  };
}

/** Lo que se lee de lo que Proyectos crea: su ID (Zod descarta los demás campos) */
export const proyectosRecordSchema = z.object({ id: z.uuid() });

/** Respuesta de GET .../projects/:id/phases: para revisar el orden */
export const proyectosPhaseListSchema = z.array(
  z.object({ id: z.uuid(), parentId: z.uuid().nullable(), position: z.number().int() }),
);
export type ProyectosPhase = z.infer<typeof proyectosPhaseListSchema>[number];

/**
 * Movimientos "subir" para que las fases de un mismo padre queden en el orden pedido (Proyectos
 * solo sube o baja de uno en uno). `current` es el orden en Proyectos, con las fases que no vienen
 * de aquí; `wanted`, el de las nuestras. Las nuestras quedan primero, en su orden.
 */
export function phaseMoves(current: readonly string[], wanted: readonly string[]): string[] {
  const order = [...current];
  const moves: string[] = [];
  wanted.forEach((id, target) => {
    let index = order.indexOf(id);
    while (index > target) {
      [order[index - 1], order[index]] = [order[index]!, order[index - 1]!];
      moves.push(id);
      index--;
    }
  });
  return moves;
}

/** Cómo va un elemento con Gestor de Proyectos, para la ficha */
export const syncStateSchema = z.enum(['off', 'pending', 'synced', 'failed']);
export type SyncState = z.infer<typeof syncStateSchema>;

/** Respuesta de GET/POST/DELETE .../elements/:elementId/sync */
export const syncStatusSchema = z.object({
  /** La instalación tiene configurada la conexión; sin ella no se ofrece enviar */
  available: z.boolean(),
  state: syncStateSchema,
  /** Último envío completo */
  lastSentAt: z.iso.datetime().nullable(),
  /** Intentos fallidos seguidos y por qué falló el último */
  attempts: z.number().int(),
  lastError: z.string().nullable(),
});
export type SyncStatus = z.infer<typeof syncStatusSchema>;
