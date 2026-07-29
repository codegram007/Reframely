/**
 * Codegen unit tests — pure widget-tree → HTML/CSS generation, plus the
 * CodegenService storage wrapper. No browser needed here; visual
 * round-trip fidelity is covered in roundtrip.test.ts.
 */
import { describe, expect, it } from 'vitest';
import type {
  ColumnNode,
  PageNode,
  RowNode,
  SectionNode,
  WidgetNode,
  WidgetProps,
  WidgetTree,
  NodeMeta,
  ResponsiveStyles,
  WidgetType,
} from '../src/services/classifier/schema.js';
import {
  CodegenError,
  CodegenService,
  generateCss,
  generatePage,
  injectClass,
} from '../src/services/codegen/index.js';
import { InMemoryObjectStore } from '../src/services/storage/object-store.js';
import { InMemoryImportRepository } from '../src/services/storage/import-repository.js';

// ---------------------------------------------------------------------------
// Tree builders
// ---------------------------------------------------------------------------

const META: NodeMeta = {
  source: 'imported',
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
};

function widget(
  id: string,
  widgetType: WidgetType,
  props: WidgetProps,
  styles: ResponsiveStyles = { desktop: {} },
  extra: Partial<WidgetNode> = {},
): WidgetNode {
  return { id, type: 'widget', widgetType, props, styles, meta: META, ...extra };
}

function column(id: string, children: WidgetNode[], styles: ResponsiveStyles = { desktop: {} }): ColumnNode {
  return { id, type: 'column', span: 12, children, styles, meta: META };
}

function row(id: string, children: ColumnNode[], styles: ResponsiveStyles = { desktop: {} }): RowNode {
  return { id, type: 'row', children, styles, meta: META };
}

function section(
  id: string,
  children: RowNode[],
  styles: ResponsiveStyles = { desktop: {} },
  extra: Partial<SectionNode> = {},
): SectionNode {
  return { id, type: 'section', children, styles, meta: META, ...extra };
}

