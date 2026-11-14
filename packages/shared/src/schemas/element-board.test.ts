import { describe, expect, it } from 'vitest';
import {
  elementsByEndMonth,
  elementToFicha,
  endMonth,
  groupByStatus,
  monthLabel,
  statusTotals,
} from './element-board.js';
import { elementFichaSchema, type Element, type ElementStatus } from './elements.js';

const item = (
  status: ElementStatus,
  actualEnd: string | null = null,
  estimatedEnd: string | null = null,
) => ({ status, actualEnd, estimatedEnd });

describe('groupByStatus y statusTotals', () => {
  it('reparte por estado conservando el orden y deja vacías las columnas sin elementos', () => {
    const a = { id: 'a', status: 'DONE' as const };
    const b = { id: 'b', status: 'IN_PROGRESS' as const };
    const c = { id: 'c', status: 'DONE' as const };
    const groups = groupByStatus([a, b, c]);
    expect(groups.DONE).toEqual([a, c]);
    expect(groups.IN_PROGRESS).toEqual([b]);
    expect(groups.NOT_STARTED).toEqual([]);
    expect(groups.PAUSED).toEqual([]);
    expect(groups.CANCELLED).toEqual([]);
  });

  it('cuenta los de cada estado', () => {
    expect(statusTotals([item('DONE'), item('DONE'), item('PAUSED')])).toEqual({
      NOT_STARTED: 0,
      IN_PROGRESS: 0,
      PAUSED: 1,
      CANCELLED: 0,
      DONE: 2,
    });
  });
});

describe('mes de término', () => {
  it('usa el fin real y, si no hay, el estimado', () => {
    expect(endMonth({ actualEnd: '2026-03-15', estimatedEnd: '2026-02-01' })).toBe('2026-03');
    expect(endMonth({ actualEnd: null, estimatedEnd: '2026-02-01' })).toBe('2026-02');
    expect(endMonth({ actualEnd: null, estimatedEnd: null })).toBeNull();
  });

  it('agrupa por mes con su estado y cuenta aparte los que no tienen fecha', () => {
    const { months, withoutDate } = elementsByEndMonth([
      item('DONE', '2026-01-20'),
      item('IN_PROGRESS', null, '2026-01-31'),
      item('NOT_STARTED', null, '2026-03-10'),
      item('PAUSED'),
    ]);
    expect(withoutDate).toBe(1);
    expect(months.map((m) => [m.month, m.total])).toEqual([
      ['2026-01', 2],
      ['2026-02', 0],
      ['2026-03', 1],
    ]);
    expect(months[0]!.byStatus).toMatchObject({ DONE: 1, IN_PROGRESS: 1, NOT_STARTED: 0 });
  });

  it('los meses van seguidos, también al cruzar el año', () => {
    const { months } = elementsByEndMonth([item('DONE', '2026-11-01'), item('DONE', '2027-02-01')]);
    expect(months.map((m) => m.month)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('sin fechas no hay meses', () => {
    expect(elementsByEndMonth([item('DONE')])).toEqual({ months: [], withoutDate: 1 });
    expect(elementsByEndMonth([])).toEqual({ months: [], withoutDate: 0 });
  });

  it('el nombre del mes', () => {
    expect(monthLabel('2026-03')).toBe('mar 2026');
    expect(monthLabel('2027-12')).toBe('dic 2027');
  });
});

describe('elementToFicha', () => {
  const element: Element = {
    id: '0198f0e0-0000-7000-8000-000000000001',
    typeId: '0198f0e0-0000-7000-8000-000000000002',
    name: 'Go',
    platformId: null,
    sponsorId: null,
    categoryId: null,
    levelId: null,
    authorId: null,
    genreId: null,
    pages: null,
    durationWeeks: 4,
    daysPerWeek: 5,
    hoursPerDay: 1.5,
    manualTotalHours: null,
    totalHours: 30,
    actualHours: null,
    estimatedStart: '2026-01-05',
    estimatedEnd: '2026-02-01',
    actualStart: '2026-01-06',
    actualEnd: null,
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    notes: 'ojo',
    updatedAt: '2026-01-06T00:00:00.000Z',
  };

  it('conserva todo y solo cambia el estado', () => {
    const ficha = elementToFicha(element, 'DONE');
    expect(ficha.status).toBe('DONE');
    expect(ficha).toMatchObject({ name: 'Go', priority: 'HIGH', actualStart: '2026-01-06' });
    expect(ficha).not.toHaveProperty('id');
    expect(ficha).not.toHaveProperty('totalHours');
  });

  it('es una ficha válida para la API', () => {
    expect(elementFichaSchema.safeParse(elementToFicha(element, 'PAUSED')).success).toBe(true);
  });
});
