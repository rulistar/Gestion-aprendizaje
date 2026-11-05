import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('aplica valores por defecto cuando no se define nada', () => {
    expect(loadEnv({})).toEqual({
      NODE_ENV: 'development',
      API_HOST: '127.0.0.1',
      API_PORT: 3001,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: ['http://localhost:5174'],
      TRUST_PROXY: false,
    });
  });

  it('convierte CORS_ORIGINS en una lista y TRUST_PROXY en booleano', () => {
    const env = loadEnv({
      CORS_ORIGINS: 'https://app.ejemplo.com, https://otra.ejemplo.com',
      TRUST_PROXY: 'true',
    });

    expect(env.CORS_ORIGINS).toEqual(['https://app.ejemplo.com', 'https://otra.ejemplo.com']);
    expect(env.TRUST_PROXY).toBe(true);
  });

  it('rechaza un origen CORS con ruta', () => {
    expect(() => loadEnv({ CORS_ORIGINS: 'https://app.ejemplo.com/inicio' })).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('rechaza un puerto inválido', () => {
    expect(() => loadEnv({ API_PORT: 'abc' })).toThrow(/API_PORT/);
  });
});
