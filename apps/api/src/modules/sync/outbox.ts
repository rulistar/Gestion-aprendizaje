import type { Tx } from '../../db/client.js';

/** Espera desde el último cambio antes de enviar: junta varias ediciones en un envío (ADR-0004 §2) */
export const DEBOUNCE_MS = 30_000;

/**
 * Deja la marca de "hay cambios" de un elemento sincronizado, dentro de la transacción del cambio:
 * si el cambio se guarda, la marca también, aunque el servidor se reinicie antes de enviarlo.
 * Si el elemento no está sincronizado, no hace nada.
 *
 * Si ya estaba fallando, no se reinician los intentos: los cambios no aceleran los reintentos ni
 * esconden un envío fallido (ese se reintenta desde la ficha).
 */
export async function markChanged(tx: Tx, elementId: string, now = new Date()): Promise<void> {
  const element = await tx.element.findUnique({
    where: { id: elementId },
    select: { workspaceId: true, syncEnabled: true },
  });
  if (!element?.syncEnabled) return;

  const due = new Date(now.getTime() + DEBOUNCE_MS);
  const pending = await tx.syncOutbox.findUnique({
    where: { elementId },
    select: { attempts: true, nextAttemptAt: true },
  });
  if (!pending) {
    await tx.syncOutbox.create({
      data: { workspaceId: element.workspaceId, elementId, changedAt: now, nextAttemptAt: due },
    });
    return;
  }
  await tx.syncOutbox.update({
    where: { elementId },
    data: {
      changedAt: now,
      // Sin fallas, el envío espera 30 s más; fallando, se respeta el reintento ya programado
      ...(pending.attempts === 0 && { nextAttemptAt: due }),
    },
  });
}

/**
 * Tras borrar un elemento para siempre ya no se puede leer si estaba sincronizado: lo dicen sus
 * vínculos. Si los tiene, se marca para que el envío quite el proyecto en Proyectos.
 */
export async function markPurged(
  tx: Tx,
  workspaceId: string,
  elementId: string,
  now = new Date(),
): Promise<void> {
  const linked = await tx.syncLink.findFirst({ where: { elementId }, select: { id: true } });
  if (!linked) return;
  await tx.syncOutbox.upsert({
    where: { elementId },
    create: { workspaceId, elementId, changedAt: now, nextAttemptAt: now },
    update: { changedAt: now },
  });
}
