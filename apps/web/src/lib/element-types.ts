import {
  elementTypeListSchema,
  elementTypeSchema,
  type CreateElementTypeInput,
  type FieldLabels,
} from '@aprendizaje/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

const elementTypesPath = (workspaceId: string) => `/workspaces/${workspaceId}/element-types`;
const elementTypesKey = (workspaceId: string) => ['workspaces', workspaceId, 'element-types'];

/** Todos los tipos de elemento del espacio, archivados incluidos */
export const elementTypesQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: elementTypesKey(workspaceId),
    queryFn: () => apiFetch(elementTypesPath(workspaceId), { schema: elementTypeListSchema }),
  });

export function useCreateElementType(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateElementTypeInput) =>
      apiFetch(elementTypesPath(workspaceId), {
        method: 'POST',
        body: data,
        schema: elementTypeSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: elementTypesKey(workspaceId) }),
  });
}

export function useUpdateElementType(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      typeId,
      ...data
    }: {
      typeId: string;
      name?: string;
      labels?: FieldLabels;
      archived?: boolean;
    }) =>
      apiFetch(`${elementTypesPath(workspaceId)}/${typeId}`, {
        method: 'PATCH',
        body: data,
        schema: elementTypeSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: elementTypesKey(workspaceId) }),
  });
}
