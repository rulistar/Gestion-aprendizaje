import { z } from 'zod';

/**
 * Campos de la ficha cuyo nombre visible puede cambiar cada tipo (ADR-0002 §3). Solo cambia el
 * nombre: las reglas de cada campo son siempre las mismas, para que los cálculos y la integración
 * sigan funcionando. El tipo de elemento no está aquí: se elige antes de conocer sus etiquetas.
 */
export const ELEMENT_FIELDS = [
  'name',
  'platform',
  'sponsor',
  'category',
  'level',
  'durationWeeks',
  'daysPerWeek',
  'hoursPerDay',
  'totalHours',
  'estimatedStart',
  'estimatedEnd',
  'actualStart',
  'actualEnd',
  'status',
  'priority',
  'notes',
] as const;
export const elementFieldSchema = z.enum(ELEMENT_FIELDS);
export type ElementField = z.infer<typeof elementFieldSchema>;

export const DEFAULT_FIELD_LABELS: Record<ElementField, string> = {
  name: 'Nombre',
  platform: 'Plataforma',
  sponsor: 'Patrocinador',
  category: 'Categoría',
  level: 'Nivel',
  durationWeeks: 'Duración en semanas',
  daysPerWeek: 'Días por semana',
  hoursPerDay: 'Horas por día',
  totalHours: 'Horas totales',
  estimatedStart: 'Inicio estimado',
  estimatedEnd: 'Fin estimado',
  actualStart: 'Inicio real',
  actualEnd: 'Fin real',
  status: 'Estado',
  priority: 'Prioridad',
  notes: 'Notas',
};

const fieldLabel = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(60, 'Máximo 60 caracteres');

/** Solo los nombres propios del tipo: un campo que no aparece usa el nombre por omisión */
export const fieldLabelsSchema = z.partialRecord(elementFieldSchema, fieldLabel);
export type FieldLabels = z.infer<typeof fieldLabelsSchema>;

/** El nombre que se muestra de cada campo en un tipo */
export function resolveFieldLabels(labels: FieldLabels): Record<ElementField, string> {
  return { ...DEFAULT_FIELD_LABELS, ...labels };
}

/**
 * Lo que se recibe para guardar: dos campos con el mismo nombre serían indistinguibles en la ficha,
 * y un nombre igual al de omisión no se guarda, para que siga a la omisión si esta cambia.
 */
export const fieldLabelsInputSchema = fieldLabelsSchema
  .superRefine((labels, ctx) => {
    const resolved = resolveFieldLabels(labels);
    for (const field of Object.keys(labels) as ElementField[]) {
      const other = ELEMENT_FIELDS.find(
        (candidate) =>
          candidate !== field &&
          resolved[candidate].toLowerCase() === resolved[field].toLowerCase(),
      );
      if (other) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `Ya lo usa el campo "${DEFAULT_FIELD_LABELS[other]}"`,
        });
      }
    }
  })
  .transform((labels): FieldLabels =>
    Object.fromEntries(
      Object.entries(labels).filter(
        ([field, label]) => label !== DEFAULT_FIELD_LABELS[field as ElementField],
      ),
    ),
  );

/** El formulario de etiquetas: un campo en blanco significa "usar el nombre por omisión" */
export const fieldLabelsFormSchema = z.preprocess(
  (values) =>
    Object.fromEntries(
      Object.entries(values as Record<string, unknown>).filter(
        ([, value]) => typeof value === 'string' && value.trim() !== '',
      ),
    ),
  fieldLabelsInputSchema,
);

/** Tipos que se cargan al crear un espacio. "Editorial" es el ejemplo del ADR-0002 §3 */
export const DEFAULT_ELEMENT_TYPES: readonly { name: string; labels: FieldLabels }[] = [
  { name: 'Curso', labels: {} },
  { name: 'Lectura', labels: { platform: 'Editorial' } },
  { name: 'Otro', labels: {} },
];

export const elementTypeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  labels: fieldLabelsSchema,
  position: z.number().int(),
  /** Archivado: ya no se ofrece para lo nuevo; lo que ya lo usa lo conserva */
  archived: z.boolean(),
});
export type ElementType = z.infer<typeof elementTypeSchema>;

/** Respuesta de GET /workspaces/:workspaceId/element-types */
export const elementTypeListSchema = z.array(elementTypeSchema);

const elementTypeName = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(80, 'Máximo 80 caracteres');

/** Cuerpo de POST /workspaces/:workspaceId/element-types; las etiquetas se ajustan después */
export const createElementTypeSchema = z.object({ name: elementTypeName });
export type CreateElementTypeInput = z.infer<typeof createElementTypeSchema>;

/** Cuerpo de PATCH .../element-types/:typeId: renombrar, cambiar etiquetas o archivar */
export const updateElementTypeSchema = z
  .object({ name: elementTypeName, labels: fieldLabelsInputSchema, archived: z.boolean() })
  .partial()
  .refine(
    (value) =>
      value.name !== undefined || value.labels !== undefined || value.archived !== undefined,
    { message: 'Indica el nombre, las etiquetas o si se archiva' },
  );
export type UpdateElementTypeInput = z.infer<typeof updateElementTypeSchema>;
