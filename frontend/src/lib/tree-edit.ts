/**
 * Immutable tree-edit helpers.
 *
 * All functions return a *new* WidgetTree — the original is never mutated.
 * These are the only write paths into the tree, so the undo stack is
 * always consistent.
 *
 * Note on field name: the prompt references `props.text`, but our schema
 * uses `props.content` for TextWidgetProps and HeadingWidgetProps (the
 * `text` field belongs to ButtonWidgetProps). Editing here updates
 * `content`, which is the correct field for text/heading widgets.
 */
import type { TreeNode, WidgetTree, WidgetNode } from './schema';

type EditableWidgetType = 'text' | 'heading';

/** True when this widget's text content can be inline-edited. */
export function isEditable(node: TreeNode): node is WidgetNode & { widgetType: EditableWidgetType } {
  return node.type === 'widget' && (node.widgetType === 'text' || node.widgetType === 'heading');
}

function mapTree(root: TreeNode, id: string, fn: (n: TreeNode) => TreeNode): TreeNode {
  if (root.id === id) return fn(root);
  if (root.type === 'widget') return root;
  const next = (root.children as TreeNode[]).map((child) => mapTree(child, id, fn));
  // Deep-equal check: if nothing changed, return the original node to
  // preserve reference equality and avoid spurious re-renders.
  const changed = next.some((c, i) => c !== (root.children as TreeNode[])[i]);
  if (!changed) return root;
  return { ...root, children: next } as TreeNode;
}

/**
 * Returns a new WidgetTree with the `content` prop of node `id` set to
 * `text`. No-ops (returns the same reference) if the node isn't found
 * or isn't a text/heading widget.
 */
export function setNodeContent(tree: WidgetTree, id: string, text: string): WidgetTree {
  const newRoot = mapTree(tree.root, id, (node) => {
    if (!isEditable(node)) return node;
    const props = { ...(node.props as { content: string }), content: text };
    return { ...node, props };
  });
  if (newRoot === tree.root) return tree;
  return { ...tree, root: newRoot } as WidgetTree;
}

/**
 * Returns a new WidgetTree with node `id`'s desktop `visible` flag set.
 * Setting `true` clears the flag entirely (visible is the default), so
 * the styles object stays clean. No-op if the node isn't found.
 */
export function setNodeVisibility(tree: WidgetTree, id: string, visible: boolean): WidgetTree {
  const newRoot = mapTree(tree.root, id, (node) => {
    const desktop = { ...node.styles.desktop };
    if (visible) {
      if (desktop.visible === undefined) return node; // already visible
      delete desktop.visible;
    } else {
      if (desktop.visible === false) return node; // already hidden
      desktop.visible = false;
    }
    return { ...node, styles: { ...node.styles, desktop } };
  });
  if (newRoot === tree.root) return tree;
  return { ...tree, root: newRoot } as WidgetTree;
}

/**
 * Returns a new WidgetTree with a shallow patch merged into the `props`
 * of widget node `id`. No-op (same reference) if the node isn't a widget
 * or the patch changes nothing. Keys set to `undefined` in the patch are
 * removed from props.
 */
export function setNodeProps(
  tree: WidgetTree,
  id: string,
  patch: Record<string, unknown>,
): WidgetTree {
  const newRoot = mapTree(tree.root, id, (node) => {
    if (node.type !== 'widget') return node;
    const current = node.props as unknown as Record<string, unknown>;
    const next: Record<string, unknown> = { ...current };
    let changed = false;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) {
        if (k in next) {
          delete next[k];
          changed = true;
        }
      } else if (current[k] !== v) {
        next[k] = v;
        changed = true;
      }
    }
    if (!changed) return node;
    return { ...node, props: next as unknown as WidgetNode['props'] } as WidgetNode;
  });
  if (newRoot === tree.root) return tree;
  return { ...tree, root: newRoot } as WidgetTree;
}
