import type { MembershipRole } from './workspaces.js';

/**
 * Catálogo de permisos. Vive en código, no en la BD: la web lo usa para mostrar u ocultar botones
 * y la API para autorizar cada endpoint (lo que cuenta es la API). A diferencia de Gestor de
 * Proyectos, aquí no hay matriz por persona: el rol decide todo (decisión del PO).
 */
export const PERMISSIONS = [
  'element.read',
  'element.create',
  'element.update',
  'element.delete',
  'data.export',
  'data.import',
  'member.manage',
  'workspace.update',
  'trash.manage',
  'catalog.manage',
  'integration.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<MembershipRole, ReadonlySet<Permission>> = {
  ADMIN: new Set(PERMISSIONS),
  MEMBER: new Set(['element.read', 'element.create', 'element.update', 'data.export']),
  VIEWER: new Set(['element.read']),
};

export function roleHasPermission(role: MembershipRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
