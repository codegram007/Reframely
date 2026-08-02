import { describe, expect, it } from 'vitest';
import { InMemoryObjectStore } from '../src/services/storage/object-store.js';
import { AssetError, AssetService } from '../src/services/assets/index.js';
import { buildApp } from '../src/app.js';

describe('AssetService', () => {
  it('stores an image and returns a signed URL', async () => {
    const store = new InMemoryObjectStore();
    const service = new AssetService({
      objectStore: store,
      idFn: () => 'assetfixed',
      now: () => new Date('2026-07-27T00:00:00.000Z'),
      urlTtlSeconds: 3600,
    });

    const result = await service.upload('proj-1', {
      filename: 'hero.png',
      mimetype: 'image/png',
      buffer: Buffer.from([137, 80, 78, 71, 0, 0]),
    });

    expect(result.assetId).toBe('assetfixed');
    expect(result.key).toBe('projects/proj-1/assets/assetfixed.png');
    expect(result.contentType).toBe('image/png');
    expect(result.bytes).toBe(6);
    expect(result.url).toBe(
      'memory://download/projects%2Fproj-1%2Fassets%2Fassetfixed.png?ttl=3600',
    );
    expect(result.expiresAt).toBe('2026-07-27T01:00:00.000Z');
    expect(store.objects.has(result.key)).toBe(true);
  });

  it('rejects empty files', async () => {
    const service = new AssetService({ objectStore: new InMemoryObjectStore() });
    await expect(
      service.upload('p', { filename: 'x.png', mimetype: 'image/png', buffer: Buffer.alloc(0) }),
    ).rejects.toMatchObject({ code: 'EMPTY_FILE' } satisfies Partial<AssetError>);
  });

  it('rejects non-image types', async () => {
    const service = new AssetService({ objectStore: new InMemoryObjectStore() });
    await expect(
      service.upload('p', {
        filename: 'x.exe',
        mimetype: 'application/octet-stream',
        buffer: Buffer.from('nope'),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TYPE' });
  });
});

describe('asset routes', () => {
  it('POST /projects/:id/assets accepts a multipart image', async () => {
    const store = new InMemoryObjectStore();
    const service = new AssetService({ objectStore: store, idFn: () => 'a1' });
    const app = buildApp({ assetService: service });
    await app.ready();

    const boundary = '----vitestboundary';
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="dot.png"\r\n` +
          `Content-Type: image/png\r\n\r\n`,
      ),
      Buffer.from([137, 80, 78, 71]),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/projects/proj-x/assets',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.assetId).toBe('a1');
    expect(json.projectId).toBe('proj-x');
    expect(json.url).toBe(
      'memory://download/projects%2Fproj-x%2Fassets%2Fa1.png?ttl=604800',
    );

    const get = await app.inject({
      method: 'GET',
      url: '/projects/proj-x/assets/file/a1.png',
    });
    expect(get.statusCode).toBe(200);
    expect(get.headers['content-type']).toMatch(/image\/png/);
    expect(Buffer.from(get.rawPayload).length).toBe(4);
    await app.close();
  });
});
