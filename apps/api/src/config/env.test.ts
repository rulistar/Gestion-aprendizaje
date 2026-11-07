import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const DATABASE_URL = 'postgresql://usuario:clave@localhost:5433/aprendizaje';

describe('loadEnv', () => {
  it('aplica valores por defecto cuando solo se define DATABASE_URL', () => {
    expect(loadEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      API_HOST: '127.0.0.1',
      API_PORT: 3001,
      LOG_LEVEL: 'info',
      DATABASE_URL,
      CORS_ORIGINS: ['http://localhost:5174'],
      SESSION_IDLE_MINUTES: 60,
      TRUST_PROXY: false,
    });
  });

  it('WEB_DIST_DIR debe ser una ruta absoluta', () => {
    expect(() => loadEnv({ DATABASE_URL, WEB_DIST_DIR: 'apps/web/dist' })).toThrow(/absoluta/);
    const absolute = resolve('apps/web/dist');
    expect(loadEnv({ DATABASE_URL, WEB_DIST_DIR: absolute }).WEB_DIST_DIR).toBe(absolute);
  });

  it('convierte CORS_ORIGINS en una lista y TRUST_PROXY en booleano', () => {
    const env = loadEnv({
      DATABASE_URL,
      CORS_ORIGINS: 'https://app.ejemplo.com, https://otra.ejemplo.com',
      TRUST_PROXY: 'true',
    });

    expect(env.CORS_ORIGINS).toEqual(['https://app.ejemplo.com', 'https://otra.ejemplo.com']);
    expect(env.TRUST_PROXY).toBe(true);
  });

  it('rechaza un origen CORS con ruta', () => {
    expect(() => loadEnv({ DATABASE_URL, CORS_ORIGINS: 'https://app.ejemplo.com/inicio' })).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('falla con un mensaje claro si falta DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rechaza una DATABASE_URL que no sea de PostgreSQL', () => {
    expect(() => loadEnv({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/postgresql/);
  });

  it('rechaza un puerto inválido', () => {
    expect(() => loadEnv({ DATABASE_URL, API_PORT: 'abc' })).toThrow(/API_PORT/);
  });
});
