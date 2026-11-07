import { Prisma } from '../generated/prisma/client.js';

/** Dos peticiones a la vez pueden pasar la revisión de nombre: el índice único es el último filtro */
export function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
