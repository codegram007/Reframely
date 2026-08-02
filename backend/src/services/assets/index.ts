/**
 * Asset upload service (B8) — accepts multipart image/media uploads for a
 * project and stores them under object storage so the editor can reference
 * hosted URLs instead of bloating the widget tree with data: URLs.
 *
 * Layout: projects/{projectId}/assets/{assetId}{ext}
 *
 * Owns: validation, storage, signed download URLs.
 * Does NOT own: rewriting tree props (the frontend sets ImageWidgetProps.src).
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { ObjectStore } from '../storage/object-store.js';

export type AssetErrorCode = 'INVALID_TYPE' | 'TOO_LARGE' | 'EMPTY_FILE';

export class AssetError extends Error {
  constructor(
    readonly code: AssetErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AssetError';
  }
}

export interface AssetUploadResult {
  projectId: string;
  assetId: string;
  /** Object-store key. */
  key: string;
  /** Time-limited download URL the editor can put in `src`. */
  url: string;
  contentType: string;
  bytes: number;
  filename: string;
  expiresAt: string;
}

export interface AssetServiceDeps {
  objectStore: ObjectStore;
  /** Max upload size in bytes (default 10 MiB). */
  maxBytes?: number;
  /** Signed URL TTL (default 7 days — assets are re-signed as needed). */
  urlTtlSeconds?: number;
  idFn?: () => string;
  now?: () => Date;
  /** Optional URL override; defaults to a time-limited object-store URL. */
  publicUrl?: (info: {
    projectId: string;
    assetId: string;
    ext: string;
    key: string;
  }) => string;
}

const DEFAULT_MAX = 10 * 1024 * 1024;
const DEFAULT_TTL = 7 * 24 * 60 * 60;

const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
]);

function extFor(filename: string, contentType: string): string {
  const fromName = path.extname(filename || '').toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  switch (contentType) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/svg+xml':
      return '.svg';
    case 'image/avif':
      return '.avif';
    default:
      return '.bin';
  }
}

export class AssetService {
  private readonly objectStore: ObjectStore;
  private readonly maxBytes: number;
  private readonly ttlSeconds: number;
  private readonly idFn: () => string;
  private readonly now: () => Date;
  private readonly publicUrl: ((info: {
    projectId: string;
    assetId: string;
    ext: string;
    key: string;
  }) => string) | undefined;

  constructor(deps: AssetServiceDeps) {
    this.objectStore = deps.objectStore;
    this.maxBytes = deps.maxBytes ?? DEFAULT_MAX;
    this.ttlSeconds = deps.urlTtlSeconds ?? DEFAULT_TTL;
    this.idFn = deps.idFn ?? (() => randomUUID().replace(/-/g, '').slice(0, 16));
    this.now = deps.now ?? (() => new Date());
    this.publicUrl = deps.publicUrl;
  }

  async upload(
    projectId: string,
    file: { filename: string; mimetype: string; buffer: Buffer },
  ): Promise<AssetUploadResult> {
    if (!file.buffer || file.buffer.length === 0) {
      throw new AssetError('EMPTY_FILE', 'Uploaded file is empty.');
    }
    if (file.buffer.length > this.maxBytes) {
      throw new AssetError(
        'TOO_LARGE',
        `File exceeds the ${Math.round(this.maxBytes / (1024 * 1024))} MiB limit.`,
      );
    }
    const contentType = (file.mimetype || 'application/octet-stream').toLowerCase();
    if (!ALLOWED.has(contentType) && !contentType.startsWith('image/')) {
      throw new AssetError(
        'INVALID_TYPE',
        `Unsupported content type "${contentType}". Upload an image (png, jpeg, webp, gif, svg).`,
      );
    }

    const assetId = this.idFn();
    const ext = extFor(file.filename, contentType);
    const key = `projects/${projectId}/assets/${assetId}${ext}`;
    await this.objectStore.put(key, file.buffer, contentType);

    const url = this.publicUrl
      ? this.publicUrl({ projectId, assetId, ext, key })
      : await this.objectStore.signedUrl(key, this.ttlSeconds);
    const expiresAt = new Date(this.now().getTime() + this.ttlSeconds * 1000).toISOString();

    return {
      projectId,
      assetId,
      key,
      url,
      contentType,
      bytes: file.buffer.length,
      filename: file.filename || `${assetId}${ext}`,
      expiresAt,
    };
  }

  /** Load a stored asset by file name (`{assetId}{ext}`). */
  async getFile(
    projectId: string,
    fileName: string,
  ): Promise<{ body: Buffer; contentType: string } | undefined> {
    const safe = path.basename(fileName);
    if (!safe || safe !== fileName || fileName.includes('..')) return undefined;
    const key = `projects/${projectId}/assets/${safe}`;
    const obj = await this.objectStore.get(key);
    if (!obj) return undefined;
    return { body: obj.body, contentType: obj.contentType };
  }
}
