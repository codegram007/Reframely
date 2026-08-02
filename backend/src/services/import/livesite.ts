/**
 * Live-site source — fetches the rendered HTML of an already-deployed
 * page and stores it as index.html. This snapshot feeds the Playwright
 * rendering step later in the pipeline; assets are not crawled here.
 */
import { ImportError } from './errors.js';
import type { FetchLike, NormalizedProject } from './types.js';

export async function normalizeLiveSite(
  url: string,
  fetchImpl: FetchLike,
): Promise<NormalizedProject> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ImportError('INVALID_URL', 'That is not a valid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ImportError('INVALID_URL', 'Only http(s) URLs are supported.');
  }

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(parsed.toString(), {
      redirect: 'follow',
      headers: { 'user-agent': 'ReframelyImporter/0.1 (+https://reframely.app)' },
    });
  } catch {
    throw new ImportError('SITE_FETCH_FAILED', 'Could not reach the site. Check the URL and try again.');
  }
  if (!response.ok) {
    throw new ImportError('SITE_FETCH_FAILED', `The site returned HTTP ${response.status}.`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    throw new ImportError(
      'NOT_HTML_CONTENT',
      `The URL returned "${contentType || 'unknown content'}" instead of an HTML page.`,
    );
  }

  const html = await response.text();
  const contents = Buffer.from(html, 'utf8');
  return {
    files: [{ path: 'index.html', contents, contentType: 'text/html' }],
    totalBytes: contents.byteLength,
  };
}
