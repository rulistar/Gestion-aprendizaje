import { z } from 'zod';
import { progressSchema } from './progress.js';

/** Estados de la ficha: los mismos de los proyectos en Gestor de Proyectos, para sincronizarlos */
export const ELEMENT_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'PAUSED',
  'CANCELLED',
  'DONE',
] as const;
export const elementStatusSchema = z.enum(ELEMENT_STATUSES);
export type ElementStatus = z.infer<typeof elementStatusSchema>;

export const ELEMENT_STATUS_LABELS: Record<ElementStatus, string> = {
  NOT_STARTED: 'No iniciado',
  IN_PROGRESS: 'En curso',
  PAUSED: 'Pausado',
  CANCELLED: 'Cancelado',
  DONE: 'Terminado',
};

/** Prioridad (HU-10): los mismos valores que la de los proyectos en Gestor de Proyectos */
export const ELEMENT_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export const elementPrioritySchema = z.enum(ELEMENT_PRIORITIES);
export type ElementPriority = z.infer<typeof elementPrioritySchema>;

export const ELEMENT_PRIORITY_LABELS: Record<ElementPriority, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

export const DEFAULT_DAYS_PER_WEEK = 5;

const catalogRef = z.uuid('Valor no válido').nullable().default(null);
const isoDate = z.iso.date('Fecha no válida');
const optionalDate = isoDate.nullable().default(null);

function positiveNumber(max: number) {
  return z
    .number({ error: 'Escribe un número' })
    .positive('Debe ser mayor que 0')
    .max(max, `Máximo ${max}`)
    .nullable()
    .default(null);
}

/** En la ficha y en las actividades, un fin no puede ser anterior a su inicio */
export function checkDateOrder(
  dates: {
    estimatedStart: string | null;
    estimatedEnd: string | null;
    actualStart: string | null;
    actualEnd: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (dates.estimatedStart && dates.estimatedEnd && dates.estimatedEnd < dates.estimatedStart) {
    ctx.addIssue({
      code: 'custom',
      path: ['estimatedEnd'],
      message: 'El fin no puede ser anterior al inicio',
    });
  }
  if (dates.actualStart && dates.actualEnd && dates.actualEnd < dates.actualStart) {
    ctx.addIssue({
      code: 'custom',
      path: ['actualEnd'],
      message: 'El fin no puede ser anterior al inicio',
    });
  }
}

/**
 * La ficha (ADR-0002 §1): una sola definición para el Elemento y, en HU-04, para los nodos Curso.
 * Las reglas no dependen del tipo de elemento; este solo cambia el nombre visible de cada campo.
 */
export const elementFichaSchema = z
  .object({
    typeId: z.uuid('Elige un tipo'),
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(200, 'Máximo 200 caracteres'),
    platformId: catalogRef,
    sponsorId: catalogRef,
    categoryId: catalogRef,
    levelId: catalogRef,
    authorId: catalogRef,
    genreId: catalogRef,
    pages: z
      .number({ error: 'Escribe un número' })
      .int('Debe ser un número entero')
      .positive('Debe ser mayor que 0')
      .max(100000, 'Máximo 100000')
      .nullable()
      .default(null),
    durationWeeks: positiveNumber(520),
    daysPerWeek: z
      .number({ error: 'Escribe un número' })
      .int('Debe ser un número entero')
      .min(1, 'Mínimo 1')
      .max(7, 'Máximo 7')
      .default(DEFAULT_DAYS_PER_WEEK),
    hoursPerDay: positiveNumber(24),
    /** Horas capturadas a mano: si hay, mandan sobre las calculadas */
    manualTotalHours: z
      .number({ error: 'Escribe un número' })
      .min(0, 'No puede ser negativo')
      .max(100000, 'Máximo 100000')
      .nullable()
      .default(null),
    /** Horas que de verdad llevó (HU-11), para compararlas con las estimadas */
    actualHours: z
      .number({ error: 'Escribe un número' })
      .min(0, 'No puede ser negativo')
      .max(100000, 'Máximo 100000')
      .nullable()
      .default(null),
    estimatedStart: optionalDate,
    estimatedEnd: optionalDate,
    actualStart: optionalDate,
    actualEnd: optionalDate,
    status: elementStatusSchema.default('NOT_STARTED'),
    priority: elementPrioritySchema.default('MEDIUM'),
    notes: z.string().trim().max(5000, 'Máximo 5000 caracteres').nullable().default(null),
  })
  .superRefine(checkDateOrder);
export type ElementFicha = z.infer<typeof elementFichaSchema>;

/** Los campos del formulario de la ficha, con los mismos nombres del esquema */
export const ELEMENT_FORM_FIELDS = [
  'typeId',
  'name',
  'platformId',
  'sponsorId',
  'categoryId',
  'levelId',
  'authorId',
  'genreId',
  'pages',
  'durationWeeks',
  'daysPerWeek',
  'hoursPerDay',
  'manualTotalHours',
  'actualHours',
  'estimatedStart',
  'estimatedEnd',
  'actualStart',
  'actualEnd',
  'status',
  'priority',
  'notes',
] as const;

const NUMERIC_FIELDS = new Set([
  'durationWeeks',
  'daysPerWeek',
  'hoursPerDay',
  'manualTotalHours',
  'actualHours',
  'pages',
  'durationMinutes',
]);
/** Estos no significan "sin valor" en blanco: el esquema decide (obligatorio u omisión) */
const REQUIRED_FIELDS = new Set(['name', 'typeId']);

/** Un formulario solo da texto: en blanco es "sin valor" y los números se convierten */
export function fromFormValues(values: unknown) {
  const ficha: Record<string, string | number | null> = {};
  for (const [field, value] of Object.entries(values as Record<string, unknown>)) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (REQUIRED_FIELDS.has(field)) ficha[field] = text;
    else if (text !== '') ficha[field] = NUMERIC_FIELDS.has(field) ? Number(text) : text;
    // Días por semana en blanco toma su valor por omisión; lo demás queda sin valor
    else if (field !== 'daysPerWeek') ficha[field] = null;
  }
  return ficha;
}

