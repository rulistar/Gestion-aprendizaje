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
  'author',
  'genre',
  'pages',
  'durationWeeks',
  'daysPerWeek',
  'hoursPerDay',
  'totalHours',
  'actualHours',
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
  author: 'Autor',
  genre: 'Género',
  pages: 'Número de páginas',
  durationWeeks: 'Duración en semanas',
  daysPerWeek: 'Días por semana',
  hoursPerDay: 'Horas por día',
  totalHours: 'Horas totales',
  actualHours: 'Horas reales',
  estimatedStart: 'Inicio estimado',
  estimatedEnd: 'Fin estimado',
  actualStart: 'Inicio real',
  actualEnd: 'Fin real',
  status: 'Estado',
  priority: 'Prioridad',
  notes: 'Notas',
};

/** Lo que toda ficha muestra siempre: sin nombre, estado ni prioridad no se entiende (HU-12) */
export const ALWAYS_SHOWN_FIELDS = [
  'name',
  'status',
  'priority',
] as const satisfies readonly ElementField[];

/** Los campos que un tipo puede ocultar, en el orden de la ficha */
export const HIDEABLE_FIELDS = ELEMENT_FIELDS.filter(
  (field) => !(ALWAYS_SHOWN_FIELDS as readonly ElementField[]).includes(field),
);
const hideableFieldSchema = z
  .enum(ELEMENT_FIELDS)
  .refine((field) => HIDEABLE_FIELDS.includes(field), 'Este campo siempre se muestra');

/** Campos que la ficha de un tipo no muestra (HU-12): sin repetidos, en el orden de la ficha */
export const hiddenFieldsSchema = z
  .array(hideableFieldSchema)
  .transform((fields) => HIDEABLE_FIELDS.filter((field) => fields.includes(field)));
export type HiddenFields = z.infer<typeof hiddenFieldsSchema>;

/** Si la ficha de un tipo muestra un campo */
export function showsField(hiddenFields: readonly ElementField[], field: ElementField): boolean {
  return !hiddenFields.includes(field);
}

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

/** Lo de libros, que Curso y Otro no muestran al empezar (PO, 2026-11-12) */
const BOOK_ONLY: ElementField[] = ['genre', 'pages'];

/**
 * Tipos que se cargan al crear un espacio. "Editorial" es el ejemplo del ADR-0002 §3; Lectura
 * muestra lo que pidió el PO (2026-11-08): nombre del libro, autor, editorial, páginas, fechas,
 * horas y género (y notas).
 */
export const DEFAULT_ELEMENT_TYPES: readonly {
  name: string;
  labels: FieldLabels;
  hiddenFields: ElementField[];
}[] = [
  { name: 'Curso', labels: {}, hiddenFields: BOOK_ONLY },
  {
    name: 'Lectura',
    labels: { name: 'Nombre del libro', platform: 'Editorial' },
    hiddenFields: ['sponsor', 'category', 'level', 'durationWeeks', 'daysPerWeek', 'hoursPerDay'],
  },
  { name: 'Otro', labels: {}, hiddenFields: BOOK_ONLY },
];

export const elementTypeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  labels: fieldLabelsSchema,
  /** Campos que su ficha no muestra (HU-12) */
  hiddenFields: z.array(elementFieldSchema),
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

/** Cuerpo de PATCH .../element-types/:typeId: renombrar, cambiar etiquetas, campos o archivar */
export const updateElementTypeSchema = z
  .object({
    name: elementTypeName,
    labels: fieldLabelsInputSchema,
    hiddenFields: hiddenFieldsSchema,
    archived: z.boolean(),
  })
  .partial()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.labels !== undefined ||
      value.hiddenFields !== undefined ||
      value.archived !== undefined,
    { message: 'Indica el nombre, las etiquetas, los campos o si se archiva' },
  );
export type UpdateElementTypeInput = z.infer<typeof updateElementTypeSchema>;
