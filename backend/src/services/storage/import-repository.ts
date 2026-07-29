/**
 * Persistence for import metadata. Production uses Postgres; tests use
 * the in-memory implementation. Local no-Docker dev can use JsonFileImportRepository.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
import { env } from '../../config/env.js';

export type ImportSourceType = 'zip' | 'github' | 'live-url';
export type ImportStatus =
  | 'processing'
  | 'completed'
  | 'failed'
  | 'snapshotting'
  | 'snapshotted'
  | 'snapshot_failed';

export interface ImportRecord {
  id: string;
  projectId: string;
  /** Auth provider user id that owns the imported project. */
  ownerId: string;
  sourceType: ImportSourceType;
  /** Original URL (github / live-url) or uploaded filename (zip). */
  origin: string;
  totalBytes: number;
  fileCount: number;
  status: ImportStatus;
  errorCode: string | null;
  createdAt: string;
}

export interface ImportRepository {
  create(record: ImportRecord): Promise<void>;
  update(
    id: string,
    patch: Partial<Pick<ImportRecord, 'status' | 'errorCode' | 'totalBytes' | 'fileCount'>>,
  ): Promise<void>;
  findById(id: string): Promise<ImportRecord | undefined>;
  findByProjectId(projectId: string): Promise<ImportRecord | undefined>;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS imports (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  owner_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('zip', 'github', 'live-url')),
  origin TEXT NOT NULL,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed', 'snapshotting', 'snapshotted', 'snapshot_failed')),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS imports_project_id_idx ON imports (project_id);
-- Existing development databases predate B14. Their legacy rows remain
-- unowned (and therefore inaccessible) until explicitly migrated.
ALTER TABLE imports ADD COLUMN IF NOT EXISTS owner_id TEXT;
CREATE INDEX IF NOT EXISTS imports_owner_id_idx ON imports (owner_id);
-- Re-assert the status CHECK so databases created before the snapshot
-- statuses were added accept the new values (idempotent).
ALTER TABLE imports DROP CONSTRAINT IF EXISTS imports_status_check;
ALTER TABLE imports ADD CONSTRAINT imports_status_check
  CHECK (status IN ('processing', 'completed', 'failed', 'snapshotting', 'snapshotted', 'snapshot_failed'));
`;

export class PgImportRepository implements ImportRepository {
  private readonly pool: pg.Pool;

  constructor(pool?: pg.Pool) {
    this.pool = pool ?? new pg.Pool({ connectionString: env.DATABASE_URL });
  }

  /** Idempotent — run once at startup. */
  async migrate(): Promise<void> {
    await this.pool.query(SCHEMA_SQL);
  }

  async create(r: ImportRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO imports (id, project_id, owner_id, source_type, origin, total_bytes, file_count, status, error_code, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        r.id,
        r.projectId,
        r.ownerId,
        r.sourceType,
        r.origin,
        r.totalBytes,
        r.fileCount,
        r.status,
        r.errorCode,
        r.createdAt,
      ],
    );
  }

  async update(
    id: string,
    patch: Partial<Pick<ImportRecord, 'status' | 'errorCode' | 'totalBytes' | 'fileCount'>>,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE imports SET
         status = COALESCE($2, status),
         error_code = COALESCE($3, error_code),
         total_bytes = COALESCE($4, total_bytes),
         file_count = COALESCE($5, file_count),
         updated_at = now()
       WHERE id = $1`,
      [id, patch.status ?? null, patch.errorCode ?? null, patch.totalBytes ?? null, patch.fileCount ?? null],
    );
  }

  async findById(id: string): Promise<ImportRecord | undefined> {
    const res = await this.pool.query<{
      id: string;
      project_id: string;
      owner_id: string;
      source_type: ImportSourceType;
      origin: string;
      total_bytes: string;
      file_count: number;
      status: ImportStatus;
      error_code: string | null;
      created_at: Date;
    }>('SELECT * FROM imports WHERE id = $1', [id]);
    const row = res.rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      projectId: row.project_id,
      ownerId: row.owner_id,
      sourceType: row.source_type,
      origin: row.origin,
      totalBytes: Number(row.total_bytes),
      fileCount: row.file_count,
      status: row.status,
      errorCode: row.error_code,
      createdAt: row.created_at.toISOString(),
    };
  }

  async findByProjectId(projectId: string): Promise<ImportRecord | undefined> {
    const res = await this.pool.query<{ id: string }>(
      'SELECT id FROM imports WHERE project_id = $1 ORDER BY created_at ASC LIMIT 1',
      [projectId],
    );
    const id = res.rows[0]?.id;
    return id ? this.findById(id) : undefined;
  }
}

export class InMemoryImportRepository implements ImportRepository {
  readonly records = new Map<string, ImportRecord>();

  async create(record: ImportRecord): Promise<void> {
    this.records.set(record.id, { ...record });
  }

  async update(
    id: string,
    patch: Partial<Pick<ImportRecord, 'status' | 'errorCode' | 'totalBytes' | 'fileCount'>>,
  ): Promise<void> {
    const existing = this.records.get(id);
    if (!existing) throw new Error(`import not found: ${id}`);
    this.records.set(id, { ...existing, ...patch });
  }

  async findById(id: string): Promise<ImportRecord | undefined> {
    return this.records.get(id);
  }

  async findByProjectId(projectId: string): Promise<ImportRecord | undefined> {
    return [...this.records.values()].find((record) => record.projectId === projectId);
  }
}

/**
 * JSON-file import metadata for local development without Postgres.
 * Path: `{filePath}` as a single JSON object map id → ImportRecord.
 */
export class JsonFileImportRepository implements ImportRepository {
  private readonly records = new Map<string, ImportRecord>();

  constructor(private readonly filePath: string) {
    this.load();
  }

  private load(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      if (!existsSync(this.filePath)) return;
      const data = JSON.parse(readFileSync(this.filePath, 'utf8')) as Record<string, ImportRecord>;
      for (const [id, record] of Object.entries(data)) this.records.set(id, record);
    } catch {
      /* start empty */
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const obj: Record<string, ImportRecord> = {};
    for (const [id, record] of this.records) obj[id] = record;
    writeFileSync(this.filePath, JSON.stringify(obj, null, 2));
  }

  async create(record: ImportRecord): Promise<void> {
    this.records.set(record.id, { ...record });
    this.persist();
  }

  async update(
    id: string,
    patch: Partial<Pick<ImportRecord, 'status' | 'errorCode' | 'totalBytes' | 'fileCount'>>,
  ): Promise<void> {
    const existing = this.records.get(id);
    if (!existing) throw new Error(`import not found: ${id}`);
    this.records.set(id, { ...existing, ...patch });
    this.persist();
  }

  async findById(id: string): Promise<ImportRecord | undefined> {
    return this.records.get(id);
  }

  async findByProjectId(projectId: string): Promise<ImportRecord | undefined> {
    return [...this.records.values()].find((record) => record.projectId === projectId);
  }
}
