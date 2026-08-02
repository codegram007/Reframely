import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { ImportService } from './services/import/index.js';
import { SnapshotService } from './services/snapshot/index.js';
import { ClassifierService } from './services/classifier/index.js';
import { CodegenService } from './services/codegen/index.js';
import { ExportService } from './services/export/index.js';
import { AssetService } from './services/assets/index.js';
import { VersionService } from './services/versions/index.js';
import { DeployService } from './services/deploy/index.js';
import { AiAgentService, aiAgentMode } from './services/ai-agent/index.js';
import { CleanupService } from './services/cleanup/index.js';
import { SupabaseAuthService } from './services/auth/index.js';
import { ProjectAccessService } from './services/projects/index.js';
import { PageSyncHub } from './services/sync/index.js';
import { ProjectTreeService } from './services/trees/index.js';
import { FileObjectStore, S3ObjectStore } from './services/storage/object-store.js';
import {
  JsonFileImportRepository,
  PgImportRepository,
  type ImportRepository,
} from './services/storage/import-repository.js';
import { resolve } from 'node:path';

async function main(): Promise<void> {
  let repository: ImportRepository;
  if (env.IMPORT_REPO_BACKEND === 'file') {
    const metaPath = resolve(env.LOCAL_DATA_DIR, 'imports.json');
    repository = new JsonFileImportRepository(metaPath);
    logger.info({ metaPath }, 'using file-backed import repository (no Postgres)');
  } else {
    const pg = new PgImportRepository();
    try {
      await pg.migrate();
    } catch (err) {
      logger.warn({ err }, 'could not run migrations — is Postgres up? (or set IMPORT_REPO_BACKEND=file)');
    }
    repository = pg;
  }

  const objectStore =
    env.STORAGE_BACKEND === 'fs'
      ? new FileObjectStore(resolve(env.LOCAL_DATA_DIR, 'objects'))
      : new S3ObjectStore();
  if (env.STORAGE_BACKEND === 'fs') {
    logger.info({ dir: resolve(env.LOCAL_DATA_DIR, 'objects') }, 'using filesystem object store (no MinIO)');
  }
  const importService = new ImportService({ objectStore, repository });
  const snapshotService = new SnapshotService({ objectStore, repository });
  const classifierService = new ClassifierService({ objectStore, repository });
  const codegenService = new CodegenService({ objectStore, repository });
  const exportService = new ExportService({ objectStore, repository, codegenService });
  const assetService = new AssetService({ objectStore });
  const versionService = new VersionService({ objectStore });
  const deployService = new DeployService({ objectStore, codegenService });
  const aiAgentService = new AiAgentService();
  const cleanupService = new CleanupService();
  const authService = new SupabaseAuthService();
  const projectAccessService = new ProjectAccessService(repository);
  const pageSyncHub = new PageSyncHub();
  const projectTreeService = new ProjectTreeService(objectStore);

  const app = buildApp({
    importService,
    snapshotService,
    classifierService,
    codegenService,
    exportService,
    assetService,
    versionService,
    deployService,
    aiAgentService,
    cleanupService,
    authService,
    projectAccessService,
    pageSyncHub,
    projectTreeService,
  });

  /* Graceful shutdown */
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      logger.info({ signal }, 'shutting down');
      await app.close();
      process.exit(0);
    });
  }

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
    logger.info(
      { aiAgentMode: aiAgentMode(), deployBase: env.DEPLOY_BASE_URL },
      'reframely backend ready',
    );
  } catch (err) {
    logger.fatal({ err }, 'failed to start server');
    process.exit(1);
  }
}

void main();
