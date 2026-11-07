/**
 * Las columnas `date` (fechas sin hora) llegan de Prisma como Date a medianoche UTC. Se convierten
 * a y desde "AAAA-MM-DD" siempre en UTC, para que la zona horaria del servidor no mueva el día.
 */
export function toIsoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function fromIsoDate(date: string | null): Date | null {
  return date ? new Date(`${date}T00:00:00.000Z`) : null;
}
