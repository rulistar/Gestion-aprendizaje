import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { verifyPassword } from '../auth/password.js';
import { createFirstAdmin, FIRST_WORKSPACE_NAME, hasAnyUser, SetupError } from './first-admin.js';

const db = createTestDb();

afterAll(async () => {
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

const input = { name: 'Ana', email: '  Ana@Example.COM ', password: 'una-clave-bien-larga' };

describe('createFirstAdmin', () => {
  it('crea el Admin de la instalación, su workspace y su membresía como Admin', async () => {
    const { user, workspace } = await createFirstAdmin(db, input);

    expect(user).toMatchObject({
      name: 'Ana',
      email: 'ana@example.com', // normalizado
      isSystemAdmin: true,
      createdById: null, // lo crea el sistema
    });
    expect(workspace).toMatchObject({ name: FIRST_WORKSPACE_NAME, createdById: user.id });

    const membership = await db.membership.findFirstOrThrow({ where: { userId: user.id } });
    expect(membership).toMatchObject({ workspaceId: workspace.id, role: 'ADMIN' });
    expect(await hasAnyUser(db)).toBe(true);
  });

  it('guarda un hash Argon2id, nunca la contraseña', async () => {
    const { user } = await createFirstAdmin(db, input);

    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(input.password);
    expect(await verifyPassword(user.passwordHash ?? '', input.password)).toBe(true);
    expect(await verifyPassword(user.passwordHash ?? '', 'otra-clave-cualquiera')).toBe(false);
  });

  it('se niega si ya existe algún usuario', async () => {
    await createFirstAdmin(db, input);

    await expect(
      createFirstAdmin(db, { ...input, email: 'luis@example.com' }),
    ).rejects.toBeInstanceOf(SetupError);
    expect(await db.user.count()).toBe(1);
  });

  it('rechaza una contraseña de menos de 12 caracteres', async () => {
    await expect(createFirstAdmin(db, { ...input, password: 'corta123' })).rejects.toThrow(
      /Mínimo 12 caracteres/,
    );
    expect(await hasAnyUser(db)).toBe(false);
  });

  it('rechaza un correo inválido y un nombre vacío', async () => {
    await expect(createFirstAdmin(db, { ...input, email: 'no-es-correo' })).rejects.toThrow(
      /Correo no válido/,
    );
    await expect(createFirstAdmin(db, { ...input, name: '   ' })).rejects.toThrow(
      /El nombre es obligatorio/,
    );
  });

  it('el mensaje de error nunca incluye la contraseña', async () => {
    const password = 'secreta'; // inválida a propósito
    const error = await createFirstAdmin(db, { ...input, password }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SetupError);
    expect((error as SetupError).message).not.toContain(password);
  });
});
