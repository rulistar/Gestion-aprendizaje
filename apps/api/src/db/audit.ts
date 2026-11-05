/**
 * Trazabilidad y borrado lógico, con las reglas del ADR-0002 de Gestor de Proyectos.
 * Los servicios usan estas funciones en vez de escribir los campos a mano,
 * para que ninguna operación olvide registrar quién hizo el cambio.
 *
 * `actorId` es el usuario de la sesión (o el usuario de servicio de una app externa);
 * es `null` solo para lo que crea el sistema, como el primer Admin.
 */

export function auditCreate(actorId: string | null) {
  return { createdById: actorId, updatedById: actorId };
}

export function auditUpdate(actorId: string) {
  return { updatedById: actorId };
}

/** Manda un registro a la papelera. */
export function auditSoftDelete(actorId: string, now: Date = new Date()) {
  return { deletedAt: now, deletedById: actorId, updatedById: actorId };
}

/** Saca un registro de la papelera. */
export function auditRestore(actorId: string) {
  return { deletedAt: null, deletedById: null, updatedById: actorId };
}

/** Filtro obligatorio en toda consulta normal: excluye lo que está en la papelera. */
export const notDeleted = { deletedAt: null } as const;
