import { describe, it, expect, beforeEach } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { ImportService, ImportError, type FetchLike } from '../src/services/import/index.js';
import { InMemoryObjectStore } from '../src/services/storage/object-store.js';
import { InMemoryImportRepository } from '../src/services/storage/import-repository.js';

function makeZip(files: Record<string, string>): Buffer {
  const input: Record<string, Uint8Array> = {};
  for (const [path, contents] of Object.entries(files)) {
    input[path] = strToU8(contents);
  }
  return Buffer.from(zipSync(input));
}

function fakeFetch(
  responder: (url: string) => {
    ok?: boolean;
    status?: number;
    contentType?: string;
    body: Buffer | string;
  },
): FetchLike {
  return async (url) => {
    const r = responder(url);
    const body = typeof r.body === 'string' ? Buffer.from(r.body) : r.body;
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      headers: { get: (name) => (name.toLowerCase() === 'content-type' ? (r.contentType ?? null) : null) },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
      text: async () => body.toString('utf8'),
    };
  };
}

describe('ImportService', () => {
  let objectStore: InMemoryObjectStore;
  let repository: InMemoryImportRepository;

  const makeService = (fetchImpl?: FetchLike) =>
    new ImportService({ objectStore, repository, ...(fetchImpl ? { fetchImpl } : {}) });

  beforeEach(() => {
    objectStore = new InMemoryObjectStore();
    repository = new InMemoryImportRepository();
  });

  it('imports a valid static zip', async () => {
    const zip = makeZip({
      'index.html': '<!doctype html><h1>Hello</h1>',
      'css/style.css': 'body { color: rebeccapurple; }',
      'js/main.js': 'console.log("hi")',
    });

    const result = await makeService().importZip('site.zip', zip);

    expect(result.fileCount).toBe(3);
    expect(result.storagePrefix).toBe(`projects/${result.projectId}/source/`);

    // Files landed in object storage under the right prefix
    const keys = [...objectStore.objects.keys()];
    expect(keys).toContain(`${result.storagePrefix}index.html`);
    expect(keys).toContain(`${result.storagePrefix}css/style.css`);
    expect(objectStore.objects.get(`${result.storagePrefix}css/style.css`)?.contentType).toBe('text/css');

    // Metadata row recorded
    const record = await repository.findById(result.importId);
    expect(record).toMatchObject({
      sourceType: 'zip',
      origin: 'site.zip',
      status: 'completed',
      fileCount: 3,
    });
    expect(record?.totalBytes).toBeGreaterThan(0);
  });

  it('rejects a zip with no HTML file and records the failure', async () => {
    const zip = makeZip({
      'main.py': 'print("not a frontend")',
      'requirements.txt': 'flask',
    });

    const service = makeService();
    await expect(service.importZip('backend.zip', zip)).rejects.toMatchObject({
      name: 'ImportError',
      code: 'NOT_A_FRONTEND_PROJECT',
    });

    // Nothing stored, failure recorded with the code for the frontend
    expect(objectStore.objects.size).toBe(0);
    const record = [...repository.records.values()][0];
    expect(record).toMatchObject({ status: 'failed', errorCode: 'NOT_A_FRONTEND_PROJECT' });
  });

  it('rejects a corrupt zip', async () => {
    await expect(
      makeService().importZip('junk.zip', Buffer.from('not a zip at all')),
    ).rejects.toMatchObject({ code: 'INVALID_ZIP' });
  });

  it('imports a public GitHub repo via its zipball', async () => {
    // GitHub zipballs wrap everything in a "{repo}-{ref}/" root dir
    const zipball = makeZip({
      'my-site-HEAD/index.html': '<!doctype html><title>Repo site</title>',
      'my-site-HEAD/style.css': 'h1 { font-size: 2rem; }',
      'my-site-HEAD/.gitignore': 'node_modules',
    });
    const fetched: string[] = [];
    const service = makeService(
      fakeFetch((url) => {
        fetched.push(url);
        return { body: zipball, contentType: 'application/zip' };
      }),
    );

    const result = await service.importGitHubRepo('https://github.com/acme/my-site');

    expect(fetched).toEqual(['https://codeload.github.com/acme/my-site/zip/HEAD']);
    // Root dir stripped, .gitignore filtered
    expect(result.fileCount).toBe(2);
    expect([...objectStore.objects.keys()]).toContain(`${result.storagePrefix}index.html`);

    const record = await repository.findById(result.importId);
    expect(record).toMatchObject({
      sourceType: 'github',
      origin: 'https://github.com/acme/my-site',
      status: 'completed',
    });
  });

  it('rejects a non-GitHub URL for the github source', async () => {
    await expect(
      makeService(fakeFetch(() => ({ body: '' }))).importGitHubRepo('https://gitlab.com/acme/site'),
    ).rejects.toMatchObject({ code: 'INVALID_GITHUB_URL' });
  });

  it('imports a live site URL as rendered HTML', async () => {
    const html = '<!doctype html><html><body><h1>Deployed site</h1></body></html>';
    const service = makeService(
      fakeFetch(() => ({ body: html, contentType: 'text/html; charset=utf-8' })),
    );

    const result = await service.importLiveSite('https://example.com/');

    expect(result.fileCount).toBe(1);
    const stored = objectStore.objects.get(`${result.storagePrefix}index.html`);
    expect(stored?.body.toString('utf8')).toBe(html);
    expect(stored?.contentType).toBe('text/html');

    const record = await repository.findById(result.importId);
    expect(record).toMatchObject({
      sourceType: 'live-url',
      origin: 'https://example.com/',
      status: 'completed',
      fileCount: 1,
    });
  });

  it('rejects a live URL that does not return HTML', async () => {
    const service = makeService(
      fakeFetch(() => ({ body: '{"api": true}', contentType: 'application/json' })),
    );
    await expect(service.importLiveSite('https://api.example.com/data')).rejects.toMatchObject({
      code: 'NOT_HTML_CONTENT',
    });
  });
});
