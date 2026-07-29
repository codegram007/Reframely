import type { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import { env } from '../config/env.js';
import { ImportError, type ImportService } from '../services/import/index.js';

/**
 * Import endpoints. ImportError maps to 422 with a stable code and a
 * display-safe message; anything else bubbles to Fastify's 500 handler.
 *
 *   POST /imports/zip     multipart, field "file"
 *   POST /imports/github  { "url": "https://github.com/owner/repo" }
 *   POST /imports/url     { "url": "https://example.com" }
 */
export function importRoutes(service: ImportService): FastifyPluginAsync {
  return async (app) => {
    await app.register(multipart, {
      limits: { fileSize: env.IMPORT_MAX_TOTAL_BYTES, files: 1 },
    });

    const handleError = (err: unknown, reply: { code(c: number): { send(b: unknown): void } }) => {
      if (err instanceof ImportError) {
        reply.code(422).send({ error: { code: err.code, message: err.message } });
        return true;
      }
      return false;
    };

    app.post('/imports/zip', async (request, reply) => {
      const upload = await request.file();
      if (!upload) {
        return reply
          .code(400)
          .send({ error: { code: 'MISSING_FILE', message: 'Attach a zip file in the "file" field.' } });
      }
      const buffer = await upload.toBuffer();
      try {
        return await service.importZip(upload.filename, buffer, request.user?.id ?? 'system');
      } catch (err) {
        if (handleError(err, reply)) return reply;
        throw err;
      }
    });

    const urlBodySchema = {
      type: 'object',
      required: ['url'],
      properties: { url: { type: 'string' } },
    } as const;

    app.post<{ Body: { url: string } }>(
      '/imports/github',
      { schema: { body: urlBodySchema } },
      async (request, reply) => {
        try {
          return await service.importGitHubRepo(request.body.url, request.user?.id ?? 'system');
        } catch (err) {
          if (handleError(err, reply)) return reply;
          throw err;
        }
      },
    );

    app.post<{ Body: { url: string } }>(
      '/imports/url',
      { schema: { body: urlBodySchema } },
      async (request, reply) => {
        try {
          return await service.importLiveSite(request.body.url, request.user?.id ?? 'system');
        } catch (err) {
          if (handleError(err, reply)) return reply;
          throw err;
        }
      },
    );
  };
}
