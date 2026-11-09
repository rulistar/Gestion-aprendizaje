import { trashListSchema, type TrashKind } from '@aprendizaje/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { elementsKey } from './elements';

const trashPath = (workspaceId: string) => `/workspaces/${workspaceId}/trash`;
export const trashKey = (workspaceId: string) => ['workspaces', workspaceId, 'trash'];

export const trashQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: trashKey(workspaceId),
    queryFn: () => apiFetch(trashPath(workspaceId), { schema: trashListSchema }),
  });

interface TrashTarget {
  kind: TrashKind;
  id: string;
}

/** Sacar de la papelera: vuelve a la lista de elementos y a su estructura (HU-07) */
export function useRestoreFromTrash(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: TrashTarget) =>
      apiFetch(`${trashPath(workspaceId)}/${kind}/${id}/restore`, { method: 'POST' }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: trashKey(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: elementsKey(workspaceId) }),
      ]),
  });
}

/** Borrar para siempre (solo el Admin) */
export function usePurgeFromTrash(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: TrashTarget) =>
      apiFetch(`${trashPath(workspaceId)}/${kind}/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trashKey(workspaceId) }),
  });
}