export const elementFichaFormSchema = z.preprocess(fromFormValues, elementFichaSchema);

/** Lo que devuelve la API: la ficha más lo que calcula el sistema */
export const elementSchema = z.object({
  id: z.uuid(),
  typeId: z.uuid(),
  name: z.string(),
  platformId: z.uuid().nullable(),
  sponsorId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  levelId: z.uuid().nullable(),
  authorId: z.uuid().nullable(),
  genreId: z.uuid().nullable(),
  pages: z.number().int().nullable(),
  durationWeeks: z.number().nullable(),
  daysPerWeek: z.number().int(),
  hoursPerDay: z.number().nullable(),
  manualTotalHours: z.number().nullable(),
  /** Las capturadas o, si no hay, las calculadas; null si faltan datos para calcular */
  totalHours: z.number().nullable(),
  actualHours: z.number().nullable(),
  estimatedStart: isoDate.nullable(),
  estimatedEnd: isoDate.nullable(),
  actualStart: isoDate.nullable(),
  actualEnd: isoDate.nullable(),
  status: elementStatusSchema,
  priority: elementPrioritySchema,
  notes: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});
export type Element = z.infer<typeof elementSchema>;

/** Un renglón de la lista: la ficha más el avance que calcula la API (HU-05) */
export const elementListItemSchema = elementSchema.extend({ progress: progressSchema });
export type ElementListItem = z.infer<typeof elementListItemSchema>;

/** Respuesta de GET /workspaces/:workspaceId/elements */
export const elementListSchema = z.array(elementListItemSchema);

/** ?today= de POST y PUT: el día en la zona del usuario, que no siempre es el del servidor */
export const elementTodayQuerySchema = z.object({ today: isoDate.optional() });

/** Horas totales: manda lo capturado; si no, semanas × días por semana × horas por día */
export function computeTotalHours({
  durationWeeks,
  daysPerWeek,
  hoursPerDay,
  manualTotalHours,
}: Pick<ElementFicha, 'durationWeeks' | 'daysPerWeek' | 'hoursPerDay' | 'manualTotalHours'>):
  number | null {
  if (manualTotalHours !== null) return manualTotalHours;
  if (durationWeeks === null || hoursPerDay === null) return null;
  return Math.round(durationWeeks * daysPerWeek * hoursPerDay * 100) / 100;
}

/**
 * Fechas reales (ADR-0002 §1): se llenan solas al cambiar a En curso o a Terminado, sin pisar lo
 * capturado. Solo actúan cuando el estado cambia: así una fecha que el usuario borra no regresa.
 * Reabrir un elemento terminado quita el fin, porque ya no es cierto. El inicio se llena también
 * al pasar directo a Terminado, como en Gestor de Proyectos. `previous` es null al crear.
 * Vale para fichas y actividades: los estados En curso y Terminado/Hecha usan la misma clave.
 */
export function applyStatusDates(
  previous: string | null,
  {
    status,
    actualStart,
    actualEnd,
  }: { status: string; actualStart: string | null; actualEnd: string | null },
  today: string,
): { actualStart: string | null; actualEnd: string | null } {
  const changed = previous !== status;
  const started = changed && (status === 'IN_PROGRESS' || status === 'DONE');
  const reopened = previous === 'DONE' && status !== 'DONE';
  const finished = changed && status === 'DONE';
  return {
    actualStart: actualStart ?? (started ? today : null),
    actualEnd: reopened ? null : (actualEnd ?? (finished ? today : null)),
  };
}
