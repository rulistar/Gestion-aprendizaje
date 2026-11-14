import type { ElementStatus } from '@aprendizaje/shared';

/**
 * Un color por estado, el mismo en el tablero y en las gráficas. Las clases van completas (no
 * armadas con texto) para que Tailwind las encuentre; el color nunca va solo: siempre hay etiqueta.
 */
export const STATUS_STYLES: Record<ElementStatus, { fill: string; dot: string }> = {
  NOT_STARTED: { fill: 'fill-slate-400', dot: 'bg-slate-400' },
  IN_PROGRESS: { fill: 'fill-blue-500', dot: 'bg-blue-500' },
  PAUSED: { fill: 'fill-amber-500', dot: 'bg-amber-500' },
  CANCELLED: { fill: 'fill-rose-400', dot: 'bg-rose-400' },
  DONE: { fill: 'fill-emerald-500', dot: 'bg-emerald-500' },
};
