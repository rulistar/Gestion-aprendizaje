import { describe, expect, it } from 'vitest';
import { buildNodeTree, type ElementNode } from './element-nodes.js';
import { elementProgress, nodeProgress, summarizeActivities } from './progress.js';

const id = (n: number) => `01a1b3c2-3eaa-7059-89a1-${String(n).padStart(12, '0')}`;
const base = (n: number, parent: number | null, level: number) => ({
  id: id(n),
  elementId: id(99),
  parentId: parent === null ? null : id(parent),
  level,
  position: n,
  name: `Nodo ${n}`,
  updatedAt: '2026-11-06T00:00:00.000Z',
});
const chapter = (n: number, parent: number | null, level: number): ElementNode => ({
  ...base(n, parent, level),
  kind: 'CHAPTER',
});
const activity = (
  n: number,
  parent: number | null,
  level: number,
  status: 'PENDING' | 'DONE' | 'CANCELLED' | 'PAUSED',
): ElementNode => ({
  ...base(n, parent, level),
  kind: 'ACTIVITY',
  activity: {
    name: `Nodo ${n}`,
    activityTypeId: null,
    durationMinutes: null,
    status,
    estimatedStart: null,
    estimatedEnd: null,
    actualStart: null,
    actualEnd: null,
  },
});

describe('summarizeActivities', () => {
  it('sin actividades es 0 %', () => {
    expect(summarizeActivities([])).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it('una cancelada no cuenta y una pausada sí', () => {
    expect(summarizeActivities(['DONE', 'PAUSED', 'CANCELLED'])).toEqual({
      total: 2,
      done: 1,
      percent: 50,
    });
  });

  it('si todas están canceladas es 0 %, sin dividir entre cero', () => {
    expect(summarizeActivities(['CANCELLED'])).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it('redondea', () => {
    expect(summarizeActivities(['DONE', 'PENDING', 'IN_PROGRESS']).percent).toBe(33);
    expect(summarizeActivities(['DONE', 'DONE', 'PENDING']).percent).toBe(67);
  });
});

describe('avance del árbol', () => {
  const nodes = [
    chapter(1, null, 1),
    chapter(2, 1, 2),
    activity(3, 2, 3, 'DONE'),
    activity(4, 2, 3, 'PENDING'),
    activity(5, 1, 2, 'DONE'),
    chapter(6, null, 1),
    activity(7, null, 1, 'CANCELLED'),
  ];

  it('el elemento cuenta todas sus actividades, en cualquier nivel', () => {
    expect(elementProgress(nodes)).toEqual({ total: 3, done: 2, percent: 67 });
  });

  it('un nodo cuenta solo lo que contiene', () => {
    const [first, empty] = buildNodeTree(nodes);
    expect(nodeProgress(first!)).toEqual({ total: 3, done: 2, percent: 67 });
    expect(nodeProgress(first!.children[0]!)).toEqual({ total: 2, done: 1, percent: 50 });
    expect(nodeProgress(empty!)).toEqual({ total: 0, done: 0, percent: 0 });
  });
});
