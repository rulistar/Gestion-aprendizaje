import { ELEMENT_STATUS_LABELS, roleHasPermission } from '@aprendizaje/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { elementTypesQueryOptions } from '@/lib/element-types';
import { elementsQueryOptions } from '@/lib/elements';
import { workspaceQueryOptions } from '@/lib/workspaces';

const route = getRouteApi('/app/w/$workspaceId/elementos');

/** Lista para abrir cada ficha (HU-03). El avance y los filtros llegan con HU-05 */
export function ElementsPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: elements } = useSuspenseQuery(elementsQueryOptions(workspaceId));
  const { data: types } = useSuspenseQuery(elementTypesQueryOptions(workspaceId));
  // Solo oculta botones: quien decide es la API
  const canCreate = roleHasPermission(workspace.role, 'element.create');
  const typeName = (typeId: string) => types.find((type) => type.id === typeId)?.name ?? '';

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Elementos</h1>
          <p className="text-sm text-muted-foreground">Tus cursos, lecturas y otros temas.</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link to="/w/$workspaceId/elementos/nuevo" params={{ workspaceId }}>
              <Plus aria-hidden />
              Nuevo elemento
            </Link>
          </Button>
        )}
      </div>

      {elements.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aún no hay elementos</CardTitle>
            <CardDescription>
              {canCreate
                ? 'Captura el primero con "Nuevo elemento".'
                : 'Aquí verás los que se capturen en este espacio.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {elements.map((element) => (
            <li key={element.id}>
              <Link
                to="/w/$workspaceId/elementos/$elementId"
                params={{ workspaceId, elementId: element.id }}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="min-w-0 font-medium">{element.name}</span>
                <span className="text-sm text-muted-foreground">
                  {typeName(element.typeId)} · {ELEMENT_STATUS_LABELS[element.status]}
                  {element.totalHours !== null && ` · ${element.totalHours} h`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
