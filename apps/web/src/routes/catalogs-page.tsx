import {
  CATALOG_KINDS,
  CATALOG_LABELS,
  catalogItemNameSchema,
  roleHasPermission,
  type CatalogItem,
  type CatalogKind,
} from '@aprendizaje/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { FieldError } from '@/components/field-error';
import { RenameForm } from '@/components/rename-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { catalogsQueryOptions, useCreateCatalogItem, useUpdateCatalogItem } from '@/lib/catalogs';
import { useSchemaForm } from '@/lib/use-schema-form';
import { workspaceQueryOptions } from '@/lib/workspaces';

const route = getRouteApi('/app/w/$workspaceId/catalogos');

const DESCRIPTIONS: Record<CatalogKind, string> = {
  PLATFORM: 'Dónde se toma: Coursera, Udemy, una editorial…',
  SPONSOR: 'Quién lo ofrece o lo paga.',
  CATEGORY: 'El tema al que pertenece.',
  LEVEL: 'Qué tan avanzado es.',
  ACTIVITY_TYPE: 'Qué se hace en cada actividad.',
};

/** Catálogos del espacio (HU-01). Lo que ya no se usa se archiva: nunca se borra */
export function CatalogsPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: items } = useSuspenseQuery(catalogsQueryOptions(workspaceId));
  // Solo oculta botones: quien decide es la API
  const canManage = roleHasPermission(workspace.role, 'catalog.manage');

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">Catálogos</h1>
        <p className="text-sm text-muted-foreground">
          Los valores que se eligen en las fichas, sin duplicados.
        </p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {CATALOG_KINDS.map((kind) => (
          <CatalogCard
            key={kind}
            workspaceId={workspaceId}
            kind={kind}
            items={items.filter((item) => item.kind === kind)}
            canManage={canManage}
          />
        ))}
      </div>
    </div>
  );
}

function CatalogCard({
  workspaceId,
  kind,
  items,
  canManage,
}: {
  workspaceId: string;
  kind: CatalogKind;
  items: CatalogItem[];
  canManage: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{CATALOG_LABELS[kind]}</CardTitle>
        <CardDescription>{DESCRIPTIONS[kind]}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay valores.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {items.map((item) => (
              <CatalogRow
                key={item.id}
                workspaceId={workspaceId}
                item={item}
                canManage={canManage}
              />
            ))}
          </ul>
        )}
        {canManage && <AddItemForm workspaceId={workspaceId} kind={kind} />}
      </CardContent>
    </Card>
  );
}

function AddItemForm({ workspaceId, kind }: { workspaceId: string; kind: CatalogKind }) {
  const create = useCreateCatalogItem(workspaceId);
  const form = useSchemaForm(catalogItemNameSchema, ['name'], ({ name }, formEl) =>
    create.mutate({ kind, name }, { onSuccess: () => formEl.reset() }),
  );

  return (
    <form onSubmit={form.onSubmit} noValidate className="grid gap-2">
      <Label htmlFor={form.idOf('name')}>Agregar a {CATALOG_LABELS[kind].toLowerCase()}</Label>
      <div className="flex gap-2">
        <Input
          {...form.field('name')}
          maxLength={80}
          autoComplete="off"
          // El aviso de "ya existe" era del texto anterior
          onChange={() => create.reset()}
        />
        <Button type="submit" variant="outline" disabled={create.isPending}>
          <Plus aria-hidden />
          Agregar
        </Button>
      </div>
      <FieldError {...form.errorProps('name')} />
      {create.error && (
        <p role="alert" className="text-sm text-destructive">
          {create.error.message}
        </p>
      )}
    </form>
  );
}

function CatalogRow({
  workspaceId,
  item,
  canManage,
}: {
  workspaceId: string;
  item: CatalogItem;
  canManage: boolean;
}) {
  const update = useUpdateCatalogItem(workspaceId);
  const [editing, setEditing] = useState(false);

  return (
    <li className="grid gap-1 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <RenameForm
            name={item.name}
            maxLength={80}
            onRename={(name) =>
              update.mutate({ itemId: item.id, name }, { onSuccess: () => setEditing(false) })
            }
            onCancel={() => {
              update.reset();
              setEditing(false);
            }}
          />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <span className={item.archived ? 'text-sm text-muted-foreground' : 'text-sm'}>
              {item.name}
            </span>
            {item.archived && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                Archivado
              </span>
            )}
          </div>
        )}
        {canManage && !editing && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Renombrar ${item.name}`}
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={update.isPending}
              aria-label={`${item.archived ? 'Reactivar' : 'Archivar'} ${item.name}`}
              title={
                item.archived
                  ? 'Volver a ofrecerlo en las fichas'
                  : 'Deja de ofrecerse; lo que ya lo usa lo conserva'
              }
              onClick={() => update.mutate({ itemId: item.id, archived: !item.archived })}
            >
              {item.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            </Button>
          </div>
        )}
      </div>
      {update.error && (
        <p role="alert" className="text-sm text-destructive">
          {update.error.message}
        </p>
      )}
    </li>
  );
}
