import { workspaceSummarySchema, type MembershipRole } from '@aprendizaje/shared';
import { queryOptions } from '@tanstack/react-query';
import { apiFetch } from './api';

export const ROLE_LABELS: Record<MembershipRole, string> = {
  ADMIN: 'Admin',
  MEMBER: 'Miembro',
  VIEWER: 'Lector',
};

/** Un workspace con mi rol. Da 404 si no tengo acceso; la API decide en cada petición */
export const workspaceQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId],
    queryFn: () => apiFetch(`/workspaces/${workspaceId}`, { schema: workspaceSummarySchema }),
  });
