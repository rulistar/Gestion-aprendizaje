import { roleHasPermission } from '@aprendizaje/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { ElementForm } from '@/components/element-form';
import { Card, CardContent } from '@/components/ui/card';
import { catalogsQueryOptions } from '@/lib/catalogs';
import { elementTypesQueryOptions } from '@/lib/element-types';
import { elementQueryOptions, useUpdateElement } from '@/lib/elements';
import { workspaceQueryOptions } from '@/lib/workspaces';

const route = getRouteApi('/app/w/$workspaceId/elementos/$elementId');

/** Ver y editar la ficha de un elemento (HU-03) */
export function ElementDetailPage() {
  const { workspaceId, elementId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: element } = useSuspenseQuery(elementQueryOptions(workspaceId, elementId));
  const { data: types } = useSuspenseQuery(elementTypesQueryOptions(workspaceId));
  const { data: catalogs } = useSuspenseQuery(catalogsQueryOptions(workspaceId));
  const update = useUpdateElement(workspaceId, elementId);
  // Solo oculta botones: quien decide es la API
  const canUpdate = roleHasPermission(workspace.role, 'element.update');

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
        <h1 className="text-2xl font-bold">{element.name}</h1>
      </div>
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
    </div>
  );
}
