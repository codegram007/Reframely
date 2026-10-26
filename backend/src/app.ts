import Fastify, { type FastifyPluginAsync } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { authPlugin } from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { importRoutes } from './routes/imports.js';
import { snapshotRoutes } from './routes/snapshots.js';
import { classifyRoutes } from './routes/classify.js';
import { generateRoutes } from './routes/generate.js';
import { exportRoutes } from './routes/export.js';
import { assetRoutes } from './routes/assets.js';
import { versionRoutes } from './routes/versions.js';
import { deployRoutes } from './routes/deploy.js';
import { assistantRoutes } from './routes/assistant.js';
import { cleanupRoutes } from './routes/cleanup.js';
import { syncRoutes } from './routes/sync.js';
import { treeRoutes } from './routes/trees.js';
import type { ImportService } from './services/import/index.js';
import type { SnapshotService } from './services/snapshot/index.js';
import type { ClassifierService } from './services/classifier/index.js';
import type { CodegenService } from './services/codegen/index.js';
import type { ExportService } from './services/export/index.js';
import type { AssetService } from './services/assets/index.js';
import type { VersionService } from './services/versions/index.js';
import type { DeployService } from './services/deploy/index.js';
import type { AiAgentService } from './services/ai-agent/index.js';
import type { CleanupService } from './services/cleanup/index.js';
import type { AuthService } from './services/auth/index.js';
import type { ProjectAccessService } from './services/projects/index.js';
import type { PageSyncHub } from './services/sync/index.js';
import type { ProjectTreeService } from './services/trees/index.js';

/** The concrete app type (Fastify instance parameterized by the pino logger). */
export type App = ReturnType<typeof buildApp>;

export interface AppDeps {
  importService?: ImportService;
  snapshotService?: SnapshotService;
  classifierService?: ClassifierService;
  codegenService?: CodegenService;
  exportService?: ExportService;
  assetService?: AssetService;
  versionService?: VersionService;
  deployService?: DeployService;
  aiAgentService?: AiAgentService;
  cleanupService?: CleanupService;
  authService?: AuthService;
  projectAccessService?: ProjectAccessService;
  pageSyncHub?: PageSyncHub;
  projectTreeService?: ProjectTreeService;
}

/**
 * Builds and configures the Fastify application without binding a port,
 * so tests can exercise it via `app.inject()`. Dependencies are
 * injectable so tests can pass fakes.
 */
export function buildApp(deps: AppDeps = {}) {
  if ((deps.authService === undefined) !== (deps.projectAccessService === undefined)) {
    throw new Error('authService and projectAccessService must be configured together.');
  }
  const app = Fastify({
    loggerInstance: logger.child({ component: 'http' }),
  });

  const allowedOrigins = env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.register(cors, {
    origin: allowedOrigins.includes('*') || allowedOrigins.length === 0 ? true : allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type'],
  });

  if (deps.authService && deps.projectAccessService) {
    app.register(authPlugin, {
      authService: deps.authService,
      projectAccessService: deps.projectAccessService,
    });
  }

  const apiModule: FastifyPluginAsync = async (api) => {
    api.register(healthRoutes);
    if (deps.importService) {
      api.register(importRoutes(deps.importService));
    }
    if (deps.snapshotService) {
      api.register(snapshotRoutes(deps.snapshotService));
    }
    if (deps.classifierService) {
      api.register(classifyRoutes(deps.classifierService));
    }
    if (deps.codegenService) {
      api.register(generateRoutes(deps.codegenService));
    }
    if (deps.exportService) {
      api.register(exportRoutes(deps.exportService));
    }
    if (deps.assetService) {
      api.register(assetRoutes(deps.assetService));
    }
    if (deps.versionService) {
      api.register(versionRoutes(deps.versionService));
    }
    if (deps.projectTreeService) {
      api.register(treeRoutes(deps.projectTreeService));
    }
    if (deps.deployService) {
      api.register(deployRoutes(deps.deployService));
    }
    if (deps.aiAgentService) {
      api.register(assistantRoutes(deps.aiAgentService));
    }
    if (deps.cleanupService) {
      api.register(cleanupRoutes(deps.cleanupService));
    }
  };

  // Register API routes under both /api and root
  app.register(apiModule, { prefix: '/api' });
  app.register(apiModule);

  if (deps.pageSyncHub) {
    // Register at the root so `app.injectWS` is available to tests and so the
    // upgrade path shares the same auth hooks as HTTP routes.
    app.register(websocket);
    app.register(syncRoutes(deps.pageSyncHub));
  }

  // Frontend static files and SPA fallback
  const candidateDists = [
    resolve(process.cwd(), 'frontend', 'dist'),
    resolve(process.cwd(), '..', 'frontend', 'dist'),
    resolve(process.cwd(), 'dist'),
  ];
  const frontendDist = candidateDists.find((d) => existsSync(d));

  if (frontendDist) {
    app.register(fastifyStatic, {
      root: frontendDist,
      prefix: '/',
    });

    app.setNotFoundHandler((request, reply) => {
      const url = request.raw.url ?? '';
      if (url.startsWith('/api/') || url === '/api') {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'API route not found' } });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
