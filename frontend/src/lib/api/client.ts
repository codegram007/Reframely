import type {
  ApiErrorBody,
  AssistantRequestBody,
  AssistantResponseBody,
  ClassifyImportResult,
  CodeSyncResult,
  DeployResult,
  DeployStatusResult,
  DomainAttachResult,
  ExportResult,
  AssetUploadResult,
  ImportResult,
  ProjectTreesResult,
  SnapshotResult,
  TreeVersionRecord,
} from './types';
import type { WidgetTree } from '@/lib/schema';
import { authHeaders, ensureAuthReady, handleUnauthorized } from './auth';

const BASE = '/api';

/**
 * A backend error with a stable `code` (e.g. NOT_A_FRONTEND_PROJECT) and
 * a display-safe `message`. The UI switches on `code` for tailored
 * explanations and shows `message` verbatim.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Network / non-HTTP failure (backend down, DNS, offline). */
export class NetworkError extends Error {
  constructor(message = 'Could not reach the server.') {
    super(message);
    this.name = 'NetworkError';
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let code = 'UNKNOWN';
  let message = `Request failed (${res.status}).`;
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (body.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
    }
  } catch {
    /* non-JSON body — keep defaults */
  }
  return new ApiError(code, message, res.status);
}

async function request(
  path: string,
  init: RequestInit & { skipAuthBootstrap?: boolean } = {},
): Promise<Response> {
  if (!init.skipAuthBootstrap) await ensureAuthReady();
  const { skipAuthBootstrap: _s, headers, ...rest } = init;
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...rest,
      headers: {
        ...(await authHeaders()),
        ...(headers as Record<string, string> | undefined),
      },
    });
    if (res.status === 401) await handleUnauthorized();
    return res;
  } catch {
    throw new NetworkError();
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await request(path, { method: 'GET' });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

/**
 * Upload a zip with progress. Uses XMLHttpRequest because fetch can't
 * report upload progress; resolves/rejects with the same error taxonomy
 * as the JSON helpers.
 */
function uploadZip(file: File, onProgress?: (fraction: number) => void): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        await ensureAuthReady();
      } catch {
        /* continue; authHeaders may still be empty */
      }

      const form = new FormData();
      form.append('file', file, file.name);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/imports/zip`);
      const headers = await authHeaders();
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      });
      xhr.addEventListener('load', () => {
        if (xhr.status === 401) void handleUnauthorized();
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as ImportResult);
          } catch {
            reject(new ApiError('BAD_RESPONSE', 'Server returned an unreadable response.', xhr.status));
          }
          return;
        }
        let code = 'UNKNOWN';
        let message = `Upload failed (${xhr.status}).`;
        try {
          const body = JSON.parse(xhr.responseText) as Partial<ApiErrorBody>;
          if (body.error) {
            code = body.error.code ?? code;
            message = body.error.message ?? message;
          }
        } catch {
          /* keep defaults */
        }
        reject(new ApiError(code, message, xhr.status));
      });
      xhr.addEventListener('error', () =>
        reject(new NetworkError('Upload failed — could not reach the server.')),
      );
      xhr.addEventListener('abort', () => reject(new NetworkError('Upload cancelled.')));

      xhr.send(form);
    })();
  });
}

/** Typed client for the import → snapshot → classify pipeline + later B8/B9 hooks. */
export const api = {
  importZip: uploadZip,
  importGitHub: (url: string) => postJson<ImportResult>('/imports/github', { url }),
  importUrl: (url: string) => postJson<ImportResult>('/imports/url', { url }),
  snapshot: (importId: string) =>
    postJson<SnapshotResult>(`/imports/${encodeURIComponent(importId)}/snapshot`, {}),
  classify: (importId: string) =>
    postJson<ClassifyImportResult>(`/imports/${encodeURIComponent(importId)}/classify`, {}),

  /** Load classified widget trees for the editor (primary page + all pages). */
  getProjectTrees: (projectId: string) =>
    getJson<ProjectTreesResult>(`/projects/${encodeURIComponent(projectId)}/tree`),

  /**
   * F14 server-side code sync (B4-style). Not implemented on the backend yet;
   * callers should fall back to the client `computeCodeDiff` stopgap.
   */
  parseCodeEdits: (projectId: string, body: { html: string; css: string; tree: WidgetTree }) =>
    postJson<CodeSyncResult>(
      `/projects/${encodeURIComponent(projectId)}/code-sync`,
      body,
    ),

  /**
   * Persist a durable tree version (B8/B9). Separate from in-session undo.
   * Frontend autosave falls back to localStorage when this 404s/network-fails.
   */
  saveTreeVersion: (
    projectId: string,
    body: { tree: WidgetTree; label?: string; source?: 'autosave' | 'manual' },
  ) =>
    postJson<TreeVersionRecord>(
      `/projects/${encodeURIComponent(projectId)}/versions`,
      body,
    ),

  listTreeVersions: (projectId: string) =>
    getJson<{ projectId: string; versions: TreeVersionRecord[] }>(
      `/projects/${encodeURIComponent(projectId)}/versions`,
    ),

  getTreeVersion: (projectId: string, versionId: string) =>
    getJson<{ record: TreeVersionRecord; tree: WidgetTree }>(
      `/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`,
    ),

  // ---- Deploy (B10) -------------------------------------------------------
  getDeployStatus: async (projectId: string): Promise<DeployStatusResult> => {
    const res = await request(`/projects/${encodeURIComponent(projectId)}/deploy`);
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as DeployStatusResult;
  },
  deployProject: (
    projectId: string,
    body: { target?: 'preview' | 'production' } = {},
  ) =>
    postJson<DeployResult>(`/projects/${encodeURIComponent(projectId)}/deploy`, body),
  attachDomain: (projectId: string, hostname: string) =>
    postJson<DomainAttachResult>(
      `/projects/${encodeURIComponent(projectId)}/domain`,
      { hostname },
    ),

  // ---- Export (B11) -------------------------------------------------------
  exportProject: (projectId: string) =>
    postJson<ExportResult>(`/projects/${encodeURIComponent(projectId)}/export`, {}),

  // ---- Assets (B8) --------------------------------------------------------
  /**
   * Upload an image for a project. Returns a same-origin `/api/...` URL the
   * editor can put in `ImageWidgetProps.src`.
   */
  uploadAsset: async (projectId: string, file: File): Promise<AssetUploadResult> => {
    await ensureAuthReady();
    const form = new FormData();
    form.append('file', file, file.name);
    let res: Response;
    try {
      const headers = await authHeaders();
      res = await fetch(`${BASE}/projects/${encodeURIComponent(projectId)}/assets`, {
        method: 'POST',
        headers,
        body: form,
      });
    } catch {
      throw new NetworkError();
    }
    if (res.status === 401) await handleUnauthorized();
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as AssetUploadResult;
  },

  // ---- AI assistant (B12) -------------------------------------------------
  runAssistant: (body: AssistantRequestBody) =>
    postJson<AssistantResponseBody>('/assistant', body),
};
