/**
 * DOM → Widget classifier tests.
 *
 * Two layers:
 *  1. Pure unit tests on hand-built snapshot JSON (no browser).
 *  2. Fixture-based suite: six realistic static sites (hand-written
 *     HTML/CSS and Tailwind-style utility output) are rendered through
 *     the real snapshot service (headless Chromium, hermetic), then
 *     classified. The final test aggregates the share of widgets mapped
 *     to a specific type vs custom-html fallback and asserts the PRD's
 *     >85% clean-mapping target, logging low-confidence classifications
 *     for manual review.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { SnapshotService, VIEWPORTS, type PageSnapshot, type SnapshotElement } from '../src/services/snapshot/index.js';
import {
  ClassifierError,
  ClassifierService,
  classifySnapshot,
  type ClassifiedPage,
  type ColumnNode,
  type PageNode,
  type RowNode,
  type SectionNode,
  type WidgetNode,
} from '../src/services/classifier/index.js';
import { InMemoryObjectStore } from '../src/services/storage/object-store.js';
import { InMemoryImportRepository } from '../src/services/storage/import-repository.js';

const FIXTURES_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'sites');
const SITES = [
  'hand-hero',
  'tailwind-landing',
  'portfolio-grid',
  'blog-article',
  'pricing-tailwind',
  'widgets-mix',
] as const;

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

type AnyNode = PageNode | SectionNode | RowNode | ColumnNode | WidgetNode;

function allNodes(page: PageNode): AnyNode[] {
  const out: AnyNode[] = [];
  const walk = (n: AnyNode): void => {
    out.push(n);
    if (n.type !== 'widget') for (const c of n.children) walk(c as AnyNode);
  };
  walk(page);
  return out;
}

function widgets(page: PageNode): WidgetNode[] {
  return allNodes(page).filter((n): n is WidgetNode => n.type === 'widget');
}

function byClassName(page: PageNode, cls: string, type?: AnyNode['type']): AnyNode | undefined {
  return allNodes(page).find(
    (n) =>
      (type === undefined || n.type === type) &&
      n.meta.originalElement?.className?.split(' ').includes(cls),
  );
}

// ---------------------------------------------------------------------------
// Pure snapshot builders (unit tests, no browser)
// ---------------------------------------------------------------------------

function elem(
  tag: string,
  opts: Partial<SnapshotElement> = {},
  children: SnapshotElement[] = [],
): SnapshotElement {
  return {
    index: 0,
    tag,
    classes: [],
    attrs: {},
    styles: {},
    bbox: { x: 0, y: 0, width: 100, height: 20 },
    scriptRefs: [],
    children,
    ...opts,
  };
}

function reindex(root: SnapshotElement): SnapshotElement {
  let i = 0;
  const walk = (el: SnapshotElement): void => {
    el.index = i++;
    for (const c of el.children) walk(c);
  };
  walk(root);
  return root;
}

function snap(body: SnapshotElement, extras: Partial<PageSnapshot> = {}): PageSnapshot {
  const dom = reindex(elem('html', {}, [elem('head'), body]));
  return {
    pagePath: '/',
    renderedUrl: 'http://test.local/',
    title: 'Unit fixture',
    capturedAt: '2026-01-01T00:00:00.000Z',
    viewport: VIEWPORTS[0]!,
    renderedHtml: '',
    dom,
    scripts: [],
    internalLinks: [],
    breakpointStyles: { tablet: {}, mobile: {} },
    screenshots: {},
    domTruncated: false,
    ...extras,
  };
}

describe('classifySnapshot (pure)', () => {
  it('maps a button-like <a> to a button widget and a plain link to text', () => {
    const body = elem('body', {}, [
      elem('a', {
        text: 'Get started',
        attrs: { href: '/signup' },
        styles: { 'background-color': 'rgb(79, 70, 229)', 'border-radius': '8px', 'padding-left': '24px' },
      }),
      elem('a', { text: 'Read the docs', attrs: { href: '/docs' } }),
    ]);
    const { tree } = classifySnapshot(snap(body));
    const ws = widgets(tree.root);
    expect(ws.map((w) => w.widgetType)).toEqual(['button', 'text']);
    expect(ws[0]!.props).toMatchObject({ text: 'Get started', href: '/signup' });
    expect((ws[1]!.props as { content: string }).content).toContain('Read the docs');
  });

  it('detects a horizontal flex container as a row and applies mobile overrides from breakpoint diffs', () => {
    const row = elem(
      'div',
      {
        classes: ['cards'],
        styles: { display: 'flex', 'flex-direction': 'row', gap: '16px' },
        bbox: { x: 0, y: 0, width: 900, height: 200 },
      },
      [
        elem('p', { text: 'One', bbox: { x: 0, y: 0, width: 440, height: 200 } }),
        elem('p', { text: 'Two', bbox: { x: 460, y: 0, width: 440, height: 200 } }),
      ],
    );
    const body = elem('body', {}, [elem('section', {}, [row])]);
    const snapshot = snap(body);
    // After reindex: html=0, head=1, body=2, section=3, div.cards=4.
    snapshot.breakpointStyles.mobile = { '4': { 'flex-direction': 'column' } };

    const { tree } = classifySnapshot(snapshot);
    const rowNode = byClassName(tree.root, 'cards');
    expect(rowNode?.type).toBe('row');
    expect((rowNode as RowNode).children).toHaveLength(2);
    expect(rowNode!.styles.desktop.display).toBe('flex');
    expect(rowNode!.styles.mobile?.flexDirection).toBe('column');
    expect(rowNode!.styles.tablet).toBeUndefined();
  });

  it('maps icon-font spans to icon widgets', () => {
    const body = elem('body', {}, [elem('span', { classes: ['fa', 'fa-check'] })]);
    const { tree } = classifySnapshot(snap(body));
    const ws = widgets(tree.root);
    expect(ws).toHaveLength(1);
    expect(ws[0]!.widgetType).toBe('icon');
    expect(ws[0]!.props).toMatchObject({ icon: 'fa fa-check' });
  });

  it('falls back to custom-html for nested horizontal layout inside a column, attaching subtree scripts as behaviors', () => {
    const nested = elem(
      'div',
      { classes: ['hrow'], styles: { display: 'flex', 'flex-direction': 'row' }, bbox: { x: 0, y: 0, width: 300, height: 40 } },
      [
        elem('img', { attrs: { src: 'a.png', alt: '' }, bbox: { x: 0, y: 0, width: 140, height: 40 } }),
        elem('img', { attrs: { src: 'b.png', alt: '' }, bbox: { x: 150, y: 0, width: 140, height: 40 } }),
      ],
    );
    const card1 = elem('div', { bbox: { x: 0, y: 0, width: 440, height: 100 } }, [nested]);
    const card2 = elem('div', { text: 'Plain card', bbox: { x: 460, y: 0, width: 440, height: 100 } });
    const section = elem(
      'section',
      { styles: { display: 'flex', 'flex-direction': 'row' }, bbox: { x: 0, y: 0, width: 900, height: 100 } },
      [card1, card2],
    );
    const body = elem('body', {}, [section]);
    const snapshot = snap(body);
    // Pre-order: html=0 head=1 body=2 section=3 card1=4 hrow=5 ...
    snapshot.scripts = [
      { inline: true, content: 'initCarousel();', parentPath: 'html > body > section > div > div', parentIndex: 5 },
    ];

    const { tree, stats } = classifySnapshot(snapshot);
    const custom = widgets(tree.root).find((w) => w.widgetType === 'custom-html');
    expect(custom).toBeDefined();
    expect((custom!.props as { html: string }).html).toContain('class="hrow"');
    expect(custom!.behaviors).toHaveLength(1);
    expect(custom!.behaviors![0]!.script).toBe('initCarousel();');
    expect(custom!.meta.confidence).toBeLessThan(0.7);
    expect(stats.customHtmlCount).toBe(1);
  });

  it('is deterministic: same snapshot in, same tree JSON out', () => {
    const body = elem('body', {}, [
      elem('section', {}, [elem('h1', { text: 'Title' }), elem('p', { text: 'Body copy.' })]),
    ]);
    const a = classifySnapshot(snap(body));
    const b = classifySnapshot(snap(body));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('ClassifierService', () => {
  it('classifies stored snapshots into stored widget trees', async () => {
    const store = new InMemoryObjectStore();
    const repo = new InMemoryImportRepository();
    const service = new ClassifierService({ objectStore: store, repository: repo });

    const snapshot = snap(elem('body', {}, [elem('h1', { text: 'Hello' })]));
    await store.put(
      'projects/proj-9/snapshots/index.json',
      Buffer.from(JSON.stringify(snapshot)),
      'application/json',
    );
    await repo.create({
      id: 'imp-9',
      projectId: 'proj-9',
      sourceType: 'zip',
      origin: 'site.zip',
      totalBytes: 0,
      fileCount: 1,
      status: 'snapshotted',
      errorCode: null,
      createdAt: new Date().toISOString(),
    });

    const result = await service.classifyImport('imp-9');
    expect(result.pageCount).toBe(1);
    expect(result.pages[0]!.treeKey).toBe('projects/proj-9/tree/index.json');
    const stored = await store.get('projects/proj-9/tree/index.json');
    expect(stored).toBeDefined();
    const doc = JSON.parse(stored!.body.toString('utf8')) as ClassifiedPage;
    expect(doc.tree.root.type).toBe('page');
    expect(doc.stats.totalWidgets).toBeGreaterThan(0);
  });

  it('refuses imports that are not snapshotted yet', async () => {
    const store = new InMemoryObjectStore();
    const repo = new InMemoryImportRepository();
    const service = new ClassifierService({ objectStore: store, repository: repo });
    await repo.create({
      id: 'imp-10',
      projectId: 'proj-10',
      sourceType: 'zip',
      origin: 'site.zip',
      totalBytes: 0,
      fileCount: 1,
      status: 'completed',
      errorCode: null,
      createdAt: new Date().toISOString(),
    });
    await expect(service.classifyImport('imp-10')).rejects.toMatchObject({
      name: 'ClassifierError',
      code: 'NOT_SNAPSHOTTED',
    });
    await expect(service.classifyImport('nope')).rejects.toMatchObject({
      code: 'IMPORT_NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// Fixture-based suite: real sites rendered by real Chromium, then classified
// ---------------------------------------------------------------------------

interface SiteResult {
  snapshot: PageSnapshot;
  classified: ClassifiedPage;
}

let browser: Browser;
const results = new Map<string, SiteResult>();

beforeAll(async () => {
  browser = await chromium.launch();
  for (const site of SITES) {
    const store = new InMemoryObjectStore();
    const repo = new InMemoryImportRepository();
    const service = new SnapshotService({ objectStore: store, repository: repo, browser });

    const dir = join(FIXTURES_DIR, site);
    for (const file of readdirSync(dir)) {
      await store.put(`projects/${site}/source/${file}`, readFileSync(join(dir, file)), 'application/octet-stream');
    }
    const result = await service.snapshotStoredProject(site);
    const doc = await store.get(result.pages[0]!.snapshotKey);
    const snapshot = JSON.parse(doc!.body.toString('utf8')) as PageSnapshot;
    results.set(site, { snapshot, classified: classifySnapshot(snapshot) });
  }
}, 300_000);

afterAll(async () => {
  await browser.close();
});

describe('classifier on rendered fixture sites', () => {
  it('hand-hero: semantic sections, 3-column feature row, hero widgets, nav list', () => {
    const { tree } = results.get('hand-hero')!.classified;
    const sectionTags = tree.root.children.map((s) => s.meta.originalElement?.tagName);
    expect(sectionTags).toEqual(['header', 'section', 'section', 'footer']);

    const featuresRow = byClassName(tree.root, 'features', 'row');
    expect(featuresRow?.type).toBe('row');
    expect((featuresRow as RowNode).children).toHaveLength(3);
    for (const col of (featuresRow as RowNode).children) {
      const types = col.children.map((w) => w.widgetType);
      expect(types).toEqual(['heading', 'text']);
    }
    // Mobile media query flips the flex row to a column.
    expect(featuresRow!.styles.mobile?.flexDirection).toBe('column');

    const ws = widgets(tree.root);
    const h1 = ws.find((w) => w.widgetType === 'heading' && (w.props as { level: number }).level === 1);
    expect((h1?.props as { content: string }).content).toBe('Ship faster with Acme');
    const btn = ws.find((w) => w.widgetType === 'button');
    expect(btn?.props).toMatchObject({ text: 'Get started', href: '#features' });
    const list = ws.find((w) => w.widgetType === 'list');
    expect((list?.props as { items: unknown[] }).items).toHaveLength(3);
  });

  it('tailwind-landing: utility classes resolve to a grid row with responsive override', () => {
    const { tree } = results.get('tailwind-landing')!.classified;
    const gridRow = byClassName(tree.root, 'grid', 'row');
    expect(gridRow?.type).toBe('row');
    expect((gridRow as RowNode).children).toHaveLength(3);
    expect(gridRow!.styles.desktop.display).toBe('grid');
    // Equal computed tracks are normalized back to a fluid template.
    expect(gridRow!.styles.desktop.gridTemplateColumns).toBe('repeat(3, 1fr)');
    // At 375px only .grid-cols-1 applies → single-track override; at
    // 768px .md:grid-cols-3 still applies, so the 3-track template holds.
    expect(gridRow!.styles.mobile?.gridTemplateColumns).toBe('1fr');
    const tabletTracks = gridRow!.styles.tablet?.gridTemplateColumns;
    if (tabletTracks !== undefined) {
      expect(tabletTracks).toBe('repeat(3, 1fr)');
    }

    const buttons = widgets(tree.root).filter((w) => w.widgetType === 'button');
    expect(buttons.length).toBeGreaterThanOrEqual(2); // header + hero CTAs
    expect(results.get('tailwind-landing')!.classified.stats.customHtmlCount).toBe(0);
  });

  it('portfolio-grid: images with src/alt and caption texts', () => {
    const { tree, stats } = results.get('portfolio-grid')!.classified;
    const images = widgets(tree.root).filter((w) => w.widgetType === 'image');
    expect(images).toHaveLength(6);
    expect(images[0]!.props).toMatchObject({ alt: 'Harbour at dawn', width: 400, height: 300 });
    expect(stats.customHtmlCount).toBe(0);
  });

  it('blog-article: headings, rich text, ordered and unordered lists, no fallbacks', () => {
    const { tree, stats } = results.get('blog-article')!.classified;
    const ws = widgets(tree.root);
    const headings = ws.filter((w) => w.widgetType === 'heading');
    expect(headings.length).toBeGreaterThanOrEqual(4); // h1 + three h2s
    const lists = ws.filter((w) => w.widgetType === 'list');
    expect(lists).toHaveLength(3); // nav menu + ul + ol
    expect(lists.some((l) => (l.props as { ordered: boolean }).ordered)).toBe(true);
    // Inline markup survives in rich text content.
    const byline = ws.find((w) => (w.props as { content?: string }).content?.includes('<strong>'));
    expect(byline?.widgetType).toBe('text');
    expect(stats.customHtmlCount).toBe(0);
  });

  it('pricing-tailwind: card row flips direction on mobile, cards carry list + button', () => {
    const { tree } = results.get('pricing-tailwind')!.classified;
    const cardsRow = byClassName(tree.root, 'pricing-cards');
    expect(cardsRow?.type).toBe('row');
    expect((cardsRow as RowNode).children).toHaveLength(3);
    expect(cardsRow!.styles.desktop.flexDirection).toBe('row');
    expect(cardsRow!.styles.mobile?.flexDirection).toBe('column');

    for (const col of (cardsRow as RowNode).children) {
      const types = col.children.map((w) => w.widgetType);
      expect(types).toContain('heading');
      expect(types).toContain('list');
      expect(types).toContain('button');
    }
  });

  it('widgets-mix: icons, video, embed, and verbatim custom-html fallbacks with behaviors', () => {
    const { snapshot, classified } = results.get('widgets-mix')!;
    const ws = widgets(classified.tree.root);

    const icons = ws.filter((w) => w.widgetType === 'icon');
    expect(icons.length).toBeGreaterThanOrEqual(2); // small svg + icon-font span

    const video = ws.find((w) => w.widgetType === 'video');
    expect(video?.props).toMatchObject({ src: 'movie.mp4', controls: true, autoplay: false });

    const embed = ws.find((w) => w.widgetType === 'embed');
    expect((embed?.props as { html: string }).html).toContain('<iframe');

    const customs = ws.filter((w) => w.widgetType === 'custom-html');
    const customHtml = customs.map((w) => (w.props as { html: string }).html).join('\n');
    expect(customHtml).toContain('<canvas');
    expect(customHtml).toContain('<my-counter'); // verbatim, post-JS
    expect(customHtml).toContain('Count: 5'); // custom element rendered by its script
    expect(customHtml).toContain('<form');
    expect(customHtml).toContain('<table');
    expect(customHtml).toContain('<path'); // complex svg preserved

    // The page-level inline script is preserved as a behavior.
    expect(snapshot.scripts.some((s) => s.inline && s.content?.includes('customElements.define'))).toBe(true);
    const behaviors = classified.tree.root.behaviors ?? [];
    expect(behaviors.some((b) => b.script?.includes('customElements.define'))).toBe(true);

    // Everything below the review threshold is surfaced.
    expect(classified.lowConfidence.length).toBeGreaterThanOrEqual(customs.length);
  });

  it('meets the PRD >85% clean-mapping target across all fixture sites', () => {
    let total = 0;
    let custom = 0;
    const lines: string[] = ['', 'site                 widgets  custom  clean%'];
    for (const site of SITES) {
      const { stats } = results.get(site)!.classified;
      total += stats.totalWidgets;
      custom += stats.customHtmlCount;
      lines.push(
        `${site.padEnd(22)}${String(stats.totalWidgets).padStart(5)}${String(stats.customHtmlCount).padStart(8)}  ${(stats.cleanMappingRate * 100).toFixed(1)}%`,
      );
    }
    const rate = (total - custom) / total;
    lines.push(`${'TOTAL'.padEnd(22)}${String(total).padStart(5)}${String(custom).padStart(8)}  ${(rate * 100).toFixed(1)}%`);
    console.info(lines.join('\n'));

    for (const site of SITES) {
      const low = results.get(site)!.classified.lowConfidence;
      if (low.length > 0) {
        console.info(
          `low-confidence [${site}]:\n` +
            low.map((e) => `  ${e.confidence.toFixed(2)}  ${e.nodeType}${e.widgetType ? `/${e.widgetType}` : ''}  ${e.selector ?? ''}  — ${e.rationale}`).join('\n'),
        );
      }
    }

    expect(total).toBeGreaterThan(50);
    expect(rate).toBeGreaterThan(0.85);
  });
});
