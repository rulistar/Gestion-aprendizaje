import {
  ELEMENT_PRIORITIES,
  ELEMENT_PRIORITY_LABELS,
  ELEMENT_STATUS_LABELS,
  ELEMENT_STATUSES,
  elementPrioritySchema,
  elementStatusSchema,
  filterElements,
  hasActiveFilters,
  roleHasPermission,
  type ElementFilters,
} from '@aprendizaje/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { ProgressBar } from '@/components/progress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { elementTypesQueryOptions } from '@/lib/element-types';
import { elementsQueryOptions } from '@/lib/elements';
import { workspaceQueryOptions } from '@/lib/workspaces';

const route = getRouteApi('/app/w/$workspaceId/elementos');

/** Lista de elementos con su avance y filtros en la URL (HU-05); prioridad (HU-10) */
export function ElementsPage() {
  const { workspaceId } = route.useParams();
  const filters = route.useSearch();
  const navigate = route.useNavigate();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: elements } = useSuspenseQuery(elementsQueryOptions(workspaceId));
  const { data: types } = useSuspenseQuery(elementTypesQueryOptions(workspaceId));
  // Solo oculta botones: quien decide es la API
  const canCreate = roleHasPermission(workspace.role, 'element.create');
  const typeName = (typeId: string) => types.find((type) => type.id === typeId)?.name ?? '';
  const visible = filterElements(elements, filters);
  // Un tipo archivado se ofrece solo si algún elemento lo usa
  const typeOptions = types.filter(
    (type) => !type.archived || elements.some((element) => element.typeId === type.id),
  );

  // replace: cada letra escrita no debe quedar como un paso del botón "Atrás"
  const setFilters = (next: ElementFilters) =>
    void navigate({ search: { ...filters, ...next }, replace: true });

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
        <>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
            <Input
              type="search"
              aria-label="Buscar por nombre"
              placeholder="Buscar por nombre"
              maxLength={100}
              value={filters.q ?? ''}
              onChange={(event) => setFilters({ q: event.target.value || undefined })}
            />
            <Select
              aria-label="Filtrar por tipo"
              value={filters.typeId ?? ''}
              onChange={(event) => setFilters({ typeId: event.target.value || undefined })}
            >
              <option value="">Todos los tipos</option>
              {typeOptions.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filtrar por estado"
              value={filters.status ?? ''}
              onChange={(event) =>
                setFilters({ status: elementStatusSchema.safeParse(event.target.value).data })
              }
            >
              <option value="">Todos los estados</option>
              {ELEMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ELEMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filtrar por prioridad"
              value={filters.priority ?? ''}
              onChange={(event) =>
                setFilters({ priority: elementPrioritySchema.safeParse(event.target.value).data })
              }
            >
              <option value="">Todas las prioridades</option>
              {ELEMENT_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {ELEMENT_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </Select>
            {hasActiveFilters(filters) && (
              <Button variant="ghost" onClick={() => void navigate({ search: {}, replace: true })}>
                Limpiar filtros
              </Button>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ningún elemento coincide con los filtros.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {visible.map((element) => (
                <li key={element.id}>
                  <Link
                    to="/w/$workspaceId/elementos/$elementId"
                    params={{ workspaceId, elementId: element.id }}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <span className="grid min-w-0 gap-0.5">
                      <span className="font-medium">{element.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {typeName(element.typeId)} · {ELEMENT_STATUS_LABELS[element.status]} ·
                        Prioridad {ELEMENT_PRIORITY_LABELS[element.priority].toLowerCase()}
                        {element.totalHours !== null && ` · ${element.totalHours} h`}
                      </span>
                    </span>
                    <ProgressBar progress={element.progress} label={`Avance de ${element.name}`} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
