import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/** Load backend/.env into process.env without overriding real env vars. */
function loadDotEnvFile(): void {
  const path = resolve(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnvFile();

/**
 * Environment configuration, validated at startup with zod.
 * The process refuses to boot if required variables are missing or malformed.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  /* Browser origins allowed to call this API directly (comma-separated). */
  CORS_ORIGINS: z.string().default('https://reframelyai.netlify.app'),

  /* Postgres */
  DATABASE_URL: z
    .string()
    .url()
    .default('postgres://reframely:reframely@localhost:5432/reframely'),

  /* S3-compatible object storage (MinIO in development) */
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_BUCKET: z.string().default('reframely-dev'),

  /* Import service limits */
  IMPORT_MAX_TOTAL_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(50 * 1024 * 1024), // 50 MiB uncompressed
  IMPORT_MAX_FILES: z.coerce.number().int().positive().default(2000),

  /* Deploy (B10) — public base used to mint preview URLs */
  DEPLOY_BASE_URL: z.string().url().default('https://preview.reframely.app'),

  /* AI agent (B12) — optional; without a key the heuristic proposer runs */
  ANTHROPIC_API_KEY: z.string().optional(),

  /* Auth (B14): Supabase in production, fixed local user in development. */
  AUTH_MODE: z.enum(['dev', 'on']).default('dev'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  /**
   * Local storage without Docker:
   *   s3  — MinIO/S3 (default)
   *   fs  — filesystem under LOCAL_DATA_DIR (no MinIO needed)
   */
  STORAGE_BACKEND: z.enum(['s3', 'fs']).default('s3'),
  /**
   * Import metadata backend:
   *   postgres — PgImportRepository (default)
   *   file     — JsonFileImportRepository under LOCAL_DATA_DIR
   */
  IMPORT_REPO_BACKEND: z.enum(['postgres', 'file']).default('postgres'),
  LOCAL_DATA_DIR: z.string().default('.data'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Preserve the original production crash guard and its actionable error.
  if (source.NODE_ENV === 'production' && source.AUTH_MODE === 'off') {
    throw new Error('Invalid environment configuration:\n  AUTH_MODE: cannot be off in production');
  }
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const value = result.data;
  if (value.NODE_ENV === 'production' && value.AUTH_MODE !== 'on') {
    throw new Error('Invalid environment configuration:\n  AUTH_MODE: must be on in production');
  }
  if (value.AUTH_MODE === 'on' && (!value.SUPABASE_URL || !value.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error(
      'Invalid environment configuration:\n  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when AUTH_MODE=on',
    );
  }
  return value;
}

export const env = loadEnv();
