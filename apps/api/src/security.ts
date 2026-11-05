import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export interface SecurityOptions {
  /** En producción se activan HSTS y la redirección de HTTP a HTTPS */
  production?: boolean;
  /** Orígenes (protocolo + dominio + puerto) que pueden llamar a la API desde un navegador */
  corsOrigins?: string[];
  /** Peticiones permitidas por IP y minuto en toda la API */
  rateLimitMax?: number;
}

/** Límite estricto para rutas sensibles (login): se aplica con `config: { rateLimit: authRateLimit }` */
export const authRateLimit = { max: 5, timeWindow: '1 minute' } as const;

/** Rutas que no se redirigen a HTTPS: el hosting comprueba la salud por HTTP interno */
const HTTPS_EXEMPT = new Set(['/api/v1/health']);

/**
 * Protecciones HTTP de la API (TEC-02). Se registran en la instancia raíz, antes que las rutas,
 * para que apliquen a todas.
 */
export function registerSecurity(
  app: FastifyInstance,
  { production = false, corsOrigins = [], rateLimitMax = 100 }: SecurityOptions,
) {
  // HTTPS obligatorio: detrás del proxy del hosting, request.protocol sale de X-Forwarded-Proto
  // (requiere trustProxy). 308 conserva el método y el cuerpo de la petición original.
  if (production) {
    app.addHook('onRequest', async (request, reply) => {
      if (request.protocol !== 'https' && !HTTPS_EXEMPT.has(request.url)) {
        return reply.redirect(`https://${request.host}${request.url}`, 308);
      }
    });
  }

  void app.register(helmet, {
    // HSTS obliga al navegador a usar solo HTTPS durante 1 año; en localhost rompería HTTP
    hsts: production ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });

  void app.register(cors, {
    origin: corsOrigins,
    // Permite enviar la cookie de sesión (HU-02) desde los orígenes autorizados
    credentials: true,
  });

  void app.register(rateLimit, {
    max: rateLimitMax,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      error: 'Too Many Requests',
      message: `Demasiadas peticiones. Intenta de nuevo en ${context.after}.`,
    }),
  });
}
