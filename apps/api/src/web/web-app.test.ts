import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createTestDb } from '../test/test-db.js';

describe('la API sirve la web compilada (TEC-04)', () => {
  const webDist = mkdtempSync(join(tmpdir(), 'web-dist-'));
  writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>Aprendizaje</title>');
  mkdirSync(join(webDist, 'assets'));
  writeFileSync(join(webDist, 'assets', 'index-abc123.js'), 'console.log(1);');
  const db = createTestDb();
  const app = buildApp({ db, webDist });

  afterAll(async () => {
    await app.close();
    await db.$disconnect();
    rmSync(webDist, { recursive: true, force: true });
  });

  it('la raíz y las rutas de la web devuelven index.html, sin caché', async () => {
    for (const url of ['/', '/login', '/w/123/elementos']) {
      const response = await app.inject({ url });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.body).toContain('<title>Aprendizaje</title>');
    }
  });

  it('los archivos con hash se guardan en caché un año', async () => {
    const response = await app.inject({ url: '/assets/index-abc123.js' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('la API no cambia: /api que no existe sigue dando 404 en JSON', async () => {
    const missing = await app.inject({ url: '/api/v1/no-existe' });
    expect(missing.statusCode).toBe(404);
    expect(missing.headers['content-type']).toContain('application/json');
    expect((await app.inject({ url: '/api/v1/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/login' })).statusCode).toBe(404);
  });
});
