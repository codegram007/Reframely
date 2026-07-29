/**
 * Dev/production auth token plumbing for the API client.
 *
 * Local (AUTH_MODE=dev): bootstrap from VITE_DEV_AUTH_TOKEN, localStorage, or
 * GET /api/auth/dev-token (backend only serves this when AUTH_MODE=dev).
 * Production (Clerk): set the token via setAuthToken after your Clerk session
 * is ready.
 */

const STORAGE_KEY = 'vibestudio:auth-token';
const USER_KEY = 'vibestudio:auth-user';

let memoryToken: string | null = null;
let bootstrapPromise: Promise<void> | null = null;

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        memoryToken = stored;
        return stored;
      }
    } catch {
      /* private mode */
    }
  }
  const envToken = import.meta.env.VITE_DEV_AUTH_TOKEN as string | undefined;
  if (envToken && envToken.length > 0) {
    memoryToken = envToken;
    return envToken;
  }
  return null;
}

export function setAuthToken(token: string | null, userId?: string): void {
  memoryToken = token;
  if (typeof localStorage === 'undefined') return;
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
    if (userId) localStorage.setItem(USER_KEY, userId);
    else if (!token) localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

/**
 * Ensure we have a token before the first protected API call.
 * Safe to call multiple times; concurrent callers share one promise.
 */
export function ensureAuthReady(): Promise<void> {
  if (getAuthToken()) return Promise.resolve();
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      const res = await fetch('/api/auth/dev-token?user=local-user&email=local%40example.com');
      if (!res.ok) return; // AUTH_MODE=off or clerk — nothing to do
      const body = (await res.json()) as { token?: string; userId?: string };
      if (body.token) setAuthToken(body.token, body.userId);
    } catch {
      /* backend down — leave unauthenticated */
    }
  })();

  return bootstrapPromise;
}
