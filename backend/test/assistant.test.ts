import { describe, expect, it } from 'vitest';
import {
  AiAgentService,
  AssistantError,
  proposeHeuristicPatches,
} from '../src/services/ai-agent/index.js';
import { buildApp } from '../src/app.js';

const tree = {
  schemaVersion: 1,
  tokens: {
    colors: [{ id: 'color-accent', name: 'Accent', value: '#6d5efc' }],
    typography: [],
  },
  root: {
    id: 'page',
    type: 'page',
    title: 'T',
    styles: { desktop: {} },
    meta: { source: 'imported', createdAt: 't', updatedAt: 't' },
    children: [
      {
        id: 'sec-hero',
        type: 'section',
        name: 'Hero',
        styles: { desktop: {} },
        meta: { source: 'imported', createdAt: 't', updatedAt: 't' },
        children: [
          {
            id: 'col-1',
            type: 'column',
            span: 12,
            styles: { desktop: {} },
            meta: { source: 'imported', createdAt: 't', updatedAt: 't' },
            children: [
              {
                id: 'w-hero-h1',
                type: 'widget',
                widgetType: 'heading',
                props: { content: 'Old title', level: 1 },
                styles: { desktop: {} },
                meta: { source: 'imported', createdAt: 't', updatedAt: 't' },
              },
            ],
          },
        ],
      },
    ],
  },
};

describe('proposeHeuristicPatches', () => {
  it('proposes a color token change', () => {
    const res = proposeHeuristicPatches(tree as never, 'make the accent blue', {
      idFn: () => 'pat_color',
      now: () => new Date('2026-07-27T00:00:00.000Z'),
    });
    expect(res.patches).toHaveLength(1);
    expect(res.patches[0]!.operations[0]).toMatchObject({
      op: 'set_color_token',
      value: '#2563eb',
    });
  });

  it('proposes a heading rewrite', () => {
    const res = proposeHeuristicPatches(tree as never, 'rewrite the hero headline', {
      idFn: () => 'pat_h',
      now: () => new Date('2026-07-27T00:00:00.000Z'),
    });
    expect(res.patches[0]!.affectedNodeIds).toContain('w-hero-h1');
    expect(res.patches[0]!.operations[0]).toMatchObject({ op: 'update_props' });
  });
});

describe('AiAgentService', () => {
  it('runs the heuristic proposer by default', async () => {
    const service = new AiAgentService({
      idFn: () => 'pat_x',
      now: () => new Date('2026-07-27T00:00:00.000Z'),
    });
    const res = await service.run({
      projectId: 'p1',
      userMessage: 'make the accent purple',
      tree,
    });
    expect(res.patches[0]!.patchId).toBe('pat_x');
  });

  it('rejects empty messages', async () => {
    const service = new AiAgentService();
    await expect(
      service.run({ projectId: 'p', userMessage: '  ', tree }),
    ).rejects.toMatchObject({ code: 'EMPTY_MESSAGE' } satisfies Partial<AssistantError>);
  });
});

describe('assistant routes', () => {
  it('POST /assistant returns patches', async () => {
    const service = new AiAgentService({ idFn: () => 'pat_route' });
    const app = buildApp({ aiAgentService: service });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/assistant',
      payload: {
        projectId: 'p1',
        userMessage: 'rewrite the hero headline',
        tree,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.patches[0].patchId).toBe('pat_route');
    expect(typeof body.assistantMessage).toBe('string');
    await app.close();
  });
});
