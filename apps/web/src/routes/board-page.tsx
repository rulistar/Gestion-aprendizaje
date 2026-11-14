import {
  BOARD_COLUMNS,
  ELEMENT_PRIORITY_LABELS,
  ELEMENT_STATUS_LABELS,
  elementStatusSchema,
  elementsByEndMonth,
  groupByStatus,
  roleHasPermission,
  statusTotals,
  type ElementListItem,
  type ElementStatus,
} from '@aprendizaje/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { ChartColumn } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { EndMonthChart, StatusLegend, StatusTotalsChart } from '@/components/board-charts';
import { ProgressBar } from '@/components/progress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { elementTypesQueryOptions } from '@/lib/element-types';
import { elementsQueryOptions, useMoveElement } from '@/lib/elements';
import { STATUS_STYLES } from '@/lib/status-colors';
import { workspaceQueryOptions } from '@/lib/workspaces';

const route = getRouteApi('/app/w/$workspaceId/tablero');

/**
 * Tablero por estado y gráficas (HU-08). Una columna por estado; arrastrar una tarjeta a otra
 * columna cambia el estado (en pantallas táctiles, el selector de la tarjeta). Solo lo cambia quien
 * puede editar: lo oculta la web y lo decide la API.
 */
export function BoardPage() {
  const { workspaceId } = route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  const { data: elements } = useSuspenseQuery(elementsQueryOptions(workspaceId));
  const { data: types } = useSuspenseQuery(elementTypesQueryOptions(workspaceId));
  const canEdit = roleHasPermission(workspace.role, 'element.update');
  const move = useMoveElement(workspaceId);
  const [showCharts, setShowCharts] = useState(true);
  const [dragOver, setDragOver] = useState<ElementStatus | null>(null);

  const groups = groupByStatus(elements);
  const typeName = (typeId: string) => types.find((type) => type.id === typeId)?.name ?? '';

  function moveTo(element: ElementListItem, status: ElementStatus) {
    if (canEdit && element.status !== status) move.mutate({ element, status });
  }

  function handleDrop(event: DragEvent, status: ElementStatus) {
    event.preventDefault();
    setDragOver(null);
    const element = elements.find((item) => item.id === event.dataTransfer.getData('text/plain'));
    if (element) moveTo(element, status);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tablero</h1>
          <p className="text-sm text-muted-foreground">
            Tus elementos por estado.{' '}
            {canEdit && 'Arrastra una tarjeta a otra columna para cambiar su estado.'}
          </p>
        </div>
        <Button
          variant="outline"
          aria-pressed={showCharts}
          onClick={() => setShowCharts((current) => !current)}
        >
          <ChartColumn aria-hidden />
          {showCharts ? 'Ocultar gráficas' : 'Ver gráficas'}
        </Button>
      </div>

      {move.isError && (
        <p role="alert" className="text-sm text-destructive">
          {move.error.message}
        </p>
      )}

      {showCharts && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Por mes de término</CardTitle>
              <CardDescription>
                Usa el fin real y, si aún no hay, el estimado. Cada barra se divide por estado.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <EndMonthChart {...elementsByEndMonth(elements)} />
              <StatusLegend />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Por estado</CardTitle>
              <CardDescription>
                {elements.length === 1 ? '1 elemento en total' : `${elements.length} elementos`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StatusTotalsChart totals={statusTotals(elements)} />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {BOARD_COLUMNS.map((status) => (
          <section
            key={status}
            aria-label={ELEMENT_STATUS_LABELS[status]}
            onDragOver={(event) => {
              if (!canEdit) return;
              event.preventDefault();
              setDragOver(status);
            }}
            onDragLeave={() => setDragOver((current) => (current === status ? null : current))}
            onDrop={(event) => handleDrop(event, status)}
            className={`grid content-start gap-2 rounded-lg border bg-muted/30 p-2.5 transition-colors ${
              dragOver === status ? 'border-primary bg-accent' : ''
            }`}
          >
            <h2 className="flex items-center gap-2 px-1 text-sm font-semibold">
              <span aria-hidden className={`size-2.5 rounded-full ${STATUS_STYLES[status].dot}`} />
              {ELEMENT_STATUS_LABELS[status]}
              <span className="font-normal text-muted-foreground">{groups[status].length}</span>
            </h2>
            {groups[status].length === 0 && (
              <p className="px-1 py-2 text-xs text-muted-foreground">Nada aquí.</p>
            )}
            {groups[status].map((element) => (
              <article
                key={element.id}
                draggable={canEdit}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', element.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDragOver(null)}
                className={`grid gap-2 rounded-lg border bg-card p-3 ${
                  canEdit ? 'cursor-grab active:cursor-grabbing' : ''
                }`}
              >
                <Link
                  to="/w/$workspaceId/elementos/$elementId"
                  params={{ workspaceId, elementId: element.id }}
                  className="font-medium hover:underline"
                >
                  {element.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {typeName(element.typeId)} · Prioridad{' '}
                  {ELEMENT_PRIORITY_LABELS[element.priority].toLowerCase()}
                  {(element.actualEnd ?? element.estimatedEnd) &&
                    ` · Fin ${element.actualEnd ?? element.estimatedEnd}`}
                </p>
                <ProgressBar progress={element.progress} label={`Avance de ${element.name}`} />
                {canEdit && (
                  <Select
                    aria-label={`Cambiar el estado de ${element.name}`}
                    value={element.status}
                    onChange={(event) => {
                      const next = elementStatusSchema.safeParse(event.target.value);
                      if (next.success) moveTo(element, next.data);
                    }}
                  >
                    {BOARD_COLUMNS.map((option) => (
                      <option key={option} value={option}>
                        {ELEMENT_STATUS_LABELS[option]}
                      </option>
                    ))}
                  </Select>
                )}
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
