import type { FastifyPluginAsync } from 'fastify';
import { TreeError, type ProjectTreeService } from '../services/trees/index.js';

/**
 * Classified widget trees for the editor.
 *
 *   GET /projects/:projectId/tree  → all pages + primary tree
 */
export function treeRoutes(service: ProjectTreeService): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: { projectId: string } }>(
      '/projects/:projectId/tree',
      async (request, reply) => {
        try {
          return await service.listProjectTrees(request.params.projectId);
        } catch (err) {
          if (err instanceof TreeError) {
            return reply
              .code(err.code === 'NOT_FOUND' ? 404 : 422)
              .send({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      },
    );
  };
}
