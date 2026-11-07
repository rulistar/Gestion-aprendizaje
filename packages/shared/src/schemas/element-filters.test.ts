import { describe, expect, it } from 'vitest';
import { elementFiltersSchema, filterElements, hasActiveFilters } from './element-filters.js';

const TYPE_A = '01a1b3c2-3eaa-7059-89a1-d001d4d0856a';
const TYPE_B = '01a1b3c2-3eaa-7059-89a1-d001d4d0856b';
const elements = [
  { name: 'Lógica de programación', typeId: TYPE_A, status: 'IN_PROGRESS' as const },
  { name: 'SQL intermedio', typeId: TYPE_A, status: 'DONE' as const },
  { name: 'El arte de la guerra', typeId: TYPE_B, status: 'IN_PROGRESS' as const },
];
const names = (filters: object) => filterElements(elements, filters).map((e) => e.name);

describe('filterElements', () => {
  it('sin filtros trae todo', () => {
    expect(names({})).toHaveLength(3);
  });

  it('busca sin distinguir acentos ni mayúsculas', () => {
    expect(names({ q: 'LOGICA' })).toEqual(['Lógica de programación']);
    expect(names({ q: '  sql ' })).toEqual(['SQL intermedio']);
  });

  it('los filtros se suman', () => {
    expect(names({ typeId: TYPE_A })).toHaveLength(2);
    expect(names({ typeId: TYPE_A, status: 'IN_PROGRESS' })).toEqual(['Lógica de programación']);
    expect(names({ q: 'sql', status: 'IN_PROGRESS' })).toEqual([]);
  });
});

describe('elementFiltersSchema', () => {
  it('ignora lo que no es válido, sin fallar', () => {
    expect(elementFiltersSchema.parse({ q: 5, typeId: 'x', status: 'NOPE' })).toEqual({});
  });

  it('conserva los espacios mientras se escribe', () => {
    expect(elementFiltersSchema.parse({ q: 'sql ' }).q).toBe('sql ');
  });
});

describe('hasActiveFilters', () => {
  it('unos espacios no son un filtro', () => {
    expect(hasActiveFilters({ q: '  ' })).toBe(false);
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ status: 'DONE' })).toBe(true);
  });
});
