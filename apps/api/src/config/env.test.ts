import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadEnv, proyectosConfig } from './env.js';

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

  describe('integración con Gestor de Proyectos (INT-02)', () => {
    const proyectos = {
      PROYECTOS_API_URL: 'https://proyectos.ejemplo.com',
      PROYECTOS_API_TOKEN: 'token-ficticio-de-al-menos-veinte',
      PROYECTOS_WORKSPACE_ID: '0190f5a4-0000-7000-8000-000000000001',
    };

    it('sin las variables (o vacías) queda apagada', () => {
      expect(proyectosConfig(loadEnv({ DATABASE_URL }))).toBeNull();
      expect(proyectosConfig(loadEnv({ DATABASE_URL, PROYECTOS_API_TOKEN: '' }))).toBeNull();
    });

    it('con las tres, queda encendida', () => {
      expect(proyectosConfig(loadEnv({ DATABASE_URL, ...proyectos }))).toEqual({
        url: proyectos.PROYECTOS_API_URL,
        token: proyectos.PROYECTOS_API_TOKEN,
        workspaceId: proyectos.PROYECTOS_WORKSPACE_ID,
      });
    });

    it('van las tres juntas', () => {
      expect(() =>
        loadEnv({ DATABASE_URL, PROYECTOS_API_URL: proyectos.PROYECTOS_API_URL }),
      ).toThrow(/PROYECTOS_API_TOKEN/);
    });

    it('en producción la URL debe ser https y siempre solo un origen', () => {
      const http = { ...proyectos, PROYECTOS_API_URL: 'http://proyectos.ejemplo.com' };
      expect(() => loadEnv({ DATABASE_URL, NODE_ENV: 'production', ...http })).toThrow(/https/);
      expect(loadEnv({ DATABASE_URL, ...http }).PROYECTOS_API_URL).toBe(http.PROYECTOS_API_URL);
      expect(() =>
        loadEnv({ DATABASE_URL, ...proyectos, PROYECTOS_API_URL: 'https://p.ejemplo.com/api' }),
      ).toThrow(/origen/);
    });
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
