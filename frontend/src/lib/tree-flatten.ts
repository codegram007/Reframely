import type { TreeNode, WidgetTree } from './schema';
import { findNodePath } from './tree-index';
import { canMove } from './tree-move';

export interface FlatRow {
  node: TreeNode;
  depth: number;
  parentId: string | null;
  index: number; // index within its parent's children
}

function childrenOf(node: TreeNode): TreeNode[] {
  return node.type === 'widget' ? [] : (node.children as TreeNode[]);
}

/**
 * Flatten the tree into an ordered list of visible rows (respecting the
 * set of expanded ids). Collapsed subtrees are omitted. The root page is
 * included so it can host section drops.
 */
export function flattenVisible(tree: WidgetTree, expanded: Set<string>): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (node: TreeNode, depth: number, parentId: string | null, index: number): void => {
    out.push({ node, depth, parentId, index });
    if (node.type !== 'widget' && expanded.has(node.id)) {
      childrenOf(node).forEach((c, i) => walk(c, depth + 1, node.id, i));
    }
  };
  walk(tree.root, 0, null, 0);
  return out;
}

export interface DropTarget {
  newParentId: string;
  position: number;
}

/**
 * Resolve a drag (activeId dropped onto overId) into a move_node target,
 * or null when the drop is invalid. Two cases:
 *
 *  1. `over` is a node of the SAME type as `active` → reorder next to it
 *     in over's parent (insert at over's index; moveNode's remove-then-
 *     insert reproduces arrayMove semantics).
 *  2. `over` is a container that ACCEPTS active's type → append as its
 *     last child (intuitive "drop onto the container").
 */
export function resolveDrop(
  tree: WidgetTree,
  activeId: string,
  overId: string,
): DropTarget | null {
  if (activeId === overId) return null;
  const activePath = findNodePath(tree, activeId);
  const overPath = findNodePath(tree, overId);
  if (!activePath || !overPath) return null;

  const active = activePath[activePath.length - 1]!;
  const over = overPath[overPath.length - 1]!;
  const overParent = overPath[overPath.length - 2] ?? null;

  // Case 1: same type → reorder within over's parent.
  if (over.type === active.type && overParent) {
    const siblings = childrenOf(overParent);
    const overIndex = siblings.findIndex((c) => c.id === overId);
    if (canMove(tree, activeId, overParent.id)) {
      return { newParentId: overParent.id, position: overIndex };
    }
    return null;
  }

  // Case 2: over is a container that accepts active's type → append.
  if (canMove(tree, activeId, overId)) {
    const kids = childrenOf(over);
    return { newParentId: overId, position: kids.length };
  }

  return null;
}
