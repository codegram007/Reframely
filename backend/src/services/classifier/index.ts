/**
 * Classifier service — turns stored PageSnapshot documents into widget
 * trees (Page → Section → Row → Column → Widget) conforming to the
 * widget-tree schema.
 *
 * The classification itself is a pure function (see classify.ts):
 * snapshot JSON in, widget tree JSON out. This wrapper adds the I/O:
 * it loads every snapshot of a project from the object store, runs the
 * classifier, and stores one classified document per page at
 * `projects/{projectId}/tree/{slug}.json`.
 *
 * Owns: DOM segmentation, widget-type inference, style extraction.
 * Does NOT own: rendering (see services/snapshot) or code output (see
 * services/codegen).
 */
import { randomUUID } from 'node:crypto';
import type { ObjectStore } from '../storage/object-store.js';
import type { ImportRepository } from '../storage/import-repository.js';
import type { PageSnapshot } from '../snapshot/types.js';
import { classifySnapshot, type ClassifiedPage } from './classify.js';

export * from './classify.js';
export * from './schema.js';

export type ClassifierErrorCode = 'IMPORT_NOT_FOUND' | 'NOT_SNAPSHOTTED' | 'NO_SNAPSHOTS';

export class ClassifierError extends Error {
  constructor(
    readonly code: ClassifierErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ClassifierError';
  }
}

export interface ClassifyImportResult {
  projectId: string;
  pageCount: number;
  pages: {
    pagePath: string;
    /** Object-store key of the ClassifiedPage JSON document. */
    treeKey: string;
    stats: ClassifiedPage['stats'];
    lowConfidenceCount: number;
  }[];
}

export interface ClassifierServiceDeps {
  objectStore: ObjectStore;
  repository: ImportRepository;
}

export class ClassifierService {
  private readonly objectStore: ObjectStore;
  private readonly repository: ImportRepository;

  constructor(deps: ClassifierServiceDeps) {
    this.objectStore = deps.objectStore;
    this.repository = deps.repository;
  }

  /** Classify every snapshotted page of an import into a widget tree. */
  async classifyImport(importId: string): Promise<ClassifyImportResult> {
    const record = await this.repository.findById(importId);
    if (!record) {
      throw new ClassifierError('IMPORT_NOT_FOUND', `No import found with id ${importId}.`);
    }
    if (record.status !== 'snapshotted') {
      throw new ClassifierError(
        'NOT_SNAPSHOTTED',
        `Import ${importId} has status "${record.status}" — it must be snapshotted before classification.`,
      );
    }

    const prefix = `projects/${record.projectId}/snapshots/`;
    const snapshotKeys = (await this.objectStore.list(prefix)).filter((k) => k.endsWith('.json'));
    if (snapshotKeys.length === 0) {
      throw new ClassifierError('NO_SNAPSHOTS', `No snapshots stored for project ${record.projectId}.`);
    }

    const now = new Date().toISOString();
    const pages: ClassifyImportResult['pages'] = [];
    for (const key of snapshotKeys) {
      const obj = await this.objectStore.get(key);
      if (!obj) continue;
      const snapshot = JSON.parse(obj.body.toString('utf8')) as PageSnapshot;
      const classified = classifySnapshot(snapshot, { now, idFn: () => randomUUID() });

      const slug = key.slice(prefix.length).replace(/\.json$/, '');
      const treeKey = `projects/${record.projectId}/tree/${slug}.json`;
      await this.objectStore.put(
        treeKey,
        Buffer.from(JSON.stringify(classified)),
        'application/json',
      );
      pages.push({
        pagePath: snapshot.pagePath,
        treeKey,
        stats: classified.stats,
        lowConfidenceCount: classified.lowConfidence.length,
      });
    }

    return { projectId: record.projectId, pageCount: pages.length, pages };
  }
}
