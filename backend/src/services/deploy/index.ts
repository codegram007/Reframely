/**
 * Deploy service (B10) — publishes a project's generated static site to a
 * hosting target and tracks lifecycle + custom domain attachment.
 *
 * Flow:
 *   1. Run the shared CodegenService.generateProject() (same as export).
 *   2. Copy the generated bundle under projects/{id}/deploys/{deployId}/.
 *   3. Persist status at projects/{id}/deploy/status.json.
 *   4. Return a public URL (signed index.html in dev, or DEPLOY_BASE_URL host).
 *
 * Owns: publish orchestration, status, domain attachment records.
 * Does NOT own: HTML generation (codegen) or zip export (export).
 */
import { randomUUID } from 'node:crypto';
import type { ObjectStore } from '../storage/object-store.js';
import { CodegenError, type CodegenService } from '../codegen/index.js';
import { env } from '../../config/env.js';

export type DeployLifecycle = 'never' | 'queued' | 'deploying' | 'live' | 'failed';
export type DomainValidation = 'none' | 'pending' | 'verified' | 'failed';

export type DeployErrorCode = 'NOT_CLASSIFIED' | 'EMPTY_BUNDLE' | 'INVALID_DOMAIN';

export class DeployError extends Error {
  constructor(
    readonly code: DeployErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DeployError';
  }
}

export interface DeployStatusResult {
  projectId: string;
  status: DeployLifecycle;
  url?: string;
  deployId?: string;
  lastDeployedAt?: string;
  errorMessage?: string;
  domain?: {
    hostname: string;
    status: DomainValidation;
  };
}

export interface DeployResult {
  deployId: string;
  url: string;
  status: 'queued' | 'live' | 'failed';
}

export interface DomainAttachResult {
  hostname: string;
  status: DomainValidation;
  instructions?: string;
}

interface StoredDeployStatus {
  projectId: string;
  status: DeployLifecycle;
  url?: string;
  deployId?: string;
  lastDeployedAt?: string;
  errorMessage?: string;
  domain?: {
    hostname: string;
    status: DomainValidation;
  };
}

export interface DeployServiceDeps {
  objectStore: ObjectStore;
  codegenService: CodegenService;
  /** Public base used to mint preview URLs, e.g. https://preview.reframely.app */
  publicBaseUrl?: string;
  idFn?: () => string;
  now?: () => Date;
}

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export class DeployService {
  private readonly objectStore: ObjectStore;
  private readonly codegenService: CodegenService;
  private readonly publicBaseUrl: string;
  private readonly idFn: () => string;
  private readonly now: () => Date;

  constructor(deps: DeployServiceDeps) {
    this.objectStore = deps.objectStore;
    this.codegenService = deps.codegenService;
    this.publicBaseUrl =
      deps.publicBaseUrl ?? env.DEPLOY_BASE_URL ?? 'https://preview.reframely.app';
    this.idFn = deps.idFn ?? (() => `dep_${randomUUID().replace(/-/g, '').slice(0, 12)}`);
    this.now = deps.now ?? (() => new Date());
  }

  async getStatus(projectId: string): Promise<DeployStatusResult> {
    const stored = await this.readStatus(projectId);
    if (!stored) {
      return { projectId, status: 'never' };
    }
    return stored;
  }

  /**
   * Generate + publish. For now "publish" copies the bundle into a deploy
   * prefix and marks the project live with a stable preview URL. Real CDN
   * upload can replace the copy step without changing the route contract.
   */
  async deploy(
    projectId: string,
    opts: { target?: 'preview' | 'production' } = {},
  ): Promise<DeployResult> {
    const target = opts.target ?? 'production';
    const deployId = this.idFn();

    await this.writeStatus({
      projectId,
      status: 'deploying',
      deployId,
    });

    try {
      await this.codegenService.generateProject(projectId);
    } catch (err) {
      if (err instanceof CodegenError) {
        const message = err.message;
        await this.writeStatus({
          projectId,
          status: 'failed',
          deployId,
          errorMessage: message,
        });
        throw new DeployError(
          err.code === 'NOT_CLASSIFIED' ? 'NOT_CLASSIFIED' : 'EMPTY_BUNDLE',
          message,
        );
      }
      throw err;
    }

    const bundlePrefix = `projects/${projectId}/generated/`;
    const keys = await this.objectStore.list(bundlePrefix);
    if (keys.length === 0) {
      const message = `Generated bundle for project ${projectId} is empty.`;
      await this.writeStatus({
        projectId,
        status: 'failed',
        deployId,
        errorMessage: message,
      });
      throw new DeployError('EMPTY_BUNDLE', message);
    }

    // Copy bundle into an immutable deploy snapshot.
    const deployPrefix = `projects/${projectId}/deploys/${deployId}/`;
    for (const key of keys) {
      const obj = await this.objectStore.get(key);
      if (!obj) continue;
      const rel = key.slice(bundlePrefix.length);
      await this.objectStore.put(deployPrefix + rel, obj.body, obj.contentType);
    }

    const url = this.publicUrl(projectId, target);
    const lastDeployedAt = this.now().toISOString();
    const prev = await this.readStatus(projectId);

    await this.writeStatus({
      projectId,
      status: 'live',
      deployId,
      url,
      lastDeployedAt,
      ...(prev?.domain ? { domain: prev.domain } : {}),
    });

    return { deployId, url, status: 'live' };
  }

  async attachDomain(projectId: string, hostnameRaw: string): Promise<DomainAttachResult> {
    const hostname = hostnameRaw.trim().toLowerCase();
    if (!DOMAIN_RE.test(hostname)) {
      throw new DeployError(
        'INVALID_DOMAIN',
        'Enter a valid domain like example.com or www.example.com.',
      );
    }

    const prev = (await this.readStatus(projectId)) ?? {
      projectId,
      status: 'never' as const,
    };

    const cnameTarget = this.cnameTarget();
    const result: DomainAttachResult = {
      hostname,
      status: 'pending',
      instructions: `Add a CNAME record pointing ${hostname} to ${cnameTarget}, then re-check later.`,
    };

    await this.writeStatus({
      ...prev,
      projectId,
      domain: { hostname, status: 'pending' },
    });

    return result;
  }

  private publicUrl(projectId: string, target: 'preview' | 'production'): string {
    const base = this.publicBaseUrl.replace(/\/$/, '');
    const slug = projectId.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 32);
    // Path-style so one apex host can serve many projects without DNS setup.
    return `${base}/${target}/${slug}/`;
  }

  private cnameTarget(): string {
    try {
      return new URL(this.publicBaseUrl).hostname;
    } catch {
      return 'cname.reframely.app';
    }
  }

  private statusKey(projectId: string): string {
    return `projects/${projectId}/deploy/status.json`;
  }

  private async readStatus(projectId: string): Promise<StoredDeployStatus | undefined> {
    const obj = await this.objectStore.get(this.statusKey(projectId));
    if (!obj) return undefined;
    try {
      return JSON.parse(obj.body.toString('utf8')) as StoredDeployStatus;
    } catch {
      return undefined;
    }
  }

  private async writeStatus(status: StoredDeployStatus): Promise<void> {
    await this.objectStore.put(
      this.statusKey(status.projectId),
      Buffer.from(JSON.stringify(status)),
      'application/json',
    );
  }
}
