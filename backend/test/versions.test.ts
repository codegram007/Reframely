import { describe, expect, it } from 'vitest';
import { InMemoryObjectStore } from '../src/services/storage/object-store.js';
import { VersionError, VersionService } from '../src/services/versions/index.js';
import { buildApp } from '../src/app.js';

const sampleTree = {
  schemaVersion: 1,
  tokens: { colors: [], typography: [] },
  root: {
    id: 'page',
    type: 'page',
    title: 'T',
    styles: { desktop: {} },
    meta: { source: 'manual', createdAt: 't', updatedAt: 't' },
    children: [],
  },
};

describe('VersionService', () => {
  it('saves a version and lists it', async () => {
    const store = new InMemoryObjectStore();
    const service = new VersionService({
      objectStore: store,
      idFn: () => 'ver_1',
      now: () => new Date('2026-07-27T12:00:00.000Z'),
    });

    const saved = await service.save('proj-1', {
      tree: sampleTree,
      source: 'autosave',
      label: 'Auto',
    });

    expect(saved.versionId).toBe('ver_1');
    expect(saved.treeKey).toBe('projects/proj-1/versions/ver_1.json');
    expect(store.objects.has(saved.treeKey)).toBe(true);

    const list = await service.list('proj-1');
    expect(list).toHaveLength(1);
    expect(list[0]!.versionId).toBe('ver_1');

    const got = await service.get('proj-1', 'ver_1');
    expect(got.tree).toEqual(sampleTree);
  });

  it('rejects a missing tree', async () => {
    const service = new VersionService({ objectStore: new InMemoryObjectStore() });
    await expect(service.save('p', { tree: null as unknown as object })).rejects.toMatchObject({
      code: 'INVALID_TREE',
    } satisfies Partial<VersionError>);
  });
});

describe('version routes', () => {
  it('POST /projects/:id/versions returns the record', async () => {
    const store = new InMemoryObjectStore();
    const service = new VersionService({ objectStore: store, idFn: () => 'ver_r' });
    const app = buildApp({ versionService: service });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/projects/p1/versions',
      payload: { tree: sampleTree, source: 'manual' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().versionId).toBe('ver_r');
    await app.close();
  });
});
