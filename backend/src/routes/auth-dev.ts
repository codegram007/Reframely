import type { FastifyPluginAsync } from 'fastify';
import type { AuthService } from '../services/auth/index.js';
import { AuthError } from '../services/auth/index.js';

/**
 * Local-only helper for AUTH_MODE=dev.
 *
 *   GET /auth/dev-token?user=local-user&email=local@example.com
 *
 * Returns a bearer token the frontend can store and attach to API calls.
 * Not registered (or no-ops) when auth mode is not `dev`.
 */
export function authDevRoutes(authService: AuthService): FastifyPluginAsync {
  return async (app) => {
    app.get<{
      Querystring: { user?: string; email?: string };
    }>('/auth/dev-token', async (request, reply) => {
      if (authService.mode !== 'dev') {
        return reply.code(404).send({
          error: { code: 'NOT_AVAILABLE', message: 'Dev tokens are only available in AUTH_MODE=dev.' },
        });
      }
      try {
        const id = (request.query.user ?? 'local-user').trim() || 'local-user';
        const email = request.query.email?.trim();
        const token = await authService.signDevToken({
          id,
          ...(email ? { email } : { email: `${id}@example.com` }),
        });
        return {
          mode: 'dev',
          userId: id,
          email: email ?? `${id}@example.com`,
          token,
          authorization: `Bearer ${token}`,
          expiresIn: '8h',
        };
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send({
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    });
  };
}
