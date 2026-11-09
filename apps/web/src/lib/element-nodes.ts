import {
  elementNodeListSchema,
  elementNodeSchema,
  type CreateNodeInput,
  type MoveNodeInput,
  type UpdateNodeInput,
} from '@aprendizaje/shared';
import { queryOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { elementsKey, localToday } from './elements';

const nodesPath = (workspaceId: string, elementId: string) =>
  `/workspaces/${workspaceId}/elements/${elementId}/nodes`;
const nodesKey = (workspaceId: string, elementId: string) => [
  'workspaces',
  workspaceId,
  'elements',
  elementId,
  'nodes',
];

/** Toda la familia de elementos: un cambio en el árbol también mueve el avance de la lista */
const invalidate = (queryClient: QueryClient, workspaceId: string) =>
  queryClient.invalidateQueries({ queryKey: elementsKey(workspaceId) });

export const nodesQueryOptions = (workspaceId: string, elementId: string) =>
  queryOptions({
    queryKey: nodesKey(workspaceId, elementId),
    queryFn: () => apiFetch(nodesPath(workspaceId, elementId), { schema: elementNodeListSchema }),
  });

export function useCreateNode(workspaceId: string, elementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNodeInput) =>
      apiFetch(`${nodesPath(workspaceId, elementId)}?today=${localToday()}`, {
        method: 'POST',
        body: data,
        schema: elementNodeSchema,
      }),
    onSuccess: () => invalidate(queryClient, workspaceId),
  });
}

export function useUpdateNode(workspaceId: string, elementId: string, nodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateNodeInput) =>
      apiFetch(`${nodesPath(workspaceId, elementId)}/${nodeId}?today=${localToday()}`, {
        method: 'PUT',
        body: data,
        schema: elementNodeSchema,
      }),
    onSuccess: () => invalidate(queryClient, workspaceId),
  });
}

export function useMoveNode(workspaceId: string, elementId: string, nodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MoveNodeInput) =>
      apiFetch(`${nodesPath(workspaceId, elementId)}/${nodeId}/move`, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => invalidate(queryClient, workspaceId),
  });
}

export function useDeleteNode(workspaceId: string, elementId: string, nodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`${nodesPath(workspaceId, elementId)}/${nodeId}`, { method: 'DELETE' }),
    onSuccess: () =>
      Promise.all([
        invalidate(queryClient, workspaceId),
        queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'trash'] }),
      ]),
  });
}
