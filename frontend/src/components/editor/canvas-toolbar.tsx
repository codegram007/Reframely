import {
  Monitor,
  Tablet,
  Smartphone,
  Palette,
  LayoutTemplate,
  Code2,
  PanelLeft,
  Maximize2,
  type LucideIcon,
} from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BREAKPOINT_WIDTH,
  useEditorUiStore,
  type Breakpoint,
} from '@/stores/editor-ui-store';
import { useCodeViewStore } from '@/stores/code-view-store';
import { useTreeStore } from '@/stores/tree-store';
import { generatePage } from '@/lib/codegen';

const options: { value: Breakpoint; icon: LucideIcon; label: string }[] = [
  { value: 'desktop', icon: Monitor, label: 'Desktop' },
  { value: 'tablet', icon: Tablet, label: 'Tablet' },
  { value: 'mobile', icon: Smartphone, label: 'Mobile' },
];

/**
 * Canvas toolbar: Site Styles, responsive breakpoint switcher (Design mode),
 * and the Design / Code view toggle (Phase G — F13/F14).
 */
export function CanvasToolbar() {
  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const setBreakpoint = useEditorUiStore((s) => s.setBreakpoint);
  const setSiteStylesOpen = useEditorUiStore((s) => s.setSiteStylesOpen);
  const leftPanelOpen = useEditorUiStore((s) => s.leftPanelOpen);
  const toggleLeftPanel = useEditorUiStore((s) => s.toggleLeftPanel);

  const codeOpen = useCodeViewStore((s) => s.open);
  const setCodeOpen = useCodeViewStore((s) => s.setOpen);
  const tree = useTreeStore((s) => s.tree);

  const openPreview = () => {
    const { html } = generatePage(tree);
    const previewUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const preview = window.open(previewUrl, '_blank');
    if (!preview) {
      URL.revokeObjectURL(previewUrl);
      return;
    }
    preview.opener = null;
    window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
  };

  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-surface px-3">
      <div className="flex min-w-0 items-center gap-1">
        <IconButton
          label={leftPanelOpen ? 'Collapse layers panel' : 'Expand layers panel'}
          variant="ghost"
          size="sm"
          active={leftPanelOpen}
          onClick={toggleLeftPanel}
        >
          <PanelLeft className="h-4 w-4" />
        </IconButton>
        <Button variant="ghost" size="sm" onClick={() => setSiteStylesOpen(true)}>
          <Palette className="h-4 w-4" />
          Site Styles
        </Button>
      </div>

      {/* Breakpoints only matter on the live canvas — hide in Code View. */}
      <div className="flex items-center">
        {!codeOpen && (
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5">
            {options.map((o) => {
              const Icon = o.icon;
              return (
                <IconButton
                  key={o.value}
                  label={o.label}
                  size="sm"
                  variant="ghost"
                  active={breakpoint === o.value}
                  onClick={() => setBreakpoint(o.value)}
                  className={cn(breakpoint === o.value && 'bg-surface shadow-xs')}
                >
                  <Icon className="h-4 w-4" />
                </IconButton>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {!codeOpen && (
          <span className="text-xs tabular-nums text-foreground-subtle">
            {BREAKPOINT_WIDTH[breakpoint]}px
          </span>
        )}

        {!codeOpen && (
          <Button variant="secondary" size="sm" onClick={openPreview}>
            <Maximize2 className="h-3.5 w-3.5" />
            Preview
          </Button>
        )}

        <div
          className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5"
          role="tablist"
          aria-label="Center pane view"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!codeOpen}
            onClick={() => setCodeOpen(false)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
              !codeOpen
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-foreground-muted hover:text-foreground',
            )}
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            Design
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={codeOpen}
            onClick={() => setCodeOpen(true)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
              codeOpen
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-foreground-muted hover:text-foreground',
            )}
          >
            <Code2 className="h-3.5 w-3.5" />
            Code
          </button>
        </div>
      </div>
    </div>
  );
}
