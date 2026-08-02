/** B14 authentication: Supabase Auth in production and a fixed user locally. */
import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env.js';

export type AuthMode = 'dev' | 'on';

export interface AuthUser {
  id: string;
  email?: string;
  mode: AuthMode;
}

export type AuthErrorCode = 'MISSING_TOKEN' | 'INVALID_TOKEN' | 'FORBIDDEN';

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
    readonly statusCode: 401 | 403 = code === 'FORBIDDEN' ? 403 : 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthService {
  readonly mode: AuthMode;
  verifyAuthorizationHeader(header: string | undefined): Promise<AuthUser>;
}

function bearerToken(header: string | undefined): string {
  if (!header) throw new AuthError('MISSING_TOKEN', 'Authorization Bearer token required.');
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match?.[1]) throw new AuthError('MISSING_TOKEN', 'Authorization Bearer token required.');
  return match[1];
}

export interface VerifiedSupabaseUser {
  id: string;
  email?: string;
}

export type SupabaseTokenVerifier = (token: string) => Promise<VerifiedSupabaseUser>;

export interface SupabaseAuthServiceOptions {
  mode?: AuthMode;
  verifySupabaseToken?: SupabaseTokenVerifier;
}

function createSupabaseVerifier(): SupabaseTokenVerifier {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return async () => {
      throw new AuthError('INVALID_TOKEN', 'Supabase authentication is not configured.');
    };
  }
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return async (token) => {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      throw new AuthError('INVALID_TOKEN', 'Token is invalid or expired.');
    }
    return {
      id: data.user.id,
      ...(data.user.email ? { email: data.user.email } : {}),
    };
  };
}

export class SupabaseAuthService implements AuthService {
  readonly mode: AuthMode;
  private readonly verifySupabaseToken: SupabaseTokenVerifier;

  constructor(options: SupabaseAuthServiceOptions | AuthMode = {}) {
    const resolved = typeof options === 'string' ? { mode: options } : options;
    this.mode = resolved.mode ?? env.AUTH_MODE;
    this.verifySupabaseToken = resolved.verifySupabaseToken ?? createSupabaseVerifier();
  }

  async verifyAuthorizationHeader(header: string | undefined): Promise<AuthUser> {
    if (this.mode === 'dev') {
      return { id: 'local-user', email: 'local@example.com', mode: 'dev' };
    }
    const token = bearerToken(header);
    try {
      const user = await this.verifySupabaseToken(token);
      if (!user.id.trim()) throw new AuthError('INVALID_TOKEN', 'Token subject is missing.');
      return { ...user, mode: 'on' };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('INVALID_TOKEN', 'Token is invalid or expired.');
    }
  }
}
