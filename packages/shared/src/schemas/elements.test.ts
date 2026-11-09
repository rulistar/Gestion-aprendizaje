import { describe, expect, it } from 'vitest';
import {
  applyStatusDates,
  computeTotalHours,
  elementFichaFormSchema,
  elementFichaSchema,
} from './elements.js';

const TYPE_ID = '01a1b3c2-3eaa-7059-89a1-d001d4d0856a';

describe('computeTotalHours', () => {
  const base = { durationWeeks: 4, daysPerWeek: 5, hoursPerDay: 2, manualTotalHours: null };

  it('multiplica semanas, días por semana y horas por día', () => {
    expect(computeTotalHours(base)).toBe(40);
  });

  it('redondea a dos decimales', () => {
    expect(
      computeTotalHours({ ...base, durationWeeks: 1.5, daysPerWeek: 3, hoursPerDay: 1.25 }),
    ).toBe(5.63);
  });

  it('manda lo capturado, aunque sea 0', () => {
    expect(computeTotalHours({ ...base, manualTotalHours: 12 })).toBe(12);
    expect(computeTotalHours({ ...base, manualTotalHours: 0 })).toBe(0);
  });

  it.each([
    ['las semanas', { durationWeeks: null }],
    ['las horas por día', { hoursPerDay: null }],
  ])('sin %s no hay cálculo', (_caso, change) => {
    expect(computeTotalHours({ ...base, ...change })).toBeNull();
  });
});

describe('applyStatusDates', () => {
  const today = '2026-11-06';
  const empty = { actualStart: null, actualEnd: null };

  it('al crear sin empezar no llena nada', () => {
    expect(applyStatusDates(null, { status: 'NOT_STARTED', ...empty }, today)).toEqual(empty);
  });

  it('al crear ya en curso llena el inicio', () => {
    expect(applyStatusDates(null, { status: 'IN_PROGRESS', ...empty }, today)).toEqual({
      actualStart: today,
      actualEnd: null,
    });
  });

  it('pasar a En curso llena el inicio', () => {
    expect(applyStatusDates('NOT_STARTED', { status: 'IN_PROGRESS', ...empty }, today)).toEqual({
      actualStart: today,
      actualEnd: null,
    });
  });

  it('pasar a Terminado llena el fin y conserva el inicio', () => {
    expect(
      applyStatusDates(
        'IN_PROGRESS',
        { status: 'DONE', actualStart: '2026-10-01', actualEnd: null },
        today,
      ),
    ).toEqual({ actualStart: '2026-10-01', actualEnd: today });
  });

  it('pasar directo a Terminado llena las dos', () => {
    expect(applyStatusDates('NOT_STARTED', { status: 'DONE', ...empty }, today)).toEqual({
      actualStart: today,
      actualEnd: today,
    });
  });

  it('no pisa una fecha capturada al cambiar de estado', () => {
    expect(
      applyStatusDates(
        'IN_PROGRESS',
        { status: 'DONE', actualStart: '2026-10-01', actualEnd: '2026-10-20' },
        today,
      ),
    ).toEqual({ actualStart: '2026-10-01', actualEnd: '2026-10-20' });
  });

  it('una fecha borrada no regresa si el estado no cambia', () => {
    expect(applyStatusDates('DONE', { status: 'DONE', ...empty }, today)).toEqual(empty);
  });

  it('reabrir quita el fin y conserva el inicio', () => {
    expect(
      applyStatusDates(
        'DONE',
        { status: 'IN_PROGRESS', actualStart: '2026-10-01', actualEnd: '2026-10-20' },
        today,
      ),
    ).toEqual({ actualStart: '2026-10-01', actualEnd: null });
  });

  it.each(['PAUSED', 'CANCELLED'] as const)('pasar a %s no llena fechas', (status) => {
    expect(applyStatusDates('NOT_STARTED', { status, ...empty }, today)).toEqual(empty);
  });
});

describe('elementFichaSchema', () => {
  const valid = { typeId: TYPE_ID, name: 'Curso de SQL' };

  it('completa lo que no viene con sus valores por omisión', () => {
    expect(elementFichaSchema.parse(valid)).toMatchObject({
      daysPerWeek: 5,
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
      platformId: null,
      durationWeeks: null,
      notes: null,
    });
  });

  it.each([
    ['días por semana en 0', { daysPerWeek: 0 }, 'daysPerWeek'],
    ['días por semana en 8', { daysPerWeek: 8 }, 'daysPerWeek'],
    ['días por semana con decimales', { daysPerWeek: 2.5 }, 'daysPerWeek'],
    ['semanas en 0', { durationWeeks: 0 }, 'durationWeeks'],
    ['más de 24 horas por día', { hoursPerDay: 25 }, 'hoursPerDay'],
    ['horas negativas', { manualTotalHours: -1 }, 'manualTotalHours'],
    ['una fecha imposible', { estimatedStart: '2026-02-30' }, 'estimatedStart'],
    ['una prioridad que no existe', { priority: 'URGENTE' }, 'priority'],
    [
      'un fin estimado anterior al inicio',
      { estimatedStart: '2026-02-02', estimatedEnd: '2026-02-01' },
      'estimatedEnd',
    ],
    [
      'un fin real anterior al inicio',
      { actualStart: '2026-02-02', actualEnd: '2026-02-01' },
      'actualEnd',
    ],
    ['un nombre vacío', { name: '   ' }, 'name'],
    ['un estado desconocido', { status: 'OTRO' }, 'status'],
    ['un catálogo que no es un ID', { platformId: 'Coursera' }, 'platformId'],
  ])('rechaza %s y señala el campo', (_caso, change, field) => {
    const result = elementFichaSchema.safeParse({ ...valid, ...change });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it('el fin puede ser el mismo día que el inicio', () => {
    const dates = { estimatedStart: '2026-02-02', estimatedEnd: '2026-02-02' };

    expect(elementFichaSchema.safeParse({ ...valid, ...dates }).success).toBe(true);
  });
});

describe('elementFichaFormSchema', () => {
  it('convierte el texto: en blanco es sin valor y los números son números', () => {
    const parsed = elementFichaFormSchema.parse({
      typeId: TYPE_ID,
      name: ' SQL ',
      platformId: '',
      durationWeeks: '4',
      daysPerWeek: '',
      hoursPerDay: '1.5',
      manualTotalHours: '',
      estimatedStart: '',
      notes: '  ',
      status: 'IN_PROGRESS',
    });

    expect(parsed).toMatchObject({
      name: 'SQL',
      platformId: null,
      durationWeeks: 4,
      daysPerWeek: 5,
      hoursPerDay: 1.5,
      manualTotalHours: null,
      estimatedStart: null,
      notes: null,
      status: 'IN_PROGRESS',
    });
  });

  it('rechaza texto que no es un número', () => {
    const result = elementFichaFormSchema.safeParse({
      typeId: TYPE_ID,
      name: 'SQL',
      durationWeeks: 'muchas',
    });

    expect(result.error?.issues[0]?.path).toEqual(['durationWeeks']);
    expect(result.error?.issues[0]?.message).toBe('Escribe un número');
  });

  it('el nombre en blanco se reporta como obligatorio', () => {
    const result = elementFichaFormSchema.safeParse({ typeId: TYPE_ID, name: '' });

    expect(result.error?.issues[0]?.message).toBe('El nombre es obligatorio');
  });
});
