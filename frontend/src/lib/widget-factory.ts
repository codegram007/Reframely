/**
 * Widget palette factory (F11).
 *
 * Pure builders that produce fresh tree subtrees for the "Insert" palette.
 * No React, no store access — callers pass the current tree so new nodes
 * can be pre-styled to match the project (clone an existing same-type
 * widget's desktop styles; fall back to global-token-based defaults).
 *
 * The six "composite" cards (spacer, divider, icon box, form, testimonial,
 * gallery) are realized with EXISTING widget/node types — no schema change
 * — so codegen renders them with no new code. See F11 plan.
 */
import type {
  GlobalTokens,
  NodeMeta,
  NodeStyles,
  NodeType,
  StyleValue,
  TreeNode,
  WidgetNode,
  WidgetTree,
  WidgetType,
} from './schema';

// ---------------------------------------------------------------------------
// ids + meta
// ---------------------------------------------------------------------------

let counter = 0;
/** Unique-enough node id. Runs only on user action, never during render. */
export function newId(prefix = 'w'): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${rand}${counter.toString(36)}`;
}

function meta(): NodeMeta {
  const now = new Date().toISOString();
  return { source: 'manual', createdAt: now, updatedAt: now };
}

// ---------------------------------------------------------------------------
// token + same-type-style resolution
// ---------------------------------------------------------------------------

/** First color token whose id/name hints at a role, else the given fallback.
 *  Always returns a concrete StyleValue so results can be spread into sparse
 *  style objects under exactOptionalPropertyTypes. */
function pickColor(
  tokens: GlobalTokens,
  role: 'accent' | 'ink' | 'muted',
  fallback: StyleValue,
): StyleValue {
  const colors = tokens.colors;
  if (colors.length === 0) return fallback;
  const byHint = (hints: string[]) =>
    colors.find((c) => hints.some((h) => c.id.toLowerCase().includes(h) || c.name.toLowerCase().includes(h)));
  if (role === 'accent') {
    const t = byHint(['accent', 'primary', 'brand']) ?? colors[0]!;
    return { type: 'token', tokenId: t.id };
  }
  if (role === 'ink') {
    const t = byHint(['ink', 'text', 'dark', 'black', 'foreground']) ?? colors[0]!;
    return { type: 'token', tokenId: t.id };
  }
  const t = byHint(['slate', 'muted', 'gray', 'grey', 'subtle']) ?? colors[colors.length - 1]!;
  return { type: 'token', tokenId: t.id };
}

function walk(node: TreeNode, visit: (n: TreeNode) => void): void {
  visit(node);
  if (node.type !== 'widget') for (const c of node.children as TreeNode[]) walk(c, visit);
}

/** Clone of the first same-type widget's desktop styles, or null if none. */
export function sameTypeStyles(tree: WidgetTree, widgetType: WidgetType): Partial<NodeStyles> | null {
  let found: Partial<NodeStyles> | null = null;
  walk(tree.root, (n) => {
    if (found) return;
    if (n.type === 'widget' && n.widgetType === widgetType) {
      found = { ...n.styles.desktop };
    }
  });
  return found;
}

/** Style context handed to every builder. */
export interface StyleContext {
  tokens: GlobalTokens;
  /** Clone of an existing same-type widget's desktop styles, if any. */
  sameType: (widgetType: WidgetType) => Partial<NodeStyles> | null;
}

export function styleContext(tree: WidgetTree): StyleContext {
  return { tokens: tree.tokens, sameType: (wt) => sameTypeStyles(tree, wt) };
}

// ---------------------------------------------------------------------------
// low-level node builders
// ---------------------------------------------------------------------------

function widget(
  widgetType: WidgetType,
  props: WidgetNode['props'],
  desktop: Partial<NodeStyles> = {},
): WidgetNode {
  return {
    id: newId('w'),
    type: 'widget',
    widgetType,
    props,
    meta: meta(),
    styles: { desktop: desktop as NodeStyles },
  };
}

function column(children: TreeNode[], desktop: Partial<NodeStyles> = {}): TreeNode {
  return {
    id: newId('col'),
    type: 'column',
    span: 'auto',
    meta: meta(),
    styles: { desktop: desktop as NodeStyles },
    children: children as never,
  };
}

function row(children: TreeNode[], desktop: Partial<NodeStyles> = {}): TreeNode {
  return {
    id: newId('row'),
    type: 'row',
    meta: meta(),
    styles: { desktop: { display: 'flex', flexDirection: 'row', gap: 24, ...desktop } as NodeStyles },
    children: children as never,
  };
}

/**
 * A self-contained SVG placeholder data URL (same pattern as the sample
 * tree) so gallery/image inserts render with no network dependency. Data
 * URLs are the known image stopgap until the asset-upload backend lands.
 */
function placeholderImage(label: string): string {
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">` +
        `<rect width="600" height="400" fill="#e2e2e8"/>` +
        `<text x="300" y="205" font-family="Inter, sans-serif" font-size="22" font-weight="600" ` +
        `fill="#9aa0ae" text-anchor="middle">${label}</text></svg>`,
    )
  );
}

