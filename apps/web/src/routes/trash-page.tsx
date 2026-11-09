import { nodeKindLabel, roleHasPermission, type TrashItem } from '@aprendizaje/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { ArchiveRestore, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trashQueryOptions, usePurgeFromTrash, useRestoreFromTrash } from '@/lib/trash';
import { workspaceQueryOptions } from '@/lib/workspaces';

const route = getRouteApi('/app/w/$workspaceId/papelera');

const dateFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/** Qué es: "Elemento", o "Capítulo de Curso de Go" */
function describe(item: TrashItem) {
  if (item.kind === 'element' || !item.nodeKind) return 'Elemento';
  // En la papelera no se sabe el nivel: un capítulo dentro de otro también se llama capítulo
  return `${nodeKindLabel(item.nodeKind, 1)} de ${item.elementName}`;
}

/**
 * Papelera del espacio (HU-07). Cada quien ve lo que pudo quitar y lo restaura; solo el Admin lo
 * borra para siempre. Lo que se quitó junto con su capítulo o su elemento vuelve con él.
 */
export function TrashPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: items } = useSuspenseQuery(trashQueryOptions(workspaceId));
  // Solo oculta botones: quien decide es la API
  const canPurge = roleHasPermission(workspace.role, 'trash.manage');

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Papelera</h1>
      <Card>
        <CardHeader>
          <CardTitle>Lo que se quitó</CardTitle>
          <CardDescription>
            Al restaurar algo, vuelve con todo lo que se quitó junto con él.
            {canPurge && ' Borrar para siempre no se puede deshacer.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">La papelera está vacía.</p>
          ) : (
            <ul className="grid gap-2">
              {items.map((item) => (
                <TrashRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  workspaceId={workspaceId}
                  canPurge={canPurge}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TrashRow({
  item,
  workspaceId,
  canPurge,
}: {
  item: TrashItem;
  workspaceId: string;
  canPurge: boolean;
}) {
  const restore = useRestoreFromTrash(workspaceId);
  const purge = usePurgeFromTrash(workspaceId);
  const [confirming, setConfirming] = useState(false);
  const pending = restore.isPending || purge.isPending;
  const error = restore.error ?? purge.error;
  const target = { kind: item.kind, id: item.id };

  return (
    <li className="grid gap-2 rounded-md border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid min-w-0 gap-0.5">
          <p className="font-medium break-words">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {describe(item)}
            {item.activityCount > 0 &&
              ` · con ${item.activityCount} ${item.activityCount === 1 ? 'actividad' : 'actividades'}`}
            {' · '}
            Quitado {item.deletedByName && `por ${item.deletedByName} `}el{' '}
            {dateFormat.format(new Date(item.deletedAt))}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => restore.mutate(target)}
          >
            <ArchiveRestore aria-hidden />
            Restaurar
          </Button>
          {canPurge && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Borrar para siempre ${item.name}`}
              aria-expanded={confirming}
              disabled={pending}
              onClick={() => setConfirming(!confirming)}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>
      {confirming && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <p className="text-sm">
            ¿Borrar "{item.name}" para siempre, con todo lo que contiene? No se puede deshacer.
          </p>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => purge.mutate(target)}
          >
            Borrar para siempre
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </li>
  );
}
