import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, resetDb } from '../test/test-db.js';
import { auditCreate, auditRestore, auditSoftDelete, notDeleted } from './audit.js';

// Pruebas de integración contra PostgreSQL real: verifican las reglas del modelo base
const db = createTestDb();

afterAll(async () => {
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

function createUser(email: string) {
  return db.user.create({
    data: { email, name: email.split('@')[0] ?? email, ...auditCreate(null) },
  });
}

describe('convenciones', () => {
  it('genera IDs UUID v7 y fechas de creación y modificación', async () => {
    const user = await createUser('ana@example.com');

    // El dígito 13 de un UUID indica su versión
    expect(user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('valores por defecto de un usuario: humano, activo y sin permisos de sistema', async () => {
    const user = await createUser('ana@example.com');

    expect(user).toMatchObject({ kind: 'HUMAN', status: 'ACTIVE', isSystemAdmin: false });
  });

  it('no permite dos usuarios con el mismo correo', async () => {
    await createUser('ana@example.com');

    await expect(createUser('ana@example.com')).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('trazabilidad', () => {
  it('registra quién creó y modificó un workspace', async () => {
    const ana = await createUser('ana@example.com');
    const luis = await createUser('luis@example.com');

    const workspace = await db.workspace.create({
      data: { name: 'Personal', ...auditCreate(ana.id) },
    });
    expect(workspace).toMatchObject({ createdById: ana.id, updatedById: ana.id });

    const updated = await db.workspace.update({
      where: { id: workspace.id },
      data: { name: 'Personal 2026', updatedById: luis.id },
    });
    expect(updated).toMatchObject({ createdById: ana.id, updatedById: luis.id });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(workspace.updatedAt.getTime());
  });
});

describe('borrado lógico', () => {
  it('lo que está en la papelera no aparece con el filtro notDeleted, y se puede restaurar', async () => {
    const ana = await createUser('ana@example.com');
    const workspace = await db.workspace.create({
      data: { name: 'Trabajo', ...auditCreate(ana.id) },
    });

    await db.workspace.update({ where: { id: workspace.id }, data: auditSoftDelete(ana.id) });
    expect(await db.workspace.findMany({ where: notDeleted })).toHaveLength(0);

    const trashed = await db.workspace.findUniqueOrThrow({ where: { id: workspace.id } });
    expect(trashed.deletedById).toBe(ana.id);

    await db.workspace.update({ where: { id: workspace.id }, data: auditRestore(ana.id) });
    expect(await db.workspace.findMany({ where: notDeleted })).toHaveLength(1);
  });
});

describe('membresías', () => {
  it('un usuario no puede ser miembro activo dos veces del mismo workspace', async () => {
    const ana = await createUser('ana@example.com');
    const workspace = await db.workspace.create({
      data: { name: 'Equipo', ...auditCreate(ana.id) },
    });
    const data = {
      workspaceId: workspace.id,
      userId: ana.id,
      role: 'ADMIN' as const,
      ...auditCreate(ana.id),
    };

    await db.membership.create({ data });

    await expect(db.membership.create({ data })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('si la membresía anterior está en la papelera, se puede volver a agregar (índice parcial)', async () => {
    const ana = await createUser('ana@example.com');
    const luis = await createUser('luis@example.com');
    const workspace = await db.workspace.create({
      data: { name: 'Equipo', ...auditCreate(ana.id) },
    });
    const data = {
      workspaceId: workspace.id,
      userId: luis.id,
      role: 'MEMBER' as const,
      ...auditCreate(ana.id),
    };

    const first = await db.membership.create({ data });
    await db.membership.update({ where: { id: first.id }, data: auditSoftDelete(ana.id) });

    const again = await db.membership.create({ data });
    expect(again.id).not.toBe(first.id);

    const active = await db.membership.findMany({
      where: { workspaceId: workspace.id, ...notDeleted },
    });
    expect(active).toHaveLength(1);
  });
});

describe('sesiones', () => {
  it('al eliminar un usuario de la BD se eliminan sus sesiones', async () => {
    const ana = await createUser('ana@example.com');
    await db.session.create({
      data: {
        tokenHash: 'hash-de-prueba',
        userId: ana.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await db.user.delete({ where: { id: ana.id } });

    expect(await db.session.count()).toBe(0);
  });
});
