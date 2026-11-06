import { emailSchema, passwordSchema, personNameSchema } from '@aprendizaje/shared';
import { z } from 'zod';
import type { Db } from '../../db/client.js';
import { auditCreate } from '../../db/audit.js';
import { hashPassword } from '../auth/password.js';

/** Nombre del workspace que se crea junto con el primer Admin; después se puede renombrar */
export const FIRST_WORKSPACE_NAME = 'Mi aprendizaje';

export const firstAdminSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type FirstAdminInput = z.input<typeof firstAdminSchema>;

/** Error esperado (no un fallo del programa): el comando lo muestra tal cual */
export class SetupError extends Error {}

export async function hasAnyUser(db: Db): Promise<boolean> {
  return (await db.user.count()) > 0;
}

/**
 * Crea el primer Admin: usuario administrador de la instalación, su workspace y su membresía como
 * Admin, todo en una transacción. Solo funciona si aún no existe ningún usuario.
 */
export async function createFirstAdmin(db: Db, input: FirstAdminInput) {
  const parsed = firstAdminSchema.safeParse(input);
  if (!parsed.success) {
    throw new SetupError(z.prettifyError(parsed.error));
  }
  const { name, email, password } = parsed.data;

  // Se calcula fuera de la transacción: el hash tarda y no debe retener la conexión
  const passwordHash = await hashPassword(password);

  return db.$transaction(async (tx) => {
    if ((await tx.user.count()) > 0) {
      throw new SetupError(
        'Ya existe al menos un usuario. El primer Admin solo se crea en una instalación vacía; ' +
          'los demás usuarios entran por invitación.',
      );
    }

    // createdById nulo: lo crea el sistema
    const user = await tx.user.create({
      data: { name, email, passwordHash, isSystemAdmin: true, ...auditCreate(null) },
    });
    const workspace = await tx.workspace.create({
      data: { name: FIRST_WORKSPACE_NAME, ...auditCreate(user.id) },
    });
    await tx.membership.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'ADMIN',
        ...auditCreate(user.id),
      },
    });

    return { user, workspace };
  });
}
