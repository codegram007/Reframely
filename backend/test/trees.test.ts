import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ProjectTreeService } from '../src/services/trees/index.js';
import { InMemoryObjectStore } from '../src/services/storage/object-store.js';
import { JwtAuthService } from '../src/services/auth/index.js';
import { ProjectAccessService } from '../src/services/projects/index.js';
import { InMemoryImportRepository } from '../src/services/storage/import-repository.js';

const tree = {
  schemaVersion: 1,
  tokens: { colors: [], typography: [] },
  root: {
    id: 'page',
    type: 'page',
    title: 'Imported',
    styles: { desktop: {} },
    meta: { source: 'imported', createdAt: 't', updatedAt: 't' },
    children: [],
  },
};

describe('ProjectTreeService', () => {
  it('loads classified pages and picks index as primary', async () => {
    const store = new InMemoryObjectStore();
    await store.put(
      'projects/p1/tree/index.json',
      Buffer.from(
        JSON.stringify({
          tree,
          stats: { totalWidgets: 0, sectionCount: 0, byType: {}, customHtmlCount: 0, cleanMappingRate: 1 },
          lowConfidence: [],
        }),
      ),
      'application/json',
    );
    const service = new ProjectTreeService(store);
    const result = await service.listProjectTrees('p1');
    expect(result.pageCount).toBe(1);
    expect(result.primary?.tree.root.id).toBe('page');
    expect(result.primary?.slug).toBe('index');
  });
});

describe('tree routes', () => {
  it('GET /projects/:id/tree returns the primary tree', async () => {
    const store = new InMemoryObjectStore();
    await store.put(
      'projects/p1/tree/index.json',
      Buffer.from(JSON.stringify({ tree, stats: {}, lowConfidence: [] })),
      'application/json',
    );
    const app = buildApp({ projectTreeService: new ProjectTreeService(store) });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/projects/p1/tree' });
    expect(res.statusCode).toBe(200);
    expect(res.json().primary.tree.root.title).toBe('Imported');
    await app.close();
  });

  it('requires ownership when auth is enabled', async () => {
    const store = new InMemoryObjectStore();
    await store.put(
      'projects/project-a/tree/index.json',
      Buffer.from(JSON.stringify({ tree, stats: {}, lowConfidence: [] })),
      'application/json',
    );
    const repository = new InMemoryImportRepository();
    await repository.create({
      id: 'import-a',
      projectId: 'project-a',
      ownerId: 'user-a',
      sourceType: 'zip',
      origin: 'site.zip',
      totalBytes: 1,
      fileCount: 1,
      status: 'completed',
      errorCode: null,
      createdAt: '2026-07-29T00:00:00.000Z',
    });
    const auth = new JwtAuthService('dev');
    const app = buildApp({
      projectTreeService: new ProjectTreeService(store),
      authService: auth,
      projectAccessService: new ProjectAccessService(repository),
    });
    await app.ready();
    expect((await app.inject({ method: 'GET', url: '/projects/project-a/tree' })).statusCode).toBe(401);
    const token = await auth.signDevToken({ id: 'user-a' });
    const ok = await app.inject({
      method: 'GET',
      url: '/projects/project-a/tree',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ok.statusCode).toBe(200);
    await app.close();
  });
});

describe('auth dev token route', () => {
  it('mints a token in dev mode without a prior bearer', async () => {
    const auth = new JwtAuthService('dev');
    const app = buildApp({
      authService: auth,
      projectAccessService: new ProjectAccessService(new InMemoryImportRepository()),
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/auth/dev-token?user=local-user' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { token: string };
    expect(body.token.length).toBeGreaterThan(20);
    await expect(auth.verifyAuthorizationHeader(`Bearer ${body.token}`)).resolves.toMatchObject({
      id: 'local-user',
    });
    await app.close();
  });
});