function tree(sections: SectionNode[], pageExtra: Partial<PageNode> = {}): WidgetTree {
  return {
    schemaVersion: 1,
    tokens: { colors: [], typography: [] },
    root: {
      id: 'page',
      type: 'page',
      title: 'Test Page',
      children: sections,
      styles: { desktop: {} },
      meta: META,
      ...pageExtra,
    },
  };
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

describe('generatePage HTML', () => {
  it('renders semantic widget markup with accessibility attributes', () => {
    const t = tree([
      section('s1', [
        row('r1', [
          column('c1', [
            widget('w1', 'heading', { content: 'Hello & <World>', level: 2 }),
            widget('w2', 'image', { src: '/pic.png', alt: 'A "nice" picture', width: 100, loading: 'lazy' }),
            widget('w3', 'button', { text: 'Go', href: '/go', target: '_blank', ariaLabel: 'Go now' }),
            widget('w4', 'list', { items: [{ id: 'i1', content: 'One' }, { id: 'i2', content: '<em>Two</em>' }], ordered: true }),
            widget('w5', 'video', { src: '/movie.mp4', controls: true, muted: true }),
          ]),
        ]),
      ], { desktop: {} }, { meta: { ...META, originalElement: { tagName: 'header', selector: 'header' } } }),
    ]);

    const { html } = generatePage(t);
    expect(html).toContain('<h2 class="vs-w1">Hello &amp; &lt;World&gt;</h2>');
    expect(html).toContain('<img class="vs-w2" src="/pic.png" alt="A &quot;nice&quot; picture" width="100" loading="lazy">');
    expect(html).toContain('<a class="vs-w3" href="/go" target="_blank" rel="noopener" aria-label="Go now">Go</a>');
    expect(html).toContain('<ol class="vs-w4">');
    expect(html).toContain('<li><em>Two</em></li>');
    expect(html).toContain('<video class="vs-w5" src="/movie.mp4" controls muted></video>');
    // Section reuses its original semantic tag.
    expect(html).toContain('<header class="vs-s1">');
    expect(html).toContain('</header>');
    expect(html).toContain('<title>Test Page</title>');
  });

  it('renders a real <button> when the widget came from a <button>', () => {
    const t = tree([
      section('s1', [row('r1', [column('c1', [
        widget('w1', 'button', { text: 'Submit' }, { desktop: {} }, {
          meta: { ...META, originalElement: { tagName: 'button', selector: 'button' } },
        }),
      ])])]),
    ]);
    expect(generatePage(t).html).toContain('<button class="vs-w1">Submit</button>');
  });

  it('injects the scoped class into verbatim custom-html without wrapping', () => {
    expect(injectClass('<canvas id="chart" width="400"></canvas>', 'vs-x'))
      .toBe('<canvas class="vs-x" id="chart" width="400"></canvas>');
    expect(injectClass('<div class="hrow"><span>a</span></div>', 'vs-y'))
      .toBe('<div class="hrow vs-y"><span>a</span></div>');
    // Attribute containing ">" must not break tag detection.
    expect(injectClass('<my-el data-tpl="a>b">x</my-el>', 'vs-z'))
      .toBe('<my-el class="vs-z" data-tpl="a>b">x</my-el>');
  });

  it('re-attaches behavior scripts scoped to their subtree by id', () => {
    const t = tree(
      [
        section('s1', [row('r1', [column('c1', [
          widget('w1', 'custom-html', { html: '<div class="carousel"></div>' }, { desktop: {} }, {
            behaviors: [{ id: 'b1', type: 'custom', script: 'initCarousel();', config: { inline: true } }],
          }),
        ])])]),
      ],
      {
        behaviors: [
          { id: 'b2', type: 'custom', script: 'console.log("page");', config: { inline: true } },
          { id: 'b3', type: 'custom', config: { inline: false, src: '/app.js' } },
        ],
      },
    );
    const { html } = generatePage(t);
    // Widget-scoped: element got the id, script declares its scope.
    expect(html).toContain('<div class="carousel vs-w1" id="vs-w1"></div>');
    expect(html).toContain('data-vs-behavior="b1" data-vs-scope="#vs-w1">');
    expect(html).toContain('initCarousel();');
    // Page-level inline + external scripts land before </body>.
    expect(html).toContain('console.log("page");');
    expect(html).toContain('src="/app.js"');
    expect(html.indexOf('initCarousel')).toBeLessThan(html.indexOf('console.log'));
  });

  it('is deterministic: same tree, same bytes', () => {
    const t = tree([
      section('s1', [row('r1', [column('c1', [
        widget('w1', 'text', { content: 'Same' }, { desktop: { color: 'rgb(1, 2, 3)' }, mobile: { color: 'rgb(4, 5, 6)' } }),
      ])])]),
    ]);
    const a = generatePage(t);
    const b = generatePage(t);
    expect(a.html).toBe(b.html);
    expect(a.css).toBe(b.css);
  });
});

// ---------------------------------------------------------------------------
// CSS generation
// ---------------------------------------------------------------------------

describe('generateCss', () => {
  it('emits one scoped class per node and real media queries for overrides', () => {
    const t = tree([
      section('s1', [row('r1', [column('c1', [
        widget('w1', 'text', { content: 'x' }, {
          desktop: { display: 'flex', flexDirection: 'row', gap: '24px', paddingTop: '16px' },
          tablet: { gap: '12px' },
          mobile: { flexDirection: 'column' },
        }),
      ])])], { desktop: { backgroundColor: 'rgb(15, 23, 42)' } }),
    ]);
    const css = generateCss(t);
    expect(css).toContain('.vs-s1 {');
    expect(css).toContain('background-color: rgb(15, 23, 42);');
    expect(css).toContain('.vs-w1 {');
    expect(css).toMatch(/@media \(max-width: 1024px\) \{[\s\S]*\.vs-w1 \{[\s\S]*gap: 12px;/);
    expect(css).toMatch(/@media \(max-width: 480px\) \{[\s\S]*\.vs-w1 \{[\s\S]*flex-direction: column;/);
    expect(css).not.toContain('style=');
  });

  it('reverts tablet-only overrides back to desktop values inside the mobile query', () => {
    const t = tree([
      section('s1', [row('r1', [column('c1', [
        widget('w1', 'text', { content: 'x' }, {
          desktop: { paddingTop: '64px' },
          tablet: { paddingTop: '32px' },
          // no mobile override: tablet's 32px would otherwise leak to mobile
        }),
      ])])]),
    ]);
    const css = generateCss(t);
    expect(css).toMatch(/@media \(max-width: 480px\) \{[\s\S]*\.vs-w1 \{[\s\S]*padding-top: 64px;/);
  });

  it('compiles token references to CSS custom properties', () => {
    const t: WidgetTree = {
      schemaVersion: 1,
      tokens: {
        colors: [{ id: 'color-accent', name: 'Accent', value: '#6366f1' }],
        typography: [],
      },
      root: {
        id: 'page',
        type: 'page',
        title: 'T',
        styles: { desktop: {} },
        meta: META,
        children: [
          section('s1', [row('r1', [column('c1', [
            widget('w1', 'button', { text: 'Go' }, {
              desktop: { backgroundColor: { type: 'token', tokenId: 'color-accent' } },
            }),
          ])])]),
        ],
      },
    };
    const css = generateCss(t);
    expect(css).toContain('--color-accent: #6366f1;');
    expect(css).toContain('background-color: var(--color-accent);');
  });
});

// ---------------------------------------------------------------------------
// CodegenService (storage wrapper)
// ---------------------------------------------------------------------------

describe('CodegenService', () => {
  it('generates html/css per stored tree and copies assets through', async () => {
    const store = new InMemoryObjectStore();
    const repository = new InMemoryImportRepository();
    const classified = {
      tree: tree([section('s1', [row('r1', [column('c1', [
        widget('w1', 'image', { src: 'pixel.png', alt: 'dot' }),
      ])])]),
      ]),
      stats: { totalWidgets: 1, sectionCount: 1, byType: { image: 1 }, customHtmlCount: 0, cleanMappingRate: 1 },
      lowConfidence: [],
    };
    await store.put('projects/p1/tree/index.json', Buffer.from(JSON.stringify(classified)), 'application/json');
    await store.put('projects/p1/source/index.html', Buffer.from('<html></html>'), 'text/html');
    await store.put('projects/p1/source/pixel.png', Buffer.from([1, 2, 3]), 'image/png');
    await store.put('projects/p1/source/styles.css', Buffer.from('body{}'), 'text/css');

    const service = new CodegenService({ objectStore: store, repository });
    const result = await service.generateProject('p1');

    expect(result.pageCount).toBe(1);
    expect(result.pages[0]).toMatchObject({ slug: 'index' });
    const html = (await store.get('projects/p1/generated/index.html'))!.body.toString('utf8');
    expect(html).toContain('<link rel="stylesheet" href="index.css">');
    expect(html).toContain('src="pixel.png"');
    expect(await store.get('projects/p1/generated/index.css')).toBeDefined();
    // Asset copied; original page html and css excluded from passthrough.
    expect(await store.get('projects/p1/generated/pixel.png')).toBeDefined();
    expect(await store.get('projects/p1/generated/styles.css')).toBeUndefined();
    expect(result.assetsCopied).toBe(1);
  });

  it('rejects projects with no classified trees', async () => {
    const service = new CodegenService({
      objectStore: new InMemoryObjectStore(),
      repository: new InMemoryImportRepository(),
    });
    await expect(service.generateProject('nope')).rejects.toMatchObject({
      code: 'NOT_CLASSIFIED',
    } satisfies Partial<CodegenError>);
  });
});
