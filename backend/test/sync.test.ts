import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { SupabaseAuthService } from '../src/services/auth/index.js';
import { ProjectAccessService } from '../src/services/projects/index.js';
import {
  PageSyncHub,
  parseClientMessage,
  type SyncServerMessage,
  type SyncSocket,
  type TreePatch,
} from '../src/services/sync/index.js';
import { InMemoryImportRepository } from '../src/services/storage/import-repository.js';

const NOW = '2026-07-29T12:00:00.000Z';

function samplePatch(id = 'patch-1'): TreePatch {
  return {
    patchId: id,
    createdAt: NOW,
    confidence: 0.9,
    rationale: 'test edit',
    affectedNodeIds: ['w1'],
    operations: [
      {
        op: 'update_props',
        nodeId: 'w1',
        props: { content: `hello-${id}` },
      },
    ],
  };
}

class CollectingSocket implements SyncSocket {
  readonly messages: SyncServerMessage[] = [];
  send(message: SyncServerMessage): void {
    this.messages.push(message);
  }
}

function parseWsData(data: unknown): SyncServerMessage {
  const text = typeof data === 'string' ? data : Buffer.from(data as Buffer).toString('utf8');
  return JSON.parse(text) as SyncServerMessage;
}

/**
 * Buffer every frame from the moment injectWS constructs the client socket
 * (via onInit) so the server's immediate `welcome` cannot race past us.
 */
