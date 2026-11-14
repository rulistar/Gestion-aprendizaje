import {
  BOARD_COLUMNS,
  ELEMENT_STATUS_LABELS,
  monthLabel,
  type MonthBucket,
  type ElementStatus,
} from '@aprendizaje/shared';
import { STATUS_STYLES } from '@/lib/status-colors';

/** Los estados con su color: para leer las gráficas */
export function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {BOARD_COLUMNS.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span aria-hidden className={`size-2.5 rounded-full ${STATUS_STYLES[status].dot}`} />
          {ELEMENT_STATUS_LABELS[status]}
        </li>
      ))}
    </ul>
  );
}

/** Cuántos elementos hay en cada estado, con barras proporcionales al total */
export function StatusTotalsChart({ totals }: { totals: Record<ElementStatus, number> }) {
  const all = BOARD_COLUMNS.reduce((sum, status) => sum + totals[status], 0);
  return (
    <ul className="grid gap-2">
      {BOARD_COLUMNS.map((status) => (
        <li key={status} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-2">
          <span className="text-sm">{ELEMENT_STATUS_LABELS[status]}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-muted">
            <span
              className={`block h-full ${STATUS_STYLES[status].dot}`}
              style={{ width: `${all === 0 ? 0 : (totals[status] / all) * 100}%` }}
            />
          </span>
          <span className="text-right text-sm tabular-nums">{totals[status]}</span>
        </li>
      ))}
    </ul>
  );
}

const BAR_WIDTH = 32;
const STEP = 48;
const PLOT_HEIGHT = 140;
const TOP = 18;
const BOTTOM = 28;

/**
 * Elementos por mes de término, cada barra dividida por estado. Una tabla oculta repite los datos
 * para quien usa lector de pantalla; los números también van sobre cada barra.
 */
export function EndMonthChart({
  months,
  withoutDate,
}: {
  months: readonly MonthBucket[];
  withoutDate: number;
}) {
  if (months.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ningún elemento tiene fecha de fin. Captúrala en su ficha para verlo aquí.
      </p>
    );
  }

  const max = Math.max(...months.map((month) => month.total), 1);
  const width = months.length * STEP + (STEP - BAR_WIDTH);
  const baseline = TOP + PLOT_HEIGHT;

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto pb-1">
        <svg
          role="img"
          aria-label="Elementos por mes de término, divididos por estado"
          viewBox={`0 0 ${width} ${baseline + BOTTOM}`}
          width={width}
          height={baseline + BOTTOM}
          className="max-w-none"
        >
          {months.map((month, index) => {
            const x = STEP - BAR_WIDTH + index * STEP;
            let offset = 0;
            const segments = BOARD_COLUMNS.flatMap((status) => {
              const count = month.byStatus[status];
              if (count === 0) return [];
              const height = (count / max) * PLOT_HEIGHT;
              offset += height;
              return [{ status, count, height, y: baseline - offset }];
            });
            return (
              <g key={month.month}>
                {segments.map(({ status, count, height, y }) => (
                  <rect
                    key={status}
                    x={x}
                    y={y}
                    width={BAR_WIDTH}
                    height={height}
                    className={STATUS_STYLES[status].fill}
                  >
                    <title>{`${monthLabel(month.month)} · ${ELEMENT_STATUS_LABELS[status]}: ${count}`}</title>
                  </rect>
                ))}
                {month.total > 0 && (
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={baseline - (month.total / max) * PLOT_HEIGHT - 4}
                    textAnchor="middle"
                    className="fill-foreground text-[10px]"
                  >
                    {month.total}
                  </text>
                )}
                <text
                  x={x + BAR_WIDTH / 2}
                  y={baseline + 16}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {monthLabel(month.month)}
                </text>
              </g>
            );
          })}
          <line x1={0} x2={width} y1={baseline} y2={baseline} className="stroke-border" />
        </svg>
      </div>

      <table className="sr-only">
        <caption>Elementos por mes de término y estado</caption>
        <thead>
          <tr>
            <th scope="col">Mes</th>
            {BOARD_COLUMNS.map((status) => (
              <th key={status} scope="col">
                {ELEMENT_STATUS_LABELS[status]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month}>
              <th scope="row">{monthLabel(month.month)}</th>
              {BOARD_COLUMNS.map((status) => (
                <td key={status}>{month.byStatus[status]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {withoutDate > 0 && (
        <p className="text-sm text-muted-foreground">
          {withoutDate === 1
            ? '1 elemento no tiene fecha de fin y no aparece en la gráfica.'
            : `${withoutDate} elementos no tienen fecha de fin y no aparecen en la gráfica.`}
        </p>
      )}
    </div>
  );
}
