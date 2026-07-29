/**
 * Export service — bundles a project's generated static site into a
 * downloadable zip and returns a signed URL for it.
 *
 * Critically, export does NOT have its own rendering path: it calls the
 * shared `CodegenService.generateProject()` — the exact same code deploy
 * runs — then zips whatever landed under `projects/{projectId}/generated/`.
 * So an exported zip is byte-for-byte the files that would go live on a
 * deploy; there is no "export-only" output that could drift.
 *
 * Storage layout:
 *   projects/{projectId}/exports/{exportId}.zip
 */
import { zipSync, type Zippable } from 'fflate';
import type { ObjectStore } from '../storage/object-store.js';
import type { ImportRepository } from '../storage/import-repository.js';
import { CodegenService, CodegenError } from '../codegen/index.js';

export type ExportErrorCode = 'IMPORT_NOT_FOUND' | 'NOT_CLASSIFIED' | 'EMPTY_BUNDLE';

export class ExportError extends Error {
  constructor(
    readonly code: ExportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ExportError';
  }
}

export interface ExportResult {
  projectId: string;
  /** Opaque id of this export (also the zip's object key stem). */
  exportId: string;
  /** Object-store key of the stored zip. */
  zipKey: string;
  /** Time-limited download URL for the zip. */
  downloadUrl: string;
  /** When `downloadUrl` stops working. */
  expiresAt: string;
  /** Uncompressed file count and byte size of the bundle. */
  fileCount: number;
  totalBytes: number;
}

export interface ExportServiceDeps {
  objectStore: ObjectStore;
  repository: ImportRepository;
  codegenService: CodegenService;
  /** Signed-URL lifetime in seconds (default 15 min). */
  downloadTtlSeconds?: number;
  /** Injectable id + clock for deterministic tests. */
  idFn?: () => string;
  now?: () => Date;
}

const DEFAULT_TTL_SECONDS = 900;

export class ExportService {
  private readonly objectStore: ObjectStore;
  private readonly repository: ImportRepository;
  private readonly codegenService: CodegenService;
  private readonly ttlSeconds: number;
  private readonly idFn: () => string;
  private readonly now: () => Date;

  constructor(deps: ExportServiceDeps) {
    this.objectStore = deps.objectStore;
    this.repository = deps.repository;
    this.codegenService = deps.codegenService;
    this.ttlSeconds = deps.downloadTtlSeconds ?? DEFAULT_TTL_SECONDS;
    this.idFn = deps.idFn ?? (() => `exp_${Math.random().toString(36).slice(2, 10)}`);
    this.now = deps.now ?? (() => new Date());
  }

  /** Resolve an import to its project, then export that project. */
  async exportImport(importId: string): Promise<ExportResult> {
    const record = await this.repository.findById(importId);
    if (!record) {
      throw new ExportError('IMPORT_NOT_FOUND', `No import found with id ${importId}.`);
    }
    return this.exportProject(record.projectId);
  }

  /**
   * Regenerate the project through the shared codegen path, zip the
   * resulting bundle, store it, and hand back a signed download URL.
   */
  async exportProject(projectId: string): Promise<ExportResult> {
    // Same call deploy makes — output cannot diverge from what goes live.
    try {
      await this.codegenService.generateProject(projectId);
    } catch (err) {
      if (err instanceof CodegenError) {
        // Surface the codegen reason under the export error taxonomy.
        const code: ExportErrorCode =
          err.code === 'IMPORT_NOT_FOUND' ? 'IMPORT_NOT_FOUND' : 'NOT_CLASSIFIED';
        throw new ExportError(code, err.message);
      }
      throw err;
    }

    const bundlePrefix = `projects/${projectId}/generated/`;
    const keys = await this.objectStore.list(bundlePrefix);
    const entries: Zippable = {};
    let fileCount = 0;
    let totalBytes = 0;
    for (const key of keys) {
      const obj = await this.objectStore.get(key);
      if (!obj) continue;
      const relPath = key.slice(bundlePrefix.length);
      entries[relPath] = new Uint8Array(obj.body);
      fileCount++;
      totalBytes += obj.body.length;
    }

    if (fileCount === 0) {
      throw new ExportError('EMPTY_BUNDLE', `Generated bundle for project ${projectId} is empty.`);
    }

    const zipped = zipSync(entries, { level: 6 });
    const zipBuffer = Buffer.from(zipped);

    const exportId = this.idFn();
    const zipKey = `projects/${projectId}/exports/${exportId}.zip`;
    await this.objectStore.put(zipKey, zipBuffer, 'application/zip');

    const downloadUrl = await this.objectStore.signedUrl(zipKey, this.ttlSeconds);
    const expiresAt = new Date(this.now().getTime() + this.ttlSeconds * 1000).toISOString();

    return {
      projectId,
      exportId,
      zipKey,
      downloadUrl,
      expiresAt,
      fileCount,
      totalBytes,
    };
  }
}
