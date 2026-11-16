import { describe, expect, it } from 'vitest';
import { rollupByDepth, rollupMinutes, sumMinutes, type MinutesNode } from './element-minutes.js';

const node = (
  id: string,
  parentId: string | null,
  rest: Partial<MinutesNode> = {},
): MinutesNode => ({
  id,
  parentId,
  captured: null,
  calculated: null,
  cancelled: false,
  ...rest,
});

describe('sumMinutes', () => {
  it('suma lo que hay y distingue 0 de "sin datos"', () => {
    expect(sumMinutes([10, null, 5])).toBe(15);
    expect(sumMinutes([0, null])).toBe(0);
    expect(sumMinutes([null, null])).toBeNull();
    expect(sumMinutes([])).toBeNull();
  });

  it('redondea a dos decimales', () => {
    expect(sumMinutes([0.1, 0.2])).toBe(0.3);
  });
});

describe('rollupMinutes (HU-18)', () => {
  it('un capítulo suma las actividades que contiene', () => {
    const { byNode, roots } = rollupMinutes([
      node('cap', null),
      node('a1', 'cap', { captured: 30 }),
      node('a2', 'cap', { captured: 45 }),
    ]);
    expect(byNode.get('cap')).toBe(75);
    expect(roots).toBe(75);
  });

  it('lo capturado manda sobre la suma de lo de adentro, pero cada hijo conserva lo suyo', () => {
    const { byNode, roots } = rollupMinutes([
      node('curso', null, { captured: 600 }),
      node('a1', 'curso', { captured: 30 }),
    ]);
    expect(byNode.get('curso')).toBe(600);
    expect(byNode.get('a1')).toBe(30);
    expect(roots).toBe(600);
  });

  it('un curso sin captura ni actividades usa lo calculado por su duración', () => {
    const { byNode } = rollupMinutes([node('curso', null, { calculated: 2400 })]);
    expect(byNode.get('curso')).toBe(2400);
  });

  it('la suma de la estructura pesa más que lo calculado', () => {
    const { byNode } = rollupMinutes([
      node('curso', null, { calculated: 2400 }),
      node('a1', 'curso', { captured: 50 }),
    ]);
    expect(byNode.get('curso')).toBe(50);
  });

  it('una actividad cancelada no cuenta', () => {
    const { byNode, roots } = rollupMinutes([
      node('cap', null),
      node('a1', 'cap', { captured: 30 }),
      node('a2', 'cap', { captured: 90, cancelled: true }),
    ]);
    expect(byNode.get('a2')).toBeNull();
    expect(byNode.get('cap')).toBe(30);
    expect(roots).toBe(30);
  });

  it('sin minutos en ningún lado, nada', () => {
    const { byNode, roots } = rollupMinutes([node('cap', null), node('a1', 'cap')]);
    expect(byNode.get('cap')).toBeNull();
    expect(roots).toBeNull();
  });

  it('suma varios niveles', () => {
    const { byNode, roots } = rollupMinutes([
      node('c1', null),
      node('c2', 'c1'),
      node('a1', 'c2', { captured: 20 }),
      node('a2', 'c1', { captured: 10 }),
    ]);
    expect(byNode.get('c2')).toBe(20);
    expect(byNode.get('c1')).toBe(30);
    expect(roots).toBe(30);
  });
});

describe('rollupByDepth', () => {
  it('arma el árbol de una lista plana con profundidad', () => {
    const { byIndex, roots } = rollupByDepth([
      { depth: 1, captured: null, calculated: null, cancelled: false },
      { depth: 2, captured: 20, calculated: null, cancelled: false },
      { depth: 2, captured: 15, calculated: null, cancelled: false },
      { depth: 1, captured: 5, calculated: null, cancelled: false },
    ]);
    expect(byIndex).toEqual([35, 20, 15, 5]);
    expect(roots).toBe(40);
  });
});
