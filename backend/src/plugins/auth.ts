/** Fastify authentication + project ownership middleware (B14). */
import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { AuthError, type AuthService, type AuthUser } from '../services/auth/index.js';
import type { ProjectAccessService } from '../services/projects/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export interface AuthPluginOptions {
  authService: AuthService;
  projectAccessService: ProjectAccessService;
}

function publicRoute(request: FastifyRequest): boolean {
  // CORS preflight carries no bearer token. The actual request is still
  // authenticated by the hooks below.
  if (request.method === 'OPTIONS') return true;
  const path = request.url.split('?')[0] ?? request.url;
  return path === '/health';
}

function authorizationForRequest(request: FastifyRequest): string | undefined {
  if (request.headers.authorization) return request.headers.authorization;
  const path = request.url.split('?')[0] ?? request.url;
  if (!/^\/projects\/[^/]+\/pages\/[^/]+\/sync$/.test(path)) return undefined;
  const token = new URL(request.url, 'http://localhost').searchParams.get('access_token');
  return token ? `Bearer ${token}` : undefined;
}

function errorResponse(error: AuthError) {
  return { error: { code: error.code, message: error.message } };
}

const authPluginImpl: FastifyPluginAsync<AuthPluginOptions> = async (app, options) => {
  app.addHook('onRequest', async (request, reply) => {
    if (publicRoute(request)) return;
    try {
      request.user = await options.authService.verifyAuthorizationHeader(
        authorizationForRequest(request),
      );
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      return reply.code(error.statusCode).send(errorResponse(error));
    }
  });

  app.addHook('preHandler', async (request, reply) => {
    if (publicRoute(request)) return;
    const user = request.user;
    if (!user) {
      return reply.code(401).send(errorResponse(
        new AuthError('MISSING_TOKEN', 'Not authenticated.'),
      ));
    }
    const params = (request.params ?? {}) as Record<string, unknown>;
    const body = (request.body ?? {}) as Record<string, unknown>;
    try {
      if (typeof params['projectId'] === 'string') {
        await options.projectAccessService.assertProjectOwner(params['projectId'], user.id);
      } else if (typeof params['importId'] === 'string') {
        await options.projectAccessService.assertImportOwner(params['importId'], user.id);
      } else if (typeof body['projectId'] === 'string') {
        await options.projectAccessService.assertProjectOwner(body['projectId'], user.id);
      }
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      return reply.code(error.statusCode).send(errorResponse(error));
    }
  });
};

export const authPlugin = fp(authPluginImpl, { name: 'reframely-auth' });
