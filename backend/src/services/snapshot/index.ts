/**
 * DOM Snapshot Service.
 *
 * Renders an imported project (stored static files or a public URL) in
 * headless Chromium and produces one PageSnapshot JSON document per
 * reachable page: post-JS serialized HTML, per-element computed styles
 * and bounding boxes, script references, and screenshots at
 * desktop/tablet/mobile widths.
 *
 * Stored projects are served to the browser via request interception on
 * a virtual origin — no local port is bound, and all other network
 * access from project code is blocked so rendering is hermetic.
 *
 * Storage layout (alongside the source):
 *   projects/{projectId}/snapshots/{slug}.json
 *   projects/{projectId}/snapshots/{slug}.desktop.png (.tablet/.mobile)
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { ObjectStore, StoredObject } from '../storage/object-store.js';
import type { ImportRepository } from '../storage/import-repository.js';
import { contentTypeFor } from '../import/validate.js';
import { buildExtractExpression } from './extract.js';
import { SnapshotError } from './errors.js';
import {
  CAPTURED_STYLE_PROPS,
  VIEWPORTS,
  type BreakpointStyleDiffs,
  type PageSnapshot,
  type ScriptRef,
  type SnapshotElement,
  type SnapshotResult,
} from './types.js';

export { SnapshotError, type SnapshotErrorCode } from './errors.js';
export * from './types.js';

/** Origin used when serving stored project files via interception. */
const VIRTUAL_ORIGIN = 'http://project.vibestudio.local';

/** Shape returned by the in-page extraction script. */
interface ExtractResult {
  title: string;
  renderedHtml: string;
  dom: SnapshotElement;
  scripts: ScriptRef[];
  internalLinks: string[];
  domTruncated: boolean;
}

export interface SnapshotServiceDeps {
  objectStore: ObjectStore;
  repository: ImportRepository;
  /** Reused across runs when provided (tests); otherwise launched per run. */
  browser?: Browser;
  /** Max reachable pages to snapshot per project. */
  maxPages?: number;
  /** Max DOM elements serialized per page before truncation. */
  maxElements?: number;
  /** Per-page navigation timeout in ms. */
  navigationTimeoutMs?: number;
}

export class SnapshotService {
  private readonly objectStore: ObjectStore;
  private readonly repository: ImportRepository;
  private readonly sharedBrowser: Browser | undefined;
  private readonly maxPages: number;
  private readonly maxElements: number;
  private readonly navigationTimeoutMs: number;

  constructor(deps: SnapshotServiceDeps) {
    this.objectStore = deps.objectStore;
    this.repository = deps.repository;
    this.sharedBrowser = deps.browser;
    this.maxPages = deps.maxPages ?? 20;
    this.maxElements = deps.maxElements ?? 5000;
    this.navigationTimeoutMs = deps.navigationTimeoutMs ?? 15_000;
  }

  /**
   * Snapshot a completed import. Live-URL imports are re-rendered from
   * their original URL (so scripts and assets resolve); zip/github
   * imports are rendered from their stored source files.
   */
  async snapshotImport(importId: string): Promise<SnapshotResult> {
    const record = await this.repository.findById(importId);
    if (!record) {
      throw new SnapshotError('IMPORT_NOT_FOUND', `No import found with id ${importId}.`);
    }
    if (record.status !== 'completed' && record.status !== 'snapshotted' && record.status !== 'snapshot_failed') {
      throw new SnapshotError(
        'IMPORT_NOT_READY',
        `Import ${importId} has status "${record.status}" — it must complete before snapshotting.`,
      );
    }

    await this.repository.update(importId, { status: 'snapshotting' });
    try {
      const result =
        record.sourceType === 'live-url'
          ? await this.snapshotLiveUrl(record.projectId, record.origin)
          : await this.snapshotStoredProject(record.projectId);
      await this.repository.update(importId, { status: 'snapshotted' });
      return result;
    } catch (err) {
      await this.repository.update(importId, {
        status: 'snapshot_failed',
        errorCode: err instanceof SnapshotError ? err.code : 'INTERNAL',
      });
      throw err;
    }
  }

