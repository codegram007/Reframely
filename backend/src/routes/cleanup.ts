import type { FastifyPluginAsync } from 'fastify';
import { CleanupError, type CleanupService } from '../services/cleanup/index.js';

/** B13 cleanup proposal endpoints. Neither endpoint persists or applies a patch. */
export function cleanupRoutes(service: CleanupService): FastifyPluginAsync {
  return async (app) => {
    const run = async (
      body: { tree: unknown; confidenceThreshold?: number },
      projectId?: string,
    ) => {
      const request: { tree: unknown; projectId?: string; confidenceThreshold?: number } = {
        tree: body.tree,
      };
      if (projectId !== undefined) request.projectId = projectId;
      if (body.confidenceThreshold !== undefined) {
        request.confidenceThreshold = body.confidenceThreshold;
      }
      return service.run(request);
    };

    const errorReply = (error: unknown) => {
      if (!(error instanceof CleanupError)) throw error;
      return {
        status: error.code === 'NO_TARGETS' ? 422 : 400,
        payload: { error: { code: error.code, message: error.message } },
      };
    };

    const bodySchema = {
      type: 'object',
      required: ['tree'],
      properties: {
        tree: {},
        confidenceThreshold: { type: 'number', exclusiveMinimum: 0, maximum: 1 },
      },
    } as const;

    app.post<{
      Body: { tree: unknown; confidenceThreshold?: number };
    }>('/cleanup', { schema: { body: bodySchema } }, async (request, reply) => {
      try {
        return await run(request.body);
      } catch (error) {
        const failure = errorReply(error);
        return reply.code(failure.status).send(failure.payload);
      }
    });

    app.post<{
      Params: { projectId: string };
      Body: { tree: unknown; confidenceThreshold?: number };
    }>(
      '/projects/:projectId/cleanup',
      { schema: { body: bodySchema } },
      async (request, reply) => {
        try {
          return await run(request.body, request.params.projectId);
        } catch (error) {
          const failure = errorReply(error);
          return reply.code(failure.status).send(failure.payload);
        }
      },
    );
  };
}

