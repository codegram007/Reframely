import type { FastifyPluginAsync } from 'fastify';
import { ExportError, type ExportService } from '../services/export/index.js';

/**
 * Export endpoints. Bundles the generated static site into a zip and
 * returns a signed download URL. ExportError maps to a stable status +
 * code; anything else bubbles to Fastify's 500 handler.
 *
 *   POST /projects/:projectId/export → ExportResult
 *   POST /imports/:importId/export   → ExportResult
 */
export function exportRoutes(service: ExportService): FastifyPluginAsync {
  return async (app) => {
    const statusFor = (code: ExportError['code']): number =>
      code === 'IMPORT_NOT_FOUND' ? 404 : 422;

    app.post<{ Params: { projectId: string } }>(
      '/projects/:projectId/export',
      async (request, reply) => {
        try {
          return await service.exportProject(request.params.projectId);
        } catch (err) {
          if (err instanceof ExportError) {
            return reply.code(statusFor(err.code)).send({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      },
    );

    app.post<{ Params: { importId: string } }>(
      '/imports/:importId/export',
      async (request, reply) => {
        try {
          return await service.exportImport(request.params.importId);
        } catch (err) {
          if (err instanceof ExportError) {
            return reply.code(statusFor(err.code)).send({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      },
    );
  };
}
