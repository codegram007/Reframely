import { create } from 'zustand';
import { api, ApiError, NetworkError } from '@/lib/api/client';
import type {
  DeployLifecycle,
  DomainValidation,
  ExportResult,
} from '@/lib/api/types';

/**
 * Deploy + Export UI state (F16).
 *
 * Backend B10 deploy is still a stub; this store tries the real API and
 * falls back to a client-side mock so the panel is demoable (frontend-first).
 * Export (B11) is implemented on the backend — real download when available.
 */

export type ExportPhase = 'idle' | 'exporting' | 'ready' | 'error';

interface DeployState {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;

  projectId: string | null;
  status: DeployLifecycle;
  url: string | null;
  deployId: string | null;
  lastDeployedAt: string | null;
  errorMessage: string | null;
  /** True when the last deploy came from the client mock, not the server. */
  usedMock: boolean;

  domain: string;
  domainStatus: DomainValidation;
  domainInstructions: string | null;
  setDomainInput: (value: string) => void;

  exportPhase: ExportPhase;
  exportResult: ExportResult | null;
  exportError: string | null;

  /** Load status for a project (best-effort). */
  hydrate: (projectId: string) => Promise<void>;
  deploy: (projectId: string) => Promise<void>;
  attachDomain: (projectId: string) => Promise<void>;
  exportZip: (projectId: string) => Promise<void>;
  resetExport: () => void;
}

const DOMAIN_RE =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function mockUrl(projectId: string): string {
  const slug = projectId.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 24) || 'site';
  return `https://${slug}.preview.vibestudio.app`;
}

export function isValidDomain(hostname: string): boolean {
  return DOMAIN_RE.test(hostname.trim());
}

export const useDeployStore = create<DeployState>((set, get) => ({
  panelOpen: false,
  setPanelOpen: (panelOpen) => set({ panelOpen }),

  projectId: null,
  status: 'never',
  url: null,
  deployId: null,
  lastDeployedAt: null,
  errorMessage: null,
  usedMock: false,

  domain: '',
  domainStatus: 'none',
  domainInstructions: null,
  setDomainInput: (domain) => set({ domain, domainStatus: domain ? get().domainStatus : 'none' }),

  exportPhase: 'idle',
  exportResult: null,
  exportError: null,

  hydrate: async (projectId) => {
    set({ projectId });
    try {
      const s = await api.getDeployStatus(projectId);
      set({
        status: s.status,
        url: s.url ?? null,
        deployId: s.deployId ?? null,
        lastDeployedAt: s.lastDeployedAt ?? null,
        errorMessage: s.errorMessage ?? null,
        domain: s.domain?.hostname ?? get().domain,
        domainStatus: s.domain?.status ?? 'none',
        usedMock: false,
      });
    } catch {
      // No backend status yet — leave local state as-is.
    }
  },

  deploy: async (projectId) => {
    set({
      projectId,
      status: 'deploying',
      errorMessage: null,
    });
    try {
      const result = await api.deployProject(projectId, { target: 'production' });
      set({
        status: result.status === 'failed' ? 'failed' : result.status === 'live' ? 'live' : 'queued',
        url: result.url,
        deployId: result.deployId,
        lastDeployedAt: new Date().toISOString(),
        usedMock: false,
        errorMessage: result.status === 'failed' ? 'Deploy failed on the server.' : null,
      });
      // If queued, optimistically flip to live after a short poll mock.
      if (result.status === 'queued') {
        setTimeout(() => {
          if (get().deployId === result.deployId) {
            set({ status: 'live' });
          }
        }, 1600);
      }
    } catch (err) {
      // Frontend-first mock path (B10 not wired).
      if (err instanceof NetworkError || err instanceof ApiError) {
        await new Promise((r) => setTimeout(r, 1200));
        const url = mockUrl(projectId);
        set({
          status: 'live',
          url,
          deployId: `dep_mock_${Date.now().toString(36)}`,
          lastDeployedAt: new Date().toISOString(),
          usedMock: true,
          errorMessage: null,
        });
        return;
      }
      set({
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Deploy failed.',
      });
    }
  },

  attachDomain: async (projectId) => {
    const hostname = get().domain.trim().toLowerCase();
    if (!isValidDomain(hostname)) {
      set({
        domainStatus: 'failed',
        domainInstructions: 'Enter a valid domain like example.com or www.example.com.',
      });
      return;
    }
    set({ domainStatus: 'pending', domainInstructions: null });
    try {
      const result = await api.attachDomain(projectId, hostname);
      set({
        domain: result.hostname,
        domainStatus: result.status,
        domainInstructions: result.instructions ?? null,
      });
    } catch (err) {
      if (err instanceof NetworkError || err instanceof ApiError) {
        // Mock: accept domain as pending verification (DNS).
        set({
          domain: hostname,
          domainStatus: 'pending',
          domainInstructions: `Add a CNAME record pointing ${hostname} to cname.vibestudio.app, then re-check later.`,
          usedMock: true,
        });
        return;
      }
      set({
        domainStatus: 'failed',
        domainInstructions: err instanceof Error ? err.message : 'Could not attach domain.',
      });
    }
  },

  exportZip: async (projectId) => {
    set({ exportPhase: 'exporting', exportError: null, exportResult: null });
    try {
      const result = await api.exportProject(projectId);
      set({ exportPhase: 'ready', exportResult: result });
      // Trigger browser download when we have a real URL.
      if (result.downloadUrl && !result.downloadUrl.startsWith('memory://')) {
        const a = document.createElement('a');
        a.href = result.downloadUrl;
        a.download = `${projectId}.zip`;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      // Client stopgap: zip is generated by the live tree via codegen when
      // the backend export route isn't reachable — download a single HTML.
      if (err instanceof NetworkError || err instanceof ApiError) {
        try {
          const { generatePage } = await import('@/lib/codegen');
          const { useTreeStore } = await import('@/stores/tree-store');
          const { html, css } = generatePage(useTreeStore.getState().tree);
          const blob = new Blob(
            [
              `<!DOCTYPE html>\n<html><head><meta charset="utf-8"/><style>\n${css}\n</style></head><body>\n`,
              // strip outer html wrapper if present — still a usable handoff
              html.includes('<body') ? '' : html,
              `\n</body></html>\n`,
            ],
            { type: 'text/html' },
          );
          // Prefer a real multi-file zip later; for the stopgap offer HTML.
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectId || 'site'}.html`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          const mock: ExportResult = {
            projectId,
            exportId: `exp_local_${Date.now().toString(36)}`,
            zipKey: 'local',
            downloadUrl: url,
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
            fileCount: 1,
            totalBytes: blob.size,
          };
          set({
            exportPhase: 'ready',
            exportResult: mock,
            exportError:
              'Backend export unavailable — downloaded a single HTML snapshot of the current page instead.',
          });
          return;
        } catch {
          /* fall through */
        }
      }
      set({
        exportPhase: 'error',
        exportError: err instanceof Error ? err.message : 'Export failed.',
      });
    }
  },

  resetExport: () => set({ exportPhase: 'idle', exportResult: null, exportError: null }),
}));