// ---------------------------------------------------------------------------
// palette builders — primitives
// ---------------------------------------------------------------------------

function buildHeading(ctx: StyleContext): TreeNode {
  const base = ctx.sameType('heading') ?? { fontSize: 32, fontWeight: 700, marginBottom: 12 };
  return widget('heading', { content: 'New heading', level: 2 }, base);
}

function buildText(ctx: StyleContext): TreeNode {
  const base = ctx.sameType('text') ?? { fontSize: 16, color: pickColor(ctx.tokens, 'ink', '#1a1a1a'), marginBottom: 12 };
  return widget('text', { content: 'New paragraph text. Edit me on the canvas.' }, base);
}

function buildImage(ctx: StyleContext): TreeNode {
  const base = ctx.sameType('image') ?? { borderRadius: 8, maxWidth: 600 };
  return widget(
    'image',
    { src: placeholderImage('Image'), alt: 'Placeholder image', width: 600, height: 400 },
    base,
  );
}

function buildButton(ctx: StyleContext): TreeNode {
  const base =
    ctx.sameType('button') ?? {
      display: 'inline-block',
      backgroundColor: pickColor(ctx.tokens, 'accent', '#2563eb'),
      color: '#ffffff',
      paddingTop: 12,
      paddingBottom: 12,
      paddingLeft: 28,
      paddingRight: 28,
      borderRadius: 8,
      fontWeight: 600,
    };
  return widget('button', { text: 'Button', href: '#' }, base);
}

function buildIcon(ctx: StyleContext): TreeNode {
  const base = ctx.sameType('icon') ?? { color: pickColor(ctx.tokens, 'accent', '#2563eb') };
  return widget('icon', { icon: 'lucide:Star', size: 32, ariaLabel: 'Star' }, base);
}

function buildEmbed(): TreeNode {
  return widget('embed', {
    html: '<div style="padding:24px;text-align:center;border:1px dashed #c9cdd8;border-radius:8px">Embed placeholder — paste an embed code in the Content panel.</div>',
    provider: 'other',
  });
}

// ---------------------------------------------------------------------------
// palette builders — composites (existing types only)
// ---------------------------------------------------------------------------

function buildSpacer(): TreeNode {
  return widget('custom-html', { html: '<div aria-hidden="true"></div>' }, { height: 40 });
}

function buildDivider(ctx: StyleContext): TreeNode {
  return widget(
    'custom-html',
    { html: '<hr>' },
    {
      borderTopWidth: 1,
      borderStyle: 'solid',
      borderColor: pickColor(ctx.tokens, 'muted', '#e2e2e8'),
      marginTop: 16,
      marginBottom: 16,
    },
  );
}

/** Icon box: a column of icon + heading + text (a common feature card). */
function buildIconBox(ctx: StyleContext): TreeNode {
  return column(
    [
      widget('icon', { icon: 'lucide:Zap', size: 32, ariaLabel: 'Feature' }, { color: pickColor(ctx.tokens, 'accent', '#2563eb'), marginBottom: 12 }),
      widget('heading', { content: 'Feature title', level: 3 }, { fontSize: 19, fontWeight: 600, marginBottom: 8 }),
      widget('text', { content: 'Short supporting copy describing this feature.' }, { color: pickColor(ctx.tokens, 'muted', '#6b7280') }),
    ],
    { paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24 },
  );
}

