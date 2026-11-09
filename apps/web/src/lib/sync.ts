import { syncStatusSchema } from '@aprendizaje/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { elementsKey } from './elements';

const syncPath = (workspaceId: string, elementId: string) =>
  `/workspaces/${workspaceId}/elements/${elementId}/sync`;
const syncKey = (workspaceId: string, elementId: string) => [
  ...elementsKey(workspaceId),
  elementId,
  'sync',
];

/**
 * Cómo va el elemento con Gestor de Proyectos (INT-02). Mientras hay algo pendiente se consulta
 * cada 10 s, para ver cuándo llega; al editar el elemento se vuelve a leer (misma clave base).
 */
export const syncQueryOptions = (workspaceId: string, elementId: string) =>
  queryOptions({
    queryKey: syncKey(workspaceId, elementId),
    queryFn: () => apiFetch(syncPath(workspaceId, elementId), { schema: syncStatusSchema }),
    refetchInterval: (query) => (query.state.data?.state === 'pending' ? 10_000 : false),
  });

type SyncAction = 'enable' | 'disable' | 'retry';

/** Enviar, dejar de sincronizar o reintentar; la respuesta ya es el estado nuevo */
export function useSyncAction(workspaceId: string, elementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: SyncAction) =>
      apiFetch(`${syncPath(workspaceId, elementId)}${action === 'retry' ? '/retry' : ''}`, {
        method: action === 'disable' ? 'DELETE' : 'POST',
        schema: syncStatusSchema,
      }),
    onSuccess: (status) => queryClient.setQueryData(syncKey(workspaceId, elementId), status),
  });
}
