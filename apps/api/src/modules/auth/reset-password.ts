import { emailSchema, passwordSchema } from '@aprendizaje/shared';
import type { Db } from '../../db/client.js';
import { hashPassword } from './password.js';

/** Error esperado (no un fallo del programa): el comando lo muestra tal cual */
export class ResetPasswordError extends Error {}

/**
 * Restablece una contraseña desde la terminal (HU-09), para cuando se olvida y no hay otra forma de
 * entrar. No pide la anterior: quien lo corre ya tiene acceso a la BD. Cierra todas las sesiones de
 * la cuenta, por si alguien más la estaba usando. Si estaba desactivada, sigue desactivada.
 */
export async function resetPasswordByEmail(db: Db, email: string, password: string) {
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) throw new ResetPasswordError('Correo no válido.');
  const parsedPassword = passwordSchema.safeParse(password);
  if (!parsedPassword.success) {
    throw new ResetPasswordError(
      parsedPassword.error.issues[0]?.message ?? 'Contraseña no válida.',
    );
  }

  const user = await db.user.findFirst({
    where: { email: parsedEmail.data, kind: 'HUMAN' },
    select: { id: true, email: true, status: true },
  });
  if (!user) {
    throw new ResetPasswordError(`No hay ninguna cuenta con el correo ${parsedEmail.data}.`);
  }

  // Se calcula fuera de la transacción: el hash tarda y no debe retener la conexión
  const passwordHash = await hashPassword(parsedPassword.data);
  // updatedById nulo: lo cambia el sistema, no una persona con sesión (RNF-01)
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash, updatedById: null } }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);
  return user;
}
