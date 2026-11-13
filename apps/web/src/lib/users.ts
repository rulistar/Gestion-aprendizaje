import {
  currentUserSchema,
  passwordResetLinkSchema,
  passwordResetPreviewSchema,
  systemUserListSchema,
  type ChangeUserEmailInput,
  type CompletePasswordResetInput,
  type SetUserStatusInput,
} from '@aprendizaje/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { meQueryKey } from './auth';

const usersKey = ['users'];

/** Todas las cuentas (HU-15); solo las pide el Admin del sistema */
export const usersQueryOptions = queryOptions({
  queryKey: usersKey,
  queryFn: () => apiFetch('/users', { schema: systemUserListSchema }),
});

export function useChangeUserEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...data }: ChangeUserEmailInput & { userId: string }) =>
      apiFetch(`/users/${userId}/email`, {
        method: 'PUT',
        body: data,
        schema: systemUserListSchema,
      }),
    onSuccess: (users) => queryClient.setQueryData(usersKey, users),
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...data }: SetUserStatusInput & { userId: string }) =>
      apiFetch(`/users/${userId}/status`, {
        method: 'PATCH',
        body: data,
        schema: systemUserListSchema,
      }),
    onSuccess: (users) => queryClient.setQueryData(usersKey, users),
  });
}

// --- Restablecer una contraseña olvidada (HU-15) ---

/** El Admin del sistema genera el enlace; el token solo viene en esta respuesta */
export function useCreatePasswordReset() {
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/users/${userId}/password-reset`, {
        method: 'POST',
        schema: passwordResetLinkSchema,
      }),
  });
}

/** Como las invitaciones: el token va después de "#", que nunca llega al servidor */
export function passwordResetLink(token: string): string {
  return `${window.location.origin}/restablecer#${token}`;
}

/** Para quién es el enlace; error 404 si no sirve */
export const passwordResetPreviewQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ['password-reset-preview', token],
    queryFn: () =>
      apiFetch('/password-resets/preview', {
        method: 'POST',
        body: { token },
        schema: passwordResetPreviewSchema,
      }),
    // No se vuelve a pedir al regresar a la pestaña: cada petición cuenta para el límite de intentos
    staleTime: Infinity,
    retry: false,
  });

/** Guarda la contraseña nueva; la sesión queda iniciada con esa cuenta */
export function useCompletePasswordReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CompletePasswordResetInput) =>
      apiFetch('/password-resets/complete', {
        method: 'POST',
        body: data,
        schema: currentUserSchema,
      }),
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryKey, user);
      return queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}
