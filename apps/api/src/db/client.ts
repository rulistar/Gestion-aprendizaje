import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../generated/prisma/client.js';

export type Db = PrismaClient;

/** Cliente dentro de una transacción (db.$transaction): para funciones que se usan en ambas */
export type Tx = Prisma.TransactionClient;

/** Crea el cliente de Prisma conectado a PostgreSQL mediante el driver `pg`. */
export function createDb(databaseUrl: string): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
