import { describe, expect, it } from 'vitest';
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
import { DeployError, DeployService } from '../src/services/deploy/index.js';
import { buildApp } from '../src/app.js';

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
      title: 'Deploy Page',
      styles: { desktop: {} },
      meta: META,
      children: [
        section('s1', [
          row('r1', [column('c1', [widget('w1', 'heading', { content: 'Hi', level: 1 })])]),
        ]),
      ],
    },
  };
}

async function seed(store: InMemoryObjectStore, projectId: string): Promise<void> {
  const classified = {
    tree: tree(),
    stats: {
      totalWidgets: 1,
      sectionCount: 1,
      byType: { heading: 1 },
      customHtmlCount: 0,
      cleanMappingRate: 1,
    },
    lowConfidence: [],
  };
  await store.put(
    `projects/${projectId}/tree/index.json`,
    Buffer.from(JSON.stringify(classified)),
    'application/json',
  );
}

function makeService(store: InMemoryObjectStore): DeployService {
  const repository = new InMemoryImportRepository();
  const codegenService = new CodegenService({ objectStore: store, repository });
  return new DeployService({
    objectStore: store,
    codegenService,
    publicBaseUrl: 'https://preview.test',
    idFn: () => 'dep_fixed',
    now: () => new Date('2026-07-27T00:00:00.000Z'),
  });
}

describe('DeployService', () => {
  it('starts as never deployed', async () => {
    const store = new InMemoryObjectStore();
    const status = await makeService(store).getStatus('proj-1');
    expect(status.status).toBe('never');
  });

  it('deploys a classified project and marks it live', async () => {
    const store = new InMemoryObjectStore();
    await seed(store, 'proj-1');
    const service = makeService(store);

    const result = await service.deploy('proj-1');
    expect(result.deployId).toBe('dep_fixed');
    expect(result.status).toBe('live');
    expect(result.url).toContain('https://preview.test/production/');

    const status = await service.getStatus('proj-1');
    expect(status.status).toBe('live');
    expect(status.deployId).toBe('dep_fixed');
    expect(status.lastDeployedAt).toBe('2026-07-27T00:00:00.000Z');

    // Immutable deploy snapshot written
    const keys = await store.list('projects/proj-1/deploys/dep_fixed/');
    expect(keys.some((k) => k.endsWith('.html'))).toBe(true);
  });

  it('rejects deploy when nothing is classified', async () => {
    const store = new InMemoryObjectStore();
    await expect(makeService(store).deploy('empty')).rejects.toMatchObject({
      code: 'NOT_CLASSIFIED',
    } satisfies Partial<DeployError>);
  });

  it('attaches a custom domain as pending', async () => {
    const store = new InMemoryObjectStore();
    const service = makeService(store);
    const domain = await service.attachDomain('proj-1', 'www.example.com');
    expect(domain.status).toBe('pending');
    expect(domain.hostname).toBe('www.example.com');
    expect(domain.instructions).toMatch(/CNAME/i);

    const status = await service.getStatus('proj-1');
    expect(status.domain?.hostname).toBe('www.example.com');
    expect(status.domain?.status).toBe('pending');
  });

  it('rejects invalid domains', async () => {
    const store = new InMemoryObjectStore();
    await expect(makeService(store).attachDomain('p', 'not a domain')).rejects.toMatchObject({
      code: 'INVALID_DOMAIN',
    });
  });
});

describe('deploy routes', () => {
  it('GET/POST deploy and domain endpoints', async () => {
    const store = new InMemoryObjectStore();
    await seed(store, 'proj-r');
    const service = makeService(store);
    const app = buildApp({ deployService: service });
    await app.ready();

    const before = await app.inject({ method: 'GET', url: '/projects/proj-r/deploy' });
    expect(before.statusCode).toBe(200);
    expect(before.json().status).toBe('never');

    const deployed = await app.inject({
      method: 'POST',
      url: '/projects/proj-r/deploy',
      payload: { target: 'production' },
    });
    expect(deployed.statusCode).toBe(200);
    expect(deployed.json().status).toBe('live');

    const domain = await app.inject({
      method: 'POST',
      url: '/projects/proj-r/domain',
      payload: { hostname: 'app.example.com' },
    });
    expect(domain.statusCode).toBe(200);
    expect(domain.json().status).toBe('pending');

    await app.close();
  });
});
