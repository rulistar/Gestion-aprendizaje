import {
  createElementTypeSchema,
  DEFAULT_FIELD_LABELS,
  ELEMENT_FIELDS,
  fieldLabelsFormSchema,
  HIDEABLE_FIELDS,
  roleHasPermission,
  type ElementField,
  type ElementType,
} from '@aprendizaje/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Archive, ArchiveRestore, Eye, Pencil, Plus, Tags } from 'lucide-react';
import { useState } from 'react';
import { FieldError } from '@/components/field-error';
import { RenameForm } from '@/components/rename-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  elementTypesQueryOptions,
  useCreateElementType,
  useUpdateElementType,
} from '@/lib/element-types';
import { useSchemaForm } from '@/lib/use-schema-form';
import { workspaceQueryOptions } from '@/lib/workspaces';

const route = getRouteApi('/app/w/$workspaceId/tipos');

/** Tipos de elemento y el nombre de cada campo en su ficha (HU-02) */
export function ElementTypesPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: types } = useSuspenseQuery(elementTypesQueryOptions(workspaceId));
  // Solo oculta botones: quien decide es la API
  const canManage = roleHasPermission(workspace.role, 'catalog.manage');
  const activeCount = types.filter((type) => !type.archived).length;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">Tipos de elemento</h1>
        <p className="text-sm text-muted-foreground">
          Cada tipo puede llamar a los campos de la ficha con sus propias palabras y ocultar los que
          no usa. Solo cambia cómo se ve: las reglas del campo siguen siendo las mismas.
        </p>
      </div>
      {canManage && <AddTypeForm workspaceId={workspaceId} />}
      <div className="grid gap-4">
        {types.map((type) => (
          <TypeCard
            key={type.id}
            workspaceId={workspaceId}
            type={type}
            canManage={canManage}
            isLastActive={!type.archived && activeCount === 1}
          />
        ))}
      </div>
    </div>
  );
}

