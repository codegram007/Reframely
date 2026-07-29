import type { ImportSourceType } from '../storage/import-repository.js';

/** A single normalized project file, path relative to the project root. */
export interface ProjectFile {
  path: string;
  contents: Buffer;
  contentType: string;
}

/** The single representation every import source normalizes into. */
export interface NormalizedProject {
  files: ProjectFile[];
  totalBytes: number;
}

export interface ImportResult {
  importId: string;
  projectId: string;
  sourceType: ImportSourceType;
  fileCount: number;
  totalBytes: number;
  /** Object-store key prefix the files were written under. */
  storagePrefix: string;
}

/** Injectable fetch so tests can stub network access. */
export type FetchLike = (
  url: string,
  init?: { redirect?: 'follow'; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}>;
