import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';

describe('smoke', () => {
  let app: App;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  it('answers browser CORS preflight for direct API requests', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/imports/url',
      headers: {
        origin: 'https://reframelyai.netlify.app',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://reframelyai.netlify.app');
    expect(res.headers['access-control-allow-headers']).toContain('authorization');
  });

  it('env validation rejects a malformed PORT', () => {
    expect(() => loadEnv({ PORT: 'not-a-number' } as NodeJS.ProcessEnv)).toThrow(
      /Invalid environment configuration/,
    );
  });
});
