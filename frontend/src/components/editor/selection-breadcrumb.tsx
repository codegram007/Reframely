import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { nodeLabel } from '@/lib/tree-index';
import type { TreeNode } from '@/lib/schema';
import { cn } from '@/lib/utils';

interface SelectionBreadcrumbProps {
  /** Root-first path to the selected node, or null when nothing is selected. */
  path: TreeNode[] | null;
  onSelect: (id: string) => void;
}

/**
 * Ancestor breadcrumb for the current selection, e.g.
 * `Section › Column › Heading`. Each crumb is clickable for one-click
 * "select parent"; the last crumb is the current selection (not a link).
 * The root Page node is omitted to keep the trail focused on structure.
 */
export function SelectionBreadcrumb({ path, onSelect }: SelectionBreadcrumbProps) {
  // Drop the root page node; keep section → … → selected.
  const crumbs = path ? path.filter((n) => n.type !== 'page') : [];

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-surface px-3 text-xs">
      {crumbs.length === 0 ? (
        <span className="text-foreground-subtle">Nothing selected — click an element on the canvas</span>
      ) : (
        crumbs.map((node, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={node.id}>
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-foreground-subtle" />}
              {isLast ? (
                <span className="font-medium text-foreground">{nodeLabel(node)}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(node.id)}
                  className={cn(
                    'rounded px-1 py-0.5 text-foreground-muted transition-colors',
                    'hover:bg-surface-sunken hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  {nodeLabel(node)}
                </button>
              )}
            </Fragment>
          );
        })
      )}
    </div>
  );
}
