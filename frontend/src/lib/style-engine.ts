/**
 * Style read/write engine for the Style panel.
 *
 * Styles are per-breakpoint: `styles.desktop` is the base (always a full
 * NodeStyles), and `styles.tablet` / `styles.mobile` are sparse override
 * partials. A field's EFFECTIVE value at a breakpoint is:
 *   override-at-breakpoint  ??  desktop-base  ??  undefined
 *
 * "Overridden" means the key is present in the *active* breakpoint's
 * object. Desktop is the base, so its set keys are "set", not overrides.
 */
import type { Breakpoint, NodeStyles, ResponsiveStyles, StyleValue, TreeNode, WidgetTree } from './schema';

export type StyleKey = keyof NodeStyles;

/** The style object for a breakpoint (may be undefined for tablet/mobile). */
function layer(styles: ResponsiveStyles, bp: Breakpoint): Partial<NodeStyles> | undefined {
  return bp === 'desktop' ? styles.desktop : styles[bp];
}

/** The raw value explicitly set at this breakpoint (no inheritance), if any. */
export function rawValue(node: TreeNode, bp: Breakpoint, key: StyleKey): StyleValue | boolean | undefined {
  return layer(node.styles, bp)?.[key];
}

/**
 * The effective value at a breakpoint: the override if present, else the
 * desktop base. `undefined` when neither is set.
 */
export function effectiveValue(
  node: TreeNode,
  bp: Breakpoint,
  key: StyleKey,
): StyleValue | boolean | undefined {
  const own = layer(node.styles, bp)?.[key];
  if (own !== undefined) return own;
  return node.styles.desktop[key];
}

/**
 * Whether `key` is explicitly overridden at this breakpoint. Always
 * false for desktop (it's the base, not an override layer).
 */
export function isOverridden(node: TreeNode, bp: Breakpoint, key: StyleKey): boolean {
  if (bp === 'desktop') return false;
  return layer(node.styles, bp)?.[key] !== undefined;
}

/**
 * Whether the effective value comes from the desktop base rather than an
 * override at this breakpoint (i.e. "inherited" from desktop). Desktop
 * itself is never "inherited".
 */
export function isInherited(node: TreeNode, bp: Breakpoint, key: StyleKey): boolean {
  if (bp === 'desktop') return false;
  const own = layer(node.styles, bp)?.[key];
  return own === undefined && node.styles.desktop[key] !== undefined;
}

function withLayer(
  styles: ResponsiveStyles,
  bp: Breakpoint,
  nextLayer: Partial<NodeStyles>,
): ResponsiveStyles {
  if (bp === 'desktop') return { ...styles, desktop: nextLayer as NodeStyles };
  // Drop the breakpoint key entirely when its override object is empty.
  if (Object.keys(nextLayer).length === 0) {
    const copy = { ...styles };
    delete copy[bp];
    return copy;
  }
  return { ...styles, [bp]: nextLayer };
}

/**
 * Returns node styles with `key` set to `value` at `bp`. Passing
 * `undefined` clears the entry: on desktop it removes the base value; on
 * tablet/mobile it removes the override (reverting to the inherited
 * desktop value). Reference-stable when nothing changes.
 */
export function setStyleValue(
  styles: ResponsiveStyles,
  bp: Breakpoint,
  key: StyleKey,
  value: StyleValue | boolean | undefined,
): ResponsiveStyles {
  const current = layer(styles, bp) ?? {};
  const existing = current[key];
  if (existing === value) return styles;

  const next: Partial<NodeStyles> = { ...current };
  if (value === undefined) {
    if (!(key in next)) return styles;
    delete next[key];
  } else {
    (next as Record<string, unknown>)[key] = value;
  }
  return withLayer(styles, bp, next);
}

/**
 * Whether the node has ANY explicit override at this breakpoint. Always
 * false for desktop (the base layer). Used to badge nodes on canvas that
 * carry breakpoint-specific styles.
 */
export function hasOverrides(node: TreeNode, bp: Breakpoint): boolean {
  if (bp === 'desktop') return false;
  const l = layer(node.styles, bp);
  return l !== undefined && Object.keys(l).length > 0;
}

// ---------------------------------------------------------------------------
// Tree-level write path
// ---------------------------------------------------------------------------

function mapNode(root: TreeNode, id: string, fn: (n: TreeNode) => TreeNode): TreeNode {
  if (root.id === id) return fn(root);
  if (root.type === 'widget') return root;
  const kids = root.children as TreeNode[];
  const next = kids.map((child) => mapNode(child, id, fn));
  const changed = next.some((c, i) => c !== kids[i]);
  return changed ? ({ ...root, children: next } as TreeNode) : root;
}

/**
 * Returns a new WidgetTree with node `id`'s style `key` set to `value`
 * at breakpoint `bp` (undefined clears it). Reference-stable no-op when
 * nothing changes.
 */
export function setNodeStyle(
  tree: WidgetTree,
  id: string,
  bp: Breakpoint,
  key: StyleKey,
  value: StyleValue | boolean | undefined,
): WidgetTree {
  const newRoot = mapNode(tree.root, id, (node) => {
    const nextStyles = setStyleValue(node.styles, bp, key, value);
    if (nextStyles === node.styles) return node;
    return { ...node, styles: nextStyles };
  });
  if (newRoot === tree.root) return tree;
  return { ...tree, root: newRoot as WidgetTree['root'] };
}
