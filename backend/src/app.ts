import Fastify from 'fastify';
import websocket from '@fastify/websocket';
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

  if (deps.authService && deps.projectAccessService) {
    app.register(authPlugin, {
      authService: deps.authService,
      projectAccessService: deps.projectAccessService,
    });
  }

  app.register(healthRoutes);
  if (deps.importService) {
    app.register(importRoutes(deps.importService));
  }
  if (deps.snapshotService) {
    app.register(snapshotRoutes(deps.snapshotService));
  }
  if (deps.classifierService) {
    app.register(classifyRoutes(deps.classifierService));
  }
  if (deps.codegenService) {
    app.register(generateRoutes(deps.codegenService));
  }
  if (deps.exportService) {
    app.register(exportRoutes(deps.exportService));
  }
  if (deps.assetService) {
    app.register(assetRoutes(deps.assetService));
  }
  if (deps.versionService) {
    app.register(versionRoutes(deps.versionService));
  }
  if (deps.projectTreeService) {
    app.register(treeRoutes(deps.projectTreeService));
  }
  if (deps.deployService) {
    app.register(deployRoutes(deps.deployService));
  }
  if (deps.aiAgentService) {
    app.register(assistantRoutes(deps.aiAgentService));
  }
  if (deps.cleanupService) {
    app.register(cleanupRoutes(deps.cleanupService));
  }
  if (deps.pageSyncHub) {
    // Register at the root so `app.injectWS` is available to tests and so the
    // upgrade path shares the same auth hooks as HTTP routes.
    app.register(websocket);
    app.register(syncRoutes(deps.pageSyncHub));
  }

  return app;
}
