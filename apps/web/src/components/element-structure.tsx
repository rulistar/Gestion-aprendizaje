import {
  ACTIVITY_FORM_FIELDS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUSES,
  activityContentFormSchema,
  allowedChildKinds,
  buildNodeTree,
  chapterContentSchema,
  ELEMENT_PRIORITY_LABELS,
  ELEMENT_STATUS_LABELS,
  elementProgress,
  nodeKindLabel,
  nodeProgress,
  type Activity,
  type ActivityContent,
  type CatalogItem,
  type ElementFicha,
  type ElementType,
  type NodeKind,
  type NodeTreeItem,
} from '@aprendizaje/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Eye,
  FolderOpen,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { ElementForm } from '@/components/element-form';
import { FieldError } from '@/components/field-error';
import { ProgressBar } from '@/components/progress-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  nodesQueryOptions,
  useCreateNode,
  useDeleteNode,
  useMoveNode,
  useUpdateNode,
} from '@/lib/element-nodes';
import { useSchemaForm } from '@/lib/use-schema-form';

const KIND_ICONS: Record<NodeKind, LucideIcon> = {
  CHAPTER: FolderOpen,
  COURSE: GraduationCap,
  ACTIVITY: CheckSquare,
};

interface Shared {
  workspaceId: string;
  elementId: string;
  types: ElementType[];
  catalogs: CatalogItem[];
  canUpdate: boolean;
}

/** Lo que el nodo necesita mostrar además de sus datos propios */
function summary(node: NodeTreeItem, catalogs: CatalogItem[]) {
  if (node.kind === 'COURSE') {
    const { status, priority, totalHours } = node.ficha;
    return [
      ELEMENT_STATUS_LABELS[status],
      `Prioridad ${ELEMENT_PRIORITY_LABELS[priority].toLowerCase()}`,
      totalHours !== null && `${totalHours} h`,
    ];
  }
  if (node.kind === 'ACTIVITY') {
    const { activityTypeId, durationMinutes, status } = node.activity;
    return [
      catalogs.find((item) => item.id === activityTypeId)?.name,
      durationMinutes !== null && `${durationMinutes} min`,
      ACTIVITY_STATUS_LABELS[status],
    ];
  }
  return [];
}

/** La estructura de un elemento en hasta 3 niveles (HU-04; reglas en ADR-0002 §2) */
export function ElementStructure(shared: Shared) {
  const { data: nodes } = useSuspenseQuery(nodesQueryOptions(shared.workspaceId, shared.elementId));
  const tree = buildNodeTree(nodes);
  const total = elementProgress(nodes);

  return (
    <div className="grid gap-3">
      {total.total > 0 && <ProgressBar progress={total} label="Avance del elemento" />}
      {tree.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no tiene estructura. Agrega capítulos, cursos o actividades.
        </p>
      ) : (
        <NodeList nodes={tree} shared={shared} />
      )}
      {shared.canUpdate && <AddNode parent={null} shared={shared} />}
    </div>
  );
}

function NodeList({ nodes, shared }: { nodes: NodeTreeItem[]; shared: Shared }) {
  return (
    <ul className="grid gap-1">
      {nodes.map((node, index) => (
        <NodeRow
          key={node.id}
          node={node}
          isFirst={index === 0}
          isLast={index === nodes.length - 1}
          shared={shared}
        />
      ))}
    </ul>
  );
}

