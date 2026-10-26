import { createClient, type Session, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function createMockSupabase() {
  const STORAGE_KEY = 'reframely_dev_auth_session';
  const listeners = new Set<(event: string, session: Session | null) => void>();

  const getStoredSession = (): Session | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return null;
  };

  let currentSession: Session | null = getStoredSession();

  const notify = (event: string) => {
    for (const listener of listeners) {
      try {
        listener(event, currentSession);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  return {
    auth: {
      async getSession() {
        return { data: { session: currentSession }, error: null };
      },
      onAuthStateChange(callback: (event: string, session: Session | null) => void) {
        listeners.add(callback);
        setTimeout(() => callback('INITIAL_SESSION', currentSession), 0);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                listeners.delete(callback);
              },
            },
          },
        };
      },
      async signOut() {
        currentSession = null;
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        notify('SIGNED_OUT');
        return { error: null };
      },
      async signInWithPassword({ email }: { email: string; password?: string }) {
        currentSession = {
          access_token: 'local-dev-token',
          token_type: 'bearer',
          expires_in: 3600000,
          refresh_token: 'local-dev-refresh',
          user: {
            id: 'local-user',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            email: email || 'designer@reframely.local',
          } as User,
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSession));
        } catch {}
        notify('SIGNED_IN');
        return { data: { session: currentSession, user: currentSession.user }, error: null };
      },
      async signUp({ email }: { email: string; password?: string }) {
        return this.signInWithPassword({ email });
      },
      async signInWithOAuth({ provider, options: _options }: { provider: string; options?: { redirectTo?: string; scopes?: string } }) {
        currentSession = {
          access_token: 'local-dev-token',
          token_type: 'bearer',
          expires_in: 3600000,
          refresh_token: 'local-dev-refresh',
          user: {
            id: 'local-user',
            app_metadata: { provider: provider || 'github' },
            user_metadata: {
              user_name: 'octocat',
              full_name: 'GitHub Developer',
              avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
            },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            email: 'github-user@reframely.local',
          } as User,
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSession));
        } catch {}
        notify('SIGNED_IN');
        return { data: { provider, url: null }, error: null };
      },
      async getUser() {
        return { data: { user: currentSession?.user ?? null }, error: null };
      },
    },
  } as unknown as ReturnType<typeof createClient>;
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : createMockSupabase();
