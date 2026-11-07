import { isAbsolute } from 'node:path';
import { z } from 'zod';

/** Variables de entorno que usa la API. Si alguna es inválida, la app no arranca. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  // 3001 y no 3000: así corre al mismo tiempo que Gestor de Proyectos (para probar la integración)
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'Debe ser una URL postgresql://' }),
  // Lista separada por comas: "https://app.ejemplo.com,https://otra.ejemplo.com"
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5174')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url({ protocol: /^https?$/ }).refine(isOrigin, 'Debe ser solo un origen'))),
  // Minutos sin actividad tras los que expira una sesión
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  // true solo detrás del proxy del hosting: así se confía en X-Forwarded-For / X-Forwarded-Proto
  TRUST_PROXY: z.stringbool().default(false),
  // Carpeta de la web compilada; en producción, si no se da, se usa apps/web/dist (TEC-04)
  WEB_DIST_DIR: z.string().refine(isAbsolute, 'Debe ser una ruta absoluta').optional(),
});

/** Un origen es protocolo + dominio + puerto, sin ruta ni barra final */
function isOrigin(value: string): boolean {
  return new URL(value).origin === value;
}

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
