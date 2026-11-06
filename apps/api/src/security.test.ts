import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { authRateLimit, type SecurityOptions } from './security.js';
import { createTestDb } from './test/test-db.js';

const db = createTestDb();
const apps: ReturnType<typeof buildApp>[] = [];

afterAll(async () => {
  await Promise.all(apps.map((app) => app.close()));
  await db.$disconnect();
});

function makeApp(security: SecurityOptions = {}, trustProxy = false) {
  const app = buildApp({ db, security, trustProxy });
  apps.push(app);
  return app;
}

const HEALTH = '/api/v1/health';

describe('cabeceras de seguridad (helmet)', () => {
  it('agrega las cabeceras de seguridad a las respuestas', async () => {
    const response = await makeApp().inject({ method: 'GET', url: HEALTH });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('en desarrollo no envía HSTS (romperría HTTP en localhost)', async () => {
    const response = await makeApp().inject({ method: 'GET', url: HEALTH });

    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('en producción envía HSTS por 1 año', async () => {
    const response = await makeApp({ production: true }, true).inject({
      method: 'GET',
      url: HEALTH,
      headers: { 'x-forwarded-proto': 'https' },
    });

    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });
});

describe('HTTPS obligatorio en producción', () => {
  const app = makeApp({ production: true }, true);

  it('redirige HTTP a HTTPS conservando la ruta', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/no-existe?x=1',
      headers: { host: 'app.ejemplo.com', 'x-forwarded-proto': 'http' },
    });

    expect(response.statusCode).toBe(308);
    expect(response.headers.location).toBe('https://app.ejemplo.com/api/v1/no-existe?x=1');
  });

  it('atiende normalmente las peticiones HTTPS', async () => {
    const response = await app.inject({
      method: 'GET',
      url: HEALTH,
      headers: { 'x-forwarded-proto': 'https' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('no redirige el health check, que el hosting hace por HTTP interno', async () => {
    const response = await app.inject({ method: 'GET', url: HEALTH });

    expect(response.statusCode).toBe(200);
  });

  it('en desarrollo no redirige', async () => {
    const response = await makeApp().inject({ method: 'GET', url: HEALTH });

    expect(response.statusCode).toBe(200);
  });
});

describe('CORS', () => {
  const app = makeApp({ corsOrigins: ['https://app.ejemplo.com'] });

  it('permite un origen autorizado, con cookies', async () => {
    const response = await app.inject({
      method: 'GET',
      url: HEALTH,
      headers: { origin: 'https://app.ejemplo.com' },
    });

    expect(response.headers['access-control-allow-origin']).toBe('https://app.ejemplo.com');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('no autoriza a un origen desconocido', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: HEALTH,
      headers: { origin: 'https://sitio-malicioso.com', 'access-control-request-method': 'POST' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('límite de peticiones', () => {
  it('responde 429 al superar el límite global', async () => {
    const app = makeApp({ rateLimitMax: 2 });

    for (let i = 0; i < 2; i++) {
      expect((await app.inject({ method: 'GET', url: HEALTH })).statusCode).toBe(200);
    }
    const blocked = await app.inject({ method: 'GET', url: HEALTH });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.json<{ message: string }>().message).toMatch(/Demasiadas peticiones/);
  });

  it('las rutas sensibles usan un límite más estricto (authRateLimit)', async () => {
    const app = makeApp();
    // Como un módulo real: se registra como plugin, después de las protecciones
    void app.register((instance, _options, done) => {
      instance.post('/login-de-prueba', { config: { rateLimit: authRateLimit } }, () => ({
        ok: true,
      }));
      done();
    });

    for (let i = 0; i < authRateLimit.max; i++) {
      expect((await app.inject({ method: 'POST', url: '/login-de-prueba' })).statusCode).toBe(200);
    }
    const blocked = await app.inject({ method: 'POST', url: '/login-de-prueba' });

    expect(blocked.statusCode).toBe(429);
  });
});
