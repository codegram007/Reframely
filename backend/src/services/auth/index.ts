/** B14 authentication: Clerk JWTs in production and HS256 dev tokens locally. */
import {
  createRemoteJWKSet,
  jwtVerify,
  SignJWT,
  type JWTPayload,
} from 'jose';
import { env } from '../../config/env.js';

export interface AuthUser {
  id: string;
  email?: string;
  mode: 'off' | 'dev' | 'clerk';
}

export type AuthErrorCode = 'MISSING_TOKEN' | 'INVALID_TOKEN' | 'FORBIDDEN';

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
    readonly statusCode: 401 | 403 | 404 = code === 'FORBIDDEN' ? 404 : 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthService {
  readonly mode: 'off' | 'dev' | 'clerk';
  verifyAuthorizationHeader(header: string | undefined): Promise<AuthUser>;
  signDevToken(user: { id: string; email?: string }, expiresIn?: string): Promise<string>;
}

function bearerToken(header: string | undefined): string {
  if (!header) throw new AuthError('MISSING_TOKEN', 'Authorization Bearer token required.');
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match?.[1]) throw new AuthError('MISSING_TOKEN', 'Authorization Bearer token required.');
  return match[1];
}

function emailFrom(payload: JWTPayload): string | undefined {
  return typeof payload['email'] === 'string' ? payload['email'] : undefined;
}

export class JwtAuthService implements AuthService {
  readonly mode: 'off' | 'dev' | 'clerk';
  private readonly devSecret: Uint8Array;
  private readonly clerkKeys: ReturnType<typeof createRemoteJWKSet> | undefined;

  constructor(mode: 'off' | 'dev' | 'clerk' = env.AUTH_MODE) {
    this.mode = mode;
    this.devSecret = new TextEncoder().encode(env.AUTH_DEV_SECRET);
    this.clerkKeys = mode === 'clerk' && env.CLERK_JWKS_URL
      ? createRemoteJWKSet(new URL(env.CLERK_JWKS_URL))
      : undefined;
  }

  async verifyAuthorizationHeader(header: string | undefined): Promise<AuthUser> {
    if (this.mode === 'off') return { id: 'system', mode: 'off' };
    const token = bearerToken(header);
    try {
      if (this.mode === 'dev') {
        const { payload } = await jwtVerify(token, this.devSecret, {
          algorithms: ['HS256'],
          issuer: 'vibestudio-dev',
          audience: 'vibestudio-api',
        });
        return this.userFromPayload(payload, 'dev');
      }
      if (!this.clerkKeys || !env.CLERK_ISSUER) {
        throw new AuthError('INVALID_TOKEN', 'Clerk authentication is not configured.');
      }
      const { payload } = await jwtVerify(token, this.clerkKeys, {
        algorithms: ['RS256'],
        issuer: env.CLERK_ISSUER,
        ...(env.CLERK_AUDIENCE ? { audience: env.CLERK_AUDIENCE } : {}),
      });
      return this.userFromPayload(payload, 'clerk');
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('INVALID_TOKEN', 'Token is invalid or expired.');
    }
  }

  async signDevToken(
    user: { id: string; email?: string },
    expiresIn = '8h',
  ): Promise<string> {
    if (this.mode !== 'dev') {
      throw new AuthError('FORBIDDEN', 'Dev tokens are only available in AUTH_MODE=dev.', 403);
    }
    if (!user.id.trim()) throw new AuthError('INVALID_TOKEN', 'Dev user id is required.');
    return new SignJWT(user.email ? { email: user.email } : {})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer('vibestudio-dev')
      .setAudience('vibestudio-api')
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(this.devSecret);
  }

  private userFromPayload(payload: JWTPayload, mode: 'dev' | 'clerk'): AuthUser {
    if (!payload.sub) throw new AuthError('INVALID_TOKEN', 'Token subject is missing.');
    const email = emailFrom(payload);
    return {
      id: payload.sub,
      mode,
      ...(email ? { email } : {}),
    };
  }
}

