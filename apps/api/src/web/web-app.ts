import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

/** Archivos con hash en el nombre (Vite los pone en assets/): cambian de nombre si cambian */
const HASHED_ASSET = /[/\\]assets[/\\]/;

/**
 * Sirve la web compilada desde la misma API (TEC-04, ADR-0007): una sola URL, así la cookie de
 * sesión sigue siendo del mismo sitio y no hace falta abrir CORS. Las rutas de la web
 * (/w/…, /login) devuelven index.html y el enrutador de la web decide; lo que empieza con /api
 * y no existe sigue dando 404 en JSON.
 */
export function registerWebApp(app: FastifyInstance, root: string) {
  void app.register(fastifyStatic, {
    root,
    // Solo los archivos que existen al arrancar: lo demás llega al manejador de abajo
    wildcard: false,
    setHeaders: (reply, path) => {
      reply.header(
        'cache-control',
        HASHED_ASSET.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    },
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.method !== 'GET' || request.url.startsWith('/api/')) {
      return reply.code(404).send({
        message: `Route ${request.method}:${request.url} not found`,
        error: 'Not Found',
        statusCode: 404,
      });
    }
    return reply.header('cache-control', 'no-cache').sendFile('index.html');
  });
}
