import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { buildApp } from '../src/app.js';
import { applyTreePatch, PatchValidationError } from '../src/lib/tree-patch.js';
import {
  CleanupError,
  CleanupService,
  type HtmlDescriptor,
} from '../src/services/cleanup/index.js';
import type { WidgetTree } from '../src/services/classifier/schema.js';
import type { VisualDiffResult } from '../src/lib/visual-parity.js';

const NOW = '2026-07-29T00:00:00.000Z';

function meta(confidence = 0.99) {
  return {
    source: 'imported' as const,
    confidence,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function messyTree(confidence = 0.42): WidgetTree {
  return {
    schemaVersion: 1,
    tokens: { colors: [], typography: [] },
    root: {
      id: 'page',
      type: 'page',
      title: 'Cleanup fixture',
      styles: { desktop: {} },
      meta: meta(),
      children: [
        {
          id: 'section',
          type: 'section',
          styles: { desktop: {} },
          meta: meta(),
          children: [
            {
              id: 'row',
              type: 'row',
              styles: { desktop: {} },
              meta: meta(),
              children: [
                {
                  id: 'column',
                  type: 'column',
                  span: 12,
                  styles: { desktop: {} },
                  meta: meta(),
                  children: [
                    {
                      id: 'fallback',
                      type: 'widget',
                      widgetType: 'custom-html',
                      props: {
                        html: '<div class="legacy"><h2>Launch faster</h2><p>Keep the same pixels.</p></div>',
                        fallbackReason: 'nested content was classified too broadly',
                      },
                      styles: { desktop: { display: 'block', color: '#222222' } },
                      meta: {
                        ...meta(confidence),
                        originalElement: { tagName: 'div', className: 'legacy' },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

const inspected: HtmlDescriptor = {
  tag: 'div',
  outerHtml: '<div><h2>Launch faster</h2><p>Keep the same pixels.</p></div>',
  innerHtml: '<h2>Launch faster</h2><p>Keep the same pixels.</p>',
  text: 'Launch fasterKeep the same pixels.',
  className: '',
  attrs: {},
  inlineOnly: false,
  children: [
    {
      tag: 'h2',
      outerHtml: '<h2>Launch faster</h2>',
      innerHtml: 'Launch faster',
      text: 'Launch faster',
      className: '',
      attrs: {},
      children: [],
      inlineOnly: true,
    },
    {
      tag: 'p',
      outerHtml: '<p>Keep the same pixels.</p>',
      innerHtml: 'Keep the same pixels.',
      text: 'Keep the same pixels.',
      className: '',
      attrs: {},
      children: [],
      inlineOnly: true,
    },
  ],
};

function visual(passed: boolean): VisualDiffResult {
  const result = { mismatchRatio: passed ? 0 : 0.2, passed };
  return {
    passed,
    maxMismatchRatio: result.mismatchRatio,
    threshold: 0.015,
    breakpoints: { desktop: result, tablet: result, mobile: result },
  };
}

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
  await browser.close();
});

describe('CleanupService', () => {
  it('decomposes a broad fallback and proves visual parity at every breakpoint', async () => {
    let id = 0;
    const service = new CleanupService({
      browser,
      idFn: () => `clean-${++id}`,
      now: () => new Date(NOW),
    });

    const response = await service.run({ projectId: 'p1', tree: messyTree() });

    expect(response.patches).toHaveLength(1);
    expect(response.visualDiff.passed).toBe(true);
    expect(response.visualDiff.maxMismatchRatio).toBeLessThanOrEqual(0.015);
    expect(response.stats).toMatchObject({
      targetNodeId: 'fallback',
      nativeWidgetsProposed: 2,
      customHtmlBefore: 1,
      customHtmlAfter: 0,
    });
    expect(response.candidateTree).toBeDefined();
    const children = response.candidateTree!.root.children[0]!.children[0]!.children[0]!.children;
    expect(children.map((node) => node.widgetType)).toEqual(['heading', 'text']);
  }, 60_000);

  it('withholds a valid patch when the visual check fails', async () => {
    const service = new CleanupService({
      inspectHtml: async () => inspected,
      compareVisuals: async () => visual(false),
      idFn: (() => {
        let id = 0;
        return () => `rejected-${++id}`;
      })(),
      now: () => new Date(NOW),
    });
    const response = await service.run({ tree: messyTree() });
    expect(response.patches).toEqual([]);
    expect(response.candidateTree).toBeUndefined();
    expect(response.assistantMessage).toContain('rejected');
  });

  it('rejects trees without a low-confidence cleanup target', async () => {
    const service = new CleanupService({
      inspectHtml: async () => inspected,
      compareVisuals: async () => visual(true),
    });
    await expect(service.run({ tree: messyTree(0.95) })).rejects.toMatchObject({
      code: 'NO_TARGETS',
    } satisfies Partial<CleanupError>);
  });
});

describe('B13 patch validation', () => {
  it('rejects schema-incompatible insertions', () => {
    expect(() =>
      applyTreePatch(messyTree(), {
        patchId: 'bad',
        createdAt: NOW,
        confidence: 1,
        rationale: 'invalid hierarchy',
        affectedNodeIds: ['column'],
        operations: [
          {
            op: 'insert_node',
            parentId: 'column',
            position: 0,
            node: messyTree().root.children[0]!,
          },
        ],
      }),
    ).toThrow(PatchValidationError);
  });
});

describe('cleanup routes', () => {
  it('POST /projects/:projectId/cleanup returns a gated patch proposal', async () => {
    let id = 0;
    const service = new CleanupService({
      inspectHtml: async () => inspected,
      compareVisuals: async () => visual(true),
      idFn: () => `route-${++id}`,
      now: () => new Date(NOW),
    });
    const app = buildApp({ cleanupService: service });
    await app.ready();
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/cleanup',
      payload: { tree: messyTree(), confidenceThreshold: 0.7 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      patches: [{ patchId: 'route-3' }],
      visualDiff: { passed: true },
      stats: { nativeWidgetsProposed: 2 },
    });
    await app.close();
  });
});

