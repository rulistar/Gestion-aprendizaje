import { memberListSchema, type MembershipRole } from '@aprendizaje/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiFetch } from './api';
import { meQueryKey } from './auth';

const membersPath = (workspaceId: string) => `/workspaces/${workspaceId}/members`;

/** Miembros del espacio. El correo solo llega a quien los administra (el Admin) */
export const membersQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'members'],
    queryFn: () => apiFetch(membersPath(workspaceId), { schema: memberListSchema }),
  });

/**
 * Tras cambiar un rol se refresca todo el espacio y la sesión: si el cambio fue sobre mí, mi rol
 * (y lo que la web me deja hacer) también cambió.
 */
export function useChangeMemberRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MembershipRole }) =>
      apiFetch(`${membersPath(workspaceId)}/${userId}`, { method: 'PATCH', body: { role } }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
        queryClient.invalidateQueries({ queryKey: meQueryKey }),
      ]),
  });
}

/**
 * Quitar a alguien del espacio. Si me quité a mí, el espacio ya no es mío: se olvida lo que la
 * web tenía de él (pedirlo de nuevo daría 404) y vuelvo al inicio con mis espacios al día.
 */
export function useRemoveMember(workspaceId: string, myUserId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`${membersPath(workspaceId)}/${userId}`, { method: 'DELETE' }),
    onSuccess: async (_data, userId) => {
      if (userId !== myUserId) {
        return queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] });
      }
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
      await navigate({ to: '/' });
      queryClient.removeQueries({ queryKey: ['workspaces', workspaceId] });
    },
  });
}
