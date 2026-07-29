/**
 * Project tree load service — returns classified WidgetTree documents so the
 * editor can hydrate after import without talking to S3 directly.
 */
import type { ObjectStore } from '../storage/object-store.js';
import type { ClassifiedPage } from '../classifier/index.js';
import type { WidgetTree } from '../classifier/schema.js';

export type TreeErrorCode = 'NOT_CLASSIFIED' | 'NOT_FOUND';

export class TreeError extends Error {
  constructor(
    readonly code: TreeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TreeError';
  }
}

export interface ProjectTreePage {
  slug: string;
  pagePath: string;
  treeKey: string;
  tree: WidgetTree;
  stats?: ClassifiedPage['stats'];
  lowConfidenceCount: number;
}

export interface ProjectTreesResult {
  projectId: string;
  pageCount: number;
  pages: ProjectTreePage[];
  /** Primary page for single-page editors (index, or first page). */
  primary: ProjectTreePage | null;
}

export interface ProjectTreeServiceDeps {
  objectStore: ObjectStore;
}

function slugFromKey(prefix: string, key: string): string {
  return key.slice(prefix.length).replace(/\.json$/, '');
}

function pagePathOf(slug: string): string {
  // ClassifiedPage does not store pagePath; recover a sensible path from slug.
  if (slug === 'index' || slug === '') return '/';
  return slug.startsWith('/') ? slug : `/${slug}`;
}

export class ProjectTreeService {
  constructor(private readonly objectStore: ObjectStore) {}

  async listProjectTrees(projectId: string): Promise<ProjectTreesResult> {
    const prefix = `projects/${projectId}/tree/`;
    const keys = (await this.objectStore.list(prefix)).filter((k) => k.endsWith('.json'));
    if (keys.length === 0) {
      throw new TreeError(
        'NOT_CLASSIFIED',
        `No classified widget trees for project ${projectId}.`,
      );
    }

    const pages: ProjectTreePage[] = [];
    for (const treeKey of keys.sort()) {
      const obj = await this.objectStore.get(treeKey);
      if (!obj) continue;
      let classified: ClassifiedPage;
      try {
        classified = JSON.parse(obj.body.toString('utf8')) as ClassifiedPage;
      } catch {
        continue;
      }
      if (!classified?.tree?.root) continue;
      const slug = slugFromKey(prefix, treeKey);
      pages.push({
        slug,
        pagePath: pagePathOf(slug),
        treeKey,
        tree: classified.tree,
        ...(classified.stats ? { stats: classified.stats } : {}),
        lowConfidenceCount: classified.lowConfidence?.length ?? 0,
      });
    }

    if (pages.length === 0) {
      throw new TreeError(
        'NOT_CLASSIFIED',
        `No readable widget trees for project ${projectId}.`,
      );
    }

    const primary =
      pages.find((p) => p.slug === 'index' || p.pagePath === '/' || p.pagePath === '/index.html') ??
      pages[0] ??
      null;

    return { projectId, pageCount: pages.length, pages, primary };
  }
}