  /** Render stored source files through the virtual origin. */
  async snapshotStoredProject(projectId: string): Promise<SnapshotResult> {
    const prefix = `projects/${projectId}/source/`;
    const keys = await this.objectStore.list(prefix);
    const files = new Map<string, StoredObject>();
    for (const key of keys) {
      const obj = await this.objectStore.get(key);
      if (obj) files.set(key.slice(prefix.length), obj);
    }
    if (files.size === 0) {
      throw new SnapshotError('NO_SOURCE_FILES', `No stored source files for project ${projectId}.`);
    }
    return this.crawl(projectId, `${VIRTUAL_ORIGIN}/`, files);
  }

  /** Render a public URL directly (no interception). */
  async snapshotLiveUrl(projectId: string, url: string): Promise<SnapshotResult> {
    return this.crawl(projectId, url, undefined);
  }

  private async crawl(
    projectId: string,
    startUrl: string,
    files: Map<string, StoredObject> | undefined,
  ): Promise<SnapshotResult> {
    const browser = this.sharedBrowser ?? (await chromium.launch());
    const desktop = VIEWPORTS[0]!;
    const context = await browser.newContext({
      viewport: { width: desktop.width, height: desktop.height },
    });
    context.setDefaultNavigationTimeout(this.navigationTimeoutMs);

    if (files) {
      // Serve stored files; block everything else so project scripts
      // cannot reach the network during rendering.
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (`${url.protocol}//${url.host}` !== VIRTUAL_ORIGIN) {
          await route.abort();
          return;
        }
        const file = resolveFile(files, url.pathname);
        if (!file) {
          await route.fulfill({ status: 404, body: 'Not found' });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: file.contentType,
          body: file.body,
        });
      });
    }

    try {
      const origin = new URL(startUrl).origin;
      const startPath = pathOf(startUrl);
      const queue: string[] = [startPath];
      const visited = new Set<string>();
      const pages: SnapshotResult['pages'] = [];

      while (queue.length > 0 && pages.length < this.maxPages) {
        const pagePath = queue.shift()!;
        if (visited.has(pagePath)) continue;
        visited.add(pagePath);

        const snapshot = await this.snapshotPage(context, `${origin}${pagePath}`, pagePath, projectId);
        if (!snapshot) continue; // page failed to render — skip, keep crawling

        pages.push({
          pagePath,
          snapshotKey: snapshot.key,
          screenshots: snapshot.doc.screenshots,
        });
        for (const link of snapshot.doc.internalLinks) {
          if (!visited.has(link)) queue.push(link);
        }
      }

      if (pages.length === 0) {
        throw new SnapshotError('RENDER_FAILED', 'No page of the project could be rendered.');
      }
      return { projectId, pageCount: pages.length, pages };
    } finally {
      await context.close();
      if (!this.sharedBrowser) await browser.close();
    }
  }

  /** Renders one page; returns null (and keeps crawling) on failure. */
  private async snapshotPage(
    context: BrowserContext,
    url: string,
    pagePath: string,
    projectId: string,
  ): Promise<{ key: string; doc: PageSnapshot } | null> {
    const desktop = VIEWPORTS[0]!;
    const page = await context.newPage();
    try {
      const response = await page.goto(url, { waitUntil: 'load' });
      if (!response || !response.ok()) return null;
      await settle(page);

      const extractExpression = buildExtractExpression({
        styleProps: CAPTURED_STYLE_PROPS,
        maxElements: this.maxElements,
        maxTextLength: 2000,
        maxHtmlLength: 20_000,
        maxScriptLength: 10_000,
      });
      const extracted = (await page.evaluate(extractExpression)) as ExtractResult;
      const desktopFlat = flattenPreOrder(extracted.dom);

      const slug = slugFor(pagePath);
      const base = `projects/${projectId}/snapshots/${slug}`;
      const screenshots: Record<string, string> = {};
      const breakpointStyles: BreakpointStyleDiffs = { tablet: {}, mobile: {} };
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await settle(page);
        const png = await page.screenshot({ fullPage: true });
        const key = `${base}.${viewport.name}.png`;
        await this.objectStore.put(key, Buffer.from(png), 'image/png');
        screenshots[viewport.name] = key;

        if (viewport.name !== 'desktop') {
          // Re-extract at this width and keep only the properties whose
          // computed value differs from the desktop baseline.
          const reExtracted = (await page.evaluate(extractExpression)) as ExtractResult;
          breakpointStyles[viewport.name] = diffStyles(
            desktopFlat,
            flattenPreOrder(reExtracted.dom),
          );
        }
      }
      // Restore desktop for consistency if the page object were reused.
      await page.setViewportSize({ width: desktop.width, height: desktop.height });

      const doc: PageSnapshot = {
        pagePath,
        renderedUrl: url,
        title: extracted.title,
        capturedAt: new Date().toISOString(),
        viewport: desktop,
        renderedHtml: extracted.renderedHtml,
        dom: extracted.dom,
        scripts: extracted.scripts,
        internalLinks: extracted.internalLinks,
        breakpointStyles,
        screenshots,
        domTruncated: extracted.domTruncated,
      };
      const key = `${base}.json`;
      await this.objectStore.put(key, Buffer.from(JSON.stringify(doc)), 'application/json');
      return { key, doc };
    } catch {
      return null;
    } finally {
      await page.close();
    }
  }
}

