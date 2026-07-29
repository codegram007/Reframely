/**
 * Export service tests — verifies the zip bundle matches the shared
 * codegen output exactly (no divergent export path), a signed URL is
 * returned, and error cases surface correctly. Pure/in-memory: no
 * browser, no network.
 */
import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import type {
  ColumnNode,
  NodeMeta,
  RowNode,
  SectionNode,
  WidgetNode,
  WidgetProps,
  WidgetTree,
  WidgetType,
} from '../src/services/classifier/schema.js';
import { InMemoryObjectStore } from '../src/services/storage/object-store.js';
import { InMemoryImportRepository } from '../src/services/storage/import-repository.js';
import { CodegenService } from '../src/services/codegen/index.js';
import { ExportError, ExportService } from '../src/services/export/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const META: NodeMeta = {
  source: 'imported',
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
};

function widget(id: string, widgetType: WidgetType, props: WidgetProps): WidgetNode {
  return { id, type: 'widget', widgetType, props, styles: { desktop: {} }, meta: META };
}
function column(id: string, children: WidgetNode[]): ColumnNode {
  return { id, type: 'column', span: 12, children, styles: { desktop: {} }, meta: META };
}
function row(id: string, children: ColumnNode[]): RowNode {
  return { id, type: 'row', children, styles: { desktop: {} }, meta: META };
}
function section(id: string, children: RowNode[]): SectionNode {
  return { id, type: 'section', children, styles: { desktop: {} }, meta: META };
}
function tree(): WidgetTree {
  return {
    schemaVersion: 1,
    tokens: { colors: [], typography: [] },
    root: {
      id: 'page',
      type: 'page',
      title: 'Exported Page',
      styles: { desktop: {} },
      meta: META,
      children: [
        section('s1', [row('r1', [column('c1', [
          widget('w1', 'heading', { content: 'Hello', level: 1 }),
          widget('w2', 'image', { src: 'pixel.png', alt: 'dot' }),
        ])])]),
      ],
    },
  };
}

/** Seeds a project with one classified tree, a page HTML, and an image. */
async function seedProject(store: InMemoryObjectStore, projectId: string): Promise<void> {
  const classified = {
    tree: tree(),
    stats: { totalWidgets: 2, sectionCount: 1, byType: { heading: 1, image: 1 }, customHtmlCount: 0, cleanMappingRate: 1 },
    lowConfidence: [],
  };
  await store.put(`projects/${projectId}/tree/index.json`, Buffer.from(JSON.stringify(classified)), 'application/json');
  await store.put(`projects/${projectId}/source/index.html`, Buffer.from('<html></html>'), 'text/html');
  await store.put(`projects/${projectId}/source/pixel.png`, Buffer.from([137, 80, 78, 71]), 'image/png');
}

