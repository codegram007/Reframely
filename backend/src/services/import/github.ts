/**
 * GitHub source — lightweight shallow-clone equivalent: downloads the
 * repo's zipball from codeload.github.com (no git binary, no history)
 * and reuses the zip normalization pipeline. Only static files are
 * kept; app logic and repo metadata are filtered out downstream.
 */
import { ImportError } from './errors.js';
import type { FetchLike, NormalizedProject } from './types.js';
import { normalizeZip } from './zip.js';

export interface GitHubRepoRef {
  owner: string;
  repo: string;
  /** Branch/tag/commit; defaults to the repo's HEAD. */
  ref: string;
}

export function parseGitHubUrl(url: string): GitHubRepoRef {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ImportError('INVALID_GITHUB_URL', 'That is not a valid URL.');
  }
  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
    throw new ImportError('INVALID_GITHUB_URL', 'Only public github.com repository URLs are supported.');
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  const [owner, repoRaw] = segments;
  if (!owner || !repoRaw) {
    throw new ImportError(
      'INVALID_GITHUB_URL',
      'Expected a URL like https://github.com/owner/repo.',
    );
  }
  const repo = repoRaw.replace(/\.git$/, '');
  // Support .../tree/<branch> URLs
  const ref = segments[2] === 'tree' && segments[3] ? segments.slice(3).join('/') : 'HEAD';
  return { owner, repo, ref };
}

export function zipballUrl({ owner, repo, ref }: GitHubRepoRef): string {
  return `https://codeload.github.com/${owner}/${repo}/zip/${ref}`;
}

export async function normalizeGitHubRepo(
  url: string,
  fetchImpl: FetchLike,
): Promise<NormalizedProject> {
  const repoRef = parseGitHubUrl(url);
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(zipballUrl(repoRef), { redirect: 'follow' });
  } catch {
    throw new ImportError('GITHUB_FETCH_FAILED', 'Could not reach GitHub to download the repository.');
  }
  if (!response.ok) {
    throw new ImportError(
      'GITHUB_FETCH_FAILED',
      `GitHub returned ${response.status} for ${repoRef.owner}/${repoRef.repo}. Check that the repository is public and the URL is correct.`,
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return normalizeZip(buffer);
}
