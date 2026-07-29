import type { Breakpoint, TreeNode } from '@/lib/schema';
import { useTreeStore } from '@/stores/tree-store';
import {
  BackgroundGroup,
  BorderGroup,
  LayoutGroup,
  ShadowGroup,
  SpacingGroup,
  TypographyGroup,
} from './style-groups';

/**
 * The Style tab's body for a selected node — the six control groups
 * writing to the active breakpoint's overrides (desktop = base). Layout
 * only renders for structural nodes (handled inside LayoutGroup).
 */
export function StyleTabContent({
  node,
  breakpoint,
}: {
  node: TreeNode;
  breakpoint: Breakpoint;
}) {
  const tokens = useTreeStore((s) => s.tree.tokens.colors);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {breakpoint !== 'desktop' && (
        <p className="border-b border-border bg-surface-sunken px-3 py-2 text-2xs text-foreground-muted">
          Editing <span className="font-medium text-foreground">{breakpoint}</span> overrides. Unset
          values inherit from desktop.
        </p>
      )}
      <LayoutGroup node={node} breakpoint={breakpoint} tokens={tokens} />
      <SpacingGroup node={node} breakpoint={breakpoint} tokens={tokens} />
      <TypographyGroup node={node} breakpoint={breakpoint} tokens={tokens} />
      <BackgroundGroup node={node} breakpoint={breakpoint} tokens={tokens} />
      <BorderGroup node={node} breakpoint={breakpoint} tokens={tokens} />
      <ShadowGroup node={node} breakpoint={breakpoint} tokens={tokens} />
    </div>
  );
}
