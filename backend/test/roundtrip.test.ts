/**
 * Round-trip fidelity harness (MVP exit criterion).
 *
 * For every fixture site: import (seed store) → snapshot → classify →
 * codegen → serve the generated bundle through the same hermetic
 * snapshot pipeline → compare original vs regenerated screenshots at
 * desktop/tablet/mobile with pixelmatch.
 *
 * A breakpoint passes when the pixel mismatch ratio is at or below
 * PASS_THRESHOLD. The final test prints the fidelity report and
 * enforces the aggregate pass rate.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { SnapshotService, type PageSnapshot } from '../src/services/snapshot/index.js';
import { InMemoryObjectStore } from '../src/services/storage/object-store.js';
import { InMemoryImportRepository } from '../src/services/storage/import-repository.js';
import { classifySnapshot } from '../src/services/classifier/index.js';
import { CodegenService } from '../src/services/codegen/index.js';

const FIXTURES = join(process.cwd(), 'test', 'fixtures', 'sites');
const SITES = readdirSync(FIXTURES).sort();
const BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const;

/** Max share of differing pixels for a breakpoint to count as passing. */
const PASS_THRESHOLD = 0.015;
/** Per-pixel color distance threshold for pixelmatch (0-1). */
const PIXEL_THRESHOLD = 0.12;

interface BreakpointResult {
  mismatchRatio: number;
  pass: boolean;
}

interface SiteResult {
  site: string;
  breakpoints: Record<(typeof BREAKPOINTS)[number], BreakpointResult>;
}

let browser: Browser;
const results: SiteResult[] = [];

/** Seeds a fresh store with the site's files under a project source prefix. */
async function seed(store: InMemoryObjectStore, projectId: string, dir: string): Promise<void> {
  for (const f of readdirSync(dir)) {
    await store.put(
      `projects/${projectId}/source/${f}`,
      readFileSync(join(dir, f)),
      'application/octet-stream',
    );
  }
}

/** Pads both images to a common canvas so fullPage heights can differ. */
function padTo(png: PNG, width: number, height: number): PNG {
  if (png.width === width && png.height === height) return png;
  const out = new PNG({ width, height, fill: true });
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

function compare(a: Buffer, b: Buffer): number {
  const imgA = PNG.sync.read(a);
  const imgB = PNG.sync.read(b);
  const width = Math.max(imgA.width, imgB.width);
  const height = Math.max(imgA.height, imgB.height);
  const paddedA = padTo(imgA, width, height);
  const paddedB = padTo(imgB, width, height);
  const differing = pixelmatch(paddedA.data, paddedB.data, undefined, width, height, {
    threshold: PIXEL_THRESHOLD,
  });
  return differing / (width * height);
}

async function roundTrip(site: string): Promise<SiteResult> {
  const dir = join(FIXTURES, site);

  // 1. Original: import → snapshot.
  const store = new InMemoryObjectStore();
  const repository = new InMemoryImportRepository();
  const snapshotService = new SnapshotService({ objectStore: store, repository, browser });
  await seed(store, 'orig', dir);
  const original = await snapshotService.snapshotStoredProject('orig');

  // 2. Classify each page and store the tree where codegen expects it.
  for (const page of original.pages) {
    const doc = JSON.parse(
      (await store.get(page.snapshotKey))!.body.toString('utf8'),
    ) as PageSnapshot;
    const classified = classifySnapshot(doc);
    const slug = page.snapshotKey.split('/').pop()!.replace(/\.json$/, '');
    await store.put(
      `projects/orig/tree/${slug}.json`,
      Buffer.from(JSON.stringify(classified)),
      'application/json',
    );
  }

  // 3. Codegen: trees + passthrough assets → generated bundle.
  const codegen = new CodegenService({ objectStore: store, repository });
  const generated = await codegen.generateProject('orig');

  // 4. Serve the generated bundle as its own project and snapshot it.
  const genPrefix = 'projects/orig/generated/';
  for (const key of await store.list(genPrefix)) {
    const obj = (await store.get(key))!;
    await store.put(`projects/regen/source/${key.slice(genPrefix.length)}`, obj.body, obj.contentType);
  }
  const regenerated = await snapshotService.snapshotStoredProject('regen');

  // 5. Compare screenshots breakpoint by breakpoint (index page).
  const origPage = original.pages.find((p) => p.pagePath === '/') ?? original.pages[0]!;
  const regenPage = regenerated.pages.find((p) => p.pagePath === '/') ?? regenerated.pages[0]!;
  const breakpoints = {} as SiteResult['breakpoints'];
  for (const bp of BREAKPOINTS) {
    const a = (await store.get(origPage.screenshots[bp]!))!.body;
    const b = (await store.get(regenPage.screenshots[bp]!))!.body;
    const mismatchRatio = compare(a, b);
    breakpoints[bp] = { mismatchRatio, pass: mismatchRatio <= PASS_THRESHOLD };
  }
  expect(generated.pageCount).toBeGreaterThan(0);
  return { site, breakpoints };
}

beforeAll(async () => {
  browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
  await browser.close();
});

describe('round-trip fidelity: import → classify → codegen → visual diff', () => {
  for (const site of SITES) {
    it(`${site}: regenerated page is visually identical at all breakpoints`, async () => {
      const result = await roundTrip(site);
      results.push(result);
      for (const bp of BREAKPOINTS) {
        expect
          .soft(
            result.breakpoints[bp].mismatchRatio,
            `${site} @ ${bp}: ${(result.breakpoints[bp].mismatchRatio * 100).toFixed(2)}% pixels differ`,
          )
          .toBeLessThanOrEqual(PASS_THRESHOLD);
      }
    }, 180_000);
  }

  it('reports the round-trip pass rate across all fixture sites', () => {
    const rows = results.map((r) => ({
      site: r.site,
      desktop: `${(r.breakpoints.desktop.mismatchRatio * 100).toFixed(2)}%${r.breakpoints.desktop.pass ? '' : ' ✗'}`,
      tablet: `${(r.breakpoints.tablet.mismatchRatio * 100).toFixed(2)}%${r.breakpoints.tablet.pass ? '' : ' ✗'}`,
      mobile: `${(r.breakpoints.mobile.mismatchRatio * 100).toFixed(2)}%${r.breakpoints.mobile.pass ? '' : ' ✗'}`,
    }));
    const cells = results.flatMap((r) => BREAKPOINTS.map((bp) => r.breakpoints[bp].pass));
    const passRate = cells.filter(Boolean).length / cells.length;

    // eslint-disable-next-line no-console
    console.log('\nRound-trip fidelity (pixel mismatch vs original, pass ≤ 1.5%):');
    // eslint-disable-next-line no-console
    console.table(rows);
    // eslint-disable-next-line no-console
    console.log(`Pass rate: ${cells.filter(Boolean).length}/${cells.length} site-breakpoints (${(passRate * 100).toFixed(1)}%)`);

    expect(results.length).toBe(SITES.length);
    expect(passRate).toBeGreaterThanOrEqual(0.8);
  });
});
