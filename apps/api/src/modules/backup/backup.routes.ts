import { backupSchema, backupToCsv, describeBackupIssues } from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyPluginCallback } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../workspaces/access.js';
import { buildBackup, importBackup } from './backup.service.js';

const BASE = '/workspaces/:workspaceId';
const exportQuerySchema = z.object({ format: z.enum(['json', 'csv']).default('json') });

/** Un respaldo grande son miles de nodos: más que el 1 MB que Fastify admite por omisión */
const IMPORT_BODY_LIMIT = 20 * 1024 * 1024;

/**
 * Exportar e importar (HU-06). Exporta cualquier miembro (lo que ve en el espacio); importa solo
 * el Admin, como en Gestor de Proyectos. Importar nunca borra ni sobrescribe: solo agrega.
 */
export const backupRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    `${BASE}/export`,
    { preHandler: requirePermission('data.export') },
    async (request, reply) => {
      const query = exportQuerySchema.safeParse(request.query);
      if (!query.success) return reply.code(400).send({ message: 'Formato no válido' });

      const backup = await buildBackup(app.db, request.membership!.workspaceId);
      const day = new Date().toISOString().slice(0, 10);
      const name = `gestor-aprendizaje-${day}`;
      void reply.header('Cache-Control', 'no-store');
      if (query.data.format === 'csv') {
        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="${name}.csv"`)
          .send(backupToCsv(backup));
      }
      return reply
        .header('Content-Type', 'application/json; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${name}.json"`)
        .send(JSON.stringify(backup, null, 2));
    },
  );

  // La vista previa y la importación reciben el mismo cuerpo; la primera no escribe nada
  for (const [path, apply] of [
    [`${BASE}/import/preview`, false],
    [`${BASE}/import`, true],
  ] as const) {
    app.post(
      path,
      { preHandler: requirePermission('data.import'), bodyLimit: IMPORT_BODY_LIMIT },
      async (request, reply) => {
        const parsed = backupSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ message: describeBackupIssues(parsed.error).join('\n') });
        }
        return importBackup(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          parsed.data,
          apply,
        );
      },
    );
  }

  done();
};
