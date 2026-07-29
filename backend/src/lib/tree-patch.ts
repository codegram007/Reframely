/**
 * Backend mirror of the editor TreePatch contract.
 *
 * B12 produces these patches and B13 validates/applies candidates before
 * returning them. Mutations are immutable and every result is checked against
 * the widget-tree hierarchy (page -> section -> row -> column -> widget).
 */
import type {
  Behavior,
  Breakpoint,
  NodeStyles,
  TreeNode,
  TypographyToken,
  WidgetNode,
  WidgetProps,
  WidgetTree,
} from '../services/classifier/schema.js';

export type PatchOperation =
  | { op: 'update_props'; nodeId: string; props: Partial<WidgetProps> }
  | { op: 'update_styles'; nodeId: string; breakpoint: Breakpoint; styles: Partial<NodeStyles> }
  | { op: 'insert_node'; parentId: string; position: number; node: TreeNode }
  | { op: 'move_node'; nodeId: string; newParentId: string; position: number }
  | { op: 'delete_node'; nodeId: string }
  | { op: 'duplicate_node'; nodeId: string; newParentId?: string; position?: number }
  | { op: 'add_behavior'; nodeId: string; behavior: Behavior }
  | { op: 'remove_behavior'; nodeId: string; behaviorId: string }
  | { op: 'set_color_token'; tokenId: string; value: string }
  | { op: 'set_typography_token'; tokenId: string; value: Partial<Omit<TypographyToken, 'id'>> }
  | { op: 'batch'; operations: PatchOperation[] };

export interface TreePatch {
  patchId: string;
  createdAt: string;
  operations: PatchOperation[];
  confidence: number;
  rationale: string;
  affectedNodeIds: string[];
}

export class PatchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatchValidationError';
  }
}

type ContainerNode = Exclude<TreeNode, WidgetNode>;

const CHILD_TYPE: Record<ContainerNode['type'], TreeNode['type']> = {
  page: 'section',
  section: 'row',
  row: 'column',
  column: 'widget',
};

function childrenOf(node: TreeNode): TreeNode[] {
  return node.type === 'widget' ? [] : (node.children as TreeNode[]);
}

function locate(
  node: TreeNode,
  id: string,
  parent: ContainerNode | null = null,
): { node: TreeNode; parent: ContainerNode | null; index: number } | null {
  if (node.id === id) return { node, parent, index: -1 };
  if (node.type === 'widget') return null;
  for (let index = 0; index < node.children.length; index++) {
    const found = locate(node.children[index] as TreeNode, id, node);
    if (found) return { ...found, index: found.parent?.id === node.id ? index : found.index };
  }
  return null;
}

function rewriteNode(root: TreeNode, id: string, rewrite: (node: TreeNode) => TreeNode): TreeNode {
  if (root.id === id) return rewrite(root);
  if (root.type === 'widget') return root;
  const children = root.children as TreeNode[];
  const next = children.map((child) => rewriteNode(child, id, rewrite));
  return next.some((child, index) => child !== children[index])
    ? ({ ...root, children: next } as TreeNode)
    : root;
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PatchValidationError(`${label} must be an object.`);
  }
}

function assertNode(node: TreeNode, expectedType: TreeNode['type'], ids: Set<string>): void {
  assertObject(node, 'node');
  if (node.type !== expectedType) {
    throw new PatchValidationError(`Expected ${expectedType} child, received ${String(node.type)}.`);
  }
  if (typeof node.id !== 'string' || node.id.length === 0) {
    throw new PatchValidationError('Every node must have a non-empty id.');
  }
  if (ids.has(node.id)) throw new PatchValidationError(`Duplicate node id: ${node.id}.`);
  ids.add(node.id);
  assertObject(node.styles, `styles for ${node.id}`);
  assertObject(node.styles.desktop, `desktop styles for ${node.id}`);
  assertObject(node.meta, `meta for ${node.id}`);
  if (!['imported', 'manual', 'ai-generated'].includes(node.meta.source)) {
    throw new PatchValidationError(`Invalid meta.source for ${node.id}.`);
  }
  if (typeof node.meta.createdAt !== 'string' || typeof node.meta.updatedAt !== 'string') {
    throw new PatchValidationError(`Node ${node.id} must have creation/update timestamps.`);
  }

  if (node.type === 'widget') {
    assertObject(node.props, `props for ${node.id}`);
    return;
  }
  if (!Array.isArray(node.children)) {
    throw new PatchValidationError(`Container ${node.id} must have children.`);
  }
  const childType = CHILD_TYPE[node.type];
  for (const child of node.children as TreeNode[]) assertNode(child, childType, ids);
}

