import { describe, expect, it } from 'vitest';
import {
  fitText,
  phaseMoves,
  projectBody,
  PROYECTOS_MAX_MINUTES,
  SYNC_STATUS_REASON,
  taskBody,
} from './sync.js';

const activity = {
  name: 'Ver la introducción',
  status: 'PENDING' as const,
  durationMinutes: 30,
  estimatedStart: '2026-11-09',
  estimatedEnd: '2026-11-10',
};

describe('fitText', () => {
  it('deja igual lo que cabe y recorta con "…" lo que no', () => {
    expect(fitText('abc', 3)).toBe('abc');
    expect(fitText('abcd', 3)).toBe('ab…');
  });
});

describe('projectBody', () => {
  it('envía nombre, estado, prioridad y fechas estimadas, como proyecto personal', () => {
    expect(
      projectBody({
        name: 'x'.repeat(200),
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        estimatedStart: '2026-11-01',
        estimatedEnd: null,
      }),
    ).toEqual({
      name: `${'x'.repeat(119)}…`,
      scope: 'PERSONAL',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      startDate: '2026-11-01',
      endDate: null,
    });
  });
});

describe('taskBody', () => {
  it('traduce la actividad a tarea en la fase dada', () => {
    expect(taskBody(activity, 'f1')).toEqual({
      title: 'Ver la introducción',
      status: 'PENDING',
      estimatedMinutes: 30,
      startDate: '2026-11-09',
      endDate: '2026-11-10',
      statusReason: null,
      phaseId: 'f1',
    });
  });

  it('pone el motivo que Proyectos exige al pausar o cancelar', () => {
    expect(taskBody({ ...activity, status: 'PAUSED' }, null).statusReason).toBe(SYNC_STATUS_REASON);
    expect(taskBody({ ...activity, status: 'CANCELLED' }, null).statusReason).toBe(
      SYNC_STATUS_REASON,
    );
    expect(taskBody({ ...activity, status: 'DONE' }, null).statusReason).toBeNull();
  });

  it('topa la duración al máximo de Proyectos', () => {
    expect(taskBody({ ...activity, durationMinutes: 20_000 }, null).estimatedMinutes).toBe(
      PROYECTOS_MAX_MINUTES,
    );
    expect(taskBody({ ...activity, durationMinutes: null }, null).estimatedMinutes).toBeNull();
  });
});

describe('phaseMoves', () => {
  it('no mueve nada si ya están en orden', () => {
    expect(phaseMoves(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([]);
  });

  it('sube cada fase hasta su lugar', () => {
    expect(phaseMoves(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'c']);
    expect(phaseMoves(['b', 'a'], ['a', 'b'])).toEqual(['a']);
  });

  it('deja al final las fases que no vienen de aquí', () => {
    expect(phaseMoves(['x', 'b', 'a'], ['a', 'b'])).toEqual(['a', 'a', 'b']);
  });
});
