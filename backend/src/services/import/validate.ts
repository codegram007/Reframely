import { env } from '../../config/env.js';
import { ImportError } from './errors.js';
import type { NormalizedProject, ProjectFile } from './types.js';

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  txt: 'text/plain',
  xml: 'application/xml',
  webmanifest: 'application/manifest+json',
};

export function contentTypeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/** Directories/files that are never part of the served frontend. */
const IGNORED_SEGMENTS = new Set(['node_modules', '.git', '__MACOSX', '.svn', '.hg']);
const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db', '.gitignore']);

export function isIgnoredPath(path: string): boolean {
  const segments = path.split('/');
  const filename = segments[segments.length - 1] ?? '';
  return segments.some((s) => IGNORED_SEGMENTS.has(s)) || IGNORED_FILES.has(filename);
}

/** Reject zip-slip / absolute paths; returns a cleaned relative path. */
export function sanitizeArchivePath(rawPath: string): string {
  const path = rawPath.replaceAll('\\', '/');
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path) || path.split('/').includes('..')) {
    throw new ImportError(
      'UNSAFE_ARCHIVE_PATH',
      `The archive contains an unsafe file path: "${rawPath}".`,
    );
  }
  return path;
}

/**
 * If every file shares a single top-level directory (typical of GitHub
 * zipballs and "zipped folder" uploads), strip it.
 */
export function stripCommonRoot(files: ProjectFile[]): ProjectFile[] {
  const roots = new Set(files.map((f) => f.path.split('/')[0]));
  if (roots.size !== 1) return files;
  const root = [...roots][0];
  if (!root || !files.every((f) => f.path.includes('/'))) return files;
  return files.map((f) => ({ ...f, path: f.path.slice(root.length + 1) }));
}

/**
 * Enforce size/count limits and reject projects with no HTML entry
 * point. Throws ImportError with a display-safe message.
 */
export function validateProject(project: NormalizedProject): void {
  if (project.files.length === 0) {
    throw new ImportError('NOT_A_FRONTEND_PROJECT', 'The import contains no usable files.');
  }
  if (project.files.length > env.IMPORT_MAX_FILES) {
    throw new ImportError(
      'TOO_MANY_FILES',
      `The project has ${project.files.length} files, which exceeds the limit of ${env.IMPORT_MAX_FILES}.`,
    );
  }
  if (project.totalBytes > env.IMPORT_MAX_TOTAL_BYTES) {
    const mb = (n: number): string => (n / (1024 * 1024)).toFixed(1);
    throw new ImportError(
      'ZIP_TOO_LARGE',
      `The project is ${mb(project.totalBytes)} MB, which exceeds the limit of ${mb(env.IMPORT_MAX_TOTAL_BYTES)} MB.`,
    );
  }
  const hasHtml = project.files.some((f) => /\.html?$/i.test(f.path));
  if (!hasHtml) {
    throw new ImportError(
      'NOT_A_FRONTEND_PROJECT',
      'No HTML file was found in the project. Vibestudio imports static frontend projects — make sure the upload includes an index.html (or other .html) file.',
    );
  }
}
