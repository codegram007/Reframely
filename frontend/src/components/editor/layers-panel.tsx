import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { TreeNode } from '@/lib/schema';
import { findNodePath, isVisible, nodeLabel } from '@/lib/tree-index';
import { flattenVisible, resolveDrop } from '@/lib/tree-flatten';
import { useTreeStore } from '@/stores/tree-store';
import { useSelectionStore } from '@/stores/selection-store';
import { SortableLayerRow } from './sortable-layer-row';

/**
 * Layers panel — a collapsible tree mirroring the widget tree, now with
 * dnd-kit drag-and-drop: reorder within a container and move nodes
 * across containers (widget→column, column→row, section→page). Every
 * drop resolves to a single `moveNode` (one undo step), the same
 * mutation the AI assistant's `move_node` produces.
 */
export function LayersPanel() {
  const tree = useTreeStore((s) => s.tree);
  const toggleVisibility = useTreeStore((s) => s.toggleVisibility);
  const moveNode = useTreeStore((s) => s.moveNode);
  const selectedId = useSelectionStore((s) => s.selectedId);
  const hoverId = useSelectionStore((s) => s.hoverId);
  const setSelected = useSelectionStore((s) => s.setSelected);
  const setHover = useSelectionStore((s) => s.setHover);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const init = new Set<string>([tree.root.id]);
    for (const section of tree.root.children) init.add(section.id);
    return init;
  });
  const [dragId, setDragId] = useState<string | null>(null);

  const selectedRowRef = useRef<HTMLDivElement | null>(null);

  // Distance activation: avoid treating a click-to-select as a drag.
  // Listeners live only on the grip handle (sortable-layer-row).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Auto-expand ancestors of the selected node when selection comes from
  // the canvas.
  useEffect(() => {
    if (!selectedId) return;
    const path = findNodePath(tree, selectedId);
    if (!path) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (let i = 0; i < path.length - 1; i++) next.add(path[i]!.id);
      return next;
    });
  }, [selectedId, tree]);

  useEffect(() => {
    if (!selectedId) return;
    const t = setTimeout(() => selectedRowRef.current?.scrollIntoView({ block: 'nearest' }), 60);
    return () => clearTimeout(t);
  }, [selectedId, expanded]);

  // Flatten the visible tree for the sortable context.
  const rows = useMemo(() => flattenVisible(tree, expanded), [tree, expanded]);
  const rowIds = useMemo(() => rows.map((r) => r.node.id), [rows]);

  const dragNode = dragId ? rows.find((r) => r.node.id === dragId)?.node ?? null : null;

  const onDragStart = (e: DragStartEvent) => {
    setDragId(String(e.active.id));
    // Collapse the dragged subtree so we don't drop into our own child.
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(String(e.active.id));
      return next;
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const target = resolveDrop(tree, String(active.id), String(over.id));
    if (target) moveNode(String(active.id), target.newParentId, target.position);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center border-b border-border px-4">
        <span className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
          Layers
        </span>
      </div>
      <div
        role="tree"
        aria-label="Page structure"
        className="min-h-0 flex-1 overflow-y-auto p-1.5"
        onMouseLeave={() => setHover(null)}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragId(null)}
        >
          <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
            {rows.map((row) => (
              <SortableLayerRow
                key={row.node.id}
                node={row.node}
                depth={row.depth}
                expanded={expanded.has(row.node.id)}
                selected={row.node.id === selectedId}
                hovered={row.node.id === hoverId && row.node.id !== selectedId}
                dragging={row.node.id === dragId}
                rowRef={row.node.id === selectedId ? (el) => { selectedRowRef.current = el; } : undefined}
                onSelect={() => setSelected(row.node.id)}
                onToggleExpand={() => toggleExpand(row.node.id)}
                onToggleVisibility={() => toggleVisibility(row.node.id, !isVisible(row.node))}
                onHover={(h) => setHover(h ? row.node.id : null)}
              />
            ))}
          </SortableContext>

          <DragOverlay>
            {dragNode ? (
              <div className="flex h-7 items-center gap-1.5 rounded-md border border-accent bg-surface px-2 text-xs font-medium text-foreground shadow-md">
                {nodeLabel(dragNode as TreeNode)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