/** Throws when a value is not a schema-compatible WidgetTree. */
export function assertWidgetTree(value: unknown): asserts value is WidgetTree {
  assertObject(value, 'tree');
  if (value['schemaVersion'] !== 1) {
    throw new PatchValidationError('tree.schemaVersion must be 1.');
  }
  assertObject(value['tokens'], 'tree.tokens');
  if (!Array.isArray(value['tokens']['colors']) || !Array.isArray(value['tokens']['typography'])) {
    throw new PatchValidationError('tree.tokens must include color and typography arrays.');
  }
  assertObject(value['root'], 'tree.root');
  assertNode(value['root'] as unknown as TreeNode, 'page', new Set());
}

function insertNode(tree: WidgetTree, parentId: string, position: number, node: TreeNode): WidgetTree {
  const parent = locate(tree.root, parentId)?.node;
  if (!parent || parent.type === 'widget') {
    throw new PatchValidationError(`Insert parent not found or is a widget: ${parentId}.`);
  }
  if (CHILD_TYPE[parent.type] !== node.type) {
    throw new PatchValidationError(`${parent.type} cannot contain ${node.type}.`);
  }
  const existingIds = new Set<string>();
  assertNode(tree.root, 'page', existingIds);
  assertNode(node, node.type, existingIds);
  const root = rewriteNode(tree.root, parentId, (current) => {
    const children = childrenOf(current);
    const at = Math.max(0, Math.min(position, children.length));
    return { ...current, children: [...children.slice(0, at), node, ...children.slice(at)] } as TreeNode;
  });
  return { ...tree, root: root as WidgetTree['root'] };
}

function deleteNode(tree: WidgetTree, nodeId: string): WidgetTree {
  if (tree.root.id === nodeId) throw new PatchValidationError('The page root cannot be deleted.');
  const found = locate(tree.root, nodeId);
  if (!found?.parent) throw new PatchValidationError(`Delete target not found: ${nodeId}.`);
  const root = rewriteNode(tree.root, found.parent.id, (parent) => ({
    ...parent,
    children: childrenOf(parent).filter((child) => child.id !== nodeId),
  }) as TreeNode);
  return { ...tree, root: root as WidgetTree['root'] };
}

