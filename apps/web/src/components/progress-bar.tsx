import type { Progress } from '@aprendizaje/shared';

/** Barra de avance (ADR-0002 §4), con las actividades Hechas de las que cuentan */
export function ProgressBar({ progress, label }: { progress: Progress; label: string }) {
  if (progress.total === 0) {
    return <span className="text-xs text-muted-foreground">Sin actividades</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
      >
        <span className="block h-full bg-primary" style={{ width: `${progress.percent}%` }} />
      </span>
      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {progress.done}/{progress.total} · {progress.percent} %
      </span>
    </span>
  );
}