function AddTypeForm({ workspaceId }: { workspaceId: string }) {
  const create = useCreateElementType(workspaceId);
  const form = useSchemaForm(createElementTypeSchema, ['name'], (data, formEl) =>
    create.mutate(data, { onSuccess: () => formEl.reset() }),
  );

  return (
    <form onSubmit={form.onSubmit} noValidate className="grid max-w-md gap-2">
      <Label htmlFor={form.idOf('name')}>Agregar un tipo</Label>
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

function TypeCard({
  workspaceId,
  type,
  canManage,
  isLastActive,
}: {
  workspaceId: string;
  type: ElementType;
  canManage: boolean;
  isLastActive: boolean;
}) {
  const update = useUpdateElementType(workspaceId);
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState<'labels' | 'fields' | null>(null);
  const toggle = (what: 'labels' | 'fields') => setEditing((open) => (open === what ? null : what));
  const own = ELEMENT_FIELDS.filter((field) => type.labels[field] !== undefined);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {renaming ? (
            <RenameForm
              name={type.name}
              maxLength={80}
              onRename={(name) =>
                update.mutate({ typeId: type.id, name }, { onSuccess: () => setRenaming(false) })
              }
              onCancel={() => {
                update.reset();
                setRenaming(false);
              }}
            />
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <CardTitle className={type.archived ? 'text-muted-foreground' : undefined}>
                {type.name}
              </CardTitle>
              {type.archived && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                  Archivado
                </span>
              )}
            </div>
          )}
          {canManage && !renaming && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={editing === 'labels'}
                onClick={() => toggle('labels')}
              >
                <Tags aria-hidden />
                Etiquetas
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={editing === 'fields'}
                onClick={() => toggle('fields')}
              >
                <Eye aria-hidden />
                Campos
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Renombrar ${type.name}`}
                onClick={() => setRenaming(true)}
              >
                <Pencil aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={update.isPending || isLastActive}
                aria-label={`${type.archived ? 'Reactivar' : 'Archivar'} ${type.name}`}
                title={
                  isLastActive
                    ? 'Debe quedar al menos un tipo activo'
                    : type.archived
                      ? 'Volver a ofrecerlo en las fichas'
                      : 'Deja de ofrecerse; lo que ya lo usa lo conserva'
                }
                onClick={() => update.mutate({ typeId: type.id, archived: !type.archived })}
              >
                {type.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              </Button>
            </div>
          )}
        </div>
        <CardDescription>
          {own.length === 0
            ? 'Usa los nombres por omisión.'
            : own
                .map((field) => `${DEFAULT_FIELD_LABELS[field]} → ${type.labels[field]}`)
                .join(' · ')}
        </CardDescription>
        <CardDescription>
          {type.hiddenFields.length === 0
            ? 'Muestra todos los campos.'
            : `Oculta: ${type.hiddenFields.map((field) => DEFAULT_FIELD_LABELS[field]).join(', ')}.`}
        </CardDescription>
        {update.error && (
          <p role="alert" className="text-sm text-destructive">
            {update.error.message}
          </p>
        )}
      </CardHeader>
      {editing === 'labels' && (
        <CardContent>
          <LabelsForm workspaceId={workspaceId} type={type} onClose={() => setEditing(null)} />
        </CardContent>
      )}
      {editing === 'fields' && (
        <CardContent>
          <FieldsForm workspaceId={workspaceId} type={type} onClose={() => setEditing(null)} />
        </CardContent>
      )}
    </Card>
  );
}

function LabelsForm({
  workspaceId,
  type,
  onClose,
}: {
  workspaceId: string;
  type: ElementType;
  onClose: () => void;
}) {
  const update = useUpdateElementType(workspaceId);
  const form = useSchemaForm(fieldLabelsFormSchema, ELEMENT_FIELDS, (labels) =>
    update.mutate({ typeId: type.id, labels }, { onSuccess: onClose }),
  );

  return (
    <form onSubmit={form.onSubmit} noValidate className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Deja un campo en blanco para usar su nombre por omisión.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ELEMENT_FIELDS.map((field: ElementField) => (
          <div key={field} className="grid content-start gap-1.5">
            <Label htmlFor={form.idOf(field)}>{DEFAULT_FIELD_LABELS[field]}</Label>
            <Input
              {...form.field(field)}
              defaultValue={type.labels[field] ?? ''}
              placeholder={DEFAULT_FIELD_LABELS[field]}
              maxLength={60}
              autoComplete="off"
            />
            <FieldError {...form.errorProps(field)} />
          </div>
        ))}
      </div>
      {update.error && (
        <p role="alert" className="text-sm text-destructive">
          {update.error.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={update.isPending}>
          Guardar etiquetas
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Qué campos muestra la ficha de este tipo (HU-12). Nombre, estado y prioridad, siempre */
function FieldsForm({
  workspaceId,
  type,
  onClose,
}: {
  workspaceId: string;
  type: ElementType;
  onClose: () => void;
}) {
  const update = useUpdateElementType(workspaceId);
  const [hidden, setHidden] = useState<ElementField[]>(type.hiddenFields);
  const labels = { ...DEFAULT_FIELD_LABELS, ...type.labels };

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate({ typeId: type.id, hiddenFields: hidden }, { onSuccess: onClose });
      }}
    >
      <p className="text-sm text-muted-foreground">
        Marca los campos que muestra su ficha. Ocultar uno no borra lo que ya tenga capturado.
        Nombre, estado y prioridad se muestran siempre.
      </p>
      <fieldset className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">Campos que muestra {type.name}</legend>
        {HIDEABLE_FIELDS.map((field) => (
          <label key={field} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={!hidden.includes(field)}
              onChange={(event) =>
                setHidden((current) =>
                  event.target.checked
                    ? current.filter((item) => item !== field)
                    : [...current, field],
                )
              }
            />
            {labels[field]}
          </label>
        ))}
      </fieldset>
      {update.error && (
        <p role="alert" className="text-sm text-destructive">
          {update.error.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={update.isPending}>
          Guardar campos
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
