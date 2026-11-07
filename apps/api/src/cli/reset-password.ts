import { createInterface } from 'node:readline/promises';
import { loadEnv } from '../config/env.js';
import { createDb } from '../db/client.js';
import { resetPasswordByEmail, ResetPasswordError } from '../modules/auth/reset-password.js';
import { askHidden, CancelledError } from './prompt.js';

/**
 * Restablecer una contraseña desde la terminal (HU-09): `pnpm reset:password`. Usa la BD de
 * DATABASE_URL (la de producción si se pone en la terminal). La contraseña se pide sin mostrarla,
 * para que no quede en el historial.
 */
async function main() {
  if (!process.stdin.isTTY) {
    throw new ResetPasswordError('Ejecuta este comando en una terminal interactiva.');
  }

  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  try {
    console.log('Restablecer una contraseña\n');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const email = await rl.question('Correo de la cuenta: ');
    rl.close();

    const password = await askHidden('Contraseña nueva (mínimo 12 caracteres): ');
    const confirmation = await askHidden('Repite la contraseña: ');
    if (password !== confirmation) {
      throw new ResetPasswordError('Las contraseñas no coinciden.');
    }

    const user = await resetPasswordByEmail(db, email, password);
    console.log(`\n✔ Contraseña de ${user.email} restablecida; sus sesiones se cerraron.`);
    if (user.status !== 'ACTIVE') {
      console.log('  La cuenta sigue desactivada: con esta contraseña todavía no puede entrar.');
    }
  } finally {
    await db.$disconnect();
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof ResetPasswordError || error instanceof CancelledError) {
    console.error(`\n✖ ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
