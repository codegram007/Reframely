/** Stable error codes the frontend can branch on. */
export type SnapshotErrorCode =
  | 'IMPORT_NOT_FOUND'
  | 'IMPORT_NOT_READY'
  | 'NO_SOURCE_FILES'
  | 'RENDER_FAILED';

export class SnapshotError extends Error {
  constructor(
    readonly code: SnapshotErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SnapshotError';
  }
}
