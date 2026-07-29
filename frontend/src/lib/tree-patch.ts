/**
 * TreePatch types + apply/summarize helpers (prompt 0.2 / F17).
 *
 * The AI assistant proposes TreePatch objects; the editor previews them
 * and only applies via `applyTreePatch` → tree-store `commit` so F15 undo
 * treats Accept as one step.
 */
import type {
  Behavior,
  Breakpoint,
  NodeId,
  NodeStyles,
  TreeNode,
  TypographyToken,
  WidgetProps,
  WidgetTree,
} from './schema';
import { setNodeProps } from './tree-edit';
import { setNodeStyle, type StyleKey } from './style-engine';
import {
  deleteNode,
  duplicateNode,
  insertNode,
  moveNode,
} from './tree-move';
import {
  setColorTokenValue,
  setTypographyToken,
} from './token-engine';
import { findNode, nodeLabel } from './tree-index';

// ---------------------------------------------------------------------------
// Types (mirrors ai-assistant-tools.ts)
// ---------------------------------------------------------------------------

export type PatchOperation =
  | { op: 'update_props'; nodeId: NodeId; props: Partial<WidgetProps> }
  | { op: 'update_styles'; nodeId: NodeId; breakpoint: Breakpoint; styles: Partial<NodeStyles> }
  | { op: 'insert_node'; parentId: NodeId; position: number; node: TreeNode }
  | { op: 'move_node'; nodeId: NodeId; newParentId: NodeId; position: number }
  | { op: 'delete_node'; nodeId: NodeId }
  | { op: 'duplicate_node'; nodeId: NodeId; newParentId?: NodeId; position?: number }
  | { op: 'add_behavior'; nodeId: NodeId; behavior: Behavior }
  | { op: 'remove_behavior'; nodeId: NodeId; behaviorId: string }
  | { op: 'set_color_token'; tokenId: string; value: string }
  | { op: 'set_typography_token'; tokenId: string; value: Partial<Omit<TypographyToken, 'id'>> }
  | { op: 'batch'; operations: PatchOperation[] };

