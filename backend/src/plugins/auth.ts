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
  const path = request.url.split('?')[0] ?? request.url;
  if (path === '/health' || path === '/auth/dev-token') return true;
  // <img src> cannot send Authorization. Asset file names are opaque ids;
  // upload/list remain protected. Tighten later with signed cookies/CDN.
  if (
    request.method === 'GET' &&
    /^\/projects\/[^/]+\/assets\/file\/[^/]+$/.test(path)
  ) {
    return true;
  }
  return false;
}

function errorResponse(error: AuthError) {
  return { error: { code: error.code, message: error.message } };
}

const authPluginImpl: FastifyPluginAsync<AuthPluginOptions> = async (app, options) => {
  app.addHook('onRequest', async (request, reply) => {
    if (publicRoute(request)) return;
    try {
      request.user = await options.authService.verifyAuthorizationHeader(
        request.headers.authorization,
      );
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      return reply.code(error.statusCode).send(errorResponse(error));
    }
  });

  app.addHook('preHandler', async (request, reply) => {
    if (publicRoute(request) || options.authService.mode === 'off') return;
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

export const authPlugin = fp(authPluginImpl, { name: 'vibestudio-auth' });

