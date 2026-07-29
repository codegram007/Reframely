import { Layers, Plus, PanelLeftClose } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/icon-button';
import { Tooltip } from '@/components/ui/tooltip';
import { useEditorUiStore, type LeftPanelTab } from '@/stores/editor-ui-store';
import { LayersPanel } from './layers-panel';
import { WidgetPalette } from './widget-palette';

/**
 * Left-side panel host (F11) — Layers + Insert, collapsible so canvas
 * work can reclaim the width. Tab + open state live in editor-ui-store.
 */
export function LeftPanel() {
  const tab = useEditorUiStore((s) => s.leftPanelTab);
  const setTab = useEditorUiStore((s) => s.setLeftPanelTab);
  const setOpen = useEditorUiStore((s) => s.setLeftPanelOpen);

  const tabs: { key: LeftPanelTab; label: string; icon: typeof Layers }[] = [
    { key: 'layers', label: 'Layers', icon: Layers },
    { key: 'insert', label: 'Insert', icon: Plus },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Tabs + collapse */}
      <div className="flex shrink-0 items-end gap-1 border-b border-border bg-surface px-2 pt-2">
        <div className="flex min-w-0 flex-1 gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'relative flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors',
                tab === key
                  ? 'text-accent'
                  : 'text-foreground-muted hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {tab === key && (
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
        {tab === 'layers' ? <LayersPanel /> : <WidgetPalette />}
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
          onClick={() => openLeftPanel('layers')}
        >
          <Layers className="h-4 w-4" />
        </IconButton>
      </Tooltip>
      <Tooltip label="Insert" side="right">
        <IconButton
          label="Open insert palette"
          variant="ghost"
          size="sm"
          onClick={() => openLeftPanel('insert')}
        >
          <Plus className="h-4 w-4" />
        </IconButton>
      </Tooltip>
    </aside>
  );
}
