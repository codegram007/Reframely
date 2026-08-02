import { supabase } from '@/lib/supabase';

let signingOut = false;

export async function getAuthToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function ensureAuthReady(): Promise<void> {
  await supabase.auth.getSession();
}

export async function handleUnauthorized(): Promise<void> {
  if (signingOut) return;
  signingOut = true;
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } finally {
    if (typeof window !== 'undefined') window.location.replace('/login');
  }
}