function openSyncSocket(
  app: { injectWS: (path?: string, ctx?: object, opts?: object) => Promise<import('ws').WebSocket> },
  path: string,
  upgradeContext: Record<string, unknown> = {},
): Promise<{
  ws: import('ws').WebSocket;
  next: (predicate: (msg: SyncServerMessage) => boolean, timeoutMs?: number) => Promise<SyncServerMessage>;
  close: () => void;
}> {
  const buffer: SyncServerMessage[] = [];
  const waiters: Array<{
    predicate: (msg: SyncServerMessage) => boolean;
    resolve: (msg: SyncServerMessage) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  const push = (msg: SyncServerMessage) => {
    for (let i = 0; i < waiters.length; i++) {
      const waiter = waiters[i]!;
      if (waiter.predicate(msg)) {
        clearTimeout(waiter.timer);
        waiters.splice(i, 1);
        waiter.resolve(msg);
        return;
      }
    }
    buffer.push(msg);
  };

  return app
    .injectWS(path, upgradeContext, {
      onInit: (ws: import('ws').WebSocket) => {
        ws.on('message', (data: unknown) => {
          try {
            push(parseWsData(data));
          } catch {
            /* ignore non-JSON */
          }
        });
      },
    })
    .then((ws) => ({
      ws,
      next(predicate: (msg: SyncServerMessage) => boolean, timeoutMs = 3000) {
        const idx = buffer.findIndex(predicate);
        if (idx >= 0) {
          const [msg] = buffer.splice(idx, 1);
          return Promise.resolve(msg!);
        }
        return new Promise<SyncServerMessage>((resolve, reject) => {
          const timer = setTimeout(() => {
            const i = waiters.findIndex((w) => w.timer === timer);
            if (i >= 0) waiters.splice(i, 1);
            reject(new Error(`Timed out waiting for WS message. Buffered: ${JSON.stringify(buffer)}`));
          }, timeoutMs);
          waiters.push({ predicate, resolve, reject, timer });
        });
      },
      close() {
        ws.close();
      },
    }));
}

describe('PageSyncHub', () => {
  it('assigns revisions in server arrival order and flags stale bases (LWW)', () => {
    const hub = new PageSyncHub({
      now: () => new Date(NOW),
      idFn: () => 'client-a',
    });
    const a = new CollectingSocket();
    const b = new CollectingSocket();
    hub.subscribe('proj', 'page', a);
    hub.subscribe('proj', 'page', b, 'client-b');

    expect(a.messages[0]).toMatchObject({
      type: 'welcome',
      revision: 0,
      policy: { conflict: 'last-write-wins', durable: false },
    });

    const first = hub.submitPatch('proj', 'page', 'client-a', samplePatch('p1'), 0);
    expect(first).toMatchObject({ type: 'patch_applied', revision: 1, stale: false, baseRevision: 0 });

    // Second client still thinks base is 0 — accepted, marked stale, still wins as rev 2.
    const second = hub.submitPatch('proj', 'page', 'client-b', samplePatch('p2'), 0);
    expect(second).toMatchObject({
      type: 'patch_applied',
      revision: 2,
      stale: true,
      baseRevision: 0,
      clientId: 'client-b',
    });

    // Both clients received both broadcasts (including author).
    const appliedA = a.messages.filter((m) => m.type === 'patch_applied');
    const appliedB = b.messages.filter((m) => m.type === 'patch_applied');
    expect(appliedA).toHaveLength(2);
    expect(appliedB).toHaveLength(2);
    expect(appliedA.map((m) => (m as { revision: number }).revision)).toEqual([1, 2]);
  });

  it('drops the room when the last subscriber disconnects (ephemeral)', () => {
    const hub = new PageSyncHub({ idFn: () => 'only' });
    const socket = new CollectingSocket();
    const { clientId } = hub.subscribe('p', 'page', socket);
    hub.submitPatch('p', 'page', clientId, samplePatch());
    expect(hub.revisionOf('p', 'page')).toBe(1);
    expect(hub.subscriberCount('p', 'page')).toBe(1);

    hub.unsubscribe('p', 'page', clientId);
    expect(hub.subscriberCount('p', 'page')).toBe(0);
    // Room gone → revision resets for a new session.
    expect(hub.revisionOf('p', 'page')).toBe(0);
  });

  it('rejects malformed patches and unknown message types', () => {
    expect(() => parseClientMessage('{')).toThrow(/not valid JSON/);
    expect(() => parseClientMessage(JSON.stringify({ type: 'submit_patch', patch: {} }))).toThrow(
      /patchId/,
    );
    expect(() => parseClientMessage(JSON.stringify({ type: 'nope' }))).toThrow(/Unknown message type/);
    expect(parseClientMessage(JSON.stringify({ type: 'ping' }))).toEqual({ type: 'ping' });
  });
});

describe('sync routes (WebSocket)', () => {
  it('broadcasts patches to every open tab on the same page', async () => {
    const hub = new PageSyncHub({
      now: () => new Date(NOW),
      idFn: (() => {
        let n = 0;
        return () => `c${++n}`;
      })(),
    });
    const app = buildApp({ pageSyncHub: hub });
    await app.ready();

    const path = '/projects/proj-1/pages/home/sync';
    const a = await openSyncSocket(app, path);
    const b = await openSyncSocket(app, path);

    await expect(a.next((m) => m.type === 'welcome')).resolves.toMatchObject({
      type: 'welcome',
      projectId: 'proj-1',
      pageId: 'home',
      revision: 0,
    });
    await expect(b.next((m) => m.type === 'welcome')).resolves.toMatchObject({
      type: 'welcome',
      pageId: 'home',
    });

    const bSeesPatch = b.next((m) => m.type === 'patch_applied');
    const aSeesPatch = a.next((m) => m.type === 'patch_applied');

    a.ws.send(
      JSON.stringify({
        type: 'submit_patch',
        baseRevision: 0,
        patch: samplePatch('from-a'),
      }),
    );

    const [fromA, fromB] = await Promise.all([aSeesPatch, bSeesPatch]);
    expect(fromA).toMatchObject({
      type: 'patch_applied',
      revision: 1,
      stale: false,
      patch: { patchId: 'from-a' },
    });
    expect(fromB).toMatchObject({
      type: 'patch_applied',
      revision: 1,
      patch: { patchId: 'from-a' },
    });

    a.close();
    b.close();
    await app.close();
  });

  it('returns an error frame for invalid patches without closing the socket', async () => {
    const app = buildApp({ pageSyncHub: new PageSyncHub() });
    await app.ready();
    const client = await openSyncSocket(app, '/projects/p/pages/x/sync');
    await client.next((m) => m.type === 'welcome');

    const errP = client.next((m) => m.type === 'error');
    client.ws.send(JSON.stringify({ type: 'submit_patch', patch: { patchId: 'x' } }));
    await expect(errP).resolves.toMatchObject({ type: 'error', code: 'INVALID_PATCH' });

    // Still alive — ping works.
    const pongP = client.next((m) => m.type === 'pong');
    client.ws.send(JSON.stringify({ type: 'ping' }));
    await expect(pongP).resolves.toMatchObject({ type: 'pong' });

    client.close();
    await app.close();
  });

  it('enforces B14 project ownership on the WebSocket upgrade', async () => {
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
      createdAt: NOW,
    });
    const auth = new SupabaseAuthService({
      mode: 'on',
      verifySupabaseToken: async (token) => {
        if (token === 'user-a' || token === 'user-b') return { id: token };
        throw new Error('invalid token');
      },
    });
    const app = buildApp({
      pageSyncHub: new PageSyncHub(),
      authService: auth,
      projectAccessService: new ProjectAccessService(repository),
    });
    await app.ready();

    const owner = await openSyncSocket(
      app,
      '/projects/project-a/pages/home/sync?access_token=user-a',
    );
    await expect(owner.next((m) => m.type === 'welcome')).resolves.toMatchObject({
      type: 'welcome',
      projectId: 'project-a',
    });
    owner.close();

    await expect(
      openSyncSocket(app, '/projects/project-a/pages/home/sync?access_token=user-b'),
    ).rejects.toThrow();

    await expect(openSyncSocket(app, '/projects/project-a/pages/home/sync')).rejects.toThrow();

    await app.close();
  });
});
