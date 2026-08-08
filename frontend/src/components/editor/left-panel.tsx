import { Layers, Plus, PanelLeftClose, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { Breakpoint } from '@/lib/schema';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/icon-button';
import { Tooltip } from '@/components/ui/tooltip';
import { useEditorUiStore, type LeftPanelTab } from '@/stores/editor-ui-store';
import { LayersPanel } from './layers-panel';
import { WidgetPalette } from './widget-palette';
import { SettingsPanel } from './settings-panel';
import { AssistantPanel } from './assistant/assistant-panel';
import { useAssistantStore } from '@/stores/assistant-store';

type WorkspaceTab = LeftPanelTab | 'assistant';

/**
 * Left-side panel host (F11) — Layers + Insert, collapsible so canvas
 * work can reclaim the width. Tab + open state live in editor-ui-store.
 */
export function LeftPanel({ projectId, breakpoint }: { projectId: string; breakpoint: Breakpoint }) {
  const tab = useEditorUiStore((s) => s.leftPanelTab);
  const setTab = useEditorUiStore((s) => s.setLeftPanelTab);
  const setOpen = useEditorUiStore((s) => s.setLeftPanelOpen);
  const assistantOpen = useAssistantStore((s) => s.open);
  const setAssistantOpen = useAssistantStore((s) => s.setOpen);
  const activeTab: WorkspaceTab = assistantOpen ? 'assistant' : tab;

  const tabs: { key: WorkspaceTab; label: string; icon: typeof Layers }[] = [
    { key: 'layers', label: 'Layers', icon: Layers },
    { key: 'insert', label: 'Insert', icon: Plus },
    { key: 'inspector', label: 'Inspector', icon: SlidersHorizontal },
    { key: 'assistant', label: 'AI', icon: Sparkles },
  ];

  const selectTab = (next: WorkspaceTab) => {
    if (next === 'assistant') {
      setAssistantOpen(true);
    } else {
      setAssistantOpen(false);
      setTab(next);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Tabs + collapse */}
      <div className="flex shrink-0 items-end gap-1 border-b border-border bg-surface px-2 pt-2">
        <div className="flex min-w-0 flex-1 gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => selectTab(key)}
              className={cn(
                'relative flex min-w-0 items-center gap-1 rounded-t-md px-2 py-1.5 text-xs font-medium transition-colors',
                activeTab === key
                  ? 'text-accent'
                  : 'text-foreground-muted hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {activeTab === key && (
                <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>
        <Tooltip label="Collapse panel" side="bottom">
          <IconButton
            label="Collapse left panel"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="mb-0.5 shrink-0"
          >
            <PanelLeftClose className="h-4 w-4" />
          </IconButton>
        </Tooltip>
      </div>

      {/* Tab body */}
      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === 'layers' && <LayersPanel />}
        {activeTab === 'insert' && <WidgetPalette />}
        {activeTab === 'inspector' && <SettingsPanel breakpoint={breakpoint} />}
        {activeTab === 'assistant' && <AssistantPanel projectId={projectId} embedded />}
      </div>
    </div>
  );
}

/**
 * Slim strip shown when the left dock is collapsed. One click reopens
 * Layers or Insert without hunting for a control on the canvas.
 */
export function LeftPanelCollapsedRail() {
  const openLeftPanel = useEditorUiStore((s) => s.openLeftPanel);
  const setAssistantOpen = useAssistantStore((s) => s.setOpen);

  return (
    <aside
      className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-2"
      aria-label="Left panel collapsed"
    >
      <Tooltip label="Layers" side="right">
        <IconButton
          label="Open layers"
          variant="ghost"
          size="sm"
          onClick={() => {
            setAssistantOpen(false);
            openLeftPanel('layers');
          }}
        >
          <Layers className="h-4 w-4" />
        </IconButton>
      </Tooltip>
      <Tooltip label="Insert" side="right">
        <IconButton
          label="Open insert palette"
          variant="ghost"
          size="sm"
          onClick={() => {
            setAssistantOpen(false);
            openLeftPanel('insert');
          }}
        >
          <Plus className="h-4 w-4" />
        </IconButton>
      </Tooltip>
      <Tooltip label="Inspector" side="right">
        <IconButton
          label="Open inspector"
          variant="ghost"
          size="sm"
          onClick={() => {
            setAssistantOpen(false);
            openLeftPanel('inspector');
          }}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </IconButton>
      </Tooltip>
      <Tooltip label="AI Assistant" side="right">
        <IconButton
          label="Open AI Assistant"
          variant="ghost"
          size="sm"
          onClick={() => {
            setAssistantOpen(true);
            openLeftPanel();
          }}
        >
          <Sparkles className="h-4 w-4" />
        </IconButton>
      </Tooltip>
    </aside>
  );
}
