import { SlidersHorizontal, Sparkles } from 'lucide-react';
import type { Breakpoint } from '@/lib/schema';
import { cn } from '@/lib/utils';
import { SettingsPanel } from '@/components/editor/settings-panel';
import { AssistantPanel } from '@/components/editor/assistant/assistant-panel';
import { useAssistantStore } from '@/stores/assistant-store';

type DockMode = 'inspector' | 'assistant';

/**
 * Single right dock (layout fix): either the selection Inspector
 * (Content / Style) or the AI Assistant — never both columns at once.
 * Mode is driven by `assistant-store.open` so the top-bar / rail sparkles
 * control stays the global toggle.
 */
export function RightDock({
  projectId,
  breakpoint,
}: {
  projectId: string;
  breakpoint: Breakpoint;
}) {
  const assistantOpen = useAssistantStore((s) => s.open);
  const setAssistantOpen = useAssistantStore((s) => s.setOpen);
  const mode: DockMode = assistantOpen ? 'assistant' : 'inspector';

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-surface">
      {/* Mode switcher — one right column, two modes */}
      <div
        className="flex h-11 shrink-0 items-center gap-0.5 border-b border-border px-2"
        role="tablist"
        aria-label="Right panel"
      >
        <ModeTab
          active={mode === 'inspector'}
          icon={SlidersHorizontal}
          label="Inspector"
          onClick={() => setAssistantOpen(false)}
        />
        <ModeTab
          active={mode === 'assistant'}
          icon={Sparkles}
          label="AI"
          onClick={() => setAssistantOpen(true)}
        />
      </div>

      <div className="min-h-0 flex-1">
        {mode === 'inspector' ? (
          <SettingsPanel breakpoint={breakpoint} />
        ) : (
          <AssistantPanel projectId={projectId} embedded />
        )}
      </div>
    </aside>
  );
}

function ModeTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
        active
          ? 'bg-accent-subtle text-accent'
          : 'text-foreground-muted hover:bg-surface-sunken hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
