import type { FastifyPluginAsync } from 'fastify';
import { CodegenError, type CodegenService } from '../services/codegen/index.js';

/**
 * Codegen endpoints. CodegenError maps to a client-friendly status with
 * a stable code; anything else bubbles to Fastify's 500 handler.
 *
 *   POST /imports/:importId/generate  → GenerateImportResult
 */
export function generateRoutes(service: CodegenService): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Params: { importId: string } }>(
      '/imports/:importId/generate',
      async (request, reply) => {
        try {
          return await service.generateImport(request.params.importId);
        } catch (err) {
          if (err instanceof CodegenError) {
            const status = err.code === 'IMPORT_NOT_FOUND' ? 404 : 422;
            return reply.code(status).send({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      },
    );
  };
}
