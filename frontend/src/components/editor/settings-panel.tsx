import { useEffect, useState } from 'react';
import { MousePointerSquareDashed } from 'lucide-react';
import type { Breakpoint } from '@/lib/schema';
import { useTreeStore } from '@/stores/tree-store';
import { useSelectionStore } from '@/stores/selection-store';
import { findNode, nodeIcon, nodeLabel } from '@/lib/tree-index';
import { cn } from '@/lib/utils';
import { StyleTabContent } from './style/style-tab-content';
import { ContentPanel } from './content/content-panel';

type Tab = 'content' | 'style';

interface SettingsPanelProps {
  /** Active breakpoint the Style tab writes to (driven by the switcher). */
  breakpoint?: Breakpoint;
}

/**
 * Right-side settings panel for the selected node, with Content and
 * Style tabs. Content edits per-widget props (text, image, link, icon);
 * Style edits per-breakpoint CSS. Widget nodes default to the Content
 * tab; structural nodes (section/row/column) have no content, so they
 * default to Style.
 */
export function SettingsPanel({ breakpoint = 'desktop' }: SettingsPanelProps) {
  const tree = useTreeStore((s) => s.tree);
  const selectedId = useSelectionStore((s) => s.selectedId);
  const node = selectedId ? findNode(tree, selectedId) : null;

  const [tab, setTab] = useState<Tab>('content');

  // When selection changes, pick a sensible default tab: structural
  // nodes have no content, so show Style.
  useEffect(() => {
    if (node && node.type !== 'widget') setTab('style');
    else if (node) setTab('content');
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 rounded-xl border border-dashed border-border-strong bg-surface-sunken p-3 text-foreground-subtle">
          <MousePointerSquareDashed className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-foreground-muted">No selection</p>
        <p className="mt-1 max-w-[200px] text-xs text-foreground-subtle">
          Select an element on the canvas to edit its content and style.
        </p>
      </div>
    );
  }

  const Icon = nodeIcon(node);

  return (
    <div className="flex h-full flex-col">
      {/* Selected-node header */}
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-3 text-xs">
        <Icon className="h-3.5 w-3.5 text-accent" />
        <span className="font-medium text-foreground">{nodeLabel(node)}</span>
        {breakpoint !== 'desktop' && (
          <span className="ml-1 rounded bg-accent-subtle px-1.5 py-0.5 text-2xs font-medium text-accent">
            {breakpoint}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 border-b border-border bg-surface px-2 pt-2">
        {(['content', 'style'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'relative rounded-t-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
              tab === t
                ? 'text-accent'
                : 'text-foreground-muted hover:text-foreground',
            )}
          >
            {t}
            {tab === t && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {/* Tab body */}
      {tab === 'content' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ContentPanel node={node} />
        </div>
      ) : (
        <StyleTabContent node={node} breakpoint={breakpoint} />
      )}
    </div>
  );
}
