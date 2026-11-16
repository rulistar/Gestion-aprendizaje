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
const chapter = (
  n: number,
  parent: number | null,
  level: number,
  status: 'PAUSED' | 'CANCELLED' | 'DONE' | null = null,
): ElementNode => ({
  ...base(n, parent, level),
  kind: 'CHAPTER',
  status,
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

describe('estado a mano de un capítulo (HU-20)', () => {
  const tree = (chapterStatus: 'PAUSED' | 'CANCELLED' | 'DONE' | null) =>
    buildNodeTree([
      chapter(1, null, 1, chapterStatus),
      activity(2, 1, 2, 'DONE'),
      activity(3, 1, 2, 'PENDING'),
      activity(4, null, 1, 'PENDING'),
    ]);

  it('sin estado cuenta solo lo que hay hecho', () => {
    expect(nodeProgress(tree(null)[0]!)).toEqual({ total: 2, done: 1, percent: 50 });
  });

  it('Terminado muestra 100 % sin tocar las actividades', () => {
    expect(nodeProgress(tree('DONE')[0]!)).toEqual({ total: 2, done: 2, percent: 100 });
  });

  it('Cancelado queda fuera del avance', () => {
    expect(nodeProgress(tree('CANCELLED')[0]!)).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it('Pausado conserva su avance', () => {
    expect(nodeProgress(tree('PAUSED')[0]!)).toEqual({ total: 2, done: 1, percent: 50 });
  });

  it('el avance del elemento suma el Terminado y omite el Cancelado', () => {
    const flat = (status: 'DONE' | 'CANCELLED') => [
      chapter(1, null, 1, status),
      activity(2, 1, 2, 'PENDING'),
      activity(3, null, 1, 'DONE'),
    ];
    expect(elementProgress(flat('DONE'))).toEqual({ total: 2, done: 2, percent: 100 });
    expect(elementProgress(flat('CANCELLED'))).toEqual({ total: 1, done: 1, percent: 100 });
  });

  it('un subcapítulo Terminado dentro de uno Cancelado sigue fuera', () => {
    const nodes = buildNodeTree([
      chapter(1, null, 1, 'CANCELLED'),
      chapter(2, 1, 2, 'DONE'),
      activity(3, 2, 3, 'PENDING'),
    ]);
    expect(nodeProgress(nodes[0]!)).toEqual({ total: 0, done: 0, percent: 0 });
  });
});
