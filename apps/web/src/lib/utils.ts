import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina clases condicionales (clsx) y resuelve choques de Tailwind: cn('p-2', 'p-4') → 'p-4' */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
