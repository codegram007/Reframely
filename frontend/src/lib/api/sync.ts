import { getAuthToken, handleUnauthorized } from './auth';

/**
 * Open the B15 project sync socket with the current Supabase access token.
 * Browsers cannot attach an Authorization header to WebSocket handshakes, so
 * the backend accepts this token only as `access_token` on the sync route.
 */
export async function openProjectSyncSocket(
  projectId: string,
  pageId: string,
  clientId?: string,
): Promise<WebSocket> {
  const token = await getAuthToken();
  if (!token) {
    await handleUnauthorized();
    throw new Error('An authenticated Supabase session is required.');
  }

  const backendOrigin = import.meta.env.VITE_BACKEND_URL?.trim() || window.location.origin;
  const url = new URL(
    `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/sync`,
    backendOrigin,
  );
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('access_token', token);
  if (clientId) url.searchParams.set('clientId', clientId);
  return new WebSocket(url);
}
