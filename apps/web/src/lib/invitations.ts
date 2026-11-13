import {
  acceptInvitationResponseSchema,
  createInvitationResponseSchema,
  invitationListSchema,
  invitationPreviewSchema,
  type AcceptInvitationResponse,
  type CreateInvitationRequest,
  type LoginRequest,
  type RegisterFromInvitationRequest,
} from '@aprendizaje/shared';
import { queryOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { meQueryKey } from './auth';

const invitationsKey = (workspaceId: string) => ['workspaces', workspaceId, 'invitations'];
const invitationsPath = (workspaceId: string) => `/workspaces/${workspaceId}/invitations`;

/** Invitaciones pendientes del espacio (solo el Admin) */
export const invitationsQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: invitationsKey(workspaceId),
    queryFn: () => apiFetch(invitationsPath(workspaceId), { schema: invitationListSchema }),
  });

export function useCreateInvitation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvitationRequest) =>
      apiFetch(invitationsPath(workspaceId), {
        method: 'POST',
        body: data,
        schema: createInvitationResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsKey(workspaceId) }),
  });
}

export function useRevokeInvitation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      apiFetch(`${invitationsPath(workspaceId)}/${invitationId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsKey(workspaceId) }),
  });
}

/**
 * Enlace que el Admin envía a la persona invitada. El token va después de "#": esa parte de la
 * URL nunca se envía al servidor, así que no queda en registros de acceso ni en la cabecera Referer.
 */
export function invitationLink(token: string): string {
  return `${window.location.origin}/invitacion#${token}`;
}

// --- Aceptar una invitación: el token va en el cuerpo, nunca en la URL de la API ---

/** A qué espacio y con qué rol me invitan; error 404 si el enlace no sirve */
export const invitationPreviewQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ['invitation-preview', token],
    queryFn: () =>
      apiFetch('/invitations/preview', {
        method: 'POST',
        body: { token },
        schema: invitationPreviewSchema,
      }),
    // No se vuelve a pedir al regresar a la pestaña: cada petición cuenta para el límite de intentos
    staleTime: Infinity,
    retry: false,
  });

/**
 * Al aceptar ya hay sesión: se guarda el usuario y se refrescan sus espacios. No se espera la
 * recarga: quien llamó lleva enseguida al espacio.
 */
function onAccepted(queryClient: QueryClient, { user }: AcceptInvitationResponse) {
  queryClient.setQueryData(meQueryKey, user);
  void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
}

export function useRegisterFromInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterFromInvitationRequest) =>
      apiFetch('/invitations/register', {
        method: 'POST',
        body: data,
        schema: acceptInvitationResponseSchema,
      }),
    onSuccess: (response) => onAccepted(queryClient, response),
  });
}

/**
 * Ya tiene cuenta pero no sesión: inicia sesión y acepta en un solo paso. La sesión de la web se
 * actualiza hasta el final; si cambiara antes, la página pasaría a otra vista a medio camino.
 */
export function useLoginAndAccept(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      await apiFetch('/auth/login', { method: 'POST', body: credentials });
      return apiFetch('/invitations/accept', {
        method: 'POST',
        body: { token },
        schema: acceptInvitationResponseSchema,
      });
    },
    onSuccess: (response) => onAccepted(queryClient, response),
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch('/invitations/accept', {
        method: 'POST',
        body: { token },
        schema: acceptInvitationResponseSchema,
      }),
    onSuccess: (response) => onAccepted(queryClient, response),
  });
}
