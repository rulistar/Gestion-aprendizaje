import type { SyncStatus } from '@aprendizaje/shared';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Send, Unlink } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { syncQueryOptions, useSyncAction } from '@/lib/sync';

const dateFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/** Qué pasa con el envío, en palabras */
function describe(status: SyncStatus): string {
  const sent =
    status.lastSentAt && ` Último envío: ${dateFormat.format(new Date(status.lastSentAt))}.`;
  switch (status.state) {
    case 'off':
      return 'No se envía. Al enviarlo, se crea como proyecto con sus fases y tareas, y cada cambio llega solo.';
    case 'pending':
      return status.attempts > 0
        ? `Aún no llega: ${status.lastError}. Se reintenta solo.${sent ?? ''}`
        : `Enviando: los cambios llegan unos segundos después de que terminas.${sent ?? ''}`;
    case 'synced':
      return `Sincronizado: cada cambio llega solo.${sent ?? ''}`;
    case 'failed':
      return `No se pudo enviar en 24 horas: ${status.lastError}. Revisa que Gestor de Proyectos funcione y reintenta.`;
  }
}

/**
 * Enviar el elemento a Gestor de Proyectos (INT-02, ADR-0004). Sin conexión configurada en la
 * instalación, no se muestra.
 */
export function SyncCard({
  workspaceId,
  elementId,
  canUpdate,
}: {
  workspaceId: string;
  elementId: string;
  canUpdate: boolean;
}) {
  const { data: status } = useQuery(syncQueryOptions(workspaceId, elementId));
  const action = useSyncAction(workspaceId, elementId);
  const [confirming, setConfirming] = useState(false);
  if (!status?.available) return null;
  const on = status.state !== 'off';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestor de Proyectos</CardTitle>
        <CardDescription role="status">{describe(status)}</CardDescription>
      </CardHeader>
      {canUpdate && (
        <CardContent className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            {!on && (
              <Button size="sm" disabled={action.isPending} onClick={() => action.mutate('enable')}>
                <Send aria-hidden />
                Enviar a Gestor de Proyectos
              </Button>
            )}
            {status.state === 'failed' && (
              <Button size="sm" disabled={action.isPending} onClick={() => action.mutate('retry')}>
                <RefreshCw aria-hidden />
                Reintentar
              </Button>
            )}
            {on && (
              <Button
                size="sm"
                variant="outline"
                aria-expanded={confirming}
                disabled={action.isPending}
                onClick={() => setConfirming(!confirming)}
              >
                <Unlink aria-hidden />
                Dejar de sincronizar
              </Button>
            )}
          </div>
          {on && confirming && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <p className="text-sm">
                Los cambios dejarán de llegar. En Gestor de Proyectos no se borra nada; si lo
                vuelves a enviar, se crea otro proyecto.
              </p>
              <Button
                size="sm"
                variant="destructive"
                disabled={action.isPending}
                onClick={() => action.mutate('disable', { onSuccess: () => setConfirming(false) })}
              >
                Dejar de sincronizar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </div>
          )}
          {action.error && (
            <p role="alert" className="text-sm text-destructive">
              {action.error.message}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
