/**
 * B15 — ephemeral, server-ordered page patch hub.
 *
 * Broadcasts B12 TreePatch objects to every open tab (or AI-driven client)
 * for a given project/page. State is in-memory only: rooms evaporate when the
 * last subscriber disconnects and nothing is written to Postgres/S3.
 *
 * ## Conflict rule (v1) — last-write-wins by *server arrival order*
 *
 * The hub assigns a monotonic `revision` per page when a patch is accepted.
 * Clients may include `baseRevision` (the revision they last applied) as a
 * hint; if it lags behind the server, the patch is still accepted and marked
 * `stale: true`. Later arrivals win simply by being ordered later. There is
 * no operational transform, no merge, and no client-side rejection.
 *
 * ## What would change for real multiplayer collaboration later
 * (explicit non-goal in the PRD for v1)
 *
 * - Reject or transform patches whose `baseRevision !== currentRevision`
 *   instead of accepting every arrival (OT / CRDT).
 * - Persist an ordered event log (or snapshot + delta) so reconnecting
 *   clients can catch up after a process restart.
 * - Presence, cursors, selection locks, and per-field ownership.
 * - Authz at finer granularity than project owner (shared editors).
 * - Durable fan-out across multiple API instances (Redis pub/sub, etc.).
 */
import { randomUUID } from 'node:crypto';
import type { TreePatch } from '../../lib/tree-patch.js';

export type { TreePatch } from '../../lib/tree-patch.js';

export type SyncErrorCode =
  | 'INVALID_MESSAGE'
  | 'INVALID_PATCH'
  | 'UNKNOWN_TYPE';