function NodeRow({
  node,
  isFirst,
  isLast,
  shared,
}: {
  node: NodeTreeItem;
  isFirst: boolean;
  isLast: boolean;
  shared: Shared;
}) {
  const { workspaceId, elementId, canUpdate } = shared;
  const move = useMoveNode(workspaceId, elementId, node.id);
  const remove = useDeleteNode(workspaceId, elementId, node.id);
  const [panel, setPanel] = useState<'edit' | 'delete' | null>(null);
  const Icon = KIND_ICONS[node.kind];
  const label = nodeKindLabel(node.kind, node.level);
  const details = summary(node, shared.catalogs).filter(Boolean).join(' · ');
  // Un Lector puede abrir lo que tiene más datos de los que caben en el renglón
  const canOpen = canUpdate || node.kind !== 'CHAPTER';
  const error = move.error ?? remove.error;
  // Una actividad ya dice su estado; lo que agrupa muestra el avance de lo que contiene
  const progress = node.kind === 'ACTIVITY' ? null : nodeProgress(node);

  return (
    <li className="grid gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border bg-card px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{node.name}</p>
            <p className="text-xs text-muted-foreground">
              {label}
              {details && ` · ${details}`}
            </p>
            {progress && progress.total > 0 && (
              <ProgressBar progress={progress} label={`Avance de ${node.name}`} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {canUpdate && (
            <>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Subir ${node.name}`}
                disabled={isFirst || move.isPending}
                onClick={() => move.mutate({ direction: 'up' })}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Bajar ${node.name}`}
                disabled={isLast || move.isPending}
                onClick={() => move.mutate({ direction: 'down' })}
              >
                <ArrowDown aria-hidden />
              </Button>
            </>
          )}
          {canOpen && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`${canUpdate ? 'Editar' : 'Ver'} ${node.name}`}
              aria-expanded={panel === 'edit'}
              onClick={() => setPanel(panel === 'edit' ? null : 'edit')}
            >
              {canUpdate ? <Pencil aria-hidden /> : <Eye aria-hidden />}
            </Button>
          )}
          {canUpdate && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Quitar ${node.name}`}
              aria-expanded={panel === 'delete'}
              onClick={() => setPanel(panel === 'delete' ? null : 'delete')}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}

      {panel === 'delete' && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <p className="text-sm">
            ¿Quitar "{node.name}"{node.children.length > 0 && ' y todo lo que contiene'}? Podrás
            restaurarlo desde la Papelera.
          </p>
          <Button
            size="sm"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Quitar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>
            Cancelar
          </Button>
        </div>
      )}

      {panel === 'edit' && (
        <div className="rounded-md border bg-muted/30 p-3">
          <EditNode node={node} shared={shared} onClose={() => setPanel(null)} />
        </div>
      )}

      {(node.children.length > 0 || (canUpdate && allowedChildKinds(node).length > 0)) && (
        <div className="grid gap-2 border-l-2 pl-3 sm:ml-2 sm:pl-4">
          {node.children.length > 0 && <NodeList nodes={node.children} shared={shared} />}
          {canUpdate && allowedChildKinds(node).length > 0 && (
            <AddNode parent={node} shared={shared} />
          )}
        </div>
      )}
    </li>
  );
}

/** Los botones para agregar lo que cabe en este lugar, y el formulario de la clase elegida */
function AddNode({ parent, shared }: { parent: NodeTreeItem | null; shared: Shared }) {
  const { workspaceId, elementId, types, catalogs } = shared;
  const create = useCreateNode(workspaceId, elementId);
  const [kind, setKind] = useState<NodeKind | null>(null);
  const level = (parent?.level ?? 0) + 1;
  const parentId = parent?.id ?? null;
  const close = () => {
    create.reset();
    setKind(null);
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {allowedChildKinds(parent).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={kind === option ? 'secondary' : 'outline'}
            aria-expanded={kind === option}
            onClick={() => {
              create.reset();
              setKind(kind === option ? null : option);
            }}
          >
            <Plus aria-hidden />
            {nodeKindLabel(option, level)}
          </Button>
        ))}
      </div>
      {kind && (
        <div className="rounded-md border bg-muted/30 p-3">
          {kind === 'CHAPTER' && (
            <ChapterForm
              initialName=""
              submitLabel="Agregar"
              pending={create.isPending}
              error={create.error?.message ?? null}
              onEdit={() => create.reset()}
              onCancel={close}
              onSubmit={(content) =>
                create.mutate({ kind, parentId, content }, { onSuccess: close })
              }
            />
          )}
          {kind === 'COURSE' && (
            <ElementForm
              types={types}
              catalogs={catalogs}
              element={null}
              pending={create.isPending}
              error={create.error?.message ?? null}
              submitLabel="Agregar curso"
              onEdit={() => create.reset()}
              onSubmit={(content: ElementFicha) =>
                create.mutate({ kind, parentId, content }, { onSuccess: close })
              }
            />
          )}
          {kind === 'ACTIVITY' && (
            <ActivityForm
              activity={null}
              catalogs={catalogs}
              readOnly={false}
              submitLabel="Agregar actividad"
              pending={create.isPending}
              error={create.error?.message ?? null}
              onEdit={() => create.reset()}
              onCancel={close}
              onSubmit={(content) =>
                create.mutate({ kind, parentId, content }, { onSuccess: close })
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

function EditNode({
  node,
  shared,
  onClose,
}: {
  node: NodeTreeItem;
  shared: Shared;
  onClose: () => void;
}) {
  const { workspaceId, elementId, types, catalogs, canUpdate } = shared;
  const update = useUpdateNode(workspaceId, elementId, node.id);
  const common = {
    pending: update.isPending,
    error: update.error?.message ?? null,
    onEdit: () => update.reset(),
  };

  if (node.kind === 'CHAPTER') {
    return (
      <ChapterForm
        {...common}
        initialName={node.name}
        submitLabel="Guardar"
        onCancel={onClose}
        onSubmit={(content) => update.mutate({ kind: 'CHAPTER', content }, { onSuccess: onClose })}
      />
    );
  }
  if (node.kind === 'COURSE') {
    return (
      <ElementForm
        {...common}
        types={types}
        catalogs={catalogs}
        element={node.ficha}
        readOnly={!canUpdate}
        submitLabel="Guardar curso"
        onSubmit={(content: ElementFicha) =>
          update.mutate({ kind: 'COURSE', content }, { onSuccess: onClose })
        }
      />
    );
  }
  return (
    <ActivityForm
      {...common}
      activity={node.activity}
      catalogs={catalogs}
      readOnly={!canUpdate}
      submitLabel="Guardar actividad"
      onCancel={onClose}
      onSubmit={(content) => update.mutate({ kind: 'ACTIVITY', content }, { onSuccess: onClose })}
    />
  );
}

function FormActions({
  submitLabel,
  pending,
  onCancel,
}: {
  submitLabel: string;
  pending: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button type="submit" size="sm" disabled={pending}>
        {submitLabel}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        <X aria-hidden />
        Cancelar
      </Button>
    </div>
  );
}

function ChapterForm({
  initialName,
  submitLabel,
  pending,
  error,
  onEdit,
  onCancel,
  onSubmit,
}: {
  initialName: string;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (content: { name: string }) => void;
}) {
  const form = useSchemaForm(chapterContentSchema, ['name'], (content) => onSubmit(content));

  return (
    <form onSubmit={form.onSubmit} onChange={onEdit} noValidate className="grid max-w-md gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={form.idOf('name')}>Nombre</Label>
        <Input
          {...form.field('name')}
          defaultValue={initialName}
          maxLength={200}
          autoComplete="off"
          autoFocus
        />
        <FieldError {...form.errorProps('name')} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <FormActions submitLabel={submitLabel} pending={pending} onCancel={onCancel} />
    </form>
  );
}

function ActivityForm({
  activity,
  catalogs,
  readOnly,
  submitLabel,
  pending,
  error,
  onEdit,
  onCancel,
  onSubmit,
}: {
  activity: Activity | null;
  catalogs: CatalogItem[];
  readOnly: boolean;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (content: ActivityContent) => void;
}) {
  const form = useSchemaForm(activityContentFormSchema, ACTIVITY_FORM_FIELDS, (content) =>
    onSubmit(content),
  );
  // Lo archivado ya no se ofrece, salvo el valor que esta actividad ya usa
  const typeOptions = catalogs.filter(
    (item) =>
      item.kind === 'ACTIVITY_TYPE' && (!item.archived || item.id === activity?.activityTypeId),
  );

  function dateField(
    field: 'estimatedStart' | 'estimatedEnd' | 'actualStart' | 'actualEnd',
    label: string,
  ) {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={form.idOf(field)}>{label}</Label>
        <Input {...form.field(field)} type="date" defaultValue={activity?.[field] ?? ''} />
        <FieldError {...form.errorProps(field)} />
      </div>
    );
  }

  return (
    <form onSubmit={form.onSubmit} onChange={onEdit} noValidate>
      <fieldset disabled={readOnly} className="grid gap-3">
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-4">
            <Label htmlFor={form.idOf('name')}>Nombre</Label>
            <Input
              {...form.field('name')}
              defaultValue={activity?.name ?? ''}
              maxLength={200}
              autoComplete="off"
              autoFocus={!readOnly}
            />
            <FieldError {...form.errorProps('name')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={form.idOf('activityTypeId')}>Tipo de actividad</Label>
            <Select {...form.field('activityTypeId')} defaultValue={activity?.activityTypeId ?? ''}>
              <option value="">Sin definir</option>
              {typeOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.archived ? ' (archivado)' : ''}
                </option>
              ))}
            </Select>
            <FieldError {...form.errorProps('activityTypeId')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={form.idOf('durationMinutes')}>Duración en minutos</Label>
            <Input
              {...form.field('durationMinutes')}
              type="number"
              min="1"
              step="1"
              defaultValue={activity?.durationMinutes ?? ''}
            />
            <FieldError {...form.errorProps('durationMinutes')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={form.idOf('status')}>Estado</Label>
            <Select {...form.field('status')} defaultValue={activity?.status ?? 'PENDING'}>
              {ACTIVITY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ACTIVITY_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
            <FieldError {...form.errorProps('status')} />
          </div>
          <div className="hidden lg:block" />
          {dateField('estimatedStart', 'Inicio estimado')}
          {dateField('estimatedEnd', 'Fin estimado')}
          {dateField('actualStart', 'Inicio real')}
          {dateField('actualEnd', 'Fin real')}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!readOnly && (
          <FormActions submitLabel={submitLabel} pending={pending} onCancel={onCancel} />
        )}
      </fieldset>
    </form>
  );
}