/** Give the render a beat for late layout/JS (fonts, deferred scripts). */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
}

/** Flattens an element tree in pre-order (matching extraction indexes). */
function flattenPreOrder(root: SnapshotElement): SnapshotElement[] {
  const out: SnapshotElement[] = [];
  const walk = (el: SnapshotElement): void => {
    out.push(el);
    for (const child of el.children) walk(child);
  };
  walk(root);
  return out;
}

/**
 * Sparse per-element style diff between two same-page extractions.
 * Elements are matched by pre-order index; if the DOM structure changed
 * between viewports (rare — resize-reactive JS) the diff is skipped.
 */
function diffStyles(
  baseline: SnapshotElement[],
  variant: SnapshotElement[],
): Record<string, Record<string, string>> {
  if (baseline.length !== variant.length) return {};
  const diffs: Record<string, Record<string, string>> = {};
  for (let i = 0; i < baseline.length; i++) {
    const base = baseline[i]!;
    const other = variant[i]!;
    if (base.tag !== other.tag) return {}; // structure drifted — bail out
    let changed: Record<string, string> | undefined;
    for (const [prop, value] of Object.entries(other.styles)) {
      if (base.styles[prop] !== value) {
        changed ??= {};
        changed[prop] = value;
      }
    }
    if (changed) diffs[String(base.index)] = changed;
  }
  return diffs;
}

function pathOf(url: string): string {
  const u = new URL(url);
  return `${u.pathname}${u.search}` || '/';
}

/** `/` → `index`, `/about.html` → `about`, `/docs/intro.html` → `docs__intro`. */
function slugFor(pagePath: string): string {
  const cleaned = pagePath
    .replace(/\?.*$/, '')
    .replace(/\.html?$/i, '')
    .replace(/^\/+|\/+$/g, '');
  if (cleaned === '') return 'index';
  return cleaned.replace(/\//g, '__').replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Maps a request pathname onto a stored file, with index fallbacks. */
function resolveFile(
  files: Map<string, StoredObject>,
  pathname: string,
): StoredObject | undefined {
  const decoded = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidates =
    decoded === ''
      ? ['index.html']
      : decoded.endsWith('/')
        ? [`${decoded}index.html`]
        : [decoded, `${decoded}.html`, `${decoded}/index.html`];
  for (const candidate of candidates) {
    const file = files.get(candidate);
    if (file) {
      // Stored contentType may be generic; recompute from the path.
      return { body: file.body, contentType: contentTypeFor(candidate) };
    }
  }
  return undefined;
}
