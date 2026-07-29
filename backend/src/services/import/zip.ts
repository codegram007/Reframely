/**
 * Zip source — normalizes an uploaded static-project archive.
 */
import { unzipSync } from 'fflate';
import { ImportError } from './errors.js';
import type { NormalizedProject, ProjectFile } from './types.js';
import {
  contentTypeFor,
  isIgnoredPath,
  sanitizeArchivePath,
  stripCommonRoot,
} from './validate.js';

export function normalizeZip(zipBuffer: Buffer): NormalizedProject {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(zipBuffer));
  } catch {
    throw new ImportError('INVALID_ZIP', 'The uploaded file is not a valid zip archive.');
  }

  let files: ProjectFile[] = [];
  for (const [rawPath, data] of Object.entries(entries)) {
    if (rawPath.endsWith('/')) continue; // directory entry
    const path = sanitizeArchivePath(rawPath);
    if (isIgnoredPath(path)) continue;
    files.push({
      path,
      contents: Buffer.from(data),
      contentType: contentTypeFor(path),
    });
  }

  files = stripCommonRoot(files);
  const totalBytes = files.reduce((sum, f) => sum + f.contents.byteLength, 0);
  return { files, totalBytes };
}
