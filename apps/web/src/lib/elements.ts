import { elementListSchema, elementSchema, type ElementFicha } from '@aprendizaje/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

const elementsPath = (workspaceId: string) => `/workspaces/${workspaceId}/elements`;
export const elementsKey = (workspaceId: string) => ['workspaces', workspaceId, 'elements'];

/** El día en la zona del usuario: el servidor no la conoce y las fechas reales dependen de ella */
export function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export const elementsQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: elementsKey(workspaceId),
    queryFn: () => apiFetch(elementsPath(workspaceId), { schema: elementListSchema }),
  });

export const elementQueryOptions = (workspaceId: string, elementId: string) =>
  queryOptions({
    queryKey: [...elementsKey(workspaceId), elementId],
    queryFn: () => apiFetch(`${elementsPath(workspaceId)}/${elementId}`, { schema: elementSchema }),
  });

export function useCreateElement(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ElementFicha) =>
      apiFetch(`${elementsPath(workspaceId)}?today=${localToday()}`, {
        method: 'POST',
        body: data,
        schema: elementSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: elementsKey(workspaceId) }),
  });
}

export function useUpdateElement(workspaceId: string, elementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ElementFicha) =>
      apiFetch(`${elementsPath(workspaceId)}/${elementId}?today=${localToday()}`, {
        method: 'PUT',
        body: data,
        schema: elementSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: elementsKey(workspaceId) }),
  });
}
