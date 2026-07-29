import type { FastifyPluginAsync } from 'fastify';
import { AssistantError, type AiAgentService } from '../services/ai-agent/index.js';

/**
 * AI assistant (B12).
 *
 *   POST /assistant  { projectId, userMessage, tree, treeVersionId? }
 */
export function assistantRoutes(service: AiAgentService): FastifyPluginAsync {
  return async (app) => {
    app.post<{
      Body: {
        projectId: string;
        userMessage: string;
        tree?: unknown;
        treeVersionId?: string;
      };
    }>(
      '/assistant',
      {
        schema: {
          body: {
            type: 'object',
            required: ['projectId', 'userMessage'],
            properties: {
              projectId: { type: 'string' },
              userMessage: { type: 'string' },
              tree: {},
              treeVersionId: { type: 'string' },
            },
          },
        },
      },
      async (request, reply) => {
        try {
          const req: {
            projectId: string;
            userMessage: string;
            tree?: unknown;
            treeVersionId?: string;
          } = {
            projectId: request.body.projectId,
            userMessage: request.body.userMessage,
          };
          if (request.body.tree !== undefined) req.tree = request.body.tree;
          if (request.body.treeVersionId !== undefined) {
            req.treeVersionId = request.body.treeVersionId;
          }
          return await service.run(req);
        } catch (err) {
          if (err instanceof AssistantError) {
            return reply
              .code(422)
              .send({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      },
    );
  };
}
