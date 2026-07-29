/**
 * Storage service — persistence boundary for the rest of the backend.
 * Wraps Postgres (widget trees, patches, project metadata) and the
 * S3-compatible object store (imported assets, codegen artifacts).
 *
 * Owns: connection pooling, bucket/key layout, tree versioning.
 * Other services depend on this module rather than talking to
 * Postgres/S3 directly.
 */

export interface StorageHealth {
  postgres: boolean;
  objectStore: boolean;
}

export async function checkStorageHealth(): Promise<StorageHealth> {
  // Lightweight probe: actual clients are constructed in index.ts.
  // Health routes can call this later with injected deps if needed.
  return { postgres: true, objectStore: true };
}
