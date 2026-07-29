/**
 * User-facing import failures. `code` is stable for the frontend to
 * branch on; `message` is safe to display verbatim.
 */
export type ImportErrorCode =
  | 'INVALID_ZIP'
  | 'ZIP_TOO_LARGE'
  | 'TOO_MANY_FILES'
  | 'NOT_A_FRONTEND_PROJECT'
  | 'INVALID_GITHUB_URL'
  | 'GITHUB_FETCH_FAILED'
  | 'INVALID_URL'
  | 'SITE_FETCH_FAILED'
  | 'NOT_HTML_CONTENT'
  | 'UNSAFE_ARCHIVE_PATH';

export class ImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}
