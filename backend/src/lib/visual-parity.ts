/** B6-style before/after screenshot comparison for widget trees. */
import type { Browser } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import type { WidgetTree } from '../services/classifier/schema.js';
import { generatePage } from '../services/codegen/generate.js';
import { VIEWPORTS } from '../services/snapshot/types.js';

export interface BreakpointVisualDiff {
  mismatchRatio: number;
  passed: boolean;
}

export interface VisualDiffResult {
  passed: boolean;
  maxMismatchRatio: number;
  threshold: number;
  breakpoints: Record<'desktop' | 'tablet' | 'mobile', BreakpointVisualDiff>;
}

function padTo(png: PNG, width: number, height: number): PNG {
  if (png.width === width && png.height === height) return png;
  const output = new PNG({ width, height, fill: true });
  PNG.bitblt(png, output, 0, 0, png.width, png.height, 0, 0);
  return output;
}

export function comparePngBuffers(before: Buffer, after: Buffer): number {
  const imageA = PNG.sync.read(before);
  const imageB = PNG.sync.read(after);
  const width = Math.max(imageA.width, imageB.width);
  const height = Math.max(imageA.height, imageB.height);
  const paddedA = padTo(imageA, width, height);
  const paddedB = padTo(imageB, width, height);
  const differing = pixelmatch(paddedA.data, paddedB.data, undefined, width, height, {
    threshold: 0.12,
  });
  return differing / (width * height);
}

/**
 * Renders both trees with the production code generator and compares full-page
 * screenshots at the same three viewports used by the B6 round-trip harness.
 */
export async function compareTreeVisuals(
  browser: Browser,
  before: WidgetTree,
  after: WidgetTree,
  threshold = 0.015,
): Promise<VisualDiffResult> {
  const page = await browser.newPage();
  const breakpoints = {} as VisualDiffResult['breakpoints'];
  try {
    // Match B6's hermetic renderer: behavior code may run, but it cannot
    // fetch remote scripts, fonts, tracking pixels, or other resources.
    await page.route('**/*', async (route) => route.abort());
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.setContent(generatePage(before).html, { waitUntil: 'load' });
      const beforePng = await page.screenshot({ fullPage: true });
      await page.setContent(generatePage(after).html, { waitUntil: 'load' });
      const afterPng = await page.screenshot({ fullPage: true });
      const mismatchRatio = comparePngBuffers(beforePng, afterPng);
      breakpoints[viewport.name] = {
        mismatchRatio,
        passed: mismatchRatio <= threshold,
      };
    }
  } finally {
    await page.close();
  }
  const ratios = Object.values(breakpoints).map((result) => result.mismatchRatio);
  return {
    passed: Object.values(breakpoints).every((result) => result.passed),
    maxMismatchRatio: Math.max(...ratios),
    threshold,
    breakpoints,
  };
}
