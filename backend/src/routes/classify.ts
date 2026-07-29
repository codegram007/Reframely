import type { FastifyPluginAsync } from 'fastify';
import { ClassifierError, type ClassifierService } from '../services/classifier/index.js';

/**
 * Classification endpoints. ClassifierError maps to a client-friendly
 * status with a stable code; anything else bubbles to Fastify's 500
 * handler.
 *
 *   POST /imports/:importId/classify  → ClassifyImportResult
 */
export function classifyRoutes(service: ClassifierService): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Params: { importId: string } }>(
      '/imports/:importId/classify',
      async (request, reply) => {
        try {
          return await service.classifyImport(request.params.importId);
        } catch (err) {
          if (err instanceof ClassifierError) {
            const status = err.code === 'IMPORT_NOT_FOUND' ? 404 : 422;
            return reply.code(status).send({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      },
    );
  };
}
