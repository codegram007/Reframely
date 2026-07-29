/**
 * Object storage boundary. Production uses an S3-compatible store
 * (MinIO in development); tests use the in-memory implementation.
 * Local no-Docker dev can use FileObjectStore (STORAGE_BACKEND=fs).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';

export interface StoredObject {
  body: Buffer;
  contentType: string;
}

export interface ObjectStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Returns undefined when the key does not exist. */
  get(key: string): Promise<StoredObject | undefined>;
  /** All keys under a prefix (recursive). */
  list(prefix: string): Promise<string[]>;
  /**
   * A time-limited URL for downloading `key` directly from storage.
   * `expiresInSeconds` defaults to 15 minutes.
   */
  signedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

const DEFAULT_SIGNED_URL_TTL_SECONDS = 900;

export class S3ObjectStore implements ObjectStore {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: true, // required for MinIO
    });
    this.bucket = env.S3_BUCKET;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<StoredObject | undefined> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) return undefined;
      return {
        body: Buffer.from(bytes),
        contentType: res.ContentType ?? 'application/octet-stream',
      };
    } catch (err) {
      if ((err as { name?: string }).name === 'NoSuchKey') return undefined;
      throw err;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
        }),
      );
      for (const obj of res.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);
    return keys;
  }

  async signedUrl(key: string, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }
}

export class InMemoryObjectStore implements ObjectStore {
  readonly objects = new Map<string, StoredObject>();

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async get(key: string): Promise<StoredObject | undefined> {
    return this.objects.get(key);
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
  }

  async signedUrl(key: string, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<string> {
    // No real signing in-memory: return a stable local URL that encodes
    // the key and TTL so tests can assert on it.
    return `memory://download/${encodeURIComponent(key)}?ttl=${expiresInSeconds}`;
  }
}

/**
 * Filesystem object store for local development without MinIO/Docker.
 * Layout: `{root}/{key}` plus `{root}/.meta/{sha1(key)}.json` for content-type.
 */
export class FileObjectStore implements ObjectStore {
  constructor(private readonly root: string) {
    mkdirSync(root, { recursive: true });
    mkdirSync(join(root, '.meta'), { recursive: true });
  }

  private filePath(key: string): string {
    return join(this.root, ...key.split('/').filter(Boolean));
  }

  private metaPath(key: string): string {
    const hash = createHash('sha1').update(key).digest('hex');
    return join(this.root, '.meta', `${hash}.json`);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const path = this.filePath(key);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
    writeFileSync(this.metaPath(key), JSON.stringify({ key, contentType }));
  }

  async get(key: string): Promise<StoredObject | undefined> {
    const path = this.filePath(key);
    if (!existsSync(path) || !statSync(path).isFile()) return undefined;
    let contentType = 'application/octet-stream';
    const meta = this.metaPath(key);
    if (existsSync(meta)) {
      try {
        contentType = (JSON.parse(readFileSync(meta, 'utf8')) as { contentType?: string })
          .contentType ?? contentType;
      } catch {
        /* keep default */
      }
    }
    return { body: readFileSync(path), contentType };
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    const walk = (dir: string, rel: string) => {
      if (!existsSync(dir)) return;
      for (const name of readdirSync(dir)) {
        if (name === '.meta') continue;
        const full = join(dir, name);
        const nextRel = rel ? `${rel}/${name}` : name;
        if (statSync(full).isDirectory()) walk(full, nextRel);
        else if (nextRel.startsWith(prefix) || prefix === '' || nextRel.startsWith(prefix.replace(/\/$/, ''))) {
          keys.push(nextRel);
        }
      }
    };
    walk(this.root, '');
    return keys.filter((k) => k.startsWith(prefix)).sort();
  }

  async signedUrl(key: string, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<string> {
    // Local FS has no CDN; return a path-style pseudo URL for tests/clients.
    return `file://local/${encodeURIComponent(key)}?ttl=${expiresInSeconds}`;
  }
}
