import {
  elementNodeListSchema,
  elementNodeSchema,
  type CreateNodeInput,
  type MoveNodeInput,
  type UpdateNodeInput,
} from '@aprendizaje/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { localToday } from './elements';

const nodesPath = (workspaceId: string, elementId: string) =>
  `/workspaces/${workspaceId}/elements/${elementId}/nodes`;
const nodesKey = (workspaceId: string, elementId: string) => [
  'workspaces',
  workspaceId,
  'elements',
  elementId,
  'nodes',
];

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: nodesKey(workspaceId, elementId) }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: nodesKey(workspaceId, elementId) }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: nodesKey(workspaceId, elementId) }),
  });
}

export function useDeleteNode(workspaceId: string, elementId: string, nodeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`${nodesPath(workspaceId, elementId)}/${nodeId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: nodesKey(workspaceId, elementId) }),
  });
}
