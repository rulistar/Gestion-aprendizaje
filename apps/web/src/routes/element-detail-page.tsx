import { roleHasPermission } from '@aprendizaje/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ElementForm } from '@/components/element-form';
import { ElementStructure } from '@/components/element-structure';
import { SyncCard } from '@/components/sync-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { catalogsQueryOptions } from '@/lib/catalogs';
import { elementTypesQueryOptions } from '@/lib/element-types';
import { elementQueryOptions, useDeleteElement, useUpdateElement } from '@/lib/elements';
import { workspaceQueryOptions } from '@/lib/workspaces';

const route = getRouteApi('/app/w/$workspaceId/elementos/$elementId');

/** Ver y editar la ficha de un elemento (HU-03), su estructura (HU-04) y su envío a Proyectos (INT-02) */
export function ElementDetailPage() {
  const { workspaceId, elementId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: element } = useSuspenseQuery(elementQueryOptions(workspaceId, elementId));
  const { data: types } = useSuspenseQuery(elementTypesQueryOptions(workspaceId));
  const { data: catalogs } = useSuspenseQuery(catalogsQueryOptions(workspaceId));
  const update = useUpdateElement(workspaceId, elementId);
  // Solo oculta botones: quien decide es la API
  const canUpdate = roleHasPermission(workspace.role, 'element.update');
  const canDelete = roleHasPermission(workspace.role, 'element.delete');
  const remove = useDeleteElement(workspaceId, elementId);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <Link
          to="/w/$workspaceId/elementos"
          params={{ workspaceId }}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground [&_svg]:size-4"
        >
          <ArrowLeft aria-hidden />
          Elementos
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold break-words">{element.name}</h1>
          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              aria-expanded={confirming}
              onClick={() => setConfirming(!confirming)}
            >
              <Trash2 aria-hidden />
              Quitar elemento
            </Button>
          )}
        </div>
      </div>
      {confirming && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <p className="text-sm">
            ¿Quitar "{element.name}" con toda su estructura? Podrás restaurarlo desde la Papelera.
          </p>
          <Button
            size="sm"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () =>
                  void navigate({ to: '/w/$workspaceId/elementos', params: { workspaceId } }),
              })
            }
          >
            Quitar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
          {remove.error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {remove.error.message}
            </p>
          )}
        </div>
      )}
      <Card>
        <CardContent className="pt-6">
          {/* La clave la vuelve a dibujar al guardar: la API pudo llenar las fechas reales */}
          <ElementForm
            key={element.updatedAt}
            types={types}
            catalogs={catalogs}
            element={element}
            readOnly={!canUpdate}
            pending={update.isPending}
            error={update.error?.message ?? null}
            notice={update.isSuccess ? 'Cambios guardados' : null}
            submitLabel="Guardar cambios"
            onEdit={() => update.reset()}
            onSubmit={(data) => update.mutate(data)}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Estructura</CardTitle>
        </CardHeader>
        <CardContent>
          <ElementStructure
            workspaceId={workspaceId}
            elementId={elementId}
            types={types}
            catalogs={catalogs}
            canUpdate={canUpdate}
          />
        </CardContent>
      </Card>
      <SyncCard workspaceId={workspaceId} elementId={elementId} canUpdate={canUpdate} />
    </div>
  );
}
