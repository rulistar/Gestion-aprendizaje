import { describe, expect, it } from 'vitest';
import {
  activityContentFormSchema,
  activityContentSchema,
  allowedChildKinds,
  buildNodeTree,
  createNodeSchema,
  nodeKindLabel,
  type ElementNode,
} from './element-nodes.js';

const ID = '01a1b3c2-3eaa-7059-89a1-d001d4d0856a';

describe('allowedChildKinds', () => {
  it('en la raíz cabe cualquier clase', () => {
    expect(allowedChildKinds(null)).toEqual(['CHAPTER', 'COURSE', 'ACTIVITY']);
  });

  it.each(['CHAPTER', 'COURSE'] as const)('dentro de un %s de nivel 1 cabe cualquiera', (kind) => {
    expect(allowedChildKinds({ kind, level: 1 })).toEqual(['CHAPTER', 'COURSE', 'ACTIVITY']);
  });

  it.each(['CHAPTER', 'COURSE'] as const)(
    'dentro de un %s de nivel 2 solo caben actividades',
    (kind) => {
      expect(allowedChildKinds({ kind, level: 2 })).toEqual(['ACTIVITY']);
    },
  );

  it('una actividad no tiene hijos, en ningún nivel', () => {
    expect(allowedChildKinds({ kind: 'ACTIVITY', level: 1 })).toEqual([]);
    expect(allowedChildKinds({ kind: 'ACTIVITY', level: 3 })).toEqual([]);
  });

  it('en el nivel 3 ya no cabe nada', () => {
    expect(allowedChildKinds({ kind: 'CHAPTER', level: 3 })).toEqual([]);
  });
});

describe('nodeKindLabel', () => {
  it('un capítulo dentro de otro nodo es un subcapítulo', () => {
    expect(nodeKindLabel('CHAPTER', 1)).toBe('Capítulo');
    expect(nodeKindLabel('CHAPTER', 2)).toBe('Subcapítulo');
    expect(nodeKindLabel('COURSE', 2)).toBe('Curso');
    expect(nodeKindLabel('ACTIVITY', 3)).toBe('Actividad');
  });
});

describe('buildNodeTree', () => {
  function chapter(id: string, parentId: string | null, position: number): ElementNode {
    return {
      kind: 'CHAPTER',
      id,
      elementId: ID,
      parentId,
      level: parentId ? 2 : 1,
      position,
      name: id,
      updatedAt: '2026-11-06T00:00:00.000Z',
    };
  }

  it('anida a los hijos y ordena a los hermanos por posición', () => {
    const tree = buildNodeTree([
      chapter('b', null, 1),
      chapter('b2', 'b', 1),
      chapter('a', null, 0),
      chapter('b1', 'b', 0),
    ]);

    expect(tree.map((node) => node.id)).toEqual(['a', 'b']);
    expect(tree[1]?.children.map((node) => node.id)).toEqual(['b1', 'b2']);
    expect(tree[0]?.children).toEqual([]);
  });

  it('una lista vacía da un árbol vacío', () => {
    expect(buildNodeTree([])).toEqual([]);
  });
});

describe('activityContentSchema', () => {
  it('completa lo que no viene', () => {
    expect(activityContentSchema.parse({ name: ' Video 1 ' })).toMatchObject({
      name: 'Video 1',
      activityTypeId: null,
      durationMinutes: null,
      status: 'PENDING',
    });
  });

  it.each([
    ['un nombre vacío', { name: ' ' }, 'name'],
    ['minutos con decimales', { name: 'X', durationMinutes: 1.5 }, 'durationMinutes'],
    ['0 minutos', { name: 'X', durationMinutes: 0 }, 'durationMinutes'],
    ['un estado de la ficha', { name: 'X', status: 'NOT_STARTED' }, 'status'],
    [
      'un fin antes del inicio',
      { name: 'X', estimatedStart: '2026-02-02', estimatedEnd: '2026-02-01' },
      'estimatedEnd',
    ],
  ])('rechaza %s', (_caso, value, field) => {
    const result = activityContentSchema.safeParse(value);

    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});

describe('activityContentFormSchema', () => {
  it('convierte el texto del formulario', () => {
    expect(
      activityContentFormSchema.parse({
        name: ' Quiz ',
        activityTypeId: '',
        durationMinutes: '30',
        status: 'DONE',
        estimatedStart: '',
      }),
    ).toMatchObject({
      name: 'Quiz',
      activityTypeId: null,
      durationMinutes: 30,
      status: 'DONE',
      estimatedStart: null,
    });
  });
});

describe('createNodeSchema', () => {
  it('sin padre, el nodo va en la raíz', () => {
    const parsed = createNodeSchema.parse({ kind: 'CHAPTER', content: { name: 'Uno' } });

    expect(parsed.parentId).toBeNull();
  });

  it('un Curso exige la ficha, con su tipo', () => {
    expect(createNodeSchema.safeParse({ kind: 'COURSE', content: { name: 'Uno' } }).success).toBe(
      false,
    );
    expect(
      createNodeSchema.safeParse({ kind: 'COURSE', content: { name: 'Uno', typeId: ID } }).success,
    ).toBe(true);
  });

  it('rechaza una clase desconocida', () => {
    expect(createNodeSchema.safeParse({ kind: 'OTRA', content: { name: 'Uno' } }).success).toBe(
      false,
    );
  });
});
