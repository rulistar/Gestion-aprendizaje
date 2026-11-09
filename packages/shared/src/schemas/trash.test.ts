import { describe, expect, it } from 'vitest';
import { trashPermission, visibleTrashKinds } from './trash.js';

describe('papelera (HU-07)', () => {
  it('un elemento lo maneja quien lo puede quitar; un nodo, quien edita el elemento', () => {
    expect(trashPermission('element')).toBe('element.delete');
    expect(trashPermission('node')).toBe('element.update');
  });

  it('cada rol ve en la papelera solo lo que pudo quitar', () => {
    expect(visibleTrashKinds('ADMIN')).toEqual(['element', 'node']);
    expect(visibleTrashKinds('MEMBER')).toEqual(['node']);
    expect(visibleTrashKinds('VIEWER')).toEqual([]);
  });
});
