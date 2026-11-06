import { healthResponseSchema } from '@aprendizaje/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb } from '../../test/test-db.js';

describe('GET /api/v1/health', () => {
  const db = createTestDb();
  const app = buildApp({ db });

  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  it('responde 200 con un cuerpo que cumple el esquema compartido', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');

    const body = healthResponseSchema.parse(response.json());
    expect(body.status).toBe('ok');
  });

  it('responde 404 en rutas que no existen', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/no-existe' });

    expect(response.statusCode).toBe(404);
  });
});
