import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import {
  AuthError,
  SupabaseAuthService,
  type SupabaseTokenVerifier,
} from '../src/services/auth/index.js';
import { AssetService } from '../src/services/assets/index.js';
import { ImportService } from '../src/services/import/index.js';
import { ProjectAccessService } from '../src/services/projects/index.js';
import { InMemoryImportRepository } from '../src/services/storage/import-repository.js';
import { InMemoryObjectStore } from '../src/services/storage/object-store.js';
import { VersionService } from '../src/services/versions/index.js';

const CREATED_AT = '2026-07-29T00:00:00.000Z';

function testVerifier(): SupabaseTokenVerifier {
  return async (token) => {
    if (token === 'expired') throw new AuthError('INVALID_TOKEN', 'Token is invalid or expired.');
    if (!token.startsWith('user-')) throw new Error('Supabase rejected token');
    return { id: token, email: `${token}@example.com` };
  };
}

function authOn(): SupabaseAuthService {
  return new SupabaseAuthService({ mode: 'on', verifySupabaseToken: testVerifier() });
}

function seedOwner(
  repository: InMemoryImportRepository,
  ownerId = 'user-a',
  projectId = 'project-a',
  importId = 'import-a',
) {
  return repository.create({
    id: importId,
    projectId,
    ownerId,
    sourceType: 'zip',
    origin: 'site.zip',
    totalBytes: 1,
    fileCount: 1,
    status: 'completed',
    errorCode: null,
    createdAt: CREATED_AT,
  });
}

function multipartFile(
  boundary: string,
  filename: string,
  contentType: string,
  contents: Buffer,
): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`,
    ),
    contents,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

describe('SupabaseAuthService', () => {
  it('accepts a valid Supabase token', async () => {
    const auth = authOn();
    await expect(auth.verifyAuthorizationHeader('Bearer user-a')).resolves.toEqual({
      id: 'user-a',
      email: 'user-a@example.com',
      mode: 'on',
    });
  });

  it('rejects missing and expired tokens', async () => {
    const auth = authOn();
    await expect(auth.verifyAuthorizationHeader(undefined)).rejects.toMatchObject({
      code: 'MISSING_TOKEN',
      statusCode: 401,
    });
    await expect(auth.verifyAuthorizationHeader('Bearer expired')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
      statusCode: 401,
    });
  });

  it('dev mode bypasses verification with one fixed local user', async () => {
    const auth = new SupabaseAuthService('dev');
    await expect(auth.verifyAuthorizationHeader(undefined)).resolves.toEqual({
      id: 'local-user',
      email: 'local@example.com',
      mode: 'dev',
    });
  });
});

describe('auth and ownership middleware', () => {
  it('returns 401 for missing/expired tokens, 403 for a non-owner, and allows the owner', async () => {
    const repository = new InMemoryImportRepository();
    await seedOwner(repository);
    const app = buildApp({
      authService: authOn(),
      projectAccessService: new ProjectAccessService(repository),
      versionService: new VersionService({ objectStore: new InMemoryObjectStore() }),
    });
    await app.ready();

    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/projects/project-a/versions' })).statusCode).toBe(401);
    expect((await app.inject({
      method: 'GET',
      url: '/projects/project-a/versions',
      headers: { authorization: 'Bearer expired' },
    })).statusCode).toBe(401);
    expect((await app.inject({
      method: 'GET',
      url: '/projects/project-a/versions',
      headers: { authorization: 'Bearer user-b' },
    })).statusCode).toBe(403);
    const ownerResponse = await app.inject({
      method: 'GET',
      url: '/projects/project-a/versions',
      headers: { authorization: 'Bearer user-a' },
    });
    expect(ownerResponse.statusCode).toBe(200);
    expect(ownerResponse.json()).toMatchObject({ projectId: 'project-a', versions: [] });
    await app.close();
  });

  it('protects both asset upload and asset download with project ownership', async () => {
    const repository = new InMemoryImportRepository();
    await seedOwner(repository);
    const store = new InMemoryObjectStore();
    const app = buildApp({
      authService: authOn(),
      projectAccessService: new ProjectAccessService(repository),
      assetService: new AssetService({ objectStore: store, idFn: () => 'asset-a' }),
    });
    await app.ready();
    const boundary = '----authboundary';
    const upload = (token: string) => app.inject({
      method: 'POST',
      url: '/projects/project-a/assets',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartFile(boundary, 'dot.png', 'image/png', Buffer.from([137, 80, 78, 71])),
    });

    expect((await upload('user-b')).statusCode).toBe(403);
    expect((await upload('user-a')).statusCode).toBe(200);
    expect((await app.inject({
      method: 'GET',
      url: '/projects/project-a/assets/file/asset-a.png',
    })).statusCode).toBe(401);
    expect((await app.inject({
      method: 'GET',
      url: '/projects/project-a/assets/file/asset-a.png',
      headers: { authorization: 'Bearer user-b' },
    })).statusCode).toBe(403);
    expect((await app.inject({
      method: 'GET',
      url: '/projects/project-a/assets/file/asset-a.png',
      headers: { authorization: 'Bearer user-a' },
    })).statusCode).toBe(200);
    await app.close();
  });
});

describe('project ownership persistence', () => {
  it('stamps a project created through the import route with the Supabase user id', async () => {
    const repository = new InMemoryImportRepository();
    const service = new ImportService({ objectStore: new InMemoryObjectStore(), repository });
    const app = buildApp({
      authService: authOn(),
      projectAccessService: new ProjectAccessService(repository),
      importService: service,
    });
    await app.ready();
    const zip = Buffer.from(zipSync({ 'index.html': strToU8('<!doctype html><h1>Owned</h1>') }));
    const boundary = '----importauthboundary';
    const response = await app.inject({
      method: 'POST',
      url: '/imports/zip',
      headers: {
        authorization: 'Bearer user-a',
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartFile(boundary, 'owned.zip', 'application/zip', zip),
    });
    expect(response.statusCode).toBe(200);
    const result = response.json<{ importId: string; projectId: string }>();
    await expect(repository.findById(result.importId)).resolves.toMatchObject({ ownerId: 'user-a' });
    await expect(
      new ProjectAccessService(repository).assertProjectOwner(result.projectId, 'user-b'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    await app.close();
  });
});

describe('production auth configuration', () => {
  it('preserves the AUTH_MODE=off production crash guard', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', AUTH_MODE: 'off' })).toThrow(
      'AUTH_MODE: cannot be off in production',
    );
  });

  it('requires AUTH_MODE=on in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', AUTH_MODE: 'dev' })).toThrow(
      'AUTH_MODE: must be on in production',
    );
  });

  it('requires Supabase server settings in on mode', () => {
    expect(() => loadEnv({ AUTH_MODE: 'on' })).toThrow(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
    );
    expect(() => loadEnv({
      NODE_ENV: 'production',
      AUTH_MODE: 'on',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-key',
    })).not.toThrow();
  });
});
