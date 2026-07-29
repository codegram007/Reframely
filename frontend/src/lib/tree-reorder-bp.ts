/**
 * Breakpoint-scoped visual reordering.
 *
 * The PRD's mobile stacked-layout case: at tablet/mobile a multi-column
 * row's columns can be reordered WITHOUT changing the structural children
 * array (which is shared by every breakpoint). Instead we write CSS
 * `order` overrides scoped to that breakpoint, so desktop keeps its
 * source order and only the active breakpoint restacks.
 *
 * Order values mirror the sibling's target visual index. When a column's
 * target index equals its structural (DOM) index the override is cleared,
 * so "back to source order" leaves a sparse tree with no overrides — and
 * the override badges disappear on their own.
 */
import type { Breakpoint, TreeNode, WidgetTree } from './schema';
import { effectiveValue, setStyleValue } from './style-engine';

function childrenOf(node: TreeNode): TreeNode[] {
  return node.type === 'widget' ? [] : (node.children as TreeNode[]);
}

function findNode(root: TreeNode, id: string): TreeNode | null {
  if (root.id === id) return root;
  for (const c of childrenOf(root)) {
    const found = findNode(c, id);
    if (found) return found;
  }
  return null;
}

/**
 * The current visual order of a parent's children at `bp`: structural
 * order re-sorted by each child's effective `order` (stable on ties, so
 * children with no order keep DOM order). Returns the child ids.
 */
export function visualOrder(parent: TreeNode, bp: Breakpoint): string[] {
  const kids = childrenOf(parent);
  return kids
    .map((c, domIndex) => {
      const raw = effectiveValue(c, bp, 'order');
      const order = typeof raw === 'number' ? raw : domIndex;
      return { id: c.id, order, domIndex };
    })
    .sort((a, b) => a.order - b.order || a.domIndex - b.domIndex)
    .map((e) => e.id);
}

function mapReplace(root: TreeNode, id: string, fn: (n: TreeNode) => TreeNode): TreeNode {
  if (root.id === id) return fn(root);
  if (root.type === 'widget') return root;
  const kids = root.children as TreeNode[];
  const next = kids.map((c) => mapReplace(c, id, fn));
  return next.some((c, i) => c !== kids[i]) ? ({ ...root, children: next } as TreeNode) : root;
}

/**
 * Reorder `parentId`'s children at breakpoint `bp` by moving the child
 * currently at visual index `from` to visual index `to`. Writes `order`
 * overrides on the affected children (clearing any whose target index
 * matches their structural index). No-op on desktop, bad indices, or when
 * nothing changes. Reference-stable on no-op.
 */
export function reorderChildAtBreakpoint(
  tree: WidgetTree,
  parentId: string,
  from: number,
  to: number,
  bp: Breakpoint,
): WidgetTree {
  if (bp === 'desktop') return tree; // desktop is the base; reorder there is structural
  const parent = findNode(tree.root, parentId);
  if (!parent || parent.type === 'widget') return tree;

  const kids = childrenOf(parent);
  const ordered = visualOrder(parent, bp);
  if (from < 0 || from >= ordered.length || to < 0 || to >= ordered.length) return tree;
  if (from === to) return tree;

  // Compute the new visual sequence.
  const seq = [...ordered];
  const [moved] = seq.splice(from, 1);
  seq.splice(to, 0, moved!);

  // Map each child id → its structural (DOM) index for the clear-on-match test.
  const domIndex = new Map(kids.map((c, i) => [c.id, i]));

  const newRoot = mapReplace(tree.root, parentId, (p) => {
    let changed = false;
    const nextKids = (childrenOf(p) as TreeNode[]).map((child) => {
      const targetIndex = seq.indexOf(child.id);
      // Clear the override when the visual index matches the source index
      // (keeps the tree sparse); otherwise pin the explicit order.
      const value = targetIndex === domIndex.get(child.id) ? undefined : targetIndex;
      const nextStyles = setStyleValue(child.styles, bp, 'order', value);
      if (nextStyles === child.styles) return child;
      changed = true;
      return { ...child, styles: nextStyles };
    });
    return changed ? ({ ...p, children: nextKids } as TreeNode) : p;
  });

  if (newRoot === tree.root) return tree;
  return { ...tree, root: newRoot as WidgetTree['root'] };
}
