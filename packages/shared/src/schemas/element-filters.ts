import { z } from 'zod';
import { elementStatusSchema, type ElementStatus } from './elements.js';

/**
 * Filtros de la lista de elementos (HU-05). Viven en la URL: un enlace abre la misma vista y volver
 * de una ficha los conserva. Un valor que no es válido se ignora: no rompe la página.
 */
export const elementFiltersSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  typeId: z.uuid().optional().catch(undefined),
  status: elementStatusSchema.optional().catch(undefined),
});
export type ElementFilters = z.infer<typeof elementFiltersSchema>;

/** Sin acentos ni mayúsculas: "logica" encuentra "Lógica" */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function hasActiveFilters({ q, typeId, status }: ElementFilters): boolean {
  return Boolean(q?.trim() || typeId || status);
}

export function filterElements<T extends { name: string; typeId: string; status: ElementStatus }>(
  elements: readonly T[],
  { q, typeId, status }: ElementFilters,
): T[] {
  const text = normalize(q?.trim() ?? '');
  return elements.filter(
    (element) =>
      (!text || normalize(element.name).includes(text)) &&
      (!typeId || element.typeId === typeId) &&
      (!status || element.status === status),
  );
}
