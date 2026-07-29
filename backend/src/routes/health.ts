import type { FastifyPluginAsync } from 'fastify';

/**
 * Liveness/readiness probe. Extend the `checks` object as real
 * dependencies (Postgres, S3) gain connection pools.
 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok' as const,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  }));
};
