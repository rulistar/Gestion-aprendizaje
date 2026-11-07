import { roleHasPermission } from '@aprendizaje/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { ElementForm } from '@/components/element-form';
import { Card, CardContent } from '@/components/ui/card';
import { catalogsQueryOptions } from '@/lib/catalogs';
import { elementTypesQueryOptions } from '@/lib/element-types';
import { useCreateElement } from '@/lib/elements';
import { workspaceQueryOptions } from '@/lib/workspaces';

const route = getRouteApi('/app/w/$workspaceId/elementos/nuevo');

/** Capturar un elemento nuevo; al guardarlo se abre su ficha (HU-03) */
export function ElementNewPage() {
  const { workspaceId } = route.useParams();
  const navigate = route.useNavigate();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: types } = useSuspenseQuery(elementTypesQueryOptions(workspaceId));
  const { data: catalogs } = useSuspenseQuery(catalogsQueryOptions(workspaceId));
  const create = useCreateElement(workspaceId);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Nuevo elemento</h1>
      <Card>
        <CardContent className="pt-6">
          {roleHasPermission(workspace.role, 'element.create') ? (
            <ElementForm
              types={types}
              catalogs={catalogs}
              element={null}
              pending={create.isPending}
              error={create.error?.message ?? null}
              submitLabel="Crear elemento"
              onEdit={() => create.reset()}
              onSubmit={(data) =>
                create.mutate(data, {
                  onSuccess: (element) =>
                    void navigate({
                      to: '/w/$workspaceId/elementos/$elementId',
                      params: { workspaceId, elementId: element.id },
                    }),
                })
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu rol en este espacio no permite crear elementos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
