import { z } from 'zod';

/** Los cinco catálogos del espacio (ADR-0002): comparten reglas, por eso son una sola tabla */
export const CATALOG_KINDS = ['PLATFORM', 'SPONSOR', 'CATEGORY', 'LEVEL', 'ACTIVITY_TYPE'] as const;
export const catalogKindSchema = z.enum(CATALOG_KINDS);
export type CatalogKind = z.infer<typeof catalogKindSchema>;

export const CATALOG_LABELS: Record<CatalogKind, string> = {
  PLATFORM: 'Plataformas',
  SPONSOR: 'Patrocinadores',
  CATEGORY: 'Categorías',
  LEVEL: 'Niveles',
  ACTIVITY_TYPE: 'Tipos de actividad',
};

/** Valores que se cargan al crear un espacio; los demás catálogos empiezan vacíos */
export const DEFAULT_CATALOG_ITEMS: Partial<Record<CatalogKind, readonly string[]>> = {
  LEVEL: ['Básico', 'Intermedio', 'Avanzado'],
  ACTIVITY_TYPE: ['Video o lección', 'Lectura', 'Ejercicio', 'Quiz', 'Proyecto', 'Examen'],
};

export const catalogItemSchema = z.object({
  id: z.uuid(),
  kind: catalogKindSchema,
  name: z.string(),
  position: z.number().int(),
  /** Archivado: ya no se ofrece para lo nuevo; lo que ya lo usa lo conserva */
  archived: z.boolean(),
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;

/** Respuesta de GET /workspaces/:workspaceId/catalogs */
export const catalogItemListSchema = z.array(catalogItemSchema);

const catalogItemName = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(80, 'Máximo 80 caracteres');

/** El campo del formulario para agregar un valor; el catálogo lo da la tarjeta donde se escribe */
export const catalogItemNameSchema = z.object({ name: catalogItemName });

/** Cuerpo de POST /workspaces/:workspaceId/catalogs */
export const createCatalogItemSchema = catalogItemNameSchema.extend({ kind: catalogKindSchema });
export type CreateCatalogItemInput = z.infer<typeof createCatalogItemSchema>;

/** Cuerpo de PATCH .../catalogs/:itemId: renombrar o archivar */
export const updateCatalogItemSchema = z
  .object({ name: catalogItemName, archived: z.boolean() })
  .partial()
  .refine((value) => value.name !== undefined || value.archived !== undefined, {
    message: 'Indica el nombre o si se archiva',
  });
export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;
