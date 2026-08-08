import { create } from 'zustand';
import { api, ApiError, NetworkError } from '@/lib/api/client';
import type { ClassifyImportResult, ImportResult } from '@/lib/api/types';
import { useTreeStore } from '@/stores/tree-store';
import { useProjectsStore } from '@/stores/projects-store';
import type { WidgetTree } from '@/lib/schema';

/**
 * The import pipeline is three sequential backend calls, each blocking
 * until its stage finishes:
 *   1. import   POST /imports/{zip|github|url}   → ImportResult
 *   2. snapshot POST /imports/:id/snapshot       → SnapshotResult
 *   3. classify POST /imports/:id/classify       → ClassifyImportResult
 *
 * There is no status endpoint yet, so each call resolving IS the
 * progress signal. This store drives both the modal (which starts the
 * run) and the editor loading screen (which watches it to completion).
 */
export type ImportPhase =
  | 'idle'
  | 'uploading'   // sending the source (zip upload shows a real % here)
  | 'importing'   // backend normalizing/storing the source
  | 'snapshotting'// rendering pages in headless Chromium
  | 'classifying' // mapping DOM → widget tree
  | 'ready'       // done — canvas can render
  | 'error';

export type ImportKind = 'zip' | 'github' | 'url';

export interface ImportSummary {
  projectId: string;
  pageCount: number;
  sectionCount: number;
  widgetCount: number;
  cleanMappingRate: number;
}

export interface ImportErrorInfo {
  code: string;
  message: string;
  /** True for the network-down case (no backend response). */
  isNetwork: boolean;
  /** The phase we were in when it failed, for contextual copy. */
  phase: ImportPhase;
}

interface ImportState {
  phase: ImportPhase;
  /** 0–1 upload fraction, only meaningful during 'uploading'. */
  uploadProgress: number;
  projectId: string | null;
  projectName: string | null;
  summary: ImportSummary | null;
  error: ImportErrorInfo | null;

  startZip: (file: File) => Promise<void>;
  startGitHub: (url: string) => Promise<void>;
  startUrl: (url: string) => Promise<void>;
  reset: () => void;
}

function summarize(result: ClassifyImportResult): ImportSummary {
  let sectionCount = 0;
  let widgetCount = 0;
  let cleanWeighted = 0;
  for (const page of result.pages) {
    sectionCount += page.stats.sectionCount;
    widgetCount += page.stats.totalWidgets;
    cleanWeighted += page.stats.cleanMappingRate * page.stats.totalWidgets;
  }
  return {
    projectId: result.projectId,
    pageCount: result.pageCount,
    sectionCount,
    widgetCount,
    cleanMappingRate: widgetCount === 0 ? 1 : cleanWeighted / widgetCount,
  };
}

function nameFrom(kind: ImportKind, source: string): string {
  if (kind === 'zip') return source.replace(/\.zip$/i, '');
  try {
    const u = new URL(source);
    if (kind === 'github') return u.pathname.replace(/^\/+|\/+$/g, '') || u.hostname;
    return u.hostname.replace(/^www\./, '');
  } catch {
    return source;
  }
}

export const useImportStore = create<ImportState>((set, get) => {
  /** Runs snapshot + classify after an import lands, advancing phases. */
  async function runPipeline(imported: ImportResult, origin: string): Promise<void> {
    set({ phase: 'snapshotting', projectId: imported.projectId });
    await api.snapshot(imported.importId);

    set({ phase: 'classifying' });
    const classified = await api.classify(imported.importId);

    // Handoff: load the real classified WidgetTree into the editor (not sampleTree).
    const trees = await api.getProjectTrees(imported.projectId);
    const tree = trees.primary?.tree as WidgetTree | undefined;
    if (tree?.root) {
      useTreeStore.getState().setTree(tree);
    }

    const nextSummary = summarize(classified);
    useProjectsStore.getState().upsertProject({
      id: imported.projectId,
      name: get().projectName ?? nameFrom(imported.sourceType === 'live-url' ? 'url' : imported.sourceType, origin),
      origin,
      status: 'ready',
      pageCount: nextSummary.pageCount,
      updatedAt: new Date().toISOString(),
    });
    set({ phase: 'ready', summary: nextSummary });
  }

  function fail(err: unknown): void {
    const phase = get().phase;
    if (err instanceof ApiError) {
      set({ phase: 'error', error: { code: err.code, message: err.message, isNetwork: false, phase } });
    } else if (err instanceof NetworkError) {
      set({ phase: 'error', error: { code: 'NETWORK', message: err.message, isNetwork: true, phase } });
    } else {
      set({
        phase: 'error',
        error: { code: 'UNKNOWN', message: 'Something went wrong during import.', isNetwork: false, phase },
      });
    }
  }

  return {
    phase: 'idle',
    uploadProgress: 0,
    projectId: null,
    projectName: null,
    summary: null,
    error: null,

    startZip: async (file) => {
      set({ phase: 'uploading', uploadProgress: 0, error: null, summary: null, projectName: nameFrom('zip', file.name) });
      try {
        const imported = await api.importZip(file, (f) => set({ uploadProgress: f }));
        set({ phase: 'importing' });
        await runPipeline(imported, file.name);
      } catch (err) {
        fail(err);
      }
    },

    startGitHub: async (url) => {
      set({ phase: 'importing', error: null, summary: null, projectName: nameFrom('github', url) });
      try {
        const imported = await api.importGitHub(url);
        await runPipeline(imported, url);
      } catch (err) {
        fail(err);
      }
    },

    startUrl: async (url) => {
      set({ phase: 'importing', error: null, summary: null, projectName: nameFrom('url', url) });
      try {
        const imported = await api.importUrl(url);
        await runPipeline(imported, url);
      } catch (err) {
        fail(err);
      }
    },

    reset: () =>
      set({
        phase: 'idle',
        uploadProgress: 0,
        projectId: null,
        projectName: null,
        summary: null,
        error: null,
      }),
  };
});
