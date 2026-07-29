/**
 * Codegen service — renders stored widget trees into a deployable static
 * HTML/CSS bundle. The rendering itself is a pure function (see
 * generate.ts): widget tree in, HTML + CSS out. This wrapper adds the
 * I/O: it loads every classified tree of a project from the object
 * store, generates one page per tree, copies through the project's
 * static assets (images, fonts, media — everything the generated markup
 * still references by its original path), and stores the bundle at
 * `projects/{projectId}/generated/`.
 *
 * Owns: template rendering, responsive CSS emission, asset passthrough.
 * Does NOT own: persistence backends (see services/storage) or
 * publishing (see services/deploy).
 */
import type { ObjectStore } from '../storage/object-store.js';
import type { ImportRepository } from '../storage/import-repository.js';
import type { ClassifiedPage } from '../classifier/index.js';
import { generatePage } from './generate.js';

export * from './generate.js';

export type CodegenErrorCode = 'IMPORT_NOT_FOUND' | 'NOT_CLASSIFIED';

export class CodegenError extends Error {
  constructor(
    readonly code: CodegenErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CodegenError';
  }
}

export interface GenerateImportResult {
  projectId: string;
  pageCount: number;
  pages: {
    /** Page slug (matches the stored tree document name). */
    slug: string;
    htmlKey: string;
    cssKey: string;
  }[];
  /** Source asset files copied through into the bundle. */
  assetsCopied: number;
}

export interface CodegenServiceDeps {
  objectStore: ObjectStore;
  repository: ImportRepository;
}

/** Source files never copied into the generated bundle. */
const EXCLUDED_ASSET_EXTENSIONS = /\.(html?|css)$/i;

export class CodegenService {
  private readonly objectStore: ObjectStore;
  private readonly repository: ImportRepository;

  constructor(deps: CodegenServiceDeps) {
    this.objectStore = deps.objectStore;
    this.repository = deps.repository;
  }

  /** Generate the static bundle for every classified page of an import. */
  async generateImport(importId: string): Promise<GenerateImportResult> {
    const record = await this.repository.findById(importId);
    if (!record) {
      throw new CodegenError('IMPORT_NOT_FOUND', `No import found with id ${importId}.`);
    }
    return this.generateProject(record.projectId);
  }

  /** Generate directly from a project's stored trees (used by tests/pipelines). */
  async generateProject(projectId: string): Promise<GenerateImportResult> {
    const treePrefix = `projects/${projectId}/tree/`;
    const treeKeys = (await this.objectStore.list(treePrefix)).filter((k) => k.endsWith('.json'));
    if (treeKeys.length === 0) {
      throw new CodegenError(
        'NOT_CLASSIFIED',
        `No classified widget trees stored for project ${projectId} — run classification first.`,
      );
    }

    const outPrefix = `projects/${projectId}/generated/`;
    const pages: GenerateImportResult['pages'] = [];
    for (const key of treeKeys) {
      const obj = await this.objectStore.get(key);
      if (!obj) continue;
      const classified = JSON.parse(obj.body.toString('utf8')) as ClassifiedPage;
      const slug = key.slice(treePrefix.length).replace(/\.json$/, '');
      const { html, css } = generatePage(classified.tree, { cssHref: `${slug}.css` });

      const htmlKey = `${outPrefix}${slug}.html`;
      const cssKey = `${outPrefix}${slug}.css`;
      await this.objectStore.put(htmlKey, Buffer.from(html), 'text/html; charset=utf-8');
      await this.objectStore.put(cssKey, Buffer.from(css), 'text/css; charset=utf-8');
      pages.push({ slug, htmlKey, cssKey });
    }

    // Pass static assets through so relative src/href references resolve
    // (images, fonts, media, iframe documents that were never crawled).
    const sourcePrefix = `projects/${projectId}/source/`;
    let assetsCopied = 0;
    for (const key of await this.objectStore.list(sourcePrefix)) {
      const rel = key.slice(sourcePrefix.length);
      if (EXCLUDED_ASSET_EXTENSIONS.test(rel)) {
        // Keep non-page HTML documents (e.g. iframe embeds) — they are
        // referenced verbatim by embed/custom-html widgets.
        const slug = rel.replace(/\.html?$/i, '').replace(/\//g, '__');
        const isGeneratedPage = pages.some((p) => p.slug === slug);
        if (!/\.html?$/i.test(rel) || isGeneratedPage) continue;
      }
      const obj = await this.objectStore.get(key);
      if (!obj) continue;
      await this.objectStore.put(`${outPrefix}${rel}`, obj.body, obj.contentType);
      assetsCopied++;
    }

    return { projectId, pageCount: pages.length, pages, assetsCopied };
  }
}
