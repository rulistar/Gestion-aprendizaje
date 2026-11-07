import { createNodeSchema, moveNodeSchema, updateNodeSchema } from '@aprendizaje/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../workspaces/access.js';
import { sendElementError, todayOf } from './elements.routes.js';
import {
  createNode,
  deleteNode,
  InvalidStructureError,
  listNodes,
  moveNode,
  updateNode,
} from './nodes.service.js';

const elementParamsSchema = z.object({ elementId: z.uuid() });
const nodeParamsSchema = elementParamsSchema.extend({ nodeId: z.uuid() });

const BASE = '/workspaces/:workspaceId/elements/:elementId/nodes';
const ELEMENT_NOT_FOUND = 'Elemento no encontrado';
const NOT_FOUND = 'Nodo no encontrado';

function sendNodeError(reply: FastifyReply, error: unknown) {
  if (error instanceof InvalidStructureError) {
    return reply.code(400).send({ message: error.message });
  }
  return sendElementError(reply, error);
}

/**
 * Estructura de un elemento (HU-04). Armarla es parte de editar el elemento: la maneja quien tiene
 * element.update, también para quitar nodos, como las fases en Gestor de Proyectos.
 */
export const nodesRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(BASE, { preHandler: requirePermission('element.read') }, async (request, reply) => {
    const params = elementParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(404).send({ message: ELEMENT_NOT_FOUND });
    const nodes = await listNodes(app.db, request.membership!.workspaceId, params.data.elementId);
    return nodes ?? (await reply.code(404).send({ message: ELEMENT_NOT_FOUND }));
  });

  app.post(BASE, { preHandler: requirePermission('element.update') }, async (request, reply) => {
    const params = elementParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(404).send({ message: ELEMENT_NOT_FOUND });
    const parsed = createNodeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    try {
      const node = await createNode(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        params.data.elementId,
        parsed.data,
        todayOf(request),
      );
      if (!node) return await reply.code(404).send({ message: ELEMENT_NOT_FOUND });
      return await reply.code(201).send(node);
    } catch (error) {
      return sendNodeError(reply, error);
    }
  });

  app.put(
    `${BASE}/:nodeId`,
    { preHandler: requirePermission('element.update') },
    async (request, reply) => {
      const params = nodeParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: NOT_FOUND });
      const parsed = updateNodeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      try {
        const node = await updateNode(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          params.data.elementId,
          params.data.nodeId,
          parsed.data,
          todayOf(request),
        );
        return node ?? (await reply.code(404).send({ message: NOT_FOUND }));
      } catch (error) {
        return sendNodeError(reply, error);
      }
    },
  );

  app.post(
    `${BASE}/:nodeId/move`,
    { preHandler: requirePermission('element.update') },
    async (request, reply) => {
      const params = nodeParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: NOT_FOUND });
      const parsed = moveNodeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      const moved = await moveNode(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        params.data.elementId,
        params.data.nodeId,
        parsed.data,
      );
      return moved ? reply.code(204).send() : reply.code(404).send({ message: NOT_FOUND });
    },
  );

  app.delete(
    `${BASE}/:nodeId`,
    { preHandler: requirePermission('element.update') },
    async (request, reply) => {
      const params = nodeParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: NOT_FOUND });
      const deleted = await deleteNode(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        params.data.elementId,
        params.data.nodeId,
      );
      return deleted ? reply.code(204).send() : reply.code(404).send({ message: NOT_FOUND });
    },
  );

  done();
};
