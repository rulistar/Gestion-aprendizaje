import {
  catalogItemListSchema,
  catalogItemSchema,
  type CreateCatalogItemInput,
  type UpdateCatalogItemInput,
} from '@aprendizaje/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

const catalogsPath = (workspaceId: string) => `/workspaces/${workspaceId}/catalogs`;
const catalogsKey = (workspaceId: string) => ['workspaces', workspaceId, 'catalogs'];

/** Todos los catálogos del espacio, archivados incluidos */
export const catalogsQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: catalogsKey(workspaceId),
    queryFn: () => apiFetch(catalogsPath(workspaceId), { schema: catalogItemListSchema }),
  });

export function useCreateCatalogItem(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCatalogItemInput) =>
      apiFetch(catalogsPath(workspaceId), {
        method: 'POST',
        body: data,
        schema: catalogItemSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogsKey(workspaceId) }),
  });
}

export function useUpdateCatalogItem(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...data }: UpdateCatalogItemInput & { itemId: string }) =>
      apiFetch(`${catalogsPath(workspaceId)}/${itemId}`, {
        method: 'PATCH',
        body: data,
        schema: catalogItemSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogsKey(workspaceId) }),
  });
}
