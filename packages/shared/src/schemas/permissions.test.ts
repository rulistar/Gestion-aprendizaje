import { describe, expect, it } from 'vitest';
import { PERMISSIONS, roleHasPermission } from './permissions.js';

describe('roleHasPermission', () => {
  it('el Admin tiene todos los permisos', () => {
    expect(PERMISSIONS.every((permission) => roleHasPermission('ADMIN', permission))).toBe(true);
  });

  it('el Miembro trabaja con elementos, pero no administra el espacio', () => {
    expect(roleHasPermission('MEMBER', 'element.update')).toBe(true);
    expect(roleHasPermission('MEMBER', 'member.manage')).toBe(false);
    expect(roleHasPermission('MEMBER', 'catalog.manage')).toBe(false);
    expect(roleHasPermission('MEMBER', 'workspace.update')).toBe(false);
  });

  it('el Lector solo puede leer', () => {
    const allowed = PERMISSIONS.filter((permission) => roleHasPermission('VIEWER', permission));
    expect(allowed).toEqual(['element.read']);
  });
});