function makeService(store: InMemoryObjectStore, repository: InMemoryImportRepository, opts = {}): ExportService {
  const codegenService = new CodegenService({ objectStore: store, repository });
  return new ExportService({
    objectStore: store,
    repository,
    codegenService,
    idFn: () => 'exp_fixed',
    now: () => new Date('2026-07-20T00:00:00.000Z'),
    ...opts,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExportService', () => {
  it('zips the generated bundle and returns a signed download URL', async () => {
    const store = new InMemoryObjectStore();
    const repository = new InMemoryImportRepository();
    await seedProject(store, 'proj-1');

    const result = await makeService(store, repository).exportProject('proj-1');

    expect(result).toMatchObject({
      projectId: 'proj-1',
      exportId: 'exp_fixed',
      zipKey: 'projects/proj-1/exports/exp_fixed.zip',
    });
    // In-memory signed URL encodes the zip key + TTL.
    expect(result.downloadUrl).toBe(
      'memory://download/projects%2Fproj-1%2Fexports%2Fexp_fixed.zip?ttl=900',
    );
    expect(result.expiresAt).toBe('2026-07-20T00:15:00.000Z');
    // index.html + index.css + pixel.png = 3 files.
    expect(result.fileCount).toBe(3);
    expect(result.totalBytes).toBeGreaterThan(0);

    // The zip is actually stored and is a valid archive.
    const storedZip = await store.get('projects/proj-1/exports/exp_fixed.zip');
    expect(storedZip?.contentType).toBe('application/zip');
    const unzipped = unzipSync(new Uint8Array(storedZip!.body));
    expect(Object.keys(unzipped).sort()).toEqual(['index.css', 'index.html', 'pixel.png']);
    expect(Buffer.from(unzipped['index.html']!).toString('utf8')).toContain('<h1');
  });

  it('produces a zip whose bytes equal the shared codegen bundle (no divergent path)', async () => {
    const store = new InMemoryObjectStore();
    const repository = new InMemoryImportRepository();
    await seedProject(store, 'proj-2');

    // Run codegen directly, capture the generated bundle.
    const codegenService = new CodegenService({ objectStore: store, repository });
    await codegenService.generateProject('proj-2');
    const bundlePrefix = 'projects/proj-2/generated/';
    const expected = new Map<string, Buffer>();
    for (const key of await store.list(bundlePrefix)) {
      const obj = await store.get(key);
      if (obj) expected.set(key.slice(bundlePrefix.length), obj.body);
    }

    // Export goes through the same codegen path; unzip and compare bytes.
    const result = await makeService(store, repository).exportProject('proj-2');
    const unzipped = unzipSync(new Uint8Array((await store.get(result.zipKey))!.body));

    expect(Object.keys(unzipped).sort()).toEqual([...expected.keys()].sort());
    for (const [path, bytes] of expected) {
      expect(Buffer.from(unzipped[path]!).equals(bytes)).toBe(true);
    }
  });

  it('honors a custom download TTL', async () => {
    const store = new InMemoryObjectStore();
    const repository = new InMemoryImportRepository();
    await seedProject(store, 'proj-3');

    const result = await makeService(store, repository, { downloadTtlSeconds: 60 }).exportProject('proj-3');
    expect(result.downloadUrl).toContain('ttl=60');
    expect(result.expiresAt).toBe('2026-07-20T00:01:00.000Z');
  });

  it('resolves an import id to its project', async () => {
    const store = new InMemoryObjectStore();
    const repository = new InMemoryImportRepository();
    await repository.create({
      id: 'imp-1',
      projectId: 'proj-4',
      sourceType: 'zip',
      origin: 'site.zip',
      totalBytes: 0,
      fileCount: 0,
      status: 'snapshotted',
      errorCode: null,
      createdAt: '2026-07-20T00:00:00.000Z',
    });
    await seedProject(store, 'proj-4');

    const result = await makeService(store, repository).exportImport('imp-1');
    expect(result.projectId).toBe('proj-4');
    expect(result.zipKey).toBe('projects/proj-4/exports/exp_fixed.zip');
  });

  it('rejects an unknown import', async () => {
    const store = new InMemoryObjectStore();
    const repository = new InMemoryImportRepository();
    await expect(makeService(store, repository).exportImport('nope')).rejects.toMatchObject({
      code: 'IMPORT_NOT_FOUND',
    } satisfies Partial<ExportError>);
  });

  it('rejects a project with no classified trees', async () => {
    const store = new InMemoryObjectStore();
    const repository = new InMemoryImportRepository();
    await expect(makeService(store, repository).exportProject('empty')).rejects.toMatchObject({
      code: 'NOT_CLASSIFIED',
    } satisfies Partial<ExportError>);
  });
});

describe('export routes', () => {
  it('POST /projects/:id/export returns the export result', async () => {
    const { buildApp } = await import('../src/app.js');
    const store = new InMemoryObjectStore();
    const repository = new InMemoryImportRepository();
    await seedProject(store, 'proj-http');
    const app = buildApp({ exportService: makeService(store, repository) });

    const res = await app.inject({ method: 'POST', url: '/projects/proj-http/export' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      projectId: 'proj-http',
      zipKey: 'projects/proj-http/exports/exp_fixed.zip',
    });
    await app.close();
  });

  it('POST /projects/:id/export returns 422 when nothing is classified', async () => {
    const { buildApp } = await import('../src/app.js');
    const store = new InMemoryObjectStore();
    const repository = new InMemoryImportRepository();
    const app = buildApp({ exportService: makeService(store, repository) });

    const res = await app.inject({ method: 'POST', url: '/projects/empty/export' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('NOT_CLASSIFIED');
    await app.close();
  });

  it('POST /imports/:id/export returns 404 for an unknown import', async () => {
    const { buildApp } = await import('../src/app.js');
    const store = new InMemoryObjectStore();
    const repository = new InMemoryImportRepository();
    const app = buildApp({ exportService: makeService(store, repository) });

    const res = await app.inject({ method: 'POST', url: '/imports/nope/export' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('IMPORT_NOT_FOUND');
    await app.close();
  });
});
