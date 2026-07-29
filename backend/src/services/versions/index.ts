/**
 * Tree version service (B8/B9) — durable checkpoints of a project's
 * widget tree, separate from the editor's in-session undo stack.
 *
 * Layout:
 *   projects/{projectId}/versions/{versionId}.json   — full tree document
 *   projects/{projectId}/versions/index.json         — lightweight list (newest first)
 *
 * Owns: serialization, storage, listing.
 * Does NOT own: applying versions back into the live editor (frontend).
 */
import { randomUUID } from 'node:crypto';
import type { ObjectStore } from '../storage/object-store.js';

export type VersionErrorCode = 'INVALID_TREE' | 'NOT_FOUND';

export class VersionError extends Error {
  constructor(
    readonly code: VersionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'VersionError';
  }
}

export interface TreeVersionRecord {
  versionId: string;
  projectId: string;
  createdAt: string;
  label?: string;
  source?: 'autosave' | 'manual';
  treeKey: string;
}

export interface SaveVersionInput {
  tree: unknown;
  label?: string;
  source?: 'autosave' | 'manual';
}

interface VersionIndex {
  versions: Array<Omit<TreeVersionRecord, 'treeKey'> & { treeKey: string }>;
}

export interface VersionServiceDeps {
  objectStore: ObjectStore;
  idFn?: () => string;
  now?: () => Date;
  /** Cap index length (default 50). */
  maxVersions?: number;
}

export class VersionService {
  private readonly objectStore: ObjectStore;
  private readonly idFn: () => string;
  private readonly now: () => Date;
  private readonly maxVersions: number;

  constructor(deps: VersionServiceDeps) {
    this.objectStore = deps.objectStore;
    this.idFn = deps.idFn ?? (() => `ver_${randomUUID().replace(/-/g, '').slice(0, 12)}`);
    this.now = deps.now ?? (() => new Date());
    this.maxVersions = deps.maxVersions ?? 50;
  }

  async save(projectId: string, input: SaveVersionInput): Promise<TreeVersionRecord> {
    if (!input.tree || typeof input.tree !== 'object') {
      throw new VersionError('INVALID_TREE', 'Request body must include a tree object.');
    }

    const versionId = this.idFn();
    const createdAt = this.now().toISOString();
    const treeKey = `projects/${projectId}/versions/${versionId}.json`;

    const document = {
      versionId,
      projectId,
      createdAt,
      label: input.label,
      source: input.source ?? 'manual',
      tree: input.tree,
    };
    await this.objectStore.put(treeKey, Buffer.from(JSON.stringify(document)), 'application/json');

    const record: TreeVersionRecord = {
      versionId,
      projectId,
      createdAt,
      treeKey,
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.source !== undefined ? { source: input.source } : { source: 'manual' as const }),
    };

    const index = await this.readIndex(projectId);
    index.versions = [record, ...index.versions].slice(0, this.maxVersions);
    await this.writeIndex(projectId, index);

    return record;
  }

  async list(projectId: string): Promise<TreeVersionRecord[]> {
    const index = await this.readIndex(projectId);
    return index.versions;
  }

  async get(projectId: string, versionId: string): Promise<{ record: TreeVersionRecord; tree: unknown }> {
    const treeKey = `projects/${projectId}/versions/${versionId}.json`;
    const obj = await this.objectStore.get(treeKey);
    if (!obj) {
      throw new VersionError('NOT_FOUND', `No version ${versionId} for project ${projectId}.`);
    }
    const doc = JSON.parse(obj.body.toString('utf8')) as {
      versionId: string;
      projectId: string;
      createdAt: string;
      label?: string;
      source?: 'autosave' | 'manual';
      tree: unknown;
    };
    return {
      record: {
        versionId: doc.versionId,
        projectId: doc.projectId,
        createdAt: doc.createdAt,
        treeKey,
        ...(doc.label !== undefined ? { label: doc.label } : {}),
        ...(doc.source !== undefined ? { source: doc.source } : {}),
      },
      tree: doc.tree,
    };
  }

  private indexKey(projectId: string): string {
    return `projects/${projectId}/versions/index.json`;
  }

  private async readIndex(projectId: string): Promise<VersionIndex> {
    const obj = await this.objectStore.get(this.indexKey(projectId));
    if (!obj) return { versions: [] };
    try {
      return JSON.parse(obj.body.toString('utf8')) as VersionIndex;
    } catch {
      return { versions: [] };
    }
  }

  private async writeIndex(projectId: string, index: VersionIndex): Promise<void> {
    await this.objectStore.put(
      this.indexKey(projectId),
      Buffer.from(JSON.stringify(index)),
      'application/json',
    );
  }
}
