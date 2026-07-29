import type { FastifyPluginAsync } from 'fastify';
import { DeployError, type DeployService } from '../services/deploy/index.js';

/**
 * Deploy + custom domain (B10).
 *
 *   GET  /projects/:projectId/deploy
 *   POST /projects/:projectId/deploy     { target?: "preview" | "production" }
 *   POST /projects/:projectId/domain     { hostname: string }
 */
export function deployRoutes(service: DeployService): FastifyPluginAsync {
  return async (app) => {
    const statusFor = (code: DeployError['code']): number => {
      if (code === 'INVALID_DOMAIN') return 422;
      if (code === 'NOT_CLASSIFIED' || code === 'EMPTY_BUNDLE') return 422;
      return 400;
    };

    app.get<{ Params: { projectId: string } }>(
      '/projects/:projectId/deploy',
      async (request) => service.getStatus(request.params.projectId),
    );

    app.post<{
      Params: { projectId: string };
      Body: { target?: 'preview' | 'production' };
    }>(
      '/projects/:projectId/deploy',
      {
        schema: {
          body: {
            type: 'object',
            properties: {
              target: { type: 'string', enum: ['preview', 'production'] },
            },
          },
        },
      },
      async (request, reply) => {
        try {
          return await service.deploy(request.params.projectId, request.body ?? {});
        } catch (err) {
          if (err instanceof DeployError) {
            return reply
              .code(statusFor(err.code))
              .send({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      },
    );

    app.post<{ Params: { projectId: string }; Body: { hostname: string } }>(
      '/projects/:projectId/domain',
      {
        schema: {
          body: {
            type: 'object',
            required: ['hostname'],
            properties: { hostname: { type: 'string' } },
          },
        },
      },
      async (request, reply) => {
        try {
          return await service.attachDomain(request.params.projectId, request.body.hostname);
        } catch (err) {
          if (err instanceof DeployError) {
            return reply
              .code(statusFor(err.code))
              .send({ error: { code: err.code, message: err.message } });
          }
          throw err;
        }
      },
    );
  };
}