export class SyncError extends Error {
  constructor(
    readonly code: SyncErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

/** Client → server messages. */
export type SyncClientMessage =
  | {
      type: 'submit_patch';
      /** Stable tab/session id; server assigns one on connect if omitted later. */
      clientId?: string;
      /**
       * Last revision this client believes it has applied. Optional.
       * When lower than the hub's current revision the patch is still
       * accepted (LWW) but flagged `stale: true` on the broadcast.
       */
      baseRevision?: number;
      patch: TreePatch;
    }
  | { type: 'ping' };

/** Server → client messages. */
export type SyncServerMessage =
  | {
      type: 'welcome';
      projectId: string;
      pageId: string;
      revision: number;
      clientId: string;
      /** Protocol + conflict policy so clients can branch behavior. */
      policy: {
        conflict: 'last-write-wins';
        durable: false;
      };
    }
  | {
      type: 'patch_applied';
      projectId: string;
      pageId: string;
      revision: number;
      /** Authoring client (the submitter). */
      clientId: string;
      baseRevision: number | null;
      /** True when baseRevision was provided and lagged the hub. */
      stale: boolean;
      patch: TreePatch;
      acceptedAt: string;
    }
  | {
      type: 'error';
      code: SyncErrorCode;
      message: string;
    }
  | { type: 'pong' };

export interface SyncSocket {
  /** Best-effort send; implementations should no-op if the socket is closed. */
  send(message: SyncServerMessage): void;
}

export interface PageSyncHubDeps {
  now?: () => Date;
  idFn?: () => string;
}

interface RoomClient {
  clientId: string;
  socket: SyncSocket;
}

interface PageRoom {
  projectId: string;
  pageId: string;
  revision: number;
  clients: Map<string, RoomClient>;
}

function roomKey(projectId: string, pageId: string): string {
  return `${projectId}\0${pageId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Structural validation of the B12 TreePatch wire shape (no tree apply). */
export function assertTreePatch(value: unknown): asserts value is TreePatch {
  if (!isRecord(value)) throw new SyncError('INVALID_PATCH', 'patch must be an object.');
  if (typeof value['patchId'] !== 'string' || value['patchId'].length === 0) {
    throw new SyncError('INVALID_PATCH', 'patch.patchId is required.');
  }
  if (typeof value['createdAt'] !== 'string' || value['createdAt'].length === 0) {
    throw new SyncError('INVALID_PATCH', 'patch.createdAt is required.');
  }
  if (!Array.isArray(value['operations']) || value['operations'].length === 0) {
    throw new SyncError('INVALID_PATCH', 'patch.operations must be a non-empty array.');
  }
  for (const op of value['operations']) {
    if (!isRecord(op) || typeof op['op'] !== 'string') {
      throw new SyncError('INVALID_PATCH', 'Each operation must include an op field.');
    }
  }
  if (typeof value['confidence'] !== 'number' || !Number.isFinite(value['confidence'])) {
    throw new SyncError('INVALID_PATCH', 'patch.confidence must be a number.');
  }
  if (value['confidence'] < 0 || value['confidence'] > 1) {
    throw new SyncError('INVALID_PATCH', 'patch.confidence must be between 0 and 1.');
  }
  if (typeof value['rationale'] !== 'string') {
    throw new SyncError('INVALID_PATCH', 'patch.rationale must be a string.');
  }
  if (!Array.isArray(value['affectedNodeIds'])) {
    throw new SyncError('INVALID_PATCH', 'patch.affectedNodeIds must be an array.');
  }
}

export function parseClientMessage(raw: unknown): SyncClientMessage {
  let text: string;
  if (typeof raw === 'string') {
    text = raw;
  } else if (Buffer.isBuffer(raw)) {
    text = raw.toString('utf8');
  } else if (raw instanceof ArrayBuffer) {
    text = Buffer.from(raw).toString('utf8');
  } else if (ArrayBuffer.isView(raw)) {
    text = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString('utf8');
  } else {
    throw new SyncError('INVALID_MESSAGE', 'Message must be a UTF-8 JSON string.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SyncError('INVALID_MESSAGE', 'Message is not valid JSON.');
  }
  if (!isRecord(parsed) || typeof parsed['type'] !== 'string') {
    throw new SyncError('INVALID_MESSAGE', 'Message must include a type field.');
  }

  if (parsed['type'] === 'ping') return { type: 'ping' };

  if (parsed['type'] === 'submit_patch') {
    assertTreePatch(parsed['patch']);
    const msg: SyncClientMessage = {
      type: 'submit_patch',
      patch: parsed['patch'],
    };
    if (typeof parsed['clientId'] === 'string' && parsed['clientId'].length > 0) {
      msg.clientId = parsed['clientId'];
    }
    if (parsed['baseRevision'] !== undefined) {
      if (
        typeof parsed['baseRevision'] !== 'number' ||
        !Number.isInteger(parsed['baseRevision']) ||
        parsed['baseRevision'] < 0
      ) {
        throw new SyncError('INVALID_MESSAGE', 'baseRevision must be a non-negative integer.');
      }
      msg.baseRevision = parsed['baseRevision'];
    }
    return msg;
  }

  throw new SyncError('UNKNOWN_TYPE', `Unknown message type: ${String(parsed['type'])}.`);
}

/**
 * In-memory hub. One room per (projectId, pageId). Not multi-process safe —
 * see file header for the multiplayer upgrade path.
 */
export class PageSyncHub {
  private readonly rooms = new Map<string, PageRoom>();
  private readonly now: () => Date;
  private readonly idFn: () => string;

  constructor(deps: PageSyncHubDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.idFn = deps.idFn ?? (() => randomUUID());
  }

  /** Current revision for a page (0 when no room / no patches yet). */
  revisionOf(projectId: string, pageId: string): number {
    return this.rooms.get(roomKey(projectId, pageId))?.revision ?? 0;
  }

  subscriberCount(projectId: string, pageId: string): number {
    return this.rooms.get(roomKey(projectId, pageId))?.clients.size ?? 0;
  }

  /**
   * Join a page room. Returns the assigned clientId and current revision.
   * Sends a `welcome` frame immediately.
   */
  subscribe(
    projectId: string,
    pageId: string,
    socket: SyncSocket,
    preferredClientId?: string,
  ): { clientId: string; revision: number } {
    const key = roomKey(projectId, pageId);
    let room = this.rooms.get(key);
    if (!room) {
      room = { projectId, pageId, revision: 0, clients: new Map() };
      this.rooms.set(key, room);
    }

    let clientId =
      preferredClientId && preferredClientId.length > 0 ? preferredClientId : this.idFn();
    // Avoid collision if a preferred id is already connected (e.g. reconnect race).
    if (room.clients.has(clientId)) clientId = this.idFn();

    room.clients.set(clientId, { clientId, socket });

    socket.send({
      type: 'welcome',
      projectId,
      pageId,
      revision: room.revision,
      clientId,
      policy: { conflict: 'last-write-wins', durable: false },
    });

    return { clientId, revision: room.revision };
  }

  /** Leave a room; drops the room entirely when the last client disconnects. */
  unsubscribe(projectId: string, pageId: string, clientId: string): void {
    const key = roomKey(projectId, pageId);
    const room = this.rooms.get(key);
    if (!room) return;
    room.clients.delete(clientId);
    if (room.clients.size === 0) this.rooms.delete(key);
  }

  /**
   * Accept a patch under last-write-wins: always assign the next revision and
   * broadcast to every subscriber, including the author (ack + fan-out).
   */
  submitPatch(
    projectId: string,
    pageId: string,
    authorClientId: string,
    patch: TreePatch,
    baseRevision?: number,
  ): SyncServerMessage & { type: 'patch_applied' } {
    assertTreePatch(patch);

    const key = roomKey(projectId, pageId);
    let room = this.rooms.get(key);
    if (!room) {
      // Allow submit without prior subscribe (e.g. unit tests / one-shot).
      room = { projectId, pageId, revision: 0, clients: new Map() };
      this.rooms.set(key, room);
    }

    const stale =
      baseRevision !== undefined && Number.isInteger(baseRevision) && baseRevision < room.revision;

    room.revision += 1;
    const applied: SyncServerMessage & { type: 'patch_applied' } = {
      type: 'patch_applied',
      projectId,
      pageId,
      revision: room.revision,
      clientId: authorClientId,
      baseRevision: baseRevision ?? null,
      stale,
      patch,
      acceptedAt: this.now().toISOString(),
    };

    for (const client of room.clients.values()) {
      client.socket.send(applied);
    }
    return applied;
  }

  /** Handle a parsed client message for a connected subscriber. */
  handleMessage(
    projectId: string,
    pageId: string,
    clientId: string,
    message: SyncClientMessage,
  ): void {
    if (message.type === 'ping') {
      const room = this.rooms.get(roomKey(projectId, pageId));
      const client = room?.clients.get(clientId);
      client?.socket.send({ type: 'pong' });
      return;
    }

    const author = message.clientId ?? clientId;
    this.submitPatch(projectId, pageId, author, message.patch, message.baseRevision);
  }
}
