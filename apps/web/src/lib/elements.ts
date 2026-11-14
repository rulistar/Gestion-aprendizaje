import {
  elementListSchema,
  elementSchema,
  elementToFicha,
  type ElementFicha,
  type ElementListItem,
  type ElementStatus,
} from '@aprendizaje/shared';
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

/** A la papelera (HU-07); de ahí se restaura */
export function useDeleteElement(workspaceId: string, elementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`${elementsPath(workspaceId)}/${elementId}`, { method: 'DELETE' }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: elementsKey(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'trash'] }),
      ]),
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

/**
 * Cambiar el estado desde el tablero (HU-08). La tarjeta se mueve al instante y vuelve a su lugar
 * si la API lo rechaza; las fechas reales automáticas las pone la API al ver el cambio de estado.
 */
export function useMoveElement(workspaceId: string) {
  const queryClient = useQueryClient();
  const key = elementsKey(workspaceId);
  return useMutation({
    mutationFn: ({ element, status }: { element: ElementListItem; status: ElementStatus }) =>
      apiFetch(`${elementsPath(workspaceId)}/${element.id}?today=${localToday()}`, {
        method: 'PUT',
        body: elementToFicha(element, status),
        schema: elementSchema,
      }),
    onMutate: async ({ element, status }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ElementListItem[]>(key);
      queryClient.setQueryData<ElementListItem[]>(key, (list) =>
        list?.map((item) => (item.id === element.id ? { ...item, status } : item)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    // Con la respuesta de la API: fechas reales y avance al día
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
