/**
 * Global design-token engine (F12).
 *
 * Pure helpers that read/mutate `tree.tokens` (the site-wide color palette
 * and typography scale) and index which widgets reference each token.
 *
 * Why propagation is "free" for colors: codegen emits every color token as
 * a CSS custom property (`--{id}`) and every token reference as
 * `var(--{id})`. So editing a token's *value* re-emits one variable and
 * every referencing widget updates with no per-widget mutation — this is
 * the PRD's "change the accent color across the site" story. Renaming a
 * token *id*, by contrast, must rewrite every `TokenReference.tokenId` so
 * the var name still matches; that rewrite is what `renameTokenId` does.
 *
 * These functions mirror the AI assistant's `set_global_token` tool shape
 * (one token in → whole-tree-consistent tree out) so the panel and the
 * assistant share a single mutation path.
 */
import type {
  ColorToken,
  NodeStyles,
  StyleValue,
  TreeNode,
  TypographyToken,
  WidgetTree,
} from './schema';

// ---------------------------------------------------------------------------
// token references in a node's styles
// ---------------------------------------------------------------------------

/** Style fields whose value can be a token reference (all StyleValue fields). */
function styleValues(styles: Partial<NodeStyles> | undefined): StyleValue[] {
  if (!styles) return [];
  const out: StyleValue[] = [];
  for (const key of Object.keys(styles)) {
    const v = (styles as Record<string, StyleValue | undefined>)[key];
    if (v !== undefined) out.push(v);
  }
  return out;
}

function tokenIdsInNode(node: TreeNode): Set<string> {
  const ids = new Set<string>();
  const layers = [node.styles.desktop, node.styles.tablet, node.styles.mobile];
  for (const layer of layers) {
    for (const v of styleValues(layer)) {
      if (v && typeof v === 'object' && v.type === 'token') ids.add(v.tokenId);
    }
  }
  return ids;
}

function walk(node: TreeNode, visit: (n: TreeNode) => void): void {
  visit(node);
  if (node.type !== 'widget') for (const c of node.children as TreeNode[]) walk(c, visit);
}

export interface TokenUsage {
  /** Number of nodes that reference the token in any breakpoint layer. */
  count: number;
  /** The referencing nodes (for the "used by" list). */
  nodes: TreeNode[];
}

/** Map of tokenId → usage across the whole tree. */
export function tokenUsageIndex(tree: WidgetTree): Record<string, TokenUsage> {
  const index: Record<string, TokenUsage> = {};
  walk(tree.root, (n) => {
    for (const id of tokenIdsInNode(n)) {
      const entry = index[id] ?? (index[id] = { count: 0, nodes: [] });
      entry.count += 1;
      entry.nodes.push(n);
    }
  });
  return index;
}

/** Usage for a single token (empty when unreferenced). */
export function tokenUsage(tree: WidgetTree, tokenId: string): TokenUsage {
  return tokenUsageIndex(tree)[tokenId] ?? { count: 0, nodes: [] };
}

// ---------------------------------------------------------------------------
// mutations — value edits (propagate via CSS var, no reference rewrite)
// ---------------------------------------------------------------------------

/** Set a color token's value. Every referencing widget updates via the var. */
export function setColorTokenValue(tree: WidgetTree, tokenId: string, value: string): WidgetTree {
  const colors = tree.tokens.colors;
  const idx = colors.findIndex((c) => c.id === tokenId);
  if (idx < 0 || colors[idx]!.value === value) return tree;
  const next = colors.slice();
  next[idx] = { ...colors[idx]!, value };
  return { ...tree, tokens: { ...tree.tokens, colors: next } };
}

/** Rename a color token's human-facing name (no reference impact). */
export function setColorTokenName(tree: WidgetTree, tokenId: string, name: string): WidgetTree {
  const colors = tree.tokens.colors;
  const idx = colors.findIndex((c) => c.id === tokenId);
  if (idx < 0 || colors[idx]!.name === name) return tree;
  const next = colors.slice();
  next[idx] = { ...colors[idx]!, name };
  return { ...tree, tokens: { ...tree.tokens, colors: next } };
}

/** Patch a typography token's fields (font family/size/weight/line-height). */
export function setTypographyToken(
  tree: WidgetTree,
  tokenId: string,
  patch: Partial<Omit<TypographyToken, 'id'>>,
): WidgetTree {
  const typo = tree.tokens.typography;
  const idx = typo.findIndex((t) => t.id === tokenId);
  if (idx < 0) return tree;
  const merged = { ...typo[idx]!, ...patch };
  // No-op if nothing actually changed.
  const cur = typo[idx]!;
  if (
    merged.name === cur.name &&
    merged.fontFamily === cur.fontFamily &&
    merged.fontSize === cur.fontSize &&
    merged.fontWeight === cur.fontWeight &&
    merged.lineHeight === cur.lineHeight
  ) {
    return tree;
  }
  const next = typo.slice();
  next[idx] = merged;
  return { ...tree, tokens: { ...tree.tokens, typography: next } };
}

// ---------------------------------------------------------------------------
// mutations — add / remove
// ---------------------------------------------------------------------------

/** Append a new color token with a unique id (does not touch any node). */
export function addColorToken(tree: WidgetTree, token: ColorToken): WidgetTree {
  if (tree.tokens.colors.some((c) => c.id === token.id)) return tree;
  return { ...tree, tokens: { ...tree.tokens, colors: [...tree.tokens.colors, token] } };
}

/**
 * Remove a color token. Any node referencing it has that reference replaced
 * with the token's last resolved literal value, so the visual result is
 * unchanged (the widget keeps its color, just no longer themed).
 */
export function removeColorToken(tree: WidgetTree, tokenId: string): WidgetTree {
  const token = tree.tokens.colors.find((c) => c.id === tokenId);
  if (!token) return tree;

  const rewriteLayer = (layer: Partial<NodeStyles> | undefined): Partial<NodeStyles> | undefined => {
    if (!layer) return layer;
    let changed = false;
    const out = { ...layer } as Record<string, unknown>;
    for (const key of Object.keys(out)) {
      const v = out[key];
      if (v && typeof v === 'object' && (v as { type?: string }).type === 'token' && (v as { tokenId?: string }).tokenId === tokenId) {
        out[key] = token.value;
        changed = true;
      }
    }
    return changed ? (out as Partial<NodeStyles>) : layer;
  };

  const rewriteNode = (node: TreeNode): TreeNode => {
    const desktop = rewriteLayer(node.styles.desktop) as NodeStyles;
    const tablet = rewriteLayer(node.styles.tablet);
    const mobile = rewriteLayer(node.styles.mobile);
    const stylesChanged =
      desktop !== node.styles.desktop ||
      tablet !== node.styles.tablet ||
      mobile !== node.styles.mobile;
    let children = node.type !== 'widget' ? (node.children as TreeNode[]) : null;
    let childrenChanged = false;
    if (children) {
      const mapped = children.map(rewriteNode);
      childrenChanged = mapped.some((c, i) => c !== children![i]);
      children = mapped;
    }
    if (!stylesChanged && !childrenChanged) return node;
    return {
      ...node,
      styles: { ...node.styles, desktop, tablet, mobile },
      ...(children ? { children } : {}),
    } as TreeNode;
  };

  const root = rewriteNode(tree.root) as WidgetTree['root'];
  const colors = tree.tokens.colors.filter((c) => c.id !== tokenId);
  return { ...tree, tokens: { ...tree.tokens, colors }, root };
}
