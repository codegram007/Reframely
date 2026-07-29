/**
 * Structural tree mutation: move_node.
 *
 * This mirrors the AI assistant's `move_node` PatchOperation exactly:
 *   { op: 'move_node', nodeId, newParentId, position }
 * so drag-and-drop (F9) and AI tool calls produce identical mutations.
 * `position` is the zero-indexed slot in the NEW parent's children array,
 * measured AFTER the node has been removed from its old location.
 *
 * All functions are immutable and reference-stable on no-op.
 */
import type { NodeType, TreeNode, WidgetTree } from './schema';

/** The node type a given parent type accepts as children. */
const CHILD_TYPE: Record<Exclude<NodeType, 'widget'>, NodeType> = {
  page: 'section',
  section: 'row',
  row: 'column',
  column: 'widget',
};

/** The parent type that accepts a given child type (inverse of CHILD_TYPE). */
export function parentTypeFor(childType: NodeType): NodeType | null {
  switch (childType) {
    case 'section':
      return 'page';
    case 'row':
      return 'section';
    case 'column':
      return 'row';
    case 'widget':
      return 'column';
    case 'page':
      return null;
  }
}

function childrenOf(node: TreeNode): TreeNode[] {
  return node.type === 'widget' ? [] : (node.children as TreeNode[]);
}

/** Find a node and its parent in one pass. */
function locate(
  root: TreeNode,
  id: string,
  parent: TreeNode | null = null,
): { node: TreeNode; parent: TreeNode | null } | null {
  if (root.id === id) return { node: root, parent };
  for (const child of childrenOf(root)) {
    const found = locate(child, id, root);
    if (found) return found;
  }
  return null;
}

/** Is `maybeAncestor` an ancestor of (or equal to) `id`? Guards self-drops. */
function isAncestor(maybeAncestor: TreeNode, id: string): boolean {
  if (maybeAncestor.id === id) return true;
  return childrenOf(maybeAncestor).some((c) => isAncestor(c, id));
}

/**
 * Whether `nodeId` may legally move into `newParentId`: the parent must
 * exist, must accept the node's type as children, and must not be the
 * node itself or a descendant of it (which would detach the subtree).
 */
export function canMove(tree: WidgetTree, nodeId: string, newParentId: string): boolean {
  if (nodeId === newParentId) return false;
  const src = locate(tree.root, nodeId);
  const dstParent = locate(tree.root, newParentId);
  if (!src || !dstParent) return false;
  const parent = dstParent.node;
  if (parent.type === 'widget') return false;
  if (CHILD_TYPE[parent.type] !== src.node.type) return false;
  // Can't drop a node into itself or its own subtree.
  if (isAncestor(src.node, newParentId)) return false;
  return true;
}

function mapReplace(root: TreeNode, id: string, fn: (n: TreeNode) => TreeNode): TreeNode {
  if (root.id === id) return fn(root);
  if (root.type === 'widget') return root;
  const kids = root.children as TreeNode[];
  const next = kids.map((c) => mapReplace(c, id, fn));
  return next.some((c, i) => c !== kids[i]) ? ({ ...root, children: next } as TreeNode) : root;
}

/** Sibling position info for a node: its parent id, index, and count. */
export function siblingInfo(
  tree: WidgetTree,
  nodeId: string,
): { parentId: string; index: number; count: number } | null {
  const found = locate(tree.root, nodeId);
  if (!found || !found.parent) return null;
  const siblings = childrenOf(found.parent);
  return {
    parentId: found.parent.id,
    index: siblings.findIndex((c) => c.id === nodeId),
    count: siblings.length,
  };
}

/**
 * Move `nodeId` into `newParentId` at `position`. Returns the same tree
 * reference when the move is invalid or a true no-op (dropped in its
 * current slot). `position` clamps to the destination's bounds.
 */
export function moveNode(
  tree: WidgetTree,
  nodeId: string,
  newParentId: string,
  position: number,
): WidgetTree {
  if (!canMove(tree, nodeId, newParentId)) return tree;

  const src = locate(tree.root, nodeId)!;
  const moved = src.node;
  const oldParent = src.parent;
  if (!oldParent) return tree; // page has no parent; never moved

  // No-op guard: same parent, same effective index.
  if (oldParent.id === newParentId) {
    const siblings = childrenOf(oldParent);
    const from = siblings.findIndex((c) => c.id === nodeId);
    const clamped = Math.max(0, Math.min(position, siblings.length - 1));
    if (from === clamped) return tree;
  }

  // 1. Remove from the old parent.
  let root = mapReplace(tree.root, oldParent.id, (p) => ({
    ...p,
    children: (childrenOf(p) as TreeNode[]).filter((c) => c.id !== nodeId),
  }) as TreeNode) as WidgetTree['root'] | TreeNode;

  // 2. Insert into the new parent at the clamped position.
  root = mapReplace(root as TreeNode, newParentId, (p) => {
    const kids = childrenOf(p) as TreeNode[];
    const clamped = Math.max(0, Math.min(position, kids.length));
    const nextKids = [...kids.slice(0, clamped), moved, ...kids.slice(clamped)];
    return { ...p, children: nextKids } as TreeNode;
  });

  return { ...tree, root: root as WidgetTree['root'] };
}

/**
 * Whether a fresh (not-yet-inserted) `node` may be inserted as a child of
 * `parentId`: the parent must exist and accept the node's type.
 */
