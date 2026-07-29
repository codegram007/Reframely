import type { TreeNode, WidgetTree, WidgetType } from './schema';
import {
  Type,
  Heading,
  Image,
  MousePointerClick,
  Star,
  List,
  Video,
  Code2,
  FileCode2,
  Layers,
  Rows3,
  Columns3,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';

/** Human label for a widget type, e.g. 'custom-html' → 'Custom HTML'. */
const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  text: 'Text',
  heading: 'Heading',
  image: 'Image',
  button: 'Button',
  icon: 'Icon',
  list: 'List',
  video: 'Video',
  embed: 'Embed',
  'custom-html': 'Custom HTML',
};

const WIDGET_TYPE_ICONS: Record<WidgetType, LucideIcon> = {
  text: Type,
  heading: Heading,
  image: Image,
  button: MousePointerClick,
  icon: Star,
  list: List,
  video: Video,
  embed: FileCode2,
  'custom-html': Code2,
};

/** Icon for any node — structural nodes get layout glyphs. */
export function nodeIcon(node: TreeNode): LucideIcon {
  switch (node.type) {
    case 'page':
      return LayoutGrid;
    case 'section':
      return Layers;
    case 'row':
      return Rows3;
    case 'column':
      return Columns3;
    case 'widget':
      return WIDGET_TYPE_ICONS[node.widgetType];
  }
}

/** Short display label for any node (used in overlay + breadcrumb). */
export function nodeLabel(node: TreeNode): string {
  switch (node.type) {
    case 'page':
      return 'Page';
    case 'section':
      return node.name ?? 'Section';
    case 'row':
      return 'Row';
    case 'column':
      return 'Column';
    case 'widget':
      return WIDGET_TYPE_LABELS[node.widgetType];
  }
}

function children(node: TreeNode): TreeNode[] {
  return node.type === 'widget' ? [] : (node.children as TreeNode[]);
}

/** A node is a leaf (no children row-toggle) if it's a widget or empty. */
export function isLeaf(node: TreeNode): boolean {
  return children(node).length === 0;
}

/** Whether the node is visible (desktop baseline). Defaults to true. */
export function isVisible(node: TreeNode): boolean {
  return node.styles.desktop.visible !== false;
}

/**
 * Returns the path from the root page down to the node with `id`
 * (inclusive), or null if not found. The last entry is the node itself;
 * everything before it is its ancestor chain, root-first.
 */
export function findNodePath(tree: WidgetTree, id: string): TreeNode[] | null {
  const path: TreeNode[] = [];
  function walk(node: TreeNode): boolean {
    path.push(node);
    if (node.id === id) return true;
    for (const child of children(node)) {
      if (walk(child)) return true;
    }
    path.pop();
    return false;
  }
  return walk(tree.root) ? path : null;
}

/** Convenience: the node itself, or null. */
export function findNode(tree: WidgetTree, id: string): TreeNode | null {
  const path = findNodePath(tree, id);
  return path ? path[path.length - 1]! : null;
}
