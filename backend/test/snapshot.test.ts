/**
 * DOM Snapshot Service tests. These run a real headless Chromium
 * (Playwright) but are hermetic: stored projects are served to the
 * browser via request interception — no ports, no external network.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  SnapshotService,
  SnapshotError,
  type PageSnapshot,
  type SnapshotElement,
} from '../src/services/snapshot/index.js';
import { InMemoryObjectStore } from '../src/services/storage/object-store.js';
import {
  InMemoryImportRepository,
  type ImportRecord,
} from '../src/services/storage/import-repository.js';

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser.close();
});

interface Harness {
  store: InMemoryObjectStore;
  repo: InMemoryImportRepository;
  service: SnapshotService;
}

function makeHarness(overrides: { maxPages?: number } = {}): Harness {
  const store = new InMemoryObjectStore();
  const repo = new InMemoryImportRepository();
  const service = new SnapshotService({
    objectStore: store,
    repository: repo,
    browser,
    ...(overrides.maxPages !== undefined ? { maxPages: overrides.maxPages } : {}),
  });
  return { store, repo, service };
}

async function seedProject(
  h: Harness,
  files: Record<string, string>,
  status: ImportRecord['status'] = 'completed',
): Promise<{ importId: string; projectId: string }> {
  const importId = 'imp-1';
  const projectId = 'proj-1';
  for (const [path, contents] of Object.entries(files)) {
    await h.store.put(
      `projects/${projectId}/source/${path}`,
      Buffer.from(contents),
      'application/octet-stream',
    );
  }
  await h.repo.create({
    id: importId,
    projectId,
    sourceType: 'zip',
    origin: 'site.zip',
    totalBytes: 0,
    fileCount: Object.keys(files).length,
    status,
    errorCode: null,
    createdAt: new Date().toISOString(),
  });
  return { importId, projectId };
}

function findByClass(node: SnapshotElement, cls: string): SnapshotElement | undefined {
  if (node.classes.includes(cls)) return node;
  for (const child of node.children) {
    const found = findByClass(child, cls);
    if (found) return found;
  }
  return undefined;
}

async function readSnapshot(h: Harness, key: string): Promise<PageSnapshot> {
  const obj = await h.store.get(key);
  expect(obj, `snapshot document ${key} should be stored`).toBeDefined();
  return JSON.parse(obj!.body.toString('utf8')) as PageSnapshot;
}

const PAGE_WITH_UTILITIES = `<!DOCTYPE html>
<html>
<head>
  <title>Utility Site</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="hero" class="row spaced">
    <h1>Hello</h1>
    <p>Welcome to the site.</p>
  </div>
  <script src="/app.js"></script>
</body>
</html>`;

const UTILITY_CSS = `.row { display: flex; flex-direction: row; gap: 16px; }
.spaced { padding: 24px; background-color: rgb(16, 32, 48); }`;

const APP_JS = `const el = document.createElement('div');
el.className = 'js-added';
el.textContent = 'rendered by js';
document.body.appendChild(el);`;

describe('SnapshotService', () => {
  it('snapshots a stored single-page project with computed styles, layout, scripts and screenshots', async () => {
    const h = makeHarness();
    const { importId, projectId } = await seedProject(h, {
      'index.html': PAGE_WITH_UTILITIES,
      'styles.css': UTILITY_CSS,
      'app.js': APP_JS,
    });

    const result = await h.service.snapshotImport(importId);

    expect(result.projectId).toBe(projectId);
    expect(result.pageCount).toBe(1);
    const page = result.pages[0]!;
    expect(page.pagePath).toBe('/');
    expect(page.snapshotKey).toBe(`projects/${projectId}/snapshots/index.json`);

    const doc = await readSnapshot(h, page.snapshotKey);

    // 1. Post-JS-execution DOM: the js-added node is present.
    expect(doc.renderedHtml).toContain('rendered by js');
    expect(findByClass(doc.dom, 'js-added')).toBeDefined();

    // 2. Computed styles resolve utility classes to concrete values.
    const hero = findByClass(doc.dom, 'row');
    expect(hero).toBeDefined();
    expect(hero!.styles['display']).toBe('flex');
    expect(hero!.styles['flex-direction']).toBe('row');
    expect(hero!.styles['gap']).toBe('16px');
    expect(hero!.styles['padding-top']).toBe('24px');
    expect(hero!.styles['background-color']).toBe('rgb(16, 32, 48)');

    // 3. Bounding boxes captured for layout inference.
    expect(hero!.bbox.width).toBeGreaterThan(0);
    expect(hero!.bbox.height).toBeGreaterThan(0);
    const heading = hero!.children.find((c) => c.tag === 'h1');
    expect(heading).toBeDefined();
    expect(heading!.bbox.y).toBeGreaterThanOrEqual(hero!.bbox.y);

    // 4. Script refs captured with DOM location.
    expect(doc.scripts).toHaveLength(1);
    expect(doc.scripts[0]!.inline).toBe(false);
    expect(doc.scripts[0]!.src).toContain('/app.js');
    expect(doc.scripts[0]!.parentPath).toContain('body');
    const body = doc.dom.children.find((c) => c.tag === 'body');
    expect(body!.scriptRefs.some((r) => r.includes('/app.js'))).toBe(true);

    // 5. Screenshots at all three viewports, valid PNGs.
    expect(Object.keys(page.screenshots).sort()).toEqual(['desktop', 'mobile', 'tablet']);
    for (const key of Object.values(page.screenshots)) {
      const shot = await h.store.get(key);
      expect(shot).toBeDefined();
      expect(shot!.contentType).toBe('image/png');
      expect(shot!.body.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    }

    // Import status updated.
    const record = await h.repo.findById(importId);
    expect(record!.status).toBe('snapshotted');
  }, 60_000);

  it('crawls internal same-origin links across a multi-page project, ignoring external links', async () => {
    const h = makeHarness();
    const { importId, projectId } = await seedProject(h, {
      'index.html': `<!DOCTYPE html><html><head><title>Home</title></head><body>
        <a href="/about.html">About</a>
        <a href="https://external.example.com/">External</a>
        <a href="#section">Anchor</a>
      </body></html>`,
      'about.html': `<!DOCTYPE html><html><head><title>About</title></head><body>
        <a href="/">Home</a><h1>About us</h1>
      </body></html>`,
    });

    const result = await h.service.snapshotImport(importId);

    expect(result.pageCount).toBe(2);
    expect(result.pages.map((p) => p.pagePath).sort()).toEqual(['/', '/about.html']);

    const about = await readSnapshot(h, `projects/${projectId}/snapshots/about.json`);
    expect(about.title).toBe('About');
    // External link never became a page; internal links recorded.
    const home = await readSnapshot(h, `projects/${projectId}/snapshots/index.json`);
    expect(home.internalLinks).toContain('/about.html');
    expect(home.internalLinks.every((l) => !l.includes('external.example.com'))).toBe(true);
  }, 60_000);

  it('bounds the crawl at maxPages', async () => {
    const h = makeHarness({ maxPages: 2 });
    const files: Record<string, string> = {};
    for (let i = 0; i < 5; i++) {
      const next = i + 1;
      const name = i === 0 ? 'index.html' : `page${i}.html`;
      files[name] = `<!DOCTYPE html><html><head><title>P${i}</title></head><body>
        <a href="/page${next}.html">Next</a>
      </body></html>`;
    }
    const { importId } = await seedProject(h, files);

    const result = await h.service.snapshotImport(importId);
    expect(result.pageCount).toBe(2);
  }, 60_000);

  it('rejects an unknown import id with IMPORT_NOT_FOUND', async () => {
    const h = makeHarness();
    await expect(h.service.snapshotImport('nope')).rejects.toMatchObject({
      code: 'IMPORT_NOT_FOUND',
    });
  });

  it('marks the import snapshot_failed when nothing can be rendered', async () => {
    const h = makeHarness();
    // Record exists and is completed, but no files were stored.
    const { importId } = await seedProject(h, {});
    await expect(h.service.snapshotImport(importId)).rejects.toBeInstanceOf(SnapshotError);
    const record = await h.repo.findById(importId);
    expect(record!.status).toBe('snapshot_failed');
    expect(record!.errorCode).toBe('NO_SOURCE_FILES');
  }, 60_000);

  it('refuses to snapshot an import that is not completed', async () => {
    const h = makeHarness();
    const { importId } = await seedProject(h, { 'index.html': '<html></html>' }, 'processing');
    await expect(h.service.snapshotImport(importId)).rejects.toMatchObject({
      code: 'IMPORT_NOT_READY',
    });
  });
});
