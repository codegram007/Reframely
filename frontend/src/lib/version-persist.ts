/**
 * Tree version persistence (F15) — durable checkpoints separate from the
 * in-session undo stack.
 *
 * Prefer the backend B8/B9 versions endpoint (`api.saveTreeVersion`). Until
 * that route exists, fall back to a bounded localStorage history so the UI
 * path is real and the swap is one call later.
 *
 * Standing frontend-first note: this is the owed wire-up for B8/B9, not a
 * permanent design. localStorage is project-scoped and size-capped.
 */
import { api, NetworkError, ApiError } from '@/lib/api/client';
import type { WidgetTree } from '@/lib/schema';

const STORAGE_PREFIX = 'reframely:tree-versions:';
const MAX_LOCAL = 20;

export interface LocalTreeVersion {
  versionId: string;
  projectId: string;
  createdAt: string;
  label?: string;
  source: 'autosave' | 'manual';
  /** Full tree only kept in the local stopgap (server stores by key). */
  tree: WidgetTree;
}

export type PersistResult =
  | { ok: true; remote: true; versionId: string }
  | { ok: true; remote: false; versionId: string }
  | { ok: false; error: string };

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

function readLocal(projectId: string): LocalTreeVersion[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalTreeVersion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(projectId: string, versions: LocalTreeVersion[]): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(versions.slice(0, MAX_LOCAL)));
  } catch {
    /* quota / private mode — drop silently */
  }
}

function newId(): string {
  return `ver_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Save a version: try the server, always keep a local copy as stopgap. */
export async function persistTreeVersion(
  projectId: string,
  tree: WidgetTree,
  opts: { label?: string; source?: 'autosave' | 'manual' } = {},
): Promise<PersistResult> {
  const source = opts.source ?? 'autosave';
  const label = opts.label;

  let remoteId: string | undefined;
  try {
    const body: { tree: WidgetTree; source: 'autosave' | 'manual'; label?: string } = {
      tree,
      source,
    };
    if (label !== undefined) body.label = label;
    const remote = await api.saveTreeVersion(projectId, body);
    remoteId = remote.versionId;
  } catch (err) {
    // Expected until B8/B9 is wired — fall through to local.
    if (!(err instanceof NetworkError || err instanceof ApiError)) {
      return { ok: false, error: err instanceof Error ? err.message : 'Version save failed' };
    }
  }

  const record: LocalTreeVersion = {
    versionId: remoteId ?? newId(),
    projectId,
    createdAt: new Date().toISOString(),
    source,
    tree,
    ...(label !== undefined ? { label } : {}),
  };
  const prev = readLocal(projectId);
  writeLocal(projectId, [record, ...prev]);

  return remoteId
    ? { ok: true, remote: true, versionId: remoteId }
    : { ok: true, remote: false, versionId: record.versionId };
}

export function listLocalVersions(projectId: string): Omit<LocalTreeVersion, 'tree'>[] {
  return readLocal(projectId).map(({ tree: _t, ...meta }) => meta);
}

/** Debounced autosave scheduler — one pending timer per project. */
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const lastSavedJson = new Map<string, string>();

/**
 * Schedule a debounced version persist after a real commit (past grew).
 * Skips if the tree JSON matches the last successful save.
 */
export function scheduleVersionAutosave(
  projectId: string,
  tree: WidgetTree,
  debounceMs = 4000,
): void {
  const existing = timers.get(projectId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    timers.delete(projectId);
    const json = JSON.stringify(tree);
    if (lastSavedJson.get(projectId) === json) return;
    void persistTreeVersion(projectId, tree, { source: 'autosave' }).then((r) => {
      if (r.ok) lastSavedJson.set(projectId, json);
    });
  }, debounceMs);

  timers.set(projectId, timer);
}

export function flushVersionAutosave(projectId: string, tree: WidgetTree): Promise<PersistResult> {
  const existing = timers.get(projectId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(projectId);
  }
  return persistTreeVersion(projectId, tree, { source: 'manual', label: 'Manual save' }).then(
    (r) => {
      if (r.ok) lastSavedJson.set(projectId, JSON.stringify(tree));
      return r;
    },
  );
}
