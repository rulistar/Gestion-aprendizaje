import { createInterface } from 'node:readline/promises';
import { loadEnv } from '../config/env.js';
import { createDb } from '../db/client.js';
import {
  createFirstAdmin,
  FIRST_WORKSPACE_NAME,
  hasAnyUser,
  SetupError,
} from '../modules/setup/first-admin.js';
import { askHidden, CancelledError } from './prompt.js';

/**
 * Comando de instalación: `pnpm --filter @aprendizaje/api setup:admin`.
 * Pide los datos de forma interactiva para que la contraseña no quede en el historial
 * de la terminal (como pasaría con un argumento) ni se vea en pantalla.
 */

async function main() {
  if (!process.stdin.isTTY) {
    throw new SetupError('Ejecuta este comando en una terminal interactiva.');
  }

  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  try {
    // Se comprueba antes de pedir datos, para no hacer escribir la contraseña en vano
    if (await hasAnyUser(db)) {
      throw new SetupError('Ya existe al menos un usuario: el primer Admin ya fue creado.');
    }

    console.log('Crear el primer administrador\n');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const name = await rl.question('Nombre: ');
    const email = await rl.question('Correo: ');
    rl.close();

    const password = await askHidden('Contraseña (mínimo 12 caracteres): ');
    const confirmation = await askHidden('Repite la contraseña: ');
    if (password !== confirmation) {
      throw new SetupError('Las contraseñas no coinciden.');
    }

    const { user } = await createFirstAdmin(db, { name, email, password });
    console.log(
      `\n✔ Administrador ${user.email} creado, con el workspace "${FIRST_WORKSPACE_NAME}".`,
    );
  } finally {
    await db.$disconnect();
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof SetupError || error instanceof CancelledError) {
    console.error(`\n✖ ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
