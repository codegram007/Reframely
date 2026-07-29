import { ChevronRight, Eye, EyeOff, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TreeNode } from '@/lib/schema';
import { nodeIcon, nodeLabel, isLeaf, isVisible } from '@/lib/tree-index';
import { cn } from '@/lib/utils';

interface SortableLayerRowProps {
  node: TreeNode;
  depth: number;
  expanded: boolean;
  selected: boolean;
  hovered: boolean;
  dragging: boolean;
  rowRef?: ((el: HTMLDivElement | null) => void) | undefined;
  onSelect: () => void;
  onToggleExpand: () => void;
  onToggleVisibility: () => void;
  onHover: (hovering: boolean) => void;
}

/**
 * A draggable row in the layers tree: expand chevron, type icon, label,
 * visibility toggle, and a drag handle. The handle carries the dnd-kit
 * listeners so dragging starts only from the grip, leaving the rest of
 * the row free for click-to-select. Indentation encodes depth.
 */
export function SortableLayerRow({
  node,
  depth,
  expanded,
  selected,
  hovered,
  dragging,
  rowRef,
  onSelect,
  onToggleExpand,
  onToggleVisibility,
  onHover,
}: SortableLayerRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isOver } =
    useSortable({ id: node.id });

  const Icon = nodeIcon(node);
  const leaf = isLeaf(node);
  const visible = isVisible(node);

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        rowRef?.(el);
      }}
      role="treeitem"
      aria-selected={selected}
      aria-expanded={leaf ? undefined : expanded}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{
        paddingLeft: 4 + depth * 14,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'group relative flex h-7 cursor-pointer items-center gap-1 rounded-md pr-1 text-xs transition-colors',
        selected
          ? 'bg-accent-subtle text-accent'
          : hovered
            ? 'bg-surface-sunken text-foreground'
            : 'text-foreground-muted hover:bg-surface-sunken hover:text-foreground',
        !visible && 'opacity-50',
        dragging && 'opacity-30',
        // Drop indicator: an accent line across the row being hovered.
        isOver && !dragging && 'before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded-full before:bg-accent',
      )}
    >
      {leaf ? (
        <span className="h-4 w-4 shrink-0" />
      ) : (
        <button
          type="button"
          aria-label={expanded ? 'Collapse' : 'Expand'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-foreground-subtle hover:text-foreground"
        >
          <ChevronRight
            className={cn('h-3 w-3 transition-transform duration-150', expanded && 'rotate-90')}
          />
        </button>
      )}

      <Icon className={cn('h-3.5 w-3.5 shrink-0', selected ? 'text-accent' : 'text-foreground-subtle')} />

      <span className="min-w-0 flex-1 truncate">{nodeLabel(node)}</span>

      <button
        type="button"
        aria-label={visible ? 'Hide' : 'Show'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded text-foreground-subtle hover:text-foreground',
          visible && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>

      {/* Drag handle — carries the dnd-kit activator listeners only (not the row). */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label="Drag to reorder"
        title="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
        className="flex h-5 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-foreground-subtle opacity-50 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
