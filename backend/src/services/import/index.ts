/**
 * Import service — accepts a zip upload, public GitHub repo URL, or
 * live-site URL, and normalizes each into a single "imported project"
 * representation: files stored under projects/{projectId}/source/... in
 * object storage plus a Postgres row of import metadata.
 *
 * Owns: source normalization, validation, storage layout.
 * Does NOT own: semantic classification (see services/classifier).
 */
import { randomUUID } from 'node:crypto';
import type { ObjectStore } from '../storage/object-store.js';
import type { ImportRepository, ImportSourceType } from '../storage/import-repository.js';
import { ImportError } from './errors.js';
import type { FetchLike, ImportResult, NormalizedProject } from './types.js';
import { validateProject } from './validate.js';
import { normalizeZip } from './zip.js';
import { normalizeGitHubRepo } from './github.js';
import { normalizeLiveSite } from './livesite.js';

export { ImportError } from './errors.js';
export type { ImportErrorCode } from './errors.js';
export type { ImportResult, NormalizedProject, ProjectFile, FetchLike } from './types.js';

export interface ImportServiceDeps {
  objectStore: ObjectStore;
  repository: ImportRepository;
  fetchImpl?: FetchLike;
}

export class ImportService {
  private readonly objectStore: ObjectStore;
  private readonly repository: ImportRepository;
  private readonly fetchImpl: FetchLike;

  constructor(deps: ImportServiceDeps) {
    this.objectStore = deps.objectStore;
    this.repository = deps.repository;
    this.fetchImpl = deps.fetchImpl ?? (fetch as unknown as FetchLike);
  }

  async importZip(filename: string, zipBuffer: Buffer, ownerId = 'system'): Promise<ImportResult> {
    return this.run('zip', filename, ownerId, async () => normalizeZip(zipBuffer));
  }

  async importGitHubRepo(url: string, ownerId = 'system'): Promise<ImportResult> {
    return this.run('github', url, ownerId, () => normalizeGitHubRepo(url, this.fetchImpl));
  }

  async importLiveSite(url: string, ownerId = 'system'): Promise<ImportResult> {
    return this.run('live-url', url, ownerId, () => normalizeLiveSite(url, this.fetchImpl));
  }

  /**
   * Shared pipeline: record → normalize → validate → store files →
   * mark completed. On ImportError the record is marked failed with the
   * error code so the frontend can show a precise message.
   */
  private async run(
    sourceType: ImportSourceType,
    origin: string,
    ownerId: string,
    normalize: () => Promise<NormalizedProject> | NormalizedProject,
  ): Promise<ImportResult> {
    const importId = randomUUID();
    const projectId = randomUUID();
    await this.repository.create({
      id: importId,
      projectId,
      ownerId,
      sourceType,
      origin,
      totalBytes: 0,
      fileCount: 0,
      status: 'processing',
      errorCode: null,
      createdAt: new Date().toISOString(),
    });

    try {
      const project = await normalize();
      validateProject(project);

      const storagePrefix = `projects/${projectId}/source/`;
      for (const file of project.files) {
        await this.objectStore.put(storagePrefix + file.path, file.contents, file.contentType);
      }

      await this.repository.update(importId, {
        status: 'completed',
        totalBytes: project.totalBytes,
        fileCount: project.files.length,
      });

      return {
        importId,
        projectId,
        sourceType,
        fileCount: project.files.length,
        totalBytes: project.totalBytes,
        storagePrefix,
      };
    } catch (err) {
      const errorCode = err instanceof ImportError ? err.code : 'INTERNAL';
      await this.repository.update(importId, { status: 'failed', errorCode });
      throw err;
    }
  }
}
