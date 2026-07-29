/**
 * Backend API contracts, mirrored from the Fastify services. Kept as a
 * hand-maintained mirror because the frontend can't import across the
 * backend's `src` root. Reconcile with:
 *   backend/src/services/import/types.ts        (ImportResult)
 *   backend/src/services/snapshot/types.ts      (SnapshotResult)
 *   backend/src/services/classifier/index.ts    (ClassifyImportResult)
 *   backend/src/services/classifier/classify.ts (ClassificationStats)
 */

export type ImportSourceType = 'zip' | 'github' | 'live-url';

export interface ImportResult {
  importId: string;
  projectId: string;
  sourceType: ImportSourceType;
  fileCount: number;
  totalBytes: number;
  storagePrefix: string;
}

export interface SnapshotResult {
  projectId: string;
  pageCount: number;
  pages: {
    pagePath: string;
    snapshotKey: string;
    screenshots: Record<string, string>;
  }[];
}

export interface ClassificationStats {
  totalWidgets: number;
  sectionCount: number;
  byType: Partial<Record<string, number>>;
  customHtmlCount: number;
  cleanMappingRate: number;
}

export interface ClassifyImportResult {
  projectId: string;
  pageCount: number;
  pages: {
    pagePath: string;
    treeKey: string;
    stats: ClassificationStats;
    lowConfidenceCount: number;
  }[];
}

/** GET /projects/:projectId/tree — classified trees for the editor. */
export interface ProjectTreePage {
  slug: string;
  pagePath: string;
  treeKey: string;
  tree: import('@/lib/schema').WidgetTree;
  stats?: ClassificationStats;
  lowConfidenceCount: number;
}

export interface ProjectTreesResult {
  projectId: string;
  pageCount: number;
  pages: ProjectTreePage[];
  primary: ProjectTreePage | null;
}

/** Uniform error envelope every service returns: `{ error: { code, message } }`. */
export interface ApiErrorBody {
  error: { code: string; message: string };
}

/**
 * Tree version snapshot (B8/B9). Persisted separately from the in-session
 * undo stack — a durable checkpoint, not a keystroke history.
 */
export interface TreeVersionRecord {
  versionId: string;
  projectId: string;
  createdAt: string;
  label?: string;
  /** Optional storage key once the object store is wired. */
  treeKey?: string;
}

/**
 * Server-side code-sync response (future B4-style parse endpoint).
 * Mirrors the client `CodeDiff` shape so the confirmation UI is shared.
 */
export interface CodeSyncResult {
  styles: {
    nodeId: string;
    label: string;
    fields: {
      key: string;
      kind: 'add' | 'change' | 'remove';
      from?: string;
      to?: string;
      value?: unknown;
    }[];
  }[];
  content: {
    nodeId: string;
    label: string;
    from: string;
    to: string;
    text: string;
  }[];
  unresolved: string[];
}

// ---- Deploy (B10) ---------------------------------------------------------

export type DeployLifecycle = 'never' | 'queued' | 'deploying' | 'live' | 'failed';
export type DomainValidation = 'none' | 'pending' | 'verified' | 'failed';

export interface DeployStatusResult {
  projectId: string;
  status: DeployLifecycle;
  /** Public URL when live (or last known URL after failure). */
  url?: string;
  deployId?: string;
  lastDeployedAt?: string;
  errorMessage?: string;
  domain?: {
    hostname: string;
    status: DomainValidation;
  };
}

export interface DeployResult {
  deployId: string;
  url: string;
  status: 'queued' | 'live' | 'failed';
}

export interface DomainAttachResult {
  hostname: string;
  status: DomainValidation;
  /** DNS instructions for the user when pending. */
  instructions?: string;
}

// ---- Export (B11) ---------------------------------------------------------

export interface ExportResult {
  projectId: string;
  exportId: string;
  zipKey: string;
  downloadUrl: string;
  expiresAt: string;
  fileCount: number;
  totalBytes: number;
}

// ---- Assets (B8) ----------------------------------------------------------

export interface AssetUploadResult {
  projectId: string;
  assetId: string;
  key: string;
  /** Same-origin URL for <img src> (proxied via /api). */
  url: string;
  contentType: string;
  bytes: number;
  filename: string;
  expiresAt: string;
}

// ---- AI assistant (B12) ---------------------------------------------------

export interface AssistantRequestBody {
  projectId: string;
  /** Optional tree version id once B8/B9 versions exist. */
  treeVersionId?: string;
  userMessage: string;
  /** Current tree — frontend-first stopgap until server loads by version. */
  tree: unknown;
}

export interface AssistantResponseBody {
  patches: unknown[];
  assistantMessage: string;
}
