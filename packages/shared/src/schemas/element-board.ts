import {
  ELEMENT_STATUSES,
  type Element,
  type ElementFicha,
  type ElementStatus,
} from './elements.js';

/**
 * Tablero por estado y gráficas (HU-08): lo que se calcula con la lista de elementos, sin tocar la
 * API. Una columna por estado, en el orden de ELEMENT_STATUSES.
 */

function emptyByStatus<T>(make: () => T): Record<ElementStatus, T> {
  return {
    NOT_STARTED: make(),
    IN_PROGRESS: make(),
    PAUSED: make(),
    CANCELLED: make(),
    DONE: make(),
  };
}

/** Los elementos de cada estado, cada uno en el orden en que venían */
export function groupByStatus<T extends { status: ElementStatus }>(
  items: readonly T[],
): Record<ElementStatus, T[]> {
  const groups = emptyByStatus<T[]>(() => []);
  for (const item of items) groups[item.status].push(item);
  return groups;
}

/** Cuántos elementos hay en cada estado */
export function statusTotals(items: readonly { status: ElementStatus }[]) {
  const totals = emptyByStatus(() => 0);
  for (const { status } of items) totals[status] += 1;
  return totals;
}

/** "AAAA-MM" del mes en que termina: el fin real si ya lo hay y, si no, el estimado */
export function endMonth(element: {
  actualEnd: string | null;
  estimatedEnd: string | null;
}): string | null {
  const day = element.actualEnd ?? element.estimatedEnd;
  return day ? day.slice(0, 7) : null;
}

export interface MonthBucket {
  /** "AAAA-MM" */
  month: string;
  total: number;
  byStatus: Record<ElementStatus, number>;
}

function nextMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5, 7));
  return number === 12
    ? `${year + 1}-01`
    : `${String(year).padStart(4, '0')}-${String(number + 1).padStart(2, '0')}`;
}

/**
 * Elementos por mes de término, cada mes con el estado de los suyos. Los meses van seguidos, del
 * primero al último, aunque alguno quede en cero: así la gráfica no esconde los huecos. Los
 * elementos sin ninguna fecha de fin se cuentan aparte.
 */
export function elementsByEndMonth(
  items: readonly {
    status: ElementStatus;
    actualEnd: string | null;
    estimatedEnd: string | null;
  }[],
): { months: MonthBucket[]; withoutDate: number } {
  const buckets = new Map<string, MonthBucket>();
  let withoutDate = 0;
  for (const item of items) {
    const month = endMonth(item);
    if (month === null) {
      withoutDate += 1;
      continue;
    }
    const bucket =
      buckets.get(month) ??
      ({ month, total: 0, byStatus: emptyByStatus(() => 0) } satisfies MonthBucket);
    bucket.total += 1;
    bucket.byStatus[item.status] += 1;
    buckets.set(month, bucket);
  }

  const sorted = [...buckets.keys()].sort();
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first === undefined || last === undefined) return { months: [], withoutDate };

  const months: MonthBucket[] = [];
  for (let month = first; month <= last; month = nextMonth(month)) {
    months.push(buckets.get(month) ?? { month, total: 0, byStatus: emptyByStatus(() => 0) });
  }
  return { months, withoutDate };
}

const MONTH_NAMES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** "2026-03" → "mar 2026" */
export function monthLabel(month: string): string {
  const name = MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month.slice(5, 7);
  return `${name} ${month.slice(0, 4)}`;
}

/**
 * La ficha de un elemento con otro estado, para cambiarlo desde el tablero: PUT reemplaza la ficha
 * completa. Las fechas reales automáticas las resuelve la API al ver que cambia el estado.
 */
export function elementToFicha(element: Element, status: ElementStatus): ElementFicha {
  return {
    typeId: element.typeId,
    name: element.name,
    platformId: element.platformId,
    sponsorId: element.sponsorId,
    categoryId: element.categoryId,
    levelId: element.levelId,
    authorId: element.authorId,
    genreId: element.genreId,
    pages: element.pages,
    durationWeeks: element.durationWeeks,
    daysPerWeek: element.daysPerWeek,
    hoursPerDay: element.hoursPerDay,
    manualTotalHours: element.manualTotalHours,
    actualHours: element.actualHours,
    estimatedStart: element.estimatedStart,
    estimatedEnd: element.estimatedEnd,
    actualStart: element.actualStart,
    actualEnd: element.actualEnd,
    status,
    priority: element.priority,
    notes: element.notes,
  };
}

/** Los estados en el orden de las columnas */
export const BOARD_COLUMNS = ELEMENT_STATUSES;
