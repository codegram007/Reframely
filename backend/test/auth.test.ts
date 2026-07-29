import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { JwtAuthService } from '../src/services/auth/index.js';
import { AssetService } from '../src/services/assets/index.js';
import { ImportService } from '../src/services/import/index.js';
import { ProjectAccessService } from '../src/services/projects/index.js';
import { InMemoryImportRepository } from '../src/services/storage/import-repository.js';
import { InMemoryObjectStore } from '../src/services/storage/object-store.js';
import { VersionService } from '../src/services/versions/index.js';

const CREATED_AT = '2026-07-29T00:00:00.000Z';

async function tokenFor(auth: JwtAuthService, id: string): Promise<string> {
  return auth.signDevToken({ id, email: `${id}@example.com` });
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

describe('JwtAuthService dev mode', () => {
  it('signs and verifies a local token without Clerk', async () => {
    const auth = new JwtAuthService('dev');
    const token = await tokenFor(auth, 'local-user');
    await expect(auth.verifyAuthorizationHeader(`Bearer ${token}`)).resolves.toMatchObject({
      id: 'local-user',
      email: 'local-user@example.com',
      mode: 'dev',
    });
  });

  it('rejects missing and invalid bearer tokens', async () => {
    const auth = new JwtAuthService('dev');
    await expect(auth.verifyAuthorizationHeader(undefined)).rejects.toMatchObject({
      code: 'MISSING_TOKEN',
    });
    await expect(auth.verifyAuthorizationHeader('Bearer not-a-jwt')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });
});

describe('auth and ownership middleware', () => {
  it('keeps health public and protects project routes', async () => {
    const repository = new InMemoryImportRepository();
    await seedOwner(repository);
    const auth = new JwtAuthService('dev');
    const app = buildApp({
      authService: auth,
      projectAccessService: new ProjectAccessService(repository),
      versionService: new VersionService({ objectStore: new InMemoryObjectStore() }),
    });
    await app.ready();

    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/projects/project-a/versions' })).statusCode).toBe(401);
    expect((await app.inject({
      method: 'GET',
      url: '/projects/project-a/versions',
      headers: { authorization: 'Bearer invalid' },
    })).statusCode).toBe(401);
    expect((await app.inject({
      method: 'GET',
      url: '/projects/project-a/versions',
      headers: { authorization: `Bearer ${await tokenFor(auth, 'user-b')}` },
    })).statusCode).toBe(404);
    const ownerResponse = await app.inject({
      method: 'GET',
      url: '/projects/project-a/versions',
      headers: { authorization: `Bearer ${await tokenFor(auth, 'user-a')}` },
    });
    expect(ownerResponse.statusCode).toBe(200);
    expect(ownerResponse.json()).toMatchObject({ projectId: 'project-a', versions: [] });
    await app.close();
  });

  it('allows only the project owner to upload an asset', async () => {
    const repository = new InMemoryImportRepository();
    await seedOwner(repository);
    const auth = new JwtAuthService('dev');
    const app = buildApp({
      authService: auth,
      projectAccessService: new ProjectAccessService(repository),
      assetService: new AssetService({ objectStore: new InMemoryObjectStore(), idFn: () => 'asset-a' }),
    });
    await app.ready();
    const boundary = '----authboundary';
    const request = (userId: string) => app.inject({
      method: 'POST',
      url: '/projects/project-a/assets',
      headers: {
        authorization: `Bearer ${userId}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartFile(boundary, 'dot.png', 'image/png', Buffer.from([137, 80, 78, 71])),
    });

    const otherToken = await tokenFor(auth, 'user-b');
    expect((await request(otherToken)).statusCode).toBe(404);
    const ownerToken = await tokenFor(auth, 'user-a');
    const response = await request(ownerToken);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ projectId: 'project-a', assetId: 'asset-a' });
    await app.close();
  });
});

describe('project ownership persistence', () => {
  it('stamps a project created through the import route with the JWT subject', async () => {
    const repository = new InMemoryImportRepository();
    const store = new InMemoryObjectStore();
    const service = new ImportService({ objectStore: store, repository });
    const auth = new JwtAuthService('dev');
    const app = buildApp({
      authService: auth,
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
        authorization: `Bearer ${await tokenFor(auth, 'user-a')}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartFile(boundary, 'owned.zip', 'application/zip', zip),
    });
    expect(response.statusCode).toBe(200);
    const result = response.json<{ importId: string; projectId: string }>();
    await expect(repository.findById(result.importId)).resolves.toMatchObject({ ownerId: 'user-a' });

    const access = new ProjectAccessService(repository);
    await expect(access.assertImportOwner(result.importId, 'user-a')).resolves.toBeUndefined();
    await expect(access.assertProjectOwner(result.projectId, 'user-b')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 404,
    });
    await app.close();
  });
});

describe('production auth configuration', () => {
  it('fails closed when authentication is disabled', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', AUTH_MODE: 'off' })).toThrow(
      'AUTH_MODE: cannot be off in production',
    );
  });

  it('requires Clerk issuer and JWKS settings in clerk mode', () => {
    expect(() => loadEnv({ AUTH_MODE: 'clerk' })).toThrow(
      'CLERK_JWKS_URL and CLERK_ISSUER are required',
    );
  });
});
