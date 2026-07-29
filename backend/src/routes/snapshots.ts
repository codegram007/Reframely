import type { FastifyPluginAsync } from 'fastify';
import { SnapshotError, type SnapshotService } from '../services/snapshot/index.js';

/**
 * Snapshot endpoints. SnapshotError maps to a client-friendly status
 * with a stable code; anything else bubbles to Fastify's 500 handler.
 *
 *   POST /imports/:importId/snapshot  → SnapshotResult
 */
export function snapshotRoutes(service: SnapshotService): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Params: { importId: string } }>(
      '/imports/:importId/snapshot',
      async (request, reply) => {
        try {
          return await service.snapshotImport(request.params.importId);
        } catch (err) {
          if (err instanceof SnapshotError) {
            const status = err.code === 'IMPORT_NOT_FOUND' ? 404 : 422;
            return reply.code(status).send({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      },
    );
  };
}
