import {
  computeTotalHours,
  DEFAULT_DAYS_PER_WEEK,
  ELEMENT_FORM_FIELDS,
  ELEMENT_STATUS_LABELS,
  ELEMENT_STATUSES,
  elementFichaFormSchema,
  resolveFieldLabels,
  type CatalogItem,
  type CatalogKind,
  type Element,
  type ElementFicha,
  type ElementType,
} from '@aprendizaje/shared';
import { useState, type ReactNode } from 'react';
import { FieldError } from '@/components/field-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSchemaForm } from '@/lib/use-schema-form';

/** Lo archivado ya no se ofrece, salvo el valor que este elemento ya usa */
function selectable<T extends { id: string; archived: boolean }>(
  items: T[],
  currentId?: string | null,
) {
  return items.filter((item) => !item.archived || item.id === currentId);
}

/** Texto de un campo numérico a número; null si no se puede calcular con él */
function toNumber(text: string) {
  const value = Number(text);
  return text.trim() === '' || Number.isNaN(value) ? null : value;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-semibold">{title}</legend>
      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

/**
 * La ficha de un elemento (HU-03). Los nombres de los campos son los del tipo elegido, y cambian
 * al elegir otro tipo; las reglas son las mismas para todos (ADR-0002 §3).
 */
export function ElementForm({
  types,
  catalogs,
  element,
  readOnly = false,
  pending,
  error,
  notice,
  submitLabel,
  onSubmit,
  onEdit,
}: {
  types: ElementType[];
  catalogs: CatalogItem[];
  element: Element | null;
  readOnly?: boolean;
  pending: boolean;
  error: string | null;
  notice?: string | null;
  submitLabel: string;
  onSubmit: (data: ElementFicha) => void;
  /** Al cambiar algo: los avisos del último envío ya no aplican */
  onEdit: () => void;
}) {
  const typeOptions = selectable(types, element?.typeId);
  const [typeId, setTypeId] = useState(element?.typeId ?? typeOptions[0]?.id ?? '');
  const [weeks, setWeeks] = useState(element?.durationWeeks?.toString() ?? '');
  const [days, setDays] = useState(String(element?.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK));
  const [hours, setHours] = useState(element?.hoursPerDay?.toString() ?? '');

  const form = useSchemaForm(elementFichaFormSchema, ELEMENT_FORM_FIELDS, (data) => onSubmit(data));
  const labels = resolveFieldLabels(types.find((type) => type.id === typeId)?.labels ?? {});

  const calculated = computeTotalHours({
    durationWeeks: toNumber(weeks),
    daysPerWeek: toNumber(days) ?? DEFAULT_DAYS_PER_WEEK,
    hoursPerDay: toNumber(hours),
    manualTotalHours: null,
  });

  function catalogField(
    field: 'platformId' | 'sponsorId' | 'categoryId' | 'levelId',
    kind: CatalogKind,
    label: string,
  ) {
    const options = selectable(
      catalogs.filter((item) => item.kind === kind),
      element?.[field],
    );
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={form.idOf(field)}>{label}</Label>
        <Select {...form.field(field)} defaultValue={element?.[field] ?? ''}>
          <option value="">Sin definir</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.archived ? ' (archivado)' : ''}
            </option>
          ))}
        </Select>
        <FieldError {...form.errorProps(field)} />
      </div>
    );
  }

  function dateField(
    field: 'estimatedStart' | 'estimatedEnd' | 'actualStart' | 'actualEnd',
    label: string,
  ) {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={form.idOf(field)}>{label}</Label>
        <Input {...form.field(field)} type="date" defaultValue={element?.[field] ?? ''} />
        <FieldError {...form.errorProps(field)} />
      </div>
    );
  }

  return (
    <form onSubmit={form.onSubmit} onChange={onEdit} noValidate>
      {/* Un Lector ve la ficha, pero no la cambia; quien decide de verdad es la API */}
      <fieldset disabled={readOnly} className="grid gap-6">
        <Section title="Datos generales">
          <div className="grid gap-1.5">
            <Label htmlFor={form.idOf('typeId')}>Tipo de elemento</Label>
            <Select
              {...form.field('typeId')}
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
            >
              {typeOptions.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                  {type.archived ? ' (archivado)' : ''}
                </option>
              ))}
            </Select>
            <FieldError {...form.errorProps('typeId')} />
          </div>
          <div className="grid gap-1.5 lg:col-span-2">
            <Label htmlFor={form.idOf('name')}>{labels.name}</Label>
            <Input
              {...form.field('name')}
              defaultValue={element?.name ?? ''}
              maxLength={200}
              autoComplete="off"
            />
            <FieldError {...form.errorProps('name')} />
          </div>
          {catalogField('platformId', 'PLATFORM', labels.platform)}
          {catalogField('sponsorId', 'SPONSOR', labels.sponsor)}
          {catalogField('categoryId', 'CATEGORY', labels.category)}
          {catalogField('levelId', 'LEVEL', labels.level)}
          <div className="grid gap-1.5">
            <Label htmlFor={form.idOf('status')}>{labels.status}</Label>
            <Select {...form.field('status')} defaultValue={element?.status ?? 'NOT_STARTED'}>
              {ELEMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ELEMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
            <FieldError {...form.errorProps('status')} />
          </div>
        </Section>

        <Section title="Duración">
          <div className="grid gap-1.5">
            <Label htmlFor={form.idOf('durationWeeks')}>{labels.durationWeeks}</Label>
            <Input
              {...form.field('durationWeeks')}
              type="number"
              min="0"
              step="any"
              value={weeks}
              onChange={(event) => setWeeks(event.target.value)}
            />
            <FieldError {...form.errorProps('durationWeeks')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={form.idOf('daysPerWeek')}>{labels.daysPerWeek}</Label>
            <Input
              {...form.field('daysPerWeek')}
              type="number"
              min="1"
              max="7"
              step="1"
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
            <FieldError {...form.errorProps('daysPerWeek')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={form.idOf('hoursPerDay')}>{labels.hoursPerDay}</Label>
            <Input
              {...form.field('hoursPerDay')}
              type="number"
              min="0"
              step="any"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
            <FieldError {...form.errorProps('hoursPerDay')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={form.idOf('manualTotalHours')}>{labels.totalHours}</Label>
            <Input
              {...form.field('manualTotalHours')}
              type="number"
              min="0"
              step="any"
              defaultValue={element?.manualTotalHours ?? ''}
              placeholder={calculated === null ? '' : String(calculated)}
            />
            <p className="text-xs text-muted-foreground">
              {calculated === null
                ? 'Se calculan al llenar la duración, o captúralas aquí.'
                : `Calculadas: ${calculated} h. Si capturas otro valor, manda el tuyo.`}
            </p>
            <FieldError {...form.errorProps('manualTotalHours')} />
          </div>
        </Section>

        <Section title="Fechas">
          {dateField('estimatedStart', labels.estimatedStart)}
          {dateField('estimatedEnd', labels.estimatedEnd)}
          <p className="self-center text-xs text-muted-foreground sm:col-span-2 lg:col-span-1">
            Las fechas reales se llenan solas al pasar a En curso y a Terminado. Puedes corregirlas.
          </p>
          {dateField('actualStart', labels.actualStart)}
          {dateField('actualEnd', labels.actualEnd)}
        </Section>

        <div className="grid gap-1.5">
          <Label htmlFor={form.idOf('notes')}>{labels.notes}</Label>
          <Textarea {...form.field('notes')} defaultValue={element?.notes ?? ''} maxLength={5000} />
          <FieldError {...form.errorProps('notes')} />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!readOnly && (
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {submitLabel}
            </Button>
            {notice && (
              <p role="status" className="text-sm text-muted-foreground">
                {notice}
              </p>
            )}
          </div>
        )}
      </fieldset>
    </form>
  );
}