export function canInsert(tree: WidgetTree, nodeType: NodeType, parentId: string): boolean {
  const dstParent = locate(tree.root, parentId);
  if (!dstParent) return false;
  const parent = dstParent.node;
  if (parent.type === 'widget') return false;
  return CHILD_TYPE[parent.type] === nodeType;
}

/**
 * Insert a fresh `node` into `parentId` at `position` (clamped). Returns
 * the same tree reference when the insert is invalid. Unlike moveNode the
 * node is new, so there is no removal step.
 */
export function insertNode(
  tree: WidgetTree,
  node: TreeNode,
  parentId: string,
  position: number,
): WidgetTree {
  if (!canInsert(tree, node.type, parentId)) return tree;
  const root = mapReplace(tree.root, parentId, (p) => {
    const kids = childrenOf(p) as TreeNode[];
    const clamped = Math.max(0, Math.min(position, kids.length));
    const nextKids = [...kids.slice(0, clamped), node, ...kids.slice(clamped)];
    return { ...p, children: nextKids } as TreeNode;
  });
  if (root === tree.root) return tree;
  return { ...tree, root: root as WidgetTree['root'] };
}

/**
 * Resolve where a fresh `nodeType` should be inserted given a drop on
 * `targetId` and an `edge`. Walks up from the target to the nearest
 * ancestor that accepts `nodeType` as a child, and picks the slot next to
 * whichever node on that ancestor's child level contains the target.
 *
 *  - `edge: 'inside'` on a container that directly accepts the type →
 *    append as its last child.
 *  - otherwise insert before/after the ancestor-chain child that sits in
 *    the accepting parent (edge decides before vs. after).
 *
 * Returns null when no ancestor accepts the type (shouldn't happen for a
 * page-rooted tree, but guards regardless). With no target (empty drop),
 * pass the page id as target.
 */
export function resolveInsert(
  tree: WidgetTree,
  nodeType: NodeType,
  targetId: string,
  edge: 'before' | 'after' | 'inside',
): { parentId: string; position: number } | null {
  const path = locatePath(tree.root, targetId);
  if (!path) return null;

  // 'inside': if the target itself accepts the type, append into it.
  const target = path[path.length - 1]!;
  if (edge === 'inside' && target.type !== 'widget' && CHILD_TYPE[target.type] === nodeType) {
    return { parentId: target.id, position: childrenOf(target).length };
  }

  // Walk up: find the deepest ancestor pair (parent, child) where parent
  // accepts nodeType. Insert next to `child` within `parent`.
  for (let i = path.length - 1; i >= 1; i--) {
    const parent = path[i - 1]!;
    const child = path[i]!;
    if (parent.type !== 'widget' && CHILD_TYPE[parent.type] === nodeType) {
      const kids = childrenOf(parent);
      const idx = kids.findIndex((c) => c.id === child.id);
      const base = idx < 0 ? kids.length : idx;
      return { parentId: parent.id, position: edge === 'after' ? base + 1 : base };
    }
  }

  // Fall back: the target's own container-chain didn't accept it; try the
  // target as a container (append) if it can hold the type at all.
  if (target.type !== 'widget' && CHILD_TYPE[target.type] === nodeType) {
    return { parentId: target.id, position: childrenOf(target).length };
  }
  return null;
}

/** Path from root to `id` inclusive (root-first), or null if not found. */
function locatePath(root: TreeNode, id: string, acc: TreeNode[] = []): TreeNode[] | null {
  const next = [...acc, root];
  if (root.id === id) return next;
  for (const child of childrenOf(root)) {
    const found = locatePath(child, id, next);
    if (found) return found;
  }
  return null;
}

/**
 * Remove `nodeId` from the tree (AI `delete_node`). Cannot delete the page
 * root. Returns the same reference when the node is missing or is the root.
 */
export function deleteNode(tree: WidgetTree, nodeId: string): WidgetTree {
  if (tree.root.id === nodeId) return tree;
  const found = locate(tree.root, nodeId);
  if (!found || !found.parent) return tree;
  const parentId = found.parent.id;
  const root = mapReplace(tree.root, parentId, (p) => ({
    ...p,
    children: childrenOf(p).filter((c) => c.id !== nodeId),
  }) as TreeNode);
  if (root === tree.root) return tree;
  return { ...tree, root: root as WidgetTree['root'] };
}

function newCloneId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Deep-clone a subtree with fresh ids (used by duplicate_node). */
function cloneSubtree(node: TreeNode): TreeNode {
  const prefix =
    node.type === 'widget' ? 'w' : node.type === 'section' ? 'sec' : node.type === 'row' ? 'row' : 'col';
  const id = newCloneId(prefix);
  if (node.type === 'widget') {
    return {
      ...node,
      id,
      meta: {
        ...node.meta,
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }
  return {
    ...node,
    id,
    meta: {
      ...node.meta,
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    children: (node.children as TreeNode[]).map(cloneSubtree),
  } as TreeNode;
}

/**
 * Duplicate `nodeId` as a sibling (or into `newParentId` at `position`).
 * Mirrors the AI assistant's `duplicate_node` op.
 */
export function duplicateNode(
  tree: WidgetTree,
  nodeId: string,
  newParentId?: string,
  position?: number,
): WidgetTree {
  const found = locate(tree.root, nodeId);
  if (!found || !found.parent) return tree;
  const clone = cloneSubtree(found.node);
  const parentId = newParentId ?? found.parent.id;
  const siblings = childrenOf(found.parent);
  const from = siblings.findIndex((c) => c.id === nodeId);
  const pos = position ?? (from < 0 ? siblings.length : from + 1);
  return insertNode(tree, clone, parentId, pos);
}
