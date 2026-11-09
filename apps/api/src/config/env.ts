import { isAbsolute } from 'node:path';
import { z } from 'zod';

/** Una variable vacía ("PROYECTOS_API_TOKEN=") cuenta como no definida */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/** Variables de entorno que usa la API. Si alguna es inválida, la app no arranca. */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_HOST: z.string().min(1).default('127.0.0.1'),
    // 3001 y no 3000: así corre al mismo tiempo que Gestor de Proyectos (para probar la integración)
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
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
    // Integración con Gestor de Proyectos (INT-02, ADR-0004): las tres o ninguna. Sin ellas, apagada
    PROYECTOS_API_URL: optional(
      z
        .url({ protocol: /^https?$/, error: 'Debe ser una URL http(s)://' })
        .refine(isOrigin, 'Debe ser solo un origen'),
    ),
    // Token Bearer del usuario de servicio en Proyectos: secreto, solo aquí y en Render
    PROYECTOS_API_TOKEN: optional(z.string().min(20, 'Token demasiado corto')),
    PROYECTOS_WORKSPACE_ID: optional(z.uuid('Debe ser el ID (UUID) de un espacio de Proyectos')),
  })
  .superRefine((env, context) => {
    const keys = ['PROYECTOS_API_URL', 'PROYECTOS_API_TOKEN', 'PROYECTOS_WORKSPACE_ID'] as const;
    const given = keys.filter((key) => env[key] !== undefined);
    if (given.length > 0 && given.length < keys.length) {
      for (const key of keys.filter((key) => env[key] === undefined)) {
        context.addIssue({ code: 'custom', path: [key], message: 'Falta: van las tres juntas' });
      }
    }
    if (env.NODE_ENV === 'production' && env.PROYECTOS_API_URL?.startsWith('http:')) {
      context.addIssue({
        code: 'custom',
        path: ['PROYECTOS_API_URL'],
        message: 'En producción debe ser https://',
      });
    }
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

/** Conexión con Gestor de Proyectos (ADR-0004 §4); null si la integración está apagada */
export interface ProyectosConfig {
  url: string;
  token: string;
  workspaceId: string;
}

export function proyectosConfig(env: Env): ProyectosConfig | null {
  const { PROYECTOS_API_URL: url, PROYECTOS_API_TOKEN: token, PROYECTOS_WORKSPACE_ID: id } = env;
  return url && token && id ? { url, token, workspaceId: id } : null;
}