export interface TreePatch {
  patchId: string;
  createdAt: string;
  operations: PatchOperation[];
  confidence: number;
  rationale: string;
  affectedNodeIds: NodeId[];
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

function applyOne(tree: WidgetTree, op: PatchOperation): WidgetTree {
  switch (op.op) {
    case 'update_props':
      return setNodeProps(tree, op.nodeId, op.props as Record<string, unknown>);
    case 'update_styles': {
      let next = tree;
      for (const [key, value] of Object.entries(op.styles)) {
        next = setNodeStyle(next, op.nodeId, op.breakpoint, key as StyleKey, value as NodeStyles[StyleKey]);
      }
      return next;
    }
    case 'insert_node':
      return insertNode(tree, op.node, op.parentId, op.position);
    case 'move_node':
      return moveNode(tree, op.nodeId, op.newParentId, op.position);
    case 'delete_node':
      return deleteNode(tree, op.nodeId);
    case 'duplicate_node':
      return duplicateNode(tree, op.nodeId, op.newParentId, op.position);
    case 'add_behavior': {
      const node = findNode(tree, op.nodeId);
      if (!node) return tree;
      const behaviors = [...(node.behaviors ?? []), op.behavior];
      // Behaviors live on the node, not in props — shallow rewrite.
      return rewriteNode(tree, op.nodeId, (n) => ({ ...n, behaviors }));
    }
    case 'remove_behavior': {
      const node = findNode(tree, op.nodeId);
      if (!node?.behaviors) return tree;
      const behaviors = node.behaviors.filter((b) => b.id !== op.behaviorId);
      return rewriteNode(tree, op.nodeId, (n) => ({ ...n, behaviors }));
    }
    case 'set_color_token':
      return setColorTokenValue(tree, op.tokenId, op.value);
    case 'set_typography_token':
      return setTypographyToken(tree, op.tokenId, op.value);
    case 'batch': {
      let next = tree;
      for (const child of op.operations) next = applyOne(next, child);
      return next;
    }
    default:
      return tree;
  }
}

function rewriteNode(
  tree: WidgetTree,
  id: string,
  fn: (n: TreeNode) => TreeNode,
): WidgetTree {
  const walk = (n: TreeNode): TreeNode => {
    if (n.id === id) return fn(n);
    if (n.type === 'widget') return n;
    const kids = n.children as TreeNode[];
    const next = kids.map(walk);
    if (next.every((c, i) => c === kids[i])) return n;
    return { ...n, children: next } as TreeNode;
  };
  const root = walk(tree.root);
  if (root === tree.root) return tree;
  return { ...tree, root: root as WidgetTree['root'] };
}

/** Apply every operation in order. Used by Accept. */
export function applyTreePatch(tree: WidgetTree, patch: TreePatch): WidgetTree {
  let next = tree;
  for (const op of patch.operations) next = applyOne(next, op);
  return next;
}

// ---------------------------------------------------------------------------
// Summarize (human-readable diff line for the preview bar)
// ---------------------------------------------------------------------------

function flattenOps(ops: PatchOperation[]): PatchOperation[] {
  const out: PatchOperation[] = [];
  for (const op of ops) {
    if (op.op === 'batch') out.push(...flattenOps(op.operations));
    else out.push(op);
  }
  return out;
}

export interface PatchSummary {
  /** One-line headline, e.g. "Adds 1 section, 3 widgets". */
  headline: string;
  /** Bullet lines for the panel. */
  lines: string[];
}

export function summarizePatch(tree: WidgetTree, patch: TreePatch): PatchSummary {
  const ops = flattenOps(patch.operations);
  let sections = 0;
  let widgets = 0;
  let deletes = 0;
  let styleUpdates = 0;
  let propUpdates = 0;
  let moves = 0;
  let tokens = 0;
  const anchors: string[] = [];

  for (const op of ops) {
    switch (op.op) {
      case 'insert_node': {
        if (op.node.type === 'section') sections += 1;
        if (op.node.type === 'widget') widgets += 1;
        // Count nested widgets in composites
        const walk = (n: TreeNode) => {
          if (n.type === 'widget') widgets += n === op.node ? 0 : 1;
          if (n.type === 'section' && n !== op.node) sections += 1;
          if (n.type !== 'widget') (n.children as TreeNode[]).forEach(walk);
        };
        if (op.node.type !== 'widget') walk(op.node);
        const parent = findNode(tree, op.parentId);
        if (parent) anchors.push(nodeLabel(parent));
        break;
      }
      case 'delete_node':
        deletes += 1;
        break;
      case 'update_styles':
        styleUpdates += 1;
        break;
      case 'update_props':
        propUpdates += 1;
        break;
      case 'move_node':
      case 'duplicate_node':
        moves += 1;
        break;
      case 'set_color_token':
      case 'set_typography_token':
        tokens += 1;
        break;
      default:
        break;
    }
  }

  const parts: string[] = [];
  if (sections) parts.push(`Adds ${sections} section${sections === 1 ? '' : 's'}`);
  if (widgets) parts.push(`${sections ? '' : 'Adds '}${widgets} widget${widgets === 1 ? '' : 's'}`.trim());
  if (deletes) parts.push(`Removes ${deletes}`);
  if (propUpdates) parts.push(`Updates ${propUpdates} content`);
  if (styleUpdates) parts.push(`Restyles ${styleUpdates}`);
  if (moves) parts.push(`Moves/duplicates ${moves}`);
  if (tokens) parts.push(`Updates ${tokens} token${tokens === 1 ? '' : 's'}`);
  if (parts.length === 0) parts.push(`${ops.length} change${ops.length === 1 ? '' : 's'}`);

  let headline = parts.join(', ');
  if (anchors.length > 0) {
    headline += ` · near ${anchors[0]}`;
  }

  const lines = ops.slice(0, 8).map((op) => describeOp(tree, op));
  if (ops.length > 8) lines.push(`…and ${ops.length - 8} more`);

  return { headline, lines };
}

function labelOf(tree: WidgetTree, id: string): string {
  const n = findNode(tree, id);
  return n ? nodeLabel(n) : id;
}

function describeOp(tree: WidgetTree, op: PatchOperation): string {
  switch (op.op) {
    case 'insert_node': {
      const kind =
        op.node.type === 'widget' && 'widgetType' in op.node
          ? `widget (${op.node.widgetType})`
          : op.node.type;
      return `Insert ${kind} into ${labelOf(tree, op.parentId)}`;
    }
    case 'delete_node':
      return `Delete ${labelOf(tree, op.nodeId)}`;
    case 'update_props':
      return `Update content on ${labelOf(tree, op.nodeId)}`;
    case 'update_styles':
      return `Update ${op.breakpoint} styles on ${labelOf(tree, op.nodeId)}`;
    case 'move_node':
      return `Move ${labelOf(tree, op.nodeId)}`;
    case 'duplicate_node':
      return `Duplicate ${labelOf(tree, op.nodeId)}`;
    case 'set_color_token':
      return `Set color token ${op.tokenId} → ${op.value}`;
    case 'set_typography_token':
      return `Update typography token ${op.tokenId}`;
    case 'add_behavior':
      return `Add behavior on ${labelOf(tree, op.nodeId)}`;
    case 'remove_behavior':
      return `Remove behavior ${op.behaviorId}`;
    default:
      return op.op;
  }
}

/** Runtime type guard for API/mock payloads. */
export function isTreePatch(value: unknown): value is TreePatch {
  if (!value || typeof value !== 'object') return false;
  const p = value as TreePatch;
  return (
    typeof p.patchId === 'string' &&
    Array.isArray(p.operations) &&
    typeof p.confidence === 'number' &&
    typeof p.rationale === 'string' &&
    Array.isArray(p.affectedNodeIds)
  );
}
