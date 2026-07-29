import type { FastifyPluginAsync } from 'fastify';
import { VersionError, type VersionService } from '../services/versions/index.js';

/**
 * Tree versions (B8/B9).
 *
 *   POST /projects/:projectId/versions  { tree, label?, source? }
 *   GET  /projects/:projectId/versions
 *   GET  /projects/:projectId/versions/:versionId
 */
export function versionRoutes(service: VersionService): FastifyPluginAsync {
  return async (app) => {
    app.post<{
      Params: { projectId: string };
      Body: { tree: unknown; label?: string; source?: 'autosave' | 'manual' };
    }>(
      '/projects/:projectId/versions',
      {
        schema: {
          body: {
            type: 'object',
            required: ['tree'],
            properties: {
              tree: {},
              label: { type: 'string' },
              source: { type: 'string', enum: ['autosave', 'manual'] },
            },
          },
        },
      },
      async (request, reply) => {
        try {
          return await service.save(request.params.projectId, request.body);
        } catch (err) {
          if (err instanceof VersionError) {
            return reply
              .code(err.code === 'NOT_FOUND' ? 404 : 422)
              .send({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      },
    );

    app.get<{ Params: { projectId: string } }>(
      '/projects/:projectId/versions',
      async (request) => {
        const versions = await service.list(request.params.projectId);
        return { projectId: request.params.projectId, versions };
      },
    );

    app.get<{ Params: { projectId: string; versionId: string } }>(
      '/projects/:projectId/versions/:versionId',
      async (request, reply) => {
        try {
          return await service.get(request.params.projectId, request.params.versionId);
        } catch (err) {
          if (err instanceof VersionError) {
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