/** Testimonial: a column with a quote + attribution, card-styled. */
function buildTestimonial(ctx: StyleContext): TreeNode {
  return column(
    [
      widget('text', { content: '"This product completely changed how our team works."' }, { fontSize: 20, fontStyle: 'italic', marginBottom: 16 }),
      widget('text', { content: '— Alex Rivera, Product Lead' }, { fontSize: 14, color: pickColor(ctx.tokens, 'muted', '#6b7280') }),
    ],
    {
      paddingTop: 32,
      paddingBottom: 32,
      paddingLeft: 32,
      paddingRight: 32,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: '#e2e2e8',
      borderRadius: 12,
    },
  );
}

/** Gallery: a row of three image columns. */
function buildGallery(ctx: StyleContext): TreeNode {
  const imageStyles = ctx.sameType('image') ?? { borderRadius: 8 };
  const cell = (n: number) =>
    column([widget('image', { src: placeholderImage(`Image ${n}`), alt: `Gallery image ${n}`, width: 600, height: 400 }, { ...imageStyles })], {
      flexGrow: 1,
      flexBasis: 0,
    });
  return row([cell(1), cell(2), cell(3)]);
}

/** Form: a minimal contact form as custom-html (backend wiring later). */
function buildForm(ctx: StyleContext): TreeNode {
  const accent = pickColor(ctx.tokens, 'accent', '#6d5efc');
  const accentCss = accent && typeof accent === 'object' ? `var(--${accent.tokenId})` : '#6d5efc';
  return widget('custom-html', {
    html:
      `<form style="display:flex;flex-direction:column;gap:12px;max-width:420px">` +
      `<label style="font-size:14px;font-weight:600">Email` +
      `<input type="email" placeholder="you@example.com" style="display:block;width:100%;margin-top:4px;padding:10px 12px;border:1px solid #c9cdd8;border-radius:8px"></label>` +
      `<button type="submit" style="padding:12px 24px;border-radius:8px;background:${accentCss};color:#fff;font-weight:600">Submit</button>` +
      `</form>`,
    fallbackReason: 'Inserted from widget palette; wire to a backend form handler later.',
  });
}

// ---------------------------------------------------------------------------
// palette definition
// ---------------------------------------------------------------------------

export type PaletteGroup = 'Basic' | 'Media' | 'Composite';

export interface PaletteItem {
  key: string;
  label: string;
  /** lucide icon name (resolved in the palette UI). */
  icon: string;
  group: PaletteGroup;
  /** The tree node type this inserts (drives insertion targeting). */
  nodeType: NodeType;
  build: (ctx: StyleContext) => TreeNode;
}

export const PALETTE: PaletteItem[] = [
  { key: 'heading', label: 'Heading', icon: 'Heading', group: 'Basic', nodeType: 'widget', build: buildHeading },
  { key: 'text', label: 'Text', icon: 'Type', group: 'Basic', nodeType: 'widget', build: buildText },
  { key: 'button', label: 'Button', icon: 'MousePointerClick', group: 'Basic', nodeType: 'widget', build: buildButton },
  { key: 'icon', label: 'Icon', icon: 'Star', group: 'Basic', nodeType: 'widget', build: buildIcon },
  { key: 'spacer', label: 'Spacer', icon: 'MoveVertical', group: 'Basic', nodeType: 'widget', build: buildSpacer },
  { key: 'divider', label: 'Divider', icon: 'Minus', group: 'Basic', nodeType: 'widget', build: buildDivider },
  { key: 'image', label: 'Image', icon: 'Image', group: 'Media', nodeType: 'widget', build: buildImage },
  { key: 'gallery', label: 'Gallery', icon: 'LayoutGrid', group: 'Media', nodeType: 'row', build: buildGallery },
  { key: 'embed', label: 'Embed', icon: 'FileCode2', group: 'Media', nodeType: 'widget', build: buildEmbed },
  { key: 'icon-box', label: 'Icon box', icon: 'SquareStack', group: 'Composite', nodeType: 'column', build: buildIconBox },
  { key: 'testimonial', label: 'Testimonial', icon: 'Quote', group: 'Composite', nodeType: 'column', build: buildTestimonial },
  { key: 'form', label: 'Form', icon: 'TextCursorInput', group: 'Composite', nodeType: 'widget', build: buildForm },
];
