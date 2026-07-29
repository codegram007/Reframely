import type { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import { AssetError, type AssetService } from '../services/assets/index.js';

/**
 * Asset upload + download (B8).
 *
 *   POST /projects/:projectId/assets              multipart field "file"
 *   GET  /projects/:projectId/assets/file/:fileName  stream stored bytes
 *
 * Upload returns a same-origin `/api/...` URL suitable for <img src> via the
 * Vite proxy (works for both MinIO and the local filesystem object store).
 */
export function assetRoutes(service: AssetService): FastifyPluginAsync {
  return async (app) => {
    await app.register(multipart, {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    });

    app.post<{ Params: { projectId: string } }>(
      '/projects/:projectId/assets',
      async (request, reply) => {
        const upload = await request.file();
        if (!upload) {
          return reply.code(400).send({
            error: { code: 'MISSING_FILE', message: 'Attach a file in the "file" field.' },
          });
        }
        const buffer = await upload.toBuffer();
        try {
          return await service.upload(request.params.projectId, {
            filename: upload.filename,
            mimetype: upload.mimetype,
            buffer,
          });
        } catch (err) {
          if (err instanceof AssetError) {
            const status = err.code === 'TOO_LARGE' ? 413 : 422;
            return reply.code(status).send({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      },
    );

    app.get<{ Params: { projectId: string; fileName: string } }>(
      '/projects/:projectId/assets/file/:fileName',
      async (request, reply) => {
        const file = await service.getFile(request.params.projectId, request.params.fileName);
        if (!file) {
          return reply.code(404).send({
            error: { code: 'NOT_FOUND', message: 'Asset not found.' },
          });
        }
        return reply
          .header('content-type', file.contentType)
          .header('cache-control', 'private, max-age=86400')
          .send(file.body);
      },
    );
  };
}