function applyOne(tree: WidgetTree, operation: PatchOperation): WidgetTree {
  switch (operation.op) {
    case 'batch': {
      let next = tree;
      for (const child of operation.operations) next = applyOne(next, child);
      return next;
    }
    case 'insert_node':
      return insertNode(tree, operation.parentId, operation.position, operation.node);
    case 'delete_node':
      return deleteNode(tree, operation.nodeId);
    case 'update_props': {
      const found = locate(tree.root, operation.nodeId)?.node;
      if (!found || found.type !== 'widget') {
        throw new PatchValidationError(`Props target is not a widget: ${operation.nodeId}.`);
      }
      const root = rewriteNode(tree.root, operation.nodeId, (node) => ({
        ...node,
        props: { ...(node as WidgetNode).props, ...operation.props } as WidgetProps,
      }) as WidgetNode);
      return { ...tree, root: root as WidgetTree['root'] };
    }
    case 'update_styles': {
      const found = locate(tree.root, operation.nodeId)?.node;
      if (!found) throw new PatchValidationError(`Style target not found: ${operation.nodeId}.`);
      const root = rewriteNode(tree.root, operation.nodeId, (node) => {
        const current = node.styles[operation.breakpoint] ?? {};
        return {
          ...node,
          styles: {
            ...node.styles,
            [operation.breakpoint]: { ...current, ...operation.styles },
          },
        } as TreeNode;
      });
      return { ...tree, root: root as WidgetTree['root'] };
    }
    case 'move_node': {
      const found = locate(tree.root, operation.nodeId);
      if (!found?.parent) throw new PatchValidationError(`Move target not found: ${operation.nodeId}.`);
      const moved = found.node;
      const without = deleteNode(tree, operation.nodeId);
      return insertNode(without, operation.newParentId, operation.position, moved);
    }
    case 'duplicate_node': {
      const found = locate(tree.root, operation.nodeId);
      if (!found?.parent) throw new PatchValidationError(`Duplicate target not found: ${operation.nodeId}.`);
      const suffix = '_copy';
      const clone = JSON.parse(JSON.stringify(found.node)) as TreeNode;
      const rename = (node: TreeNode): TreeNode => {
        if (node.type === 'widget') return { ...node, id: `${node.id}${suffix}` };
        return {
          ...node,
          id: `${node.id}${suffix}`,
          children: (node.children as TreeNode[]).map(rename),
        } as TreeNode;
      };
      const parentId = operation.newParentId ?? found.parent.id;
      const position = operation.position ?? found.index + 1;
      return insertNode(tree, parentId, position, rename(clone));
    }
    case 'add_behavior': {
      const found = locate(tree.root, operation.nodeId)?.node;
      if (!found) throw new PatchValidationError(`Behavior target not found: ${operation.nodeId}.`);
      const root = rewriteNode(tree.root, operation.nodeId, (node) => ({
        ...node,
        behaviors: [...(node.behaviors ?? []), operation.behavior],
      }) as TreeNode);
      return { ...tree, root: root as WidgetTree['root'] };
    }
    case 'remove_behavior': {
      const found = locate(tree.root, operation.nodeId)?.node;
      if (!found) throw new PatchValidationError(`Behavior target not found: ${operation.nodeId}.`);
      const root = rewriteNode(tree.root, operation.nodeId, (node) => ({
        ...node,
        behaviors: (node.behaviors ?? []).filter((behavior) => behavior.id !== operation.behaviorId),
      }) as TreeNode);
      return { ...tree, root: root as WidgetTree['root'] };
    }
    case 'set_color_token': {
      const index = tree.tokens.colors.findIndex((token) => token.id === operation.tokenId);
      if (index < 0) throw new PatchValidationError(`Color token not found: ${operation.tokenId}.`);
      return {
        ...tree,
        tokens: {
          ...tree.tokens,
          colors: tree.tokens.colors.map((token, i) =>
            i === index ? { ...token, value: operation.value } : token),
        },
      };
    }
    case 'set_typography_token': {
      const index = tree.tokens.typography.findIndex((token) => token.id === operation.tokenId);
      if (index < 0) throw new PatchValidationError(`Typography token not found: ${operation.tokenId}.`);
      return {
        ...tree,
        tokens: {
          ...tree.tokens,
          typography: tree.tokens.typography.map((token, i) =>
            i === index ? { ...token, ...operation.value } : token),
        },
      };
    }
  }
}

/** Applies a patch and validates the resulting tree before returning it. */
export function applyTreePatch(tree: WidgetTree, patch: TreePatch): WidgetTree {
  assertWidgetTree(tree);
  if (!Number.isFinite(patch.confidence) || patch.confidence < 0 || patch.confidence > 1) {
    throw new PatchValidationError('Patch confidence must be between 0 and 1.');
  }
  let next = tree;
  for (const operation of patch.operations) next = applyOne(next, operation);
  assertWidgetTree(next);
  return next;
}

