import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CanvasToolbar } from '@/components/editor/canvas-toolbar';
import { Canvas } from '@/components/editor/canvas';
import { CodeView } from '@/components/editor/code/code-view';
import { LeftPanel, LeftPanelCollapsedRail } from '@/components/editor/left-panel';
import { SiteStylesPanel } from '@/components/editor/site-styles-panel';
import { EditorLoading } from '@/components/editor/editor-loading';
import { useImportStore } from '@/stores/import-store';
import { BREAKPOINT_WIDTH, useEditorUiStore } from '@/stores/editor-ui-store';
import { useCodeViewStore } from '@/stores/code-view-store';
import { useTreeStore } from '@/stores/tree-store';
import { useEditorHistoryShortcuts } from '@/hooks/use-editor-history-shortcuts';
import { useVersionAutosave } from '@/hooks/use-version-autosave';
import { api } from '@/lib/api/client';
import type { WidgetTree } from '@/lib/schema';
import { getLatestLocalVersion } from '@/lib/version-persist';

/**
 * Editor page shell — three-pane builder layout:
 *   [ layers / insert | collapsed strip ] [ canvas | code view ] [ right dock ]
 *
 * Left dock is collapsible for canvas-first work. Right dock is
 * mode-switched (Inspector | AI) — never both at once.
 */
export function EditorPage() {
  const { projectId } = useParams();
  const phase = useImportStore((s) => s.phase);
  const summary = useImportStore((s) => s.summary);
  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const leftPanelOpen = useEditorUiStore((s) => s.leftPanelOpen);
  const frameWidth = BREAKPOINT_WIDTH[breakpoint];
  const codeOpen = useCodeViewStore((s) => s.open);

  // F15: editor-wide undo/redo shortcuts + durable version autosave.
  useEditorHistoryShortcuts();
  useVersionAutosave(projectId);

  // Show loading only for an in-flight/just-finished import handoff, not
  // when navigating to an already-imported project directly.
  const [showLoading, setShowLoading] = useState(
    () => phase !== 'idle' && phase !== 'error',
  );
  const [hydrating, setHydrating] = useState(false);

  useEffect(() => {
    if (phase === 'ready') {
      const t = setTimeout(() => setShowLoading(false), 900);
      return () => clearTimeout(t);
    }
    if (phase === 'idle' || phase === 'error') setShowLoading(false);
    return undefined;
  }, [phase]);

  // Re-open / hard refresh: prefer latest remote version, else classified tree.
  useEffect(() => {
    if (!projectId || phase === 'ready' || phase === 'classifying' || phase === 'snapshotting') {
      return;
    }
    let cancelled = false;
    setHydrating(true);
    void (async () => {
      try {
        try {
          const listed = await api.listTreeVersions(projectId);
          const latest = listed.versions[0];
          if (latest && !cancelled) {
            const full = await api.getTreeVersion(projectId, latest.versionId);
            if (full.tree?.root && !cancelled) {
              useTreeStore.getState().setTree(full.tree as WidgetTree);
              return;
            }
          }
        } catch {
          /* no remote versions — fall through */
        }

        const local = getLatestLocalVersion(projectId);
        if (local?.tree?.root && !cancelled) {
          useTreeStore.getState().setTree(local.tree);
          return;
        }

        try {
          const trees = await api.getProjectTrees(projectId);
          if (trees.primary?.tree?.root && !cancelled) {
            useTreeStore.getState().setTree(trees.primary.tree as WidgetTree);
          }
        } catch {
          /* leave sampleTree / current tree */
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, phase]);

  if (showLoading || hydrating) {
    return <EditorLoading phase={showLoading ? phase : 'idle'} summary={summary} />;
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Left — full Layers/Insert dock, or slim reopen strip when collapsed */}
      {leftPanelOpen ? (
        <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-surface">
          <LeftPanel projectId={projectId ?? 'demo'} breakpoint={breakpoint} />
        </aside>
      ) : (
        <LeftPanelCollapsedRail />
      )}

      {/* Center — Design canvas or Code View (F13/F14) */}
      <section className="flex min-w-0 flex-1 flex-col bg-canvas">
        <CanvasToolbar />
        <div className={codeOpen ? 'min-h-0 flex-1' : 'min-h-0 flex-1 bg-dotgrid'}>
          {codeOpen ? <CodeView /> : <Canvas frameWidth={frameWidth} />}
        </div>
      </section>

      {/* Right — single dock: Inspector XOR AI */}

      {/* Global design tokens — a separate modal surface (F12) */}
      <SiteStylesPanel />
    </div>
  );
}
